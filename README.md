# Work in Progress

# dsp-ts-redis

> **High-performance digital signal processing for TypeScript with native C++ acceleration and optional Redis state persistence**

A modern DSP library built for Node.js backends processing real-time biosignals, audio streams, and sensor data. Combines TypeScript's developer experience with C++ performance and Redis-backed state continuity across distributed workers.

[![npm version](https://badge.fury.io/js/dsp-ts-redis.svg)](https://www.npmjs.com/package/dsp-ts-redis)
[![CI Status](https://github.com/yourusername/dsp-ts-redis/workflows/CI/badge.svg)](https://github.com/yourusername/dsp-ts-redis/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## ✨ Features

- 🚀 **Native C++ Kernels** – 10-50x faster than pure JavaScript DSP
- 🔧 **TypeScript-First** – Full type safety and excellent IntelliSense
- 📡 **Redis State Persistence** – Maintain filter states across restarts and distributed workers
- 🔗 **Fluent Pipeline API** – Chain operations with zero boilerplate
- 🎯 **Zero-Copy Processing** – Direct TypedArray manipulation for minimal overhead
- 📊 **Multi-Channel Support** – Process EMG, EEG, audio arrays natively
- 🪝 **Observability Hooks** – Built-in metrics, tracing, and debugging
- 📦 **Prebuilt Binaries** – No compilation needed for Linux, macOS, Windows

---

## 📦 Installation

```bash
npm install dsp-ts-redis
```

**Optional:** For Redis state persistence:

```bash
npm install ioredis
```

Prebuilt binaries are available for:

- Linux x64/ARM64
- macOS x64/ARM64 (Intel & Apple Silicon)
- Windows x64

---

## 🚀 Quick Start

### Basic Usage (C++ Backend)

```typescript
import dsp from "dsp-ts-redis";

// Create a processing pipeline
const processor = dsp
  .pipeline()
  .notchFilter(60) // Remove 60 Hz powerline noise
  .butterworthLowpass(500) // Low-pass at 500 Hz
  .rectify() // Full-wave rectification
  .movingAverage(100) // Smooth with 100-sample window
  .build();

// Process samples
const input = new Float32Array([
  /* your signal data */
]);
const output = await processor.process(input, { sampleRate: 2000 });

console.log(output); // Filtered signal
```

### With Redis State Persistence

```typescript
import dsp from "dsp-ts-redis";
import Redis from "ioredis";

const redis = new Redis();

const processor = dsp
  .pipeline({
    redis,
    stateKey: "emg:user123:channel1",
  })
  .notchFilter(60)
  .butterworthLowpass(500)
  .hilbertEnvelope()
  .build();

// State persists across process() calls and service restarts
await processor.process(chunk1, { sampleRate: 2000 });
await processor.process(chunk2, { sampleRate: 2000 });

// Clear state when needed
await processor.clearState();
```

### Real-Time EMG Processing

```typescript
const processor = dsp
  .pipeline({
    redis,
    stateKey: "emg:session:abc123",
  })
  .dcRemove() // Remove DC offset
  .notchFilter(60) // Remove powerline interference
  .butterworthLowpass(450) // Anti-aliasing
  .rectify() // Full-wave rectification
  .movingAverage(50) // Smooth envelope
  .build();

// Process streaming data
for await (const chunk of emgStream) {
  const envelope = await processor.process(chunk, {
    sampleRate: 2000,
    channels: 4, // 4-channel EMG
  });

  // Send to dashboard, ML model, etc.
  sendToClient(envelope);
}
```

---

## 🔗 Pipeline API

### Configuration

```typescript
interface PipelineConfig {
  redis?: RedisClient; // Optional Redis instance
  stateKey?: string; // Key prefix for state storage
  precision?: "float32" | "float64"; // Default: 'float32'
  errorStrategy?: "throw" | "skip" | "zero";
  profile?: boolean; // Enable performance profiling
  hooks?: {
    onSample?: (output: number, index: number, stage: string) => void;
    onStageComplete?: (stage: string, duration: number) => void;
    onError?: (stage: string, error: Error) => void;
  };
}

const processor = dsp.pipeline(config);
```

### Available Filters & Operations

#### 🧩 Time-Domain Filters

- `movingAverage(windowSize)` – Simple moving average
- `rms(windowSize)` – Root mean square
- `variance(windowSize)` – Running variance
- `zScoreNormalize(windowSize)` – Z-score normalization
- `rectify()` – Full-wave rectification
- `dcRemove(cutoffHz?)` – High-pass DC blocking filter

#### 🎛 Classic Filters

- `firFilter(coefficients)` – Finite impulse response
- `iirFilter(b, a)` – Infinite impulse response
- `butterworthLowpass(cutoffHz, order?)` – Butterworth low-pass
- `butterworthHighpass(cutoffHz, order?)` – Butterworth high-pass
- `notchFilter(freqHz, q?)` – Notch filter (powerline removal)
- `bandpassFilter(lowHz, highHz, order?)` – Bandpass filter
- `kalmanFilter(processNoise, measurementNoise)` – Kalman filtering
- `savitzkyGolayFilter(windowSize, polyOrder)` – Polynomial smoothing

#### 🔉 Transform Domain

- `fft()` – Fast Fourier Transform
- `dft()` – Discrete Fourier Transform
- `stft(windowSize, hopSize)` – Short-Time Fourier Transform
- `istft()` – Inverse STFT
- `hilbertTransform()` – Analytic signal
- `hilbertEnvelope()` – Amplitude envelope
- `waveletTransform(wavelet)` – Wavelet decomposition
- `spectrogram(windowSize)` – Time-frequency spectrogram

#### ⚡ EMG/Biosignal Specific

- `mav(windowSize)` – Mean Absolute Value
- `waveformLength(windowSize)` – Waveform complexity
- `zeroCrossRate(windowSize)` – Zero-crossing rate
- `willisonAmplitude(threshold)` – Willison amplitude
- `slopeSignChange(threshold)` – Slope sign changes
- `muscleActivationThreshold(threshold)` – Onset/offset detection

#### 🧠 Feature Extraction

- `spectralCentroid()` – Center of mass of spectrum
- `spectralRolloff(percentile)` – Frequency rolloff point
- `spectralFlux()` – Spectral change rate
- `entropy()` – Shannon entropy
- `sampleEntropy(m, r)` – Sample entropy (complexity)
- `hjorthParameters()` – Activity, mobility, complexity

#### 🔧 Utilities

- `tap(callback)` – Inspect samples at any stage
- `downsample(factor)` – Reduce sample rate
- `upsample(factor)` – Increase sample rate
- `interpolate(targetRate)` – Resample to target rate
- `detrend()` – Remove linear trend

---

## 🪝 Observability & Debugging

### Stage-Level Hooks

```typescript
const processor = dsp
  .pipeline()
  .notchFilter(60, {
    onSample: (output, index) => {
      if (output > threshold) {
        console.log(`Spike detected at sample ${index}`);
      }
    },
  })
  .butterworthLowpass(500)
  .build();
```

### Pipeline-Level Hooks

```typescript
const processor = dsp
  .pipeline({
    hooks: {
      onStageComplete: (stage, duration) => {
        metrics.record(`dsp.${stage}.duration`, duration);
      },
      onError: (stage, error) => {
        logger.error(`Pipeline failed at ${stage}`, error);
      },
    },
  })
  .notchFilter(60)
  .butterworthLowpass(500)
  .build();
```

### Performance Profiling

```typescript
const processor = dsp
  .pipeline({ profile: true })
  .notchFilter(60)
  .butterworthLowpass(500)
  .fft()
  .build();

await processor.process(samples, { sampleRate: 2000 });

console.log(processor.getProfile());
/*
{
  notchFilter: { avgTime: 0.52ms, calls: 100 },
  butterworthLowpass: { avgTime: 0.31ms, calls: 100 },
  fft: { avgTime: 1.15ms, calls: 100 },
  total: { avgTime: 1.98ms, calls: 100 }
}
*/
```

### Pipeline Inspection

```typescript
const processor = dsp
  .pipeline()
  .notchFilter(60)
  .butterworthLowpass(500)
  .hilbertEnvelope()
  .build();

// View pipeline structure
console.log(processor.describe());
/*
[
  { name: 'notchFilter', params: { freq: 60, q: 30 }, stateKeys: [...] },
  { name: 'butterworthLowpass', params: { cutoff: 500, order: 4 }, stateKeys: [...] },
  { name: 'hilbertEnvelope', params: {}, stateKeys: [...] }
]
*/

// ASCII visualization
console.log(processor.visualize());
// [notchFilter] → [butterworthLowpass] → [hilbertEnvelope]

// Inspect stage state
const state = await processor.inspect("notchFilter");
```

### Debugging with `.tap()`

```typescript
const processor = dsp
  .pipeline()
  .notchFilter(60)
  .tap((samples) => console.log("After notch:", samples.slice(0, 5)))
  .butterworthLowpass(500)
  .tap((samples) => console.log("After lowpass:", samples.slice(0, 5)))
  .build();
```

---

## 🏗️ Architecture

### Native C++ Backend (Default)

- Zero-copy TypedArray processing via N-API
- Optimized kernels using SIMD where available
- Thread-safe for concurrent pipeline instances

### Redis State Store (Optional)

- Maintains filter states across service restarts
- Enables distributed processing across workers
- Atomic state updates via Lua scripting
- Automatic TTL and key namespacing

### Multi-Channel Processing

```typescript
// 4-channel EMG array
const input = new Float32Array(4 * 1000); // 4 channels × 1000 samples

const processor = dsp
  .pipeline()
  .notchFilter(60)
  .butterworthLowpass(500)
  .build();

const output = await processor.process(input, {
  sampleRate: 2000,
  channels: 4,
});

// Output has same shape: 4 channels × 1000 samples
```

---

## 📊 Use Cases

### Real-Time Biosignal Processing

```typescript
// EMG muscle activation detection
const emgProcessor = dsp
  .pipeline({ redis, stateKey: "emg:patient:123" })
  .dcRemove()
  .notchFilter(60)
  .butterworthLowpass(450)
  .rectify()
  .movingAverage(100)
  .muscleActivationThreshold(0.1)
  .build();
```

### Audio Feature Extraction

```typescript
// Real-time audio analysis
const audioProcessor = dsp
  .pipeline()
  .butterworthHighpass(80) // Remove low-frequency rumble
  .stft(2048, 512) // Time-frequency transform
  .spectralCentroid() // Extract brightness
  .build();
```

### Industrial Vibration Monitoring

```typescript
// Condition monitoring for rotating machinery
const vibrationProcessor = dsp
  .pipeline({ redis, stateKey: "machine:pump:01" })
  .dcRemove()
  .butterworthBandpass(10, 1000)
  .fft()
  .peakDetection({ prominence: 0.5 })
  .build();
```

### Distributed IoT Telemetry

```typescript
// Edge gateway processing sensor data
const sensorProcessor = dsp
  .pipeline({
    redis: sharedRedis,
    stateKey: `sensor:${deviceId}:${channelId}`,
  })
  .kalmanFilter(0.01, 0.1) // Sensor fusion
  .movingAverage(50) // Noise reduction
  .zScoreNormalize(1000) // Anomaly detection prep
  .build();
```

---

## ⚠️ Important Disclaimers

### Not for Clinical Use

**This software has not been validated for medical diagnosis, treatment, or life-critical applications.**

- Not FDA/CE cleared or approved
- No medical device certification
- For research and development only
- Consult regulatory experts before clinical deployment

### Performance Considerations

- **Redis overhead**: Network latency adds ~0.5-5ms per state access. Use native store for ultra-low latency (<1ms).
- **Batch sizes**: Process 256-4096 samples per call for optimal performance.
- **Worker threads**: For CPU-intensive pipelines, consider offloading to worker threads.

---

## 🧪 Testing & Validation

All filters are validated against reference implementations:

```bash
npm test                  # Run all tests
npm run test:golden       # Validate against SciPy/NumPy
npm run benchmark         # Performance benchmarks
```

### Accuracy

- ✅ Cross-validated against SciPy and NumPy
- ✅ Golden tests with known signal inputs/outputs
- ✅ Numerical precision within 1e-6 for float64

### Performance

- ✅ Native FFT: 15-30× faster than pure JS
- ✅ IIR filters: 10-20× faster than pure JS
- ✅ Redis overhead: <5ms for typical state sizes (<10KB)

---

## 📚 Documentation

- [API Reference](./docs/api.md)
- [Filter Design Guide](./docs/filters.md)
- [Redis State Management](./docs/redis.md)
- [Multi-Channel Processing](./docs/multichannel.md)
- [Performance Tuning](./docs/performance.md)
- [Examples](./examples)

---

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Development Setup

```bash
git clone https://github.com/yourusername/dsp-ts-redis.git
cd dsp-ts-redis
npm install
npm run build          # Compile C++ bindings
npm test               # Run tests
```

### Building Prebuilds

```bash
npm run prebuild       # Build for current platform
npm run prebuild:all   # Build for all platforms (CI only)
```

---

## 📄 License

MIT © [Your Name]

**Third-party licenses:**

- KissFFT (BSD-3-Clause)
- Eigen (MPL2)

---

## 🙏 Acknowledgments

Inspired by:

- [SciPy](https://scipy.org/) signal processing module
- [librosa](https://librosa.org/) audio analysis library
- [dsp.js](https://github.com/corbanbrook/dsp.js/) pioneering JS DSP work

Special thanks to the communities behind:

- N-API and node-addon-api
- Redis and ioredis
- TypeScript

---

## 💬 Community

- 🐛 [Report Issues](https://github.com/yourusername/dsp-ts-redis/issues)
- 💡 [Feature Requests](https://github.com/yourusername/dsp-ts-redis/discussions)
- 💬 [Discord Community](https://discord.gg/your-invite)
- 🐦 Follow [@yourhandle](https://twitter.com/yourhandle) for updates

---

**Built with ❤️ for the Node.js signal processing community**
