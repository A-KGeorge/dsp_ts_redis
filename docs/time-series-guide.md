# Time-Series Processing Guide

## Overview

The DSP library supports **time-series processing** with explicit timestamps, enabling:

- ✅ Explicit timestamp tracking for sample metadata
- ✅ Intuitive time-based window specification (via `windowDuration`)
- ✅ **True time-based sample expiration** - samples expire by actual age, not just count
- ✅ Proper state persistence with timestamps
- ✅ Uniform and irregular sampling data processing
- ✅ 100% backwards compatibility with sample-based API

---

## Quick Start

### Legacy Sample-Based (Still Works!)

```typescript
import { createDspPipeline } from "dsp-ts-redis";

const pipeline = createDspPipeline();
pipeline.MovingAverage({ mode: "moving", windowSize: 100 });

const samples = new Float32Array(1000);
// ... fill with sensor data ...

await pipeline.process(samples, {
  sampleRate: 100, // 100 Hz
  channels: 1,
});
```

### New Time-Based Processing

```typescript
import { createDspPipeline } from "dsp-ts-redis";

const pipeline = createDspPipeline();
// Use time-based window instead of sample count
pipeline.MovingAverage({ mode: "moving", windowDuration: 5000 }); // 5 seconds

const samples = new Float32Array([1.2, 3.4, 2.1, 4.5, 3.3]);
const timestamps = new Float32Array([0, 100, 250, 400, 500]); // milliseconds

await pipeline.process(samples, timestamps, { channels: 1 });
```

---

## Three Processing Modes

### 1. Legacy Mode (Auto-Generated Timestamps from Sample Rate)

**Best for:** Uniform sampling, backwards compatibility

```typescript
const pipeline = createDspPipeline();
pipeline.MovingAverage({ mode: "moving", windowSize: 50 });

await pipeline.process(samples, {
  sampleRate: 100, // 100 Hz = 10ms per sample
  channels: 1,
});
// Internally generates timestamps: [0, 10, 20, 30, ...]
```

### 2. Time-Based Mode (Explicit Timestamps)

**Best for:** Tracking sample timing, time-based window specification

```typescript
const pipeline = createDspPipeline();
pipeline.MovingAverage({ mode: "moving", windowDuration: 5000 }); // 5 seconds (converted to sample count)

// Real timestamps from your sensors/network
const timestamps = new Float32Array([
  1698889200000, // Unix timestamp in ms
  1698889200150,
  1698889200320,
  1698889200500,
]);

await pipeline.process(samples, timestamps, { channels: 1 });
```

### 3. Auto-Sequential Mode (No Sample Rate)

**Best for:** Sample-count based processing without time awareness

```typescript
const pipeline = createDspPipeline();
pipeline.MovingAverage({ mode: "moving", windowSize: 10 });

await pipeline.process(samples, { channels: 1 });
// Internally generates timestamps: [0, 1, 2, 3, ...]
```

---

## Window Parameters: windowSize vs windowDuration

### windowSize (Legacy - Sample Count)

```typescript
pipeline.MovingAverage({
  mode: "moving",
  windowSize: 100, // Last 100 samples
});
```

**Pros:**

- Predictable memory usage
- Consistent across sample rates
- Faster (no timestamp checks)

**Cons:**

- Not intuitive for time-based analysis
- ~~Breaks with irregular sampling~~
- Requires manual sample rate calculations

### windowDuration (Time-Based Expiration)

```typescript
pipeline.MovingAverage({
  mode: "moving",
  windowDuration: 5000, // Last 5 seconds of data (true time-based)
});
```

**Pros:**

- **True time-based expiration** - samples automatically expire when they're older than the window duration
- Intuitive ("5 seconds of data")
- Works correctly with irregular sampling (samples expire by age, not count)
- Independent of sample rate
- Accurate representation of data within the time window

**Cons:**

- Requires timestamps to be provided
- Slightly more memory overhead (stores timestamps alongside samples)
- Requires buffer size estimation at initialization (uses 3x safety factor)

**Implementation:**

When `windowDuration` is specified, the library implements **true time-based expiration**:

1. A circular buffer is created with capacity = 3× estimated sample count (safety margin)
2. Each sample is stored with its timestamp
3. Before adding new samples, old samples are expired using `expireOld(currentTimestamp)`
4. Samples are removed when: `sample_timestamp < current_timestamp - windowDuration`

**Example - Irregular Sampling:**

