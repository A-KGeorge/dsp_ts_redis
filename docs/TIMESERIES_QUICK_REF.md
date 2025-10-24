# Time-Series Processing Quick Reference

## Three Processing Modes

```typescript
// Mode 1: Legacy (auto-generate timestamps from sample rate)
await pipeline.process(samples, { sampleRate: 1000, channels: 1 });

// Mode 2: Time-based (explicit timestamps)
await pipeline.process(samples, timestamps, { channels: 1 });

// Mode 3: Auto-sequential (generate [0, 1, 2, ...])
await pipeline.process(samples, { channels: 1 });
```

## Window Parameters

```typescript
// Sample-based (count)
windowSize: 100        // Last 100 samples

// Time-based (milliseconds)
windowDuration: 5000   // Last 5 seconds

// Both (whichever limit hit first)
windowSize: 100, windowDuration: 5000
```

## Filter Examples

```typescript
// All filters support both parameters
pipeline.MovingAverage({ mode: "moving", windowDuration: 10000 });
pipeline.Rms({ mode: "moving", windowDuration: 5000 });
pipeline.Variance({ mode: "moving", windowDuration: 30000 });
pipeline.ZScoreNormalize({
  mode: "moving",
  windowDuration: 60000,
  epsilon: 1e-6,
});
pipeline.MeanAbsoluteValue({ mode: "moving", windowDuration: 5000 });
```

## Conversion Formula

```
windowDuration (ms) = (windowSize / sampleRate) * 1000

Example:
  windowSize = 500 samples
  sampleRate = 100 Hz
  windowDuration = (500 / 100) * 1000 = 5000 ms
```

## Common Use Cases

| Data Type            | Use                | Recommended      |
| -------------------- | ------------------ | ---------------- |
| Uniform ADC/Audio    | High-rate, regular | `windowSize`     |
| IoT Sensors          | Network jitter     | `windowDuration` |
| Financial Ticks      | Irregular market   | `windowDuration` |
| Biosignals (EMG/ECG) | High-rate uniform  | `windowSize`     |
| Streaming Telemetry  | Variable rate      | `windowDuration` |

## Quick Debugging

```typescript
// Check processing mode
console.log(timestamps ? "Time-based" : "Sample-based");

// Validate timestamps
console.assert(timestamps.length === samples.length);
console.assert(timestamps[i] >= timestamps[i - 1]); // Ascending

// Check intervals
for (let i = 1; i < timestamps.length; i++) {
  console.log(`Δt = ${timestamps[i] - timestamps[i - 1]}ms`);
}
```

## Links

- **Full Guide:** [`docs/time-series-guide.md`](./time-series-guide.md)
- **Examples:** [`src/ts/examples/timeseries/`](../src/ts/examples/timeseries/)
- **Implementation:** [`docs/TIMESERIES_IMPLEMENTATION_SUMMARY.md`](./TIMESERIES_IMPLEMENTATION_SUMMARY.md)
