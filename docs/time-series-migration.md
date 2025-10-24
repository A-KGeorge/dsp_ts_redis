# Time-Series Migration Plan

**Goal:** Transform dsp-ts-redis from a sample-based processor to a time-aware time-series processor.

---

## Architecture Decision

### Current (Sample-Based)

```typescript
// User provides raw samples, library assumes fixed intervals
pipeline.process(new Float32Array([1, 2, 3, 4, 5]), {
  sampleRate: 100, // Assumes 100Hz = 10ms intervals
  channels: 1,
});
```

**Problems:**

- ❌ Breaks with irregular data (network jitter, sensor lag)
- ❌ Window size in "samples" is unintuitive (500 samples ≠ 5 seconds without mental math)
- ❌ Fragile to sample rate changes
- ❌ Redis persistence lacks context (what _time_ is this sample from?)

### Proposed (Time-Based)

```typescript
// Option 1: Parallel timestamps array
pipeline.process(
  new Float32Array([1, 2, 3, 4, 5]),
  new Float32Array([1000, 1010, 1020, 1030, 1040]), // millisecond timestamps
  { channels: 1 }
);

// Option 2: Interleaved (value, timestamp) pairs
pipeline.process(
  new Float32Array([1, 1000, 2, 1010, 3, 1020, 4, 1030, 5, 1040]),
  { format: "interleaved", channels: 1 }
);

// Option 3: Fall back to sample-based for backwards compatibility
pipeline.process(
  new Float32Array([1, 2, 3, 4, 5]),
  { sampleRate: 100, channels: 1 } // Old API still works
);
```

**Benefits:**

- ✅ Handles irregular data correctly
- ✅ Intuitive windowing: `windowDuration: 5000` = 5 seconds (regardless of sample rate)
- ✅ Robust to sample rate changes
- ✅ Redis persistence has full context
- ✅ Backwards compatible (sampleRate-based still works)

---

## Implementation Phases

### Phase 1: TypeScript API Changes

#### 1.1 Update `ProcessOptions`

```typescript
export interface ProcessOptions {
  // Legacy sample-based mode (backwards compatible)
  sampleRate?: number;
  channels?: number;

  // New time-based mode (mutually exclusive with sampleRate)
  // If omitted, assumes millisecond increments: [0, 1, 2, 3, ...]
}
```

#### 1.2 Update Filter Parameters

```typescript
// Current
export interface MovingAverageParams {
  mode: "batch" | "moving";
  windowSize?: number; // in samples
}

// New (backwards compatible)
export interface MovingAverageParams {
  mode: "batch" | "moving";

  // Option 1: Sample-based (legacy)
  windowSize?: number; // in samples (requires sampleRate in process())

  // Option 2: Time-based (preferred)
  windowDuration?: number; // in milliseconds
}
```

#### 1.3 New `process()` Signatures

```typescript
class DspProcessor {
  // Legacy: Sample-based (backwards compatible)
  process(
    samples: Float32Array,
    options: { sampleRate: number; channels?: number }
  ): Promise<Float32Array>;

  // New: Time-based with parallel arrays
  process(
    samples: Float32Array,
    timestamps: Float32Array,
    options: { channels?: number }
  ): Promise<Float32Array>;

  // Auto-generate timestamps if missing
  process(
    samples: Float32Array,
    options: { channels?: number }
  ): Promise<Float32Array>; // timestamps = [0, 1, 2, ...]
}
```

---

### Phase 2: C++ Core Changes

#### 2.1 Update `SlidingWindowFilter` to Store Time

```cpp
// Current: Stores only values
template <typename T, typename Policy>
class SlidingWindowFilter {
    CircularBuffer<T> m_buffer;  // [v1, v2, v3, ...]
    Policy m_policy;
    size_t m_windowSize;  // Number of samples
};

// New: Stores (time, value) pairs
template <typename T, typename Policy>
class SlidingWindowFilter {
    std::deque<std::pair<uint64_t, T>> m_buffer;  // [(t1,v1), (t2,v2), ...]
    Policy m_policy;
    uint64_t m_windowDuration;  // Duration in milliseconds

    void add(T value, uint64_t timestamp) {
        // Add new sample
        m_buffer.push_back({timestamp, value});
        m_policy.onAdd(value);

        // Remove expired samples
        while (!m_buffer.empty() &&
               timestamp - m_buffer.front().first > m_windowDuration) {
            T expired = m_buffer.front().second;
            m_buffer.pop_front();
            m_policy.onRemove(expired);
        }
    }
};
```

#### 2.2 Update All Filters

- `MovingAverageFilter` - Time-based window
- `RmsFilter` - Time-based window
- `MovingAbsoluteValueFilter` - Time-based window
- `MovingVarianceFilter` - Time-based window
- `MovingZScoreFilter` - Time-based window

#### 2.3 Update N-API Bindings

```cpp
// DspPipeline::ProcessAsync needs to accept optional timestamps
Napi::Value DspPipeline::Process(const Napi::CallbackInfo& info) {
    Napi::Float32Array samples = info[0].As<Napi::Float32Array>();

    // Check if second arg is timestamps or options
    Napi::Float32Array timestamps;
    if (info[1].IsTypedArray()) {
        timestamps = info[1].As<Napi::Float32Array>();
        // options is info[2]
    } else {
        // Legacy mode: auto-generate timestamps
        // options is info[1]
    }
}
```