```typescript
pipeline.MovingAverage({ mode: "moving", windowDuration: 1000 }); // 1 second window

// Samples arrive at irregular intervals
const samples = new Float32Array([10, 20, 30, 40]);
const timestamps = new Float32Array([
  0, // Sample at 0ms
  50, // Sample at 50ms
  600, // Sample at 600ms (550ms gap!)
  650, // Sample at 650ms
]);

await pipeline.process(samples, timestamps, { channels: 1 });

// At 650ms:
//   - Sample at 0ms is EXPIRED (650 - 0 = 650ms > 1000ms window) ❌
//   - Sample at 50ms is EXPIRED (650 - 50 = 600ms > 1000ms window) ❌
//   - Sample at 600ms is KEPT (650 - 600 = 50ms < 1000ms) ✓
//   - Sample at 650ms is KEPT (current sample) ✓
// Result: Moving average of [30, 40] = 35
```

This is fundamentally different from sample-count windows, where exactly N samples would be kept regardless of their timestamps.

**Buffer Size Estimation:**

The circular buffer capacity is estimated as `3 × (windowDuration_ms / 1000) × estimated_sample_rate`:

```typescript
// Example: 5 second window at 100 Hz
// windowDuration = 5000ms
// sample_rate = 100 Hz
// capacity = 3 × (5000 / 1000) × 100 = 1500 samples

// Why 3x?
// - Handles bursts (multiple samples arriving together)
// - Safety margin for sample rate variations
// - Prevents buffer overflow before expiration
```

**Important:** True time-based expiration means the number of samples in the window varies dynamically based on sample timing, not a fixed count.

---

## All Filters Support Time-Series

All filters support both `windowSize` and `windowDuration`:

### MovingAverage ✅ Time-based expiration

```typescript
// Sample-based
pipeline.MovingAverage({ mode: "moving", windowSize: 50 });

// Time-based (true time-based expiration)
pipeline.MovingAverage({ mode: "moving", windowDuration: 10000 }); // 10 seconds
```

### RMS (Root Mean Square) ✅ Time-based expiration

```typescript
// Time-based RMS over last 100ms
pipeline.Rms({ mode: "moving", windowDuration: 100 });
```

### MeanAbsoluteValue ✅ Time-based expiration

```typescript
// Time-based MAV over last 250ms
pipeline.MeanAbsoluteValue({ mode: "moving", windowDuration: 250 });
```

### Variance ✅ Time-based expiration

```typescript
// Time-based Variance over last 3 seconds (true time-based expiration)
pipeline.Variance({ mode: "moving", windowDuration: 3000 });
```

### Z-Score Normalization ✅ Time-based expiration

```typescript
// Time-based Z-Score over last 30 seconds (true time-based expiration)
pipeline.ZScoreNormalize({
  mode: "moving",
  windowDuration: 30000,
  epsilon: 1e-6,
});
```

---

## Multi-Channel Processing with Timestamps

```typescript
const pipeline = createDspPipeline();
pipeline.MovingAverage({ mode: "moving", windowDuration: 5000 });

// 2 channels, interleaved: [ch0_sample0, ch1_sample0, ch0_sample1, ch1_sample1, ...]
const samples = new Float32Array([
  1.0,
  10.0, // Sample 0: ch0=1.0, ch1=10.0
  2.0,
  20.0, // Sample 1: ch0=2.0, ch1=20.0
  3.0,
  30.0, // Sample 2: ch0=3.0, ch1=30.0
]);

// One timestamp per SAMPLE (not per channel value)
const timestamps = new Float32Array([0, 100, 200]);

await pipeline.process(samples, timestamps, { channels: 2 });
```

**Important:** The timestamps array length should equal `samples.length / channels`.

---

## Real-World Examples

### IoT Sensor with Network Jitter

```typescript
import { createDspPipeline } from "dsp-ts-redis";

const pipeline = createDspPipeline();
pipeline.MovingAverage({ mode: "moving", windowDuration: 10000 }); // 10 second window

async function processSensorData(sensorReadings) {
  const samples = new Float32Array(sensorReadings.length);
  const timestamps = new Float32Array(sensorReadings.length);

  sensorReadings.forEach((reading, i) => {
    samples[i] = reading.value;
    timestamps[i] = reading.timestamp; // Unix timestamp in ms
  });

  const smoothed = await pipeline.process(samples, timestamps, { channels: 1 });
  return smoothed;
}

// Readings might arrive at irregular intervals due to network latency
const readings = [
  { value: 23.5, timestamp: 1698889200000 },
  { value: 24.1, timestamp: 1698889200150 }, // 150ms later
  { value: 23.8, timestamp: 1698889200380 }, // 230ms later (jitter)
  { value: 24.5, timestamp: 1698889200500 }, // 120ms later
];

const result = await processSensorData(readings);
```

### Financial Data (Irregular Market Hours)

