# Notch Filter Quick Reference

## TL;DR

```typescript
import { FirFilter } from "./filters.js";

// Create 60 Hz notch filter
const notch = FirFilter.createBandStop({
  lowCutoffFrequency: 58,
  highCutoffFrequency: 62,
  sampleRate: 1000,
  order: 51,
});

// Process signal
const filtered = await notch.process(signal);
```

## Common Mistake

❌ **WRONG** - "notch" is not a type:

```typescript
const dsp = createDspPipeline().filter({type: "notch", ...})
```

✅ **CORRECT** - "notch" is a mode of band-stop:

```typescript
const notch = FirFilter.createBandStop({...})
// or
const notch = IirFilter.createBandStop({...})  // when implemented
```

## Filter API Structure

### Types (Implementation)

- `fir` - FIR filter
- `iir` - IIR filter
- `butterworth` - Butterworth IIR
- `chebyshev` - Chebyshev IIR
- `biquad` - Biquad IIR

### Modes (Frequency Response)

- `lowpass` - Pass low frequencies
- `highpass` - Pass high frequencies
- `bandpass` - Pass band of frequencies
- `bandstop` - Reject band (= notch)
- `notch` - Reject band (= bandstop)

## Common Use Cases

### 60 Hz Power Line Noise (US)

```typescript
FirFilter.createBandStop({
  lowCutoffFrequency: 58,
  highCutoffFrequency: 62,
  sampleRate: 1000,
  order: 51,
});
```

### 50 Hz Power Line Noise (EU)

```typescript
FirFilter.createBandStop({
  lowCutoffFrequency: 49,
  highCutoffFrequency: 51,
  sampleRate: 1000,
  order: 51,
});
```

### Multiple Harmonics

```typescript
const notch60 = FirFilter.createBandStop({
  lowCutoffFrequency: 58,
  highCutoffFrequency: 62,
  sampleRate: 1000,
  order: 51,
});

const notch120 = FirFilter.createBandStop({
  lowCutoffFrequency: 118,
  highCutoffFrequency: 122,
  sampleRate: 1000,
  order: 51,
});

// Chain them
const step1 = await notch60.process(signal);
const step2 = await notch120.process(step1);
```

## Pipeline Status

⚠️ **Not Yet Implemented**: Filter stages in DSP pipeline require C++ support.

**Workaround** - Use standalone filters:

```typescript
const dsp = createDspPipeline()
  .MovingAverage({ mode: "moving", windowSize: 10 })
  .Rectify({ mode: "full" });

const notch = FirFilter.createBandStop({...});

const pipelineOutput = await dsp.process(samples);
const finalOutput = await notch.process(pipelineOutput);
```

## See Also

- Full examples: `src/ts/examples/notch-filter-examples.ts`
- Filter API: `docs/FILTER_API_GUIDE.md`
- Tests: `src/ts/__tests__/AdvancedDsp.test.ts`
