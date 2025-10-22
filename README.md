# Work in Progress

# dsp-ts-redis

> **High-performance digital signal processing for TypeScript with native C++ acceleration and Redis state persistence**

A modern DSP library built for Node.js backends processing real-time biosignals, audio streams, and sensor data. Features native C++ filters with full state serialization to Redis, enabling seamless processing across service restarts and distributed workers.

[![npm version](https://badge.fury.io/js/dsp-ts-redis.svg)](https://www.npmjs.com/package/dsp-ts-redis)
[![CI Status](https://github.com/yourusername/dsp-ts-redis/workflows/CI/badge.svg)](https://github.com/yourusername/dsp-ts-redis/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## ✨ Features

- 🚀 **Native C++ Performance** – Optimized circular buffers and filters for real-time processing
- 🔧 **TypeScript-First** – Full type safety with excellent IntelliSense
- 📡 **Redis State Persistence** – Fully implemented state serialization/deserialization including circular buffer contents and running sums
- 🔗 **Fluent Pipeline API** – Chain filter operations with method chaining
- 🎯 **Zero-Copy Processing** – Direct TypedArray manipulation for minimal overhead
- 📊 **Multi-Channel Support** – Process multi-channel signals (EMG, EEG, audio) with independent filter states per channel
- ⚡ **Async Processing** – Background thread processing to avoid blocking the Node.js event loop
- � **Crash Recovery** – Resume processing from exact state after service restarts

---

## 📦 Installation

```bash
npm install dsp-ts-redis redis
```

**Note:** You'll need a C++ compiler if prebuilt binaries aren't available for your platform:

- Windows: Visual Studio 2022 or Build Tools
- macOS: Xcode Command Line Tools
- Linux: GCC/G++ 7+

---

## 🚀 Quick Start

### Basic Usage

```typescript
import { createDspPipeline } from "dsp-ts-redis";

// Create a processing pipeline
const pipeline = createDspPipeline();

// Add filters using method chaining
pipeline.MovingAverage({ windowSize: 100 });

// Process samples (modifies input in-place for performance)
const input = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
const output = await pipeline.process(input, {
  sampleRate: 2000,
  channels: 1,
});

console.log(output); // Smoothed signal
```

### Processing Without Modifying Input

```typescript
// Use processCopy to preserve the original input
const input = new Float32Array([1, 2, 3, 4, 5]);
const output = await pipeline.processCopy(input, {
  sampleRate: 2000,
  channels: 1,
});

console.log(input); // [1, 2, 3, 4, 5] - unchanged
console.log(output); // [1, 1.5, 2, 3, 4] - smoothed
```

### With Redis State Persistence

```typescript
import { createDspPipeline } from "dsp-ts-redis";
import { createClient } from "redis";

const redis = await createClient({ url: "redis://localhost:6379" }).connect();

// Create pipeline with Redis config
const pipeline = createDspPipeline({
  redisHost: "localhost",
  redisPort: 6379,
  stateKey: "dsp:user123:channel1",
});

pipeline.MovingAverage({ windowSize: 100 });

// Try to restore previous state from Redis
const savedState = await redis.get("dsp:user123:channel1");
if (savedState) {
  await pipeline.loadState(savedState);
  console.log("State restored!");
}

// Process data - filter state is maintained
await pipeline.process(chunk1, { sampleRate: 2000, channels: 1 });

// Save state to Redis (includes circular buffer contents!)
const state = await pipeline.saveState();
await redis.set("dsp:user123:channel1", state);

// Continue processing - even after service restart!
await pipeline.process(chunk2, { sampleRate: 2000, channels: 1 });

// Clear state when starting fresh
pipeline.clearState();
```

### Multi-Channel Processing

```typescript
import { createDspPipeline } from "dsp-ts-redis";

const pipeline = createDspPipeline();
pipeline.MovingAverage({ windowSize: 50 });

// Process 4-channel EMG data
// Data format: [ch1_s1, ch2_s1, ch3_s1, ch4_s1, ch1_s2, ch2_s2, ...]
const fourChannelData = new Float32Array(4000); // 1000 samples × 4 channels

const output = await pipeline.process(fourChannelData, {
  sampleRate: 2000,
  channels: 4, // Each channel maintains its own filter state
});

// Each channel is processed independently with its own circular buffer
```

---

## 🔗 API Reference

### Creating a Pipeline

```typescript
import { createDspPipeline, type RedisConfig } from "dsp-ts-redis";

interface RedisConfig {
  redisHost?: string;   // Redis server hostname (optional)
  redisPort?: number;   // Redis server port (optional)
  stateKey?: string;    // Key prefix for state storage (optional)
}

const pipeline = createDspPipeline(config?: RedisConfig);
```

### Process Options

```typescript
interface ProcessOptions {
  sampleRate: number;   // Sample rate in Hz (required)
  channels?: number;    // Number of channels (default: 1)
}

await pipeline.process(input: Float32Array, options: ProcessOptions);
```

### Available Filters

#### Currently Implemented

##### Moving Average Filter

```typescript
pipeline.MovingAverage({ windowSize: number });
```

Implements a simple moving average (SMA) filter using a circular buffer for O(1) average calculation.

**Parameters:**

- `windowSize`: Number of samples to average over

**Features:**

- Maintains running sum for optimal performance
- Circular buffer with efficient memory usage
- Per-channel state for multi-channel processing
- Full state serialization to Redis

#### � Coming Soon

The following filters are planned for future releases:

- **IIR/FIR Filters**: Butterworth, Chebyshev, notch filters
- **Transform Domain**: FFT, STFT, Hilbert transform
- **EMG/Biosignal**: Rectification, envelope detection
- **Feature Extraction**: RMS, variance, zero-crossing rate

See the [project roadmap](./ROADMAP.md) for more details.

---

### Core Methods

#### `process(input, options)`

Process data in-place (modifies input buffer for performance):

```typescript
const input = new Float32Array([1, 2, 3, 4, 5]);
const output = await pipeline.process(input, {
  sampleRate: 2000,
  channels: 1,
});
// input === output (same reference)
```

#### `processCopy(input, options)`

Process a copy of the data (preserves original):

```typescript
const input = new Float32Array([1, 2, 3, 4, 5]);
const output = await pipeline.processCopy(input, {
  sampleRate: 2000,
  channels: 1,
});
// input !== output (different references)
```

#### `saveState()`

Serialize the current pipeline state to JSON:

```typescript
const stateJson = await pipeline.saveState();
// Returns: JSON string with all filter states
await redis.set("dsp:state:key", stateJson);
```

#### `loadState(stateJson)`

Deserialize and restore pipeline state from JSON:

```typescript
const stateJson = await redis.get("dsp:state:key");
if (stateJson) {
  await pipeline.loadState(stateJson);
}
```

#### `clearState()`

Reset all filter states to initial values:

```typescript
pipeline.clearState();
// All circular buffers cleared, running sums reset
```

---

## 🏗️ Architecture

### Native C++ Backend

- **N-API Bindings**: Direct TypedArray access for zero-copy processing
- **Async Processing**: Uses `Napi::AsyncWorker` to avoid blocking the event loop
- **Optimized Data Structures**: Circular buffers with O(1) operations
- **Template-Based**: Generic implementation supports int, float, double

### Redis State Persistence

The state serialization includes:

- **Circular buffer contents**: All samples in order (oldest to newest)
- **Running sums**: Maintained for O(1) average calculation
- **Per-channel state**: Independent state for each audio channel
- **Metadata**: Window size, channel count, timestamps

**State format:**

```json
{
  "timestamp": 1761156820,
  "stages": [
    {
      "index": 0,
      "type": "movingAverage",
      "state": {
        "windowSize": 3,
        "numChannels": 1,
        "channels": [
          {
            "buffer": [3, 4, 5],
            "runningSum": 12
          }
        ]
      }
    }
  ],
  "stageCount": 1
}
```

### Multi-Channel Processing

Each channel maintains its own independent filter state:

```typescript
// 4-channel interleaved data: [ch1, ch2, ch3, ch4, ch1, ch2, ...]
const input = new Float32Array(4000); // 1000 samples × 4 channels

const pipeline = createDspPipeline();
pipeline.MovingAverage({ windowSize: 50 });

const output = await pipeline.process(input, {
  sampleRate: 2000,
  channels: 4,
});

// Each channel has its own circular buffer and running sum
```

---

## 📊 Use Cases

### Streaming Data with Crash Recovery

```typescript
import { createDspPipeline } from "dsp-ts-redis";
import { createClient } from "redis";

const redis = await createClient({ url: "redis://localhost:6379" }).connect();
const stateKey = "dsp:stream:sensor01";

const pipeline = createDspPipeline({
  redisHost: "localhost",
  redisPort: 6379,
  stateKey,
});

pipeline.MovingAverage({ windowSize: 100 });

// Restore state if processing was interrupted
const savedState = await redis.get(stateKey);
if (savedState) {
  await pipeline.loadState(savedState);
  console.log("Resumed from saved state");
}

// Process streaming chunks
for await (const chunk of sensorStream) {
  const smoothed = await pipeline.process(chunk, {
    sampleRate: 1000,
    channels: 1,
  });

  // Save state after each chunk for crash recovery
  const state = await pipeline.saveState();
  await redis.set(stateKey, state);

  await sendToAnalytics(smoothed);
}
```

### Multi-Channel EMG Processing

```typescript
import { createDspPipeline } from "dsp-ts-redis";

// Process 4-channel EMG with independent filtering per channel
const pipeline = createDspPipeline();
pipeline.MovingAverage({ windowSize: 50 }); // Smooth envelope

// Interleaved 4-channel data
const emgData = new Float32Array(4000); // 1000 samples × 4 channels

const smoothed = await pipeline.process(emgData, {
  sampleRate: 2000,
  channels: 4,
});

// Each channel maintains independent circular buffer state
```

### Distributed Processing Across Workers

```typescript
// Worker 1 processes first part
const worker1 = createDspPipeline({
  redisHost: "redis.example.com",
  stateKey: "dsp:session:abc123",
});
worker1.MovingAverage({ windowSize: 100 });

await worker1.process(chunk1, { sampleRate: 2000, channels: 1 });
const state = await worker1.saveState();
await redis.set("dsp:session:abc123", state);

// Worker 2 continues exactly where Worker 1 left off
const worker2 = createDspPipeline({
  redisHost: "redis.example.com",
  stateKey: "dsp:session:abc123",
});
worker2.MovingAverage({ windowSize: 100 });

const savedState = await redis.get("dsp:session:abc123");
await worker2.loadState(savedState);
await worker2.process(chunk2, { sampleRate: 2000, channels: 1 });
// Processing continues seamlessly with exact buffer state
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

- **Redis overhead**: State save/load involves JSON serialization and network I/O (~1-10ms depending on state size and network latency).
- **In-place processing**: Use `process()` instead of `processCopy()` when you don't need to preserve the input buffer.
- **Async processing**: Filter processing runs on a background thread via `Napi::AsyncWorker` to avoid blocking the event loop.
- **Batch sizes**: Process reasonable chunk sizes (e.g., 512-4096 samples) to balance latency and throughput.

---

## 🧪 Testing & Development

### Building from Source

```bash
git clone https://github.com/yourusername/dsp-ts-redis.git
cd dsp-ts-redis
npm install
npm run build          # Compile C++ bindings with cmake-js
```

### Running Examples

```bash
# Make sure Redis is running
redis-server

# Run the Redis persistence example
npx tsx ./src/ts/examples/redis-example.ts

# Run the state management test
npx tsx ./src/ts/examples/test-state.ts
```

### Implementation Status

- ✅ **Moving Average Filter**: Fully implemented with state persistence
- ✅ **Circular Buffer**: Optimized with O(1) operations
- ✅ **Multi-Channel Support**: Independent state per channel
- ✅ **Redis State Serialization**: Complete buffer and sum persistence
- ✅ **Async Processing**: Background thread via Napi::AsyncWorker
- 🚧 **Additional Filters**: IIR, FIR, FFT (coming soon)

---

## 📚 Examples

Check out the `/src/ts/examples` directory for complete working examples:

- [`redis-example.ts`](./src/ts/examples/redis-example.ts) - Full Redis integration with state persistence
- [`test-state.ts`](./src/ts/examples/test-state.ts) - State management and serialization demo

---

## 🤝 Contributing

Contributions are welcome! This project is in active development.

### Priority Areas

1. **Additional Filters**: IIR, FIR, Butterworth, Chebyshev, notch filters
2. **Transform Domain**: FFT, STFT, wavelet transforms
3. **Performance**: SIMD optimizations, benchmarking
4. **Testing**: Unit tests, validation against SciPy/NumPy
5. **Documentation**: More examples, API docs, tutorials

### Development Workflow

```bash
git clone https://github.com/yourusername/dsp-ts-redis.git
cd dsp-ts-redis
npm install
npm run build          # Compile C++ with cmake-js
npm run dev            # Watch mode for development
```

---

## 📄 License

MIT © [Your Name]

**Third-party licenses:**

- KissFFT (BSD-3-Clause)
- Eigen (MPL2)

---

## 🙏 Acknowledgments

Built with:

- [N-API](https://nodejs.org/api/n-api.html) and [node-addon-api](https://github.com/nodejs/node-addon-api) for native bindings
- [cmake-js](https://github.com/cmake-js/cmake-js) for C++ compilation
- [Redis](https://redis.io/) for state persistence
- [TypeScript](https://www.typescriptlang.org/) for type safety

Inspired by:

- [SciPy](https://scipy.org/) signal processing
- [librosa](https://librosa.org/) audio analysis

---

---

**Built for real-time signal processing in Node.js** 🚀