```typescript
const pipeline = createDspPipeline();
pipeline.MovingAverage({ mode: "moving", windowDuration: 3600000 }); // 1 hour

// Stock ticks at irregular intervals
const prices = new Float32Array([100.5, 100.7, 100.3, 101.2, 100.9]);
const tickTimestamps = new Float32Array([
  1698889200000, // 9:00:00 AM
  1698889260000, // 9:01:00 AM
  1698889290000, // 9:01:30 AM (30 sec later)
  1698889320000, // 9:02:00 AM
  1698889500000, // 9:05:00 AM (3 min gap)
]);

const movingAvg = await pipeline.process(prices, tickTimestamps, {
  channels: 1,
});
```

### EMG/ECG Signal Processing

```typescript
const pipeline = createDspPipeline();
pipeline
  .Rectify({ mode: "full" })
  .MovingAverage({ mode: "moving", windowDuration: 250 }) // 250ms window
  .Rms({ mode: "moving", windowDuration: 100 }); // 100ms RMS

// High-rate biosignal sampling
const emgSignal = new Float32Array(1000);
const timestamps = new Float32Array(1000);

// Fill with actual sensor data at ~1000 Hz
for (let i = 0; i < 1000; i++) {
  emgSignal[i] = Math.sin(i * 0.1) + Math.random() * 0.1;
  timestamps[i] = i; // 1ms per sample
}

const processed = await pipeline.process(emgSignal, timestamps, {
  channels: 1,
});
```

---

## State Persistence with Redis

Time-series processing works seamlessly with Redis state persistence:

```typescript
import { createDspPipeline } from "dsp-ts-redis";
import { createClient } from "redis";

const redis = createClient();
await redis.connect();

const pipeline = createDspPipeline();
pipeline.MovingAverage({ mode: "moving", windowDuration: 5000 });

// Process streaming data
async function processChunk(samples, timestamps) {
  // Restore previous state
  const savedState = await redis.get("dsp:sensor:123");
  if (savedState) {
    await pipeline.loadState(savedState);
  }

  // Process new chunk
  const result = await pipeline.process(samples, timestamps, { channels: 1 });

  // Save state for next chunk
  const newState = await pipeline.saveState();
  await redis.set("dsp:sensor:123", newState, { EX: 3600 }); // 1 hour TTL

  return result;
}
```

---

## Migration Guide

### Migrating from Sample-Based to Time-Based

#### Before (Sample-Based)

```typescript
const pipeline = createDspPipeline();
pipeline.MovingAverage({ mode: "moving", windowSize: 100 }); // 100 samples

await pipeline.process(samples, {
  sampleRate: 1000, // 1000 Hz
  channels: 1,
});
```

#### After (Time-Based)

```typescript
const pipeline = createDspPipeline();
// 100 samples at 1000 Hz = 100ms window
pipeline.MovingAverage({ mode: "moving", windowDuration: 100 }); // 100ms

// Generate timestamps from your data source
const timestamps = samples.map((_, i) => i * (1000 / 1000)); // 1ms per sample

await pipeline.process(samples, timestamps, { channels: 1 });
```

### Converting Window Size to Duration

If you know your sample rate, convert `windowSize` to `windowDuration`:

```
windowDuration (ms) = (windowSize / sampleRate) * 1000

Example:
  windowSize = 500 samples
  sampleRate = 100 Hz
  windowDuration = (500 / 100) * 1000 = 5000 ms (5 seconds)
```

---

## Performance Considerations

### Memory Usage

- **Sample-based windows:** Fixed memory (`windowSize` samples)
- **Time-based windows:** Fixed memory (converted to `windowSize` samples at initialization)

### Processing Speed

- **With timestamps:** Minimal overhead (timestamps are passed but not used for expiration)
- **Without timestamps:** Fastest (legacy mode)

**Recommendation:** Use `windowDuration` when you want to specify windows in time units and have consistent sample rates. Use `windowSize` for maximum control and when sample rate varies significantly.

---

## Error Handling

### Timestamp Validation

```typescript
// Error: Timestamp array length mismatch
const samples = new Float32Array(5);
const timestamps = new Float32Array(3); // Wrong!

await pipeline.process(samples, timestamps, { channels: 1 });
// Throws: "Timestamps length (3) must match samples length (5)"
```

### Window Parameter Validation

```typescript
// Error: Neither windowSize nor windowDuration specified
pipeline.MovingAverage({ mode: "moving" }); // Throws!

// Error: Invalid windowDuration
pipeline.MovingAverage({ mode: "moving", windowDuration: -100 }); // Throws!

// Error: Invalid windowSize
pipeline.MovingAverage({ mode: "moving", windowSize: 0 }); // Throws!
```

---

