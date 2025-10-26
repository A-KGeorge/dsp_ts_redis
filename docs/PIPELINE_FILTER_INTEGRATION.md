# Pipeline Filter Integration

**Status**: 🚧 Partial Implementation (TypeScript API ready, C++ integration pending)  
**Date**: October 26, 2025

## Overview

This document describes the design for integrating filter stages into the DSP pipeline for chainable filter operations. Currently, filters must be used as standalone instances with manual chaining. The goal is to enable seamless integration into the `createDSPpipeline()` API.

## Current State

### ✅ What Works

**Standalone Filter Usage**:

```typescript
import { IirFilter, createDspPipeline } from "dsp-ts-redis";

// Create filters
const filter = IirFilter.createButterworthLowPass({
  cutoffFreq: 1000,
  sampleRate: 8000,
  order: 4
});

// Create pipeline
const pipeline = createDspPipeline()
  .Rms({ mode: "moving", windowSize: 128 });

// Manual chaining
const signal = new Float32Array([...]);
const step1 = await pipeline.process(signal);
const step2 = filter.process(step1);
```

**Filter Types Supported**:

- ✅ FIR filters (low-pass, high-pass, band-pass, band-stop)
- ✅ IIR Butterworth filters (low-pass, high-pass, band-pass)
- ✅ IIR Chebyshev Type I filters (low-pass, high-pass, band-pass)
- ✅ Biquad EQ filters (peaking EQ, low-shelf, high-shelf)
- ✅ Generic biquad filters (all modes)

### 🚧 Partial Implementation

**TypeScript Pipeline API** (`.filter()` method added but throws error):

```typescript
// This API is defined but not yet functional
const pipeline = createDspPipeline()
  .Rms({ mode: "moving", windowSize: 128 })
  .filter({
    // ❌ Throws error: "not yet implemented in C++ layer"
    type: "butterworth",
    mode: "lowpass",
    cutoffFrequency: 1000,
    sampleRate: 8000,
    order: 4,
  });
```

The `.filter()` method exists in `DspProcessor` but throws an informative error because C++ pipeline support is not yet implemented.

## Desired API

The goal is to enable this seamless chaining:

```typescript
import { createDspPipeline } from "dsp-ts-redis";

const pipeline = createDspPipeline()
  // Standard DSP stages
  .Rms({ mode: "moving", windowSize: 128 })

  // Filter stage
  .filter({
    type: "butterworth",
    mode: "lowpass",
    cutoffFrequency: 1000,
    sampleRate: 8000,
    order: 4,
  })

  // More DSP stages
  .MovingAverage({ mode: "moving", windowSize: 64 })

  // Another filter
  .filter({
    type: "chebyshev",
    mode: "highpass",
    cutoffFrequency: 50,
    sampleRate: 8000,
    order: 2,
    ripple: 0.5,
  })

  // Debug tap
  .tap((samples) => console.log("After filters:", samples[0]));

// Process through entire pipeline
const output = await pipeline.process(signal);
```

## Implementation Plan

### Phase 1: C++ Filter Stage Adapter ✅ (Complete)

Create a generic filter adapter in C++ that wraps FirFilter and IirFilter for use in DspPipeline.

**Files to Modify**:

- `src/native/IDspStage.h` - Already has interface
- `src/native/adapters/FilterStage.h` (new) - Generic filter adapter
- `src/native/DspPipeline.cc` - Add `addFilterStage()` method

**Implementation**:

```cpp
// src/native/adapters/FilterStage.h
#ifndef DSP_FILTER_STAGE_H
#define DSP_FILTER_STAGE_H

#include "../IDspStage.h"
#include "../core/FirFilter.h"
#include "../core/IirFilter.h"
#include <memory>
#include <variant>

namespace dsp {
namespace adapters {

template <typename T>
class FilterStage : public IDspStage<T> {
public:
    using FilterVariant = std::variant<
        core::FirFilter<T>,
        core::IirFilter<T>
    >;

    explicit FilterStage(FilterVariant filter)
        : filter_(std::move(filter)) {}

    void process(T* samples, size_t count, size_t numChannels) override {
        // Visit the variant to call the right filter type
        std::visit([&](auto& f) {
            for (size_t ch = 0; ch < numChannels; ++ch) {
                for (size_t i = ch; i < count; i += numChannels) {
                    samples[i] = f.processSample(samples[i]);
                }
            }
        }, filter_);
    }

    void reset() override {
        std::visit([](auto& f) { f.reset(); }, filter_);
    }

    std::string getName() const override {
        return "filter";
    }

    // Time-based processing
    void process(T* samples, size_t count, const T* timestamps,
                 size_t numChannels) override {
        // Filters don't use timestamps, delegate to sample-based process
        process(samples, count, numChannels);
    }

private:
    FilterVariant filter_;
};

} // namespace adapters
} // namespace dsp

#endif // DSP_FILTER_STAGE_H
```

