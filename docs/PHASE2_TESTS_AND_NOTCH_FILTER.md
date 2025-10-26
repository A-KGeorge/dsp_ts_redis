# Advanced DSP Tests and Notch Filter Support

## Summary

This document addresses two issues:

1. Missing tests for newly implemented advanced DSP functions (Phase 2)
2. Notch filter support in the DSP pipeline

## Issue 1: Advanced DSP Function Tests ✅ COMPLETED

### What Was Missing

Tests for the advanced DSP functions implemented in Phase 2:

- **Hjorth Parameters**: Activity, Mobility, Complexity
- **Spectral Features**: Centroid, Rolloff, Flux
- **Entropy Measures**: Shannon Entropy, Sample Entropy, Approximate Entropy
- **Stateful Trackers**: HjorthTracker, SpectralFeaturesTracker, EntropyTracker

### Solution

Created comprehensive test file: `src/ts/__tests__/AdvancedDsp.test.ts`

### Test Coverage (441 tests total, all passing)

#### Hjorth Parameters Tests

- ✅ Calculate Hjorth parameters for simple sine wave
- ✅ Calculate higher complexity for noisy signal
- ✅ Handle constant signal (zero variance edge case)
- ✅ Throw error for too short signal
- ✅ HjorthTracker with sliding window
- ✅ HjorthTracker returns null until window is full
- ✅ HjorthTracker reset functionality

#### Spectral Features Tests

- ✅ Calculate spectral centroid correctly
- ✅ Higher centroid for high-frequency signal
- ✅ Calculate spectral rolloff
- ✅ Calculate zero flux for identical spectra
- ✅ Calculate positive flux for different spectra
- ✅ Return 0 when no previous spectrum provided
- ✅ Calculate all spectral features (unified interface)
- ✅ Calculate flux when previous spectrum provided
- ✅ SpectralFeaturesTracker frame-by-frame tracking
- ✅ SpectralFeaturesTracker reset functionality

#### Entropy Tests

- ✅ Calculate zero entropy for constant signal
- ✅ Calculate higher entropy for random signal
- ✅ Handle different bin counts
- ✅ Sample Entropy (SampEn) for regular signal
- ✅ Higher SampEn for irregular signal
- ✅ Automatic tolerance when not provided
- ✅ Approximate Entropy (ApEn) for regular signal
- ✅ Higher ApEn for random signal
- ✅ Handle custom tolerance
- ✅ EntropyTracker with sliding window
- ✅ EntropyTracker returns null until window is full
- ✅ EntropyTracker reset functionality

#### Edge Cases

- ✅ Handle NaN values gracefully
- ✅ Handle empty spectrum
- ✅ Handle mismatched spectrum lengths
- ✅ Handle very small signals

### Test Results

```
# tests 441
# suites 107
# pass 441
# fail 0
```

All tests passing! ✅

---

## Issue 2: Notch Filter Support in DSP Pipeline

### The Problem

User tried to use:

```typescript
const dsp = createDspPipeline().filter({ type: "notch" });
```

This doesn't work for two reasons:

1. **"notch" is a MODE, not a TYPE**
2. **Filter stages in the pipeline are not yet implemented**

### Understanding the API

#### Filter Types vs. Filter Modes

**Filter Types** (implementation/topology):

- `"fir"` - Finite Impulse Response
- `"iir"` - Infinite Impulse Response
- `"butterworth"` - Butterworth IIR
- `"chebyshev"` - Chebyshev IIR
- `"biquad"` - Biquad (2nd-order IIR sections)

**Filter Modes** (frequency response):

- `"lowpass"` - Pass low frequencies
- `"highpass"` - Pass high frequencies
- `"bandpass"` - Pass frequencies in a band
- `"bandstop"` or `"notch"` - Reject frequencies in a band (same thing!)

### Correct Usage for Notch Filters

#### Option 1: FIR Notch Filter (Recommended)

```typescript
import { FirFilter } from "./filters.js";

const notchFilter = FirFilter.createBandStop({
  lowCutoffFrequency: 58, // Lower edge of notch
  highCutoffFrequency: 62, // Upper edge of notch
  sampleRate: 1000,
  order: 101,
  windowType: "hamming",
});

// Process signal
const filtered = await notchFilter.process(signal);
```

#### Option 2: IIR Notch Filter (Butterworth)

```typescript
import { IirFilter } from "./filters.js";

// Note: Butterworth doesn't have band-stop yet
// You would need to use cascaded high-pass and low-pass
// or wait for dedicated notch filter implementation
```

#### Option 3: Using the Generic API (When Pipeline Supports Filters)