## API Reference

### Process Methods

#### `process(samples, timestamps, options)`

Time-based processing with explicit timestamps.

```typescript
async process(
  samples: Float32Array,
  timestamps: Float32Array,
  options: { channels: number }
): Promise<Float32Array>
```

#### `process(samples, options)`

Legacy sample-based processing (auto-generates timestamps).

```typescript
async process(
  samples: Float32Array,
  options: { sampleRate?: number; channels: number }
): Promise<Float32Array>
```

#### `processCopy(samples, timestamps, options)`

Process a copy (preserves original).

```typescript
async processCopy(
  samples: Float32Array,
  timestamps: Float32Array,
  options: { channels: number }
): Promise<Float32Array>
```

### Filter Parameters

All filters accept either `windowSize` or `windowDuration`:

```typescript
interface FilterParams {
  mode: "batch" | "moving";
  windowSize?: number; // Number of samples
  windowDuration?: number; // Milliseconds
}
```

---

## Best Practices

### ✅ DO

- Use `windowDuration` for true time-based windows that adapt to irregular sampling
- Pass explicit timestamps to enable time-based expiration
- Use `windowSize` for fixed sample-count windows (faster, no timestamp overhead)
- Validate timestamp ordering (should be non-decreasing) when using timestamps
- Use state persistence for streaming applications
- Provide sufficient buffer capacity when using both `windowSize` and `windowDuration`

### ❌ DON'T

- Forget to provide timestamps when using `windowDuration` (required for time-based expiration)
- Expect `windowSize` alone to give time-based behavior (it only controls sample count)
- Assume time-based windows always contain the same number of samples (they adapt dynamically)
- Forget to handle timezone conversions when using absolute timestamps
- Process data with backwards-jumping timestamps (non-monotonic time)

---

## Troubleshooting

### Q: My time-based windows aren't working as expected

**A:** Time-based windows now implement true time-based expiration! Samples are automatically removed when they're older than `windowDuration` from the current timestamp. Make sure you're providing timestamps with each `process()` call. The number of samples in the window will vary dynamically based on your sampling rate and timing.

### Q: How does time-based expiration handle irregular sampling?

**A:** Time-based expiration works correctly with irregular sampling. Samples expire based on their actual age (timestamp difference), not their position in the buffer. For example, with a 1-second window:

- A burst of samples arriving within 100ms will all be kept
- A sample from 1.5 seconds ago will be expired
- The window always contains samples from the last `windowDuration` milliseconds

### Q: What's the difference between windowSize and windowDuration?

**A:**

- **windowSize**: Keeps exactly N samples (fixed count, regardless of time span)
- **windowDuration**: Keeps samples from the last T milliseconds (variable count, based on timing)

Use `windowSize` when you want a fixed number of samples. Use `windowDuration` when you want a fixed time span.

### Q: Should I use milliseconds or seconds for timestamps?

**A:** Use **milliseconds** for consistency with JavaScript `Date.now()` and Unix timestamps. The library expects milliseconds.

### Q: Can I use both windowSize and windowDuration?

**A:** Yes! When both are specified, the filter uses time-based expiration (`windowDuration`) but also allocates a buffer sized for `windowSize` samples. This gives you control over both the time window and memory usage. However, typically you'd use one or the other:

- Use `windowSize` alone for sample-count windows
- Use `windowDuration` alone for true time-based windows (buffer size auto-estimated)

### Q: What happens if I don't provide timestamps?

**A:** The library auto-generates sequential timestamps `[0, 1, 2, ...]`. If you provide `sampleRate`, it generates time-based timestamps.

---

## Future Enhancements (Roadmap)

- [x] **True time-based filtering** - ✅ FULLY IMPLEMENTED for all moving window filters!
  - MovingAverage, RMS, MeanAbsoluteValue, Variance, and ZScoreNormalize all support true time-based expiration
- [ ] **Polyphase decimation/interpolation** - High-quality resampling to uniform intervals
  - Anti-aliasing lowpass filter before decimation
  - Polyphase FIR filter banks for efficient computation
  - Support for arbitrary rational resampling ratios (L/M)
- [ ] **Timestamp interpolation** - Fill gaps in irregular data with linear/spline interpolation
- [ ] **Timestamp-aware state format** - Include timestamps in serialized state
- [ ] **Window overlap control** - For advanced signal analysis (STFT, spectrograms)

---

## Need Help?

- **GitHub Issues:** [Report bugs or request features](https://github.com/A-KGeorge/dsp-ts-redis/issues)
- **Documentation:** Check `docs/` folder for additional guides
- **Examples:** See `src/ts/examples/` for working code samples

---

**Happy time-series processing! 📈**