### Phase 2: N-API Bindings (Pending)

Add method to DspPipeline N-API wrapper to accept filter instances.

**Files to Modify**:

- `src/native/DspPipeline.cc` - Add `AddFilterStage()` method

**Implementation**:

```cpp
// In DspPipelineWrapper class
Napi::Value AddFilterStage(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1) {
        Napi::TypeError::New(env, "Expected filter instance")
            .ThrowAsJavaScriptException();
        return env.Undefined();
    }

    // Check if it's a FirFilter or IirFilter
    if (info[0].IsObject()) {
        Napi::Object filterObj = info[0].As<Napi::Object>();

        // Try to unwrap as FirFilter
        if (filterObj.InstanceOf(FirFilterWrapper::constructor.Value())) {
            auto firFilter = Napi::ObjectWrap<FirFilterWrapper>::Unwrap(filterObj);
            // Get the underlying C++ filter and add to pipeline
            // pipeline_->addStage(std::make_unique<FilterStage<float>>(firFilter->getFilter()));
        }
        // Try to unwrap as IirFilter
        else if (filterObj.InstanceOf(IirFilterWrapper::constructor.Value())) {
            auto iirFilter = Napi::ObjectWrap<IirFilterWrapper>::Unwrap(filterObj);
            // Get the underlying C++ filter and add to pipeline
            // pipeline_->addStage(std::make_unique<FilterStage<float>>(iirFilter->getFilter()));
        }
    }

    return env.Undefined();
}
```

### Phase 3: TypeScript Integration (Pending)

Update `DspProcessor.filter()` to use the C++ method instead of throwing an error.

**Files to Modify**:

- `src/ts/bindings.ts` - Update `.filter()` method

**Implementation**:

```typescript
filter(options: FilterOptions): this {
  // Create the appropriate filter based on type
  let filterInstance: FirFilter | IirFilter;

  switch (options.type) {
    case "fir":
      filterInstance = this.createFirFilter(options);
      break;

    case "butterworth":
      filterInstance = this.createButterworthFilter(options);
      break;

    case "chebyshev":
      filterInstance = this.createChebyshevFilter(options);
      break;

    case "biquad":
      filterInstance = this.createBiquadFilter(options);
      break;

    case "iir":
    default:
      throw new Error(
        `Filter type "${options.type}" not yet implemented`
      );
  }

  // Add filter stage to native pipeline
  this.nativeInstance.addFilterStage(filterInstance.getNative());
  this.stages.push(`filter:${options.type}:${options.mode}`);

  return this;
}
```

### Phase 4: Testing (Pending)

Create comprehensive tests for pipeline filter integration.

**Test File**: `src/ts/__tests__/PipelineFilters.test.ts`

**Test Cases**:

1. Single filter in pipeline
2. Multiple filters chained
3. Filters mixed with DSP stages (RMS, MovingAverage, etc.)
4. All filter types (FIR, Butterworth, Chebyshev, Biquad)
5. Filter state persistence through pipeline saves/loads
6. Performance benchmarks (manual chaining vs pipeline chaining)

## Current Workaround

Until pipeline integration is complete, use this pattern:

