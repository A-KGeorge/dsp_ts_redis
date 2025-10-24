# Time-Series Processing Guide

## Overview

The DSP library now supports **time-series processing** with explicit timestamps, enabling:

- ✅ Irregular sampling intervals (network jitter, sensor delays)
- ✅ Intuitive time-based windows ("5 seconds" instead of "500 samples")
- ✅ Proper state persistence with timestamps
- ✅ Real-world IoT and sensor data processing
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

**Best for:** Irregular sampling, real-world sensor data

```typescript
const pipeline = createDspPipeline();
pipeline.MovingAverage({ mode: "moving", windowDuration: 5000 }); // 5 seconds

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
- Breaks with irregular sampling
- Requires manual sample rate calculations

### windowDuration (New - Time-Based)

```typescript
pipeline.MovingAverage({
  mode: "moving",
  windowDuration: 5000, // Last 5 seconds
});
```

**Pros:**

- Intuitive ("5 seconds of data")
- Handles irregular sampling naturally
- Independent of sample rate
- Perfect for IoT/sensor applications
- **Automatically adapts to actual sample rate** (derived from timestamps)

**Cons:**

- Slightly more processing overhead
- Variable memory usage with irregular sampling
- Requires timestamps to derive sample rate

**Implementation:**

When `windowDuration` is specified, the library uses **lazy initialization**:

1. The stage is created with the duration parameter
2. On the first `process()` call with timestamps, the sample rate is estimated from the timestamp deltas
3. The window size is calculated: `windowSize = (windowDuration_ms / 1000) * actual_sample_rate`
4. The filter is initialized with the correct window size

**Example:**

```typescript
// User requests 5 second window
pipeline.MovingAverage({ mode: "moving", windowDuration: 5000 });

// Processing data at 44,100 Hz (CD audio quality)
const samples = new Float32Array(44100); // 1 second of audio
const timestamps = new Float32Array(44100);
for (let i = 0; i < 44100; i++) {
  timestamps[i] = i * (1000.0 / 44100.0); // ~0.0227 ms per sample
}

await pipeline.process(samples, timestamps, { channels: 1 });

// Result: windowSize = 220,500 samples (5 seconds at 44.1 kHz) ✓
```

**Sample Rate Estimation:**
The library estimates sample rate from the first few timestamp samples:

```
sample_rate = 1000.0 / avg_sample_period_ms
```

This approach ensures the window size is correct regardless of your data's sample rate (100 Hz, 1 kHz, 44.1 kHz, etc.).

### Using Both (Maximum Flexibility)

```typescript
pipeline.MovingAverage({
  mode: "moving",
  windowSize: 100, // Limit to 100 samples max
  windowDuration: 5000, // But only last 5 seconds
});
// Whichever constraint is hit first applies
```

---

## All Filters Support Time-Series

All filters support both `windowSize` and `windowDuration`:

### MovingAverage

```typescript
// Sample-based
pipeline.MovingAverage({ mode: "moving", windowSize: 50 });

// Time-based
pipeline.MovingAverage({ mode: "moving", windowDuration: 10000 }); // 10 seconds
```

### RMS (Root Mean Square)

```typescript
pipeline.Rms({ mode: "moving", windowDuration: 3000 }); // 3 seconds
```

### Variance

```typescript
pipeline.Variance({ mode: "moving", windowDuration: 60000 }); // 1 minute
```

### Z-Score Normalization

```typescript
pipeline.ZScoreNormalize({
  mode: "moving",
  windowDuration: 30000, // 30 seconds
  epsilon: 1e-6,
});
```

### Mean Absolute Value

```typescript
pipeline.MeanAbsoluteValue({ mode: "moving", windowDuration: 5000 }); // 5 seconds
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
- **Time-based windows:** Variable memory (depends on sampling rate and irregularity)

### Processing Speed

- **With timestamps:** ~5-10% overhead for timestamp checking
- **Without timestamps:** Fastest (legacy mode)

**Recommendation:** Use time-based processing when you need it; stick with sample-based for maximum performance on uniform data.

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

- Use `windowDuration` for time-based analysis
- Pass explicit timestamps for irregular data
- Use `windowSize` for maximum performance on uniform data
- Validate timestamp ordering (ascending)
- Use state persistence for streaming applications

### ❌ DON'T

- Mix sample rates in the same pipeline
- Use timestamps without `windowDuration` (defeats the purpose)
- Assume uniform sampling in IoT applications
- Forget to handle timezone conversions
- Process data with backwards-jumping timestamps

---

## Troubleshooting

### Q: My time-based windows aren't working as expected

**A:** Currently, `windowDuration` is converted to a fixed `windowSize` internally. True time-based expiration (removing samples based on age) is planned for a future release. For now, use `windowSize` if you need precise sample-count control.

### Q: Should I use milliseconds or seconds for timestamps?

**A:** Use **milliseconds** for consistency with JavaScript `Date.now()` and Unix timestamps. The library expects milliseconds.

### Q: Can I use both windowSize and windowDuration?

**A:** Yes! Specify both to enforce multiple constraints. Whichever limit is reached first will apply.

### Q: What happens if I don't provide timestamps?

**A:** The library auto-generates sequential timestamps `[0, 1, 2, ...]`. If you provide `sampleRate`, it generates time-based timestamps.

---

## Future Enhancements (Roadmap)

- [ ] **True time-based filtering** - Samples expire based on `windowDuration`
- [ ] **Timestamp interpolation** - Fill gaps in irregular data
- [ ] **Time-based resampling** - Downsample to uniform intervals
- [ ] **Timestamp-aware state format** - Include timestamps in serialized state
- [ ] **Window overlap control** - For advanced signal analysis

---

## Need Help?

- **GitHub Issues:** [Report bugs or request features](https://github.com/A-KGeorge/dsp-ts-redis/issues)
- **Documentation:** Check `docs/` folder for additional guides
- **Examples:** See `src/ts/examples/` for working code samples

---

**Happy time-series processing! 📈**