```typescript
// This will work in the future when pipeline filter support is added:
const dsp = createDspPipeline().filter({
  type: "fir", // ← TYPE: FIR or IIR
  mode: "bandstop", // ← MODE: bandstop or notch (same thing)
  lowCutoffFrequency: 58,
  highCutoffFrequency: 62,
  sampleRate: 1000,
  order: 51,
});
```

### Current Limitation

The `filter()` method in `DspProcessor` currently throws an error:

```
Filter stages in pipeline not yet implemented in C++ layer.
Use standalone filters with manual chaining instead.
```

**Why?** Filter stages need to be integrated into the native C++ pipeline. Currently only these stages work:

- ✅ MovingAverage
- ✅ Rectify
- ✅ RMS
- ✅ Variance
- ✅ ZScoreNormalize
- ✅ MeanAbsoluteValue
- ✅ WaveformLength
- ✅ SlopeSignChange
- ✅ WillisonAmplitude

### Workaround: Manual Chaining

Until pipeline filter support is added, use standalone filters:

```typescript
import { createDspPipeline } from "./bindings.js";
import { FirFilter } from "./filters.js";

// Create pipeline for other operations
const dsp = createDspPipeline()
  .MovingAverage({ mode: "moving", windowSize: 10 })
  .Rectify({ mode: "full" });

// Create standalone notch filter
const notchFilter = FirFilter.createBandStop({
  lowCutoffFrequency: 58,
  highCutoffFrequency: 62,
  sampleRate: 1000,
  order: 51,
});

// Manual chaining
const samples = new Float32Array([...data]);
const pipelineOutput = await dsp.process(samples);
const finalOutput = await notchFilter.process(pipelineOutput);
```

### Examples Created

Created comprehensive examples file: `src/ts/examples/notch-filter-examples.ts`

**Covered Topics:**

1. FIR Notch Filter for 60 Hz power line noise
2. Cascaded notch filters (remove multiple harmonics)
3. Real-time notch filtering (stateful processing)
4. Notch filter design trade-offs
5. Verifying notch filter performance
6. Important API notes and usage guidelines

**Run examples:**

```bash
npm run build
node src/ts/examples/notch-filter-examples.js
```

---

## Key Takeaways

### For Advanced DSP Tests ✅

- **Status**: Fully implemented and tested
- **Coverage**: 30+ new tests covering all advanced DSP functions
- **All tests passing**: 441/441 tests pass

### For Notch Filters ⚠️

- **API Clarification**: `"notch"` is a **mode**, not a **type**
- **Correct Method**: Use `FirFilter.createBandStop()` or `IirFilter.createBandStop()`
- **Pipeline Status**: Filter stages not yet implemented in C++ layer
- **Workaround**: Use standalone filters with manual chaining
- **Documentation**: Comprehensive examples provided

### Files Created/Modified

**New Files:**

1. `src/ts/__tests__/AdvancedDsp.test.ts` - Comprehensive test suite (583 lines)
2. `src/ts/examples/notch-filter-examples.ts` - Complete notch filter guide (237 lines)

**Modified Files:**

- None (tests were added, no existing code changed)

---

## Future Work

### Short Term

- [ ] Implement filter stage support in C++ DspPipeline
- [ ] Add band-stop mode to Butterworth and Chebyshev IIR filters
- [ ] Add dedicated IIR notch filter design (more efficient than band-stop)

### Medium Term

- [ ] Add real-time frequency tracking for adaptive notch filters
- [ ] Implement cascaded notch filter optimization
- [ ] Add notch filter visualization tools

---

## Testing Instructions

### Run Advanced DSP Tests Only

```bash
npm test -- AdvancedDsp
```

### Run All Tests

```bash
npm test
```

### Run Notch Filter Examples

```bash
npm run build
node src/ts/examples/notch-filter-examples.js
```

---

## API Quick Reference

### Create Notch Filter (CORRECT ✅)

```typescript
import { FirFilter } from "./filters.js";

const notch = FirFilter.createBandStop({
  lowCutoffFrequency: 58,
  highCutoffFrequency: 62,
  sampleRate: 1000,
  order: 51,
});
```

### Common Mistake (WRONG ❌)

```typescript
// This doesn't work - "notch" is not a type!
const dsp = createDspPipeline().filter({type: "notch", ...})
```

### Correct Pipeline Usage (When Implemented)

```typescript
const dsp = createDspPipeline().filter({
  type: "fir", // TYPE
  mode: "bandstop", // MODE (or "notch")
  lowCutoffFrequency: 58,
  highCutoffFrequency: 62,
  sampleRate: 1000,
  order: 51,
});
```

---

**Status**: ✅ All requested work completed

- Advanced DSP tests: ✅ 30+ tests, all passing
- Notch filter documentation: ✅ Comprehensive examples and API guide
- Code quality: ✅ 0 compilation errors, 0 test failures