```typescript
import { IirFilter, createDspPipeline } from "dsp-ts-redis";

// Create standalone filters
const lpFilter = IirFilter.createButterworthLowPass({
  cutoffFreq: 1000,
  sampleRate: 8000,
  order: 4,
});

const hpFilter = IirFilter.createChebyshevHighPass({
  cutoffFreq: 50,
  sampleRate: 8000,
  order: 2,
  rippleDb: 0.5,
});

// Create pipeline for DSP stages
const pipeline = createDspPipeline()
  .Rms({ mode: "moving", windowSize: 128 })
  .MovingAverage({ mode: "moving", windowSize: 64 });

// Manual chaining
async function processWithFilters(signal: Float32Array): Promise<Float32Array> {
  // Step 1: Apply first filter
  let output = lpFilter.process(signal);

  // Step 2: Run through DSP pipeline
  output = await pipeline.process(output);

  // Step 3: Apply second filter
  output = hpFilter.process(output);

  return output;
}

const result = await processWithFilters(mySignal);
```

## Performance Considerations

### Current (Manual Chaining)

- ✅ Explicit control over each step
- ❌ Multiple buffer copies
- ❌ Less ergonomic API
- ❌ No automatic state serialization for filters

### Future (Pipeline Integration)

- ✅ Single pass through entire pipeline
- ✅ Minimal buffer copies
- ✅ Ergonomic chainable API
- ✅ Filters included in pipeline state save/load
- ✅ Unified performance monitoring

## Filter Configuration Options

The `.filter()` method accepts these option types:

### FIR Filter

```typescript
{
  type: "fir",
  mode: "lowpass" | "highpass" | "bandpass" | "bandstop" | "notch",
  cutoffFrequency?: number,      // For lowpass/highpass
  lowCutoffFrequency?: number,   // For bandpass/bandstop
  highCutoffFrequency?: number,  // For bandpass/bandstop
  sampleRate: number,
  order: number,                 // Number of taps
  windowType?: "hamming" | "hann" | "blackman" | "bartlett"
}
```

### Butterworth Filter

```typescript
{
  type: "butterworth",
  mode: "lowpass" | "highpass" | "bandpass",
  cutoffFrequency?: number,      // For lowpass/highpass
  lowCutoffFrequency?: number,   // For bandpass
  highCutoffFrequency?: number,  // For bandpass
  sampleRate: number,
  order: number                  // 1-8 recommended
}
```

### Chebyshev Filter

```typescript
{
  type: "chebyshev",
  mode: "lowpass" | "highpass" | "bandpass",
  cutoffFrequency?: number,
  lowCutoffFrequency?: number,   // For bandpass
  highCutoffFrequency?: number,  // For bandpass
  sampleRate: number,
  order: number,
  ripple?: number               // Passband ripple 0.1-3.0 dB (default: 0.5)
}
```

### Biquad Filter

```typescript
{
  type: "biquad",
  mode: "peak" | "lowshelf" | "highshelf" | "lowpass" | "highpass" | "bandpass" | "notch",
  cutoffFrequency: number,      // Center frequency for peak/notch
  sampleRate: number,
  q?: number,                   // Quality factor (default: 0.707)
  gain?: number                 // Gain in dB for EQ modes (default: 0)
}
```

## Migration Guide

When pipeline integration is complete, migration is simple:

**Before** (Current):

```typescript
const filter = IirFilter.createButterworthLowPass({...});
const pipeline = createDspPipeline().Rms({...});
const step1 = await pipeline.process(signal);
const output = filter.process(step1);
```

**After** (Future):

```typescript
const pipeline = createDspPipeline()
  .Rms({...})
  .filter({
    type: "butterworth",
    mode: "lowpass",
    ...
  });
const output = await pipeline.process(signal);
```

## Timeline

- **Phase 1 (C++ Adapter)**: 2-3 hours (includes testing)
- **Phase 2 (N-API Bindings)**: 2-3 hours (includes error handling)
- **Phase 3 (TypeScript Update)**: 1 hour (mostly removing error throw)
- **Phase 4 (Testing)**: 2-3 hours (comprehensive test coverage)

**Total Estimate**: 8-10 hours

## Conclusion

The `.filter()` method is designed and ready in TypeScript but requires C++ pipeline support. Until then, standalone filters with manual chaining provide full functionality with explicit control over each processing step.

**Current Recommendation**: Use standalone filters as documented in `FILTER_API_GUIDE.md` and `CHEBYSHEV_BIQUAD_EQ_IMPLEMENTATION.md`.

**Future**: Once C++ integration is complete, the pipeline API will provide seamless filter chaining with performance benefits.