---

### Phase 3: State Serialization Updates

#### 3.1 JSON Format Changes

```json
{
  "timestamp": 1678886400000,
  "stages": [
    {
      "index": 0,
      "type": "movingAverage",
      "state": {
        "windowDuration": 5000, // NEW: milliseconds instead of sample count
        "numChannels": 1,
        "channels": [
          {
            "buffer": [
              { "time": 1678886395000, "value": 3.0 },
              { "time": 1678886396000, "value": 4.0 },
              { "time": 1678886397000, "value": 5.0 }
            ],
            "runningSum": 12.0
          }
        ]
      }
    }
  ]
}
```

---

### Phase 4: Migration Strategy (Backwards Compatibility)

#### 4.1 Detection Logic

```typescript
// In DspProcessor.process()
if (options.sampleRate) {
  // Legacy sample-based mode
  // Convert sampleRate to timestamps internally
  const dt = 1000 / options.sampleRate; // milliseconds per sample
  const timestamps = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    timestamps[i] = i * dt;
  }
  return this.processWithTime(samples, timestamps, options);
} else {
  // New time-based mode
  return this.processWithTime(samples, timestamps, options);
}
```

#### 4.2 Filter Configuration Migration

```typescript
// Auto-convert windowSize to windowDuration
if (params.windowSize && options.sampleRate) {
  const windowDuration = (params.windowSize / options.sampleRate) * 1000;
  // Use windowDuration internally
}
```

---

## Testing Strategy

### 5.1 Backwards Compatibility Tests

- ✅ All existing tests should pass unchanged
- ✅ Legacy `windowSize` with `sampleRate` produces same results

### 5.2 New Time-Based Tests

- ✅ Irregular timestamps handled correctly
- ✅ Variable sample rates work
- ✅ Window duration matches expected time span
- ✅ State serialization includes timestamps

### 5.3 Performance Tests

- ✅ `std::deque` performance vs `CircularBuffer`
- ✅ Memory usage with time storage
- ✅ Throughput comparison (sample-based vs time-based)

---

## Documentation Updates

### 6.1 README Changes

```typescript
// Highlight time-based API
const pipeline = createDspPipeline();
pipeline.MovingAverage({ windowDuration: 5000 }); // 5 seconds

// Show irregular data handling
const samples = new Float32Array([1.2, 1.5, 1.8]);
const timestamps = new Float32Array([0, 100, 250]); // Irregular gaps
await pipeline.process(samples, timestamps, { channels: 1 });
```

### 6.2 Migration Guide

Create `docs/migration-to-time-series.md` with:

- Why time-based is better
- How to migrate existing code
- Performance implications
- Backwards compatibility guarantees

---

## Implementation Timeline

### Week 1: TypeScript Layer

- [ ] Update `types.ts` with new interfaces
- [ ] Update `bindings.ts` with new `process()` signatures
- [ ] Add detection logic for legacy vs new mode
- [ ] Add backwards compatibility tests

### Week 2: C++ Core (Simple Filters)

- [ ] Update `SlidingWindowFilter` to use `std::deque<pair<time, value>>`
- [ ] Update `MovingAverageFilter` to time-based windowing
- [ ] Update `RmsFilter` to time-based windowing
- [ ] Add C++ unit tests

### Week 3: C++ Core (Complex Filters)

- [ ] Update `MovingVarianceFilter`
- [ ] Update `MovingZScoreFilter`
- [ ] Update `MovingAbsoluteValueFilter`
- [ ] Update N-API bindings

### Week 4: State & Documentation

- [ ] Update state serialization format
- [ ] Add migration for old state format
- [ ] Update all documentation
- [ ] Create migration guide
- [ ] Performance benchmarks

---

## Open Questions

1. **Timestamp Units**: Milliseconds (standard) or allow user-defined?
2. **Timestamp Type**: `uint64_t` (C++) vs `number` (JS) precision?
3. **Memory Trade-off**: `std::deque` vs custom circular buffer with time?
4. **Multi-channel Time**: One timestamp per sample or per channel?
5. **Batch vs Moving**: Should batch mode also support time?

---

## Risk Mitigation

### Breaking Changes

- **Risk**: Changing C++ core may break existing code
- **Mitigation**: Full backwards compatibility via auto-conversion

### Performance Regression

- **Risk**: `std::deque` slower than `CircularBuffer`
- **Mitigation**: Benchmark and optimize; consider custom time-aware circular buffer

### State Migration

- **Risk**: Old Redis states won't load
- **Mitigation**: Add state version field and auto-upgrade logic

---

## Success Criteria

✅ All existing tests pass without modification
✅ New time-based API works with irregular data
✅ Redis state includes timestamps
✅ Documentation updated with examples
✅ Performance within 10% of current implementation
✅ Migration guide published

---

**Status**: 📋 Planning Phase
**Next Action**: Implement TypeScript API changes (Phase 1)
