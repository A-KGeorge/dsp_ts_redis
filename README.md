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

**Use cases:**

- Signal smoothing and noise reduction
- Trend analysis
- Low-pass filtering for real-time data streams

##### RMS (Root Mean Square) Filter

```typescript
pipeline.Rms({ windowSize: number });
```

Implements an efficient RMS filter using a circular buffer with running sum of squares for O(1) calculation. Converts negative values to magnitude (always positive output).

**Parameters:**

- `windowSize`: Number of samples to calculate RMS over

**Features:**

- Maintains running sum of squares for optimal performance
- Circular buffer with efficient memory usage
- Per-channel state for multi-channel processing
- Full state serialization to Redis including buffer contents and running sum of squares

**Use cases:**

- Signal envelope detection (amplitude tracking)
- Power measurement in audio/EMG signals
- Feature extraction for machine learning
- Quality metrics for sensor data

**Example:**

```typescript
const pipeline = createDspPipeline();
pipeline.Rms({ windowSize: 20 });

// Process amplitude-modulated signal
const signal = new Float32Array([1, -2, 3, -4, 5]);
const rms = await pipeline.process(signal, { sampleRate: 1000, channels: 1 });
console.log(rms); // [1.0, 1.58, 2.16, 2.74, 3.32] - magnitude values
```

##### Rectify Filter

```typescript
pipeline.Rectify(params?: { mode?: "full" | "half" });
```

Implements signal rectification with two modes: full-wave (absolute value) and half-wave (zero out negatives). Stateless operation with no internal buffers.

**Parameters:**

- `mode` (optional): Rectification mode
  - `"full"` (default): Full-wave rectification (absolute value) - converts all samples to positive
  - `"half"`: Half-wave rectification - positive samples unchanged, negative samples → 0

**Features:**

- Zero overhead - simple sample-by-sample transformation
- No internal state/buffers (stateless)
- Mode is serializable for pipeline persistence
- Works independently on each sample (no windowing)

**Use cases:**

- EMG signal pre-processing before envelope detection
- AC to DC conversion in audio/biosignal processing
- Preparing signals for RMS or moving average smoothing
- Feature extraction requiring positive-only values

**Examples:**

```typescript
// Full-wave rectification (default) - converts to absolute value
const pipeline1 = createDspPipeline();
pipeline1.Rectify(); // or Rectify({ mode: "full" })

const bipolar = new Float32Array([1, -2, 3, -4, 5]);
const fullWave = await pipeline1.process(bipolar, {
  sampleRate: 1000,
  channels: 1,
});
console.log(fullWave); // [1, 2, 3, 4, 5] - all positive

// Half-wave rectification - zeros out negatives
const pipeline2 = createDspPipeline();
pipeline2.Rectify({ mode: "half" });

const halfWave = await pipeline2.process(new Float32Array([1, -2, 3, -4, 5]), {
  sampleRate: 1000,
  channels: 1,
});
console.log(halfWave); // [1, 0, 3, 0, 5] - negatives become zero

// Common pipeline: Rectify → RMS for EMG envelope
const emgPipeline = createDspPipeline();
emgPipeline
  .Rectify({ mode: "full" }) // Convert to magnitude
  .Rms({ windowSize: 50 }); // Calculate envelope
```

#### 🚧 Coming Soon

The following filters are planned for future releases:

- **IIR/FIR Filters**: Butterworth, Chebyshev, notch filters
- **Transform Domain**: FFT, STFT, Hilbert transform
- **EMG/Biosignal**: Specialized EMG processing stages
- **Feature Extraction**: Variance, zero-crossing rate, peak detection

See the [project roadmap](./ROADMAP.md) for more details.

---

### Pipeline Callbacks (Monitoring & Observability)

Configure callbacks for monitoring, alerting, and observability. The library supports both **individual** and **pooled/batched** callbacks:

#### Basic Usage

```typescript
import { createDspPipeline } from "dsp-ts-redis";
import type { PipelineCallbacks } from "dsp-ts-redis";

const callbacks: PipelineCallbacks = {
  // Monitor individual samples (use sparingly - can impact performance)
  onSample: (value, index, stage) => {
    if (value > THRESHOLD) {
      triggerAlert(index, stage);
    }
  },

  // Track performance metrics
  onStageComplete: (stage, durationMs) => {
    metrics.record(`dsp.${stage}.duration`, durationMs);
  },

  // Handle errors gracefully
  onError: (stage, error) => {
    logger.error(`Stage ${stage} failed`, error);
  },

  // Structured logging (called immediately for each log)
  onLog: (level, msg, context) => {
    if (level === "debug") return; // Filter debug logs
    console.log(`[${level}] ${msg}`, context);
  },
};

// Configure callbacks before adding filters
const pipeline = createDspPipeline()
  .pipeline(callbacks)
  .MovingAverage({ windowSize: 10 })
  .Rectify()
  .Rms({ windowSize: 5 });
```

#### Pooled/Batched Callbacks (Better Performance)

For high-throughput scenarios, use **pooled callbacks** to reduce overhead:

```typescript
const callbacks: PipelineCallbacks = {
  // Process samples in batches (more efficient than onSample)
  onBatch: (batch) => {
    console.log(`Stage: ${batch.stage}`);
    console.log(`Samples: ${batch.count}`);

    // Process entire batch efficiently (SIMD-friendly)
    for (let i = 0; i < batch.samples.length; i++) {
      if (batch.samples[i] > THRESHOLD) {
        triggerAlert(batch.startIndex + i, batch.stage);
      }
    }
  },

  // Receive all logs at once (pooled during processing)
  onLogBatch: (logs) => {
    // Send all logs to external system in one request
    await loggingService.sendBatch(
      logs.map((log) => ({
        level: log.level,
        message: log.message,
        timestamp: log.timestamp,
        ...log.context,
      }))
    );
  },

  onStageComplete: (stage, durationMs) => {
    metrics.record(`dsp.${stage}.duration`, durationMs);
  },
};
```

**When to Use What:**

| Callback Type     | Best For                                                      | Throughput       | Production Safety                       |
| ----------------- | ------------------------------------------------------------- | ---------------- | --------------------------------------- |
| `onSample`        | Peak detection, threshold alerts, individual value monitoring | ~6M samples/sec  | ⚠️ **RISKY** - Blocks event loop        |
| `onBatch`         | Batch aggregation, efficient sample processing                | ~23M samples/sec | ✅ **SAFE** - Non-blocking              |
| `onLog`           | Real-time logging, immediate output                           | Variable         | ⚠️ **RISKY** - Synchronous I/O per call |
| `onLogBatch`      | External logging services, log aggregation                    | ~3M samples/sec  | ✅ **SAFE** - Batched, non-blocking     |
| `onStageComplete` | Performance metrics, timing                                   | ✅ Minimal       | ✅ **SAFE** - 1 call per process        |
| `onError`         | Error handling                                                | ✅ Minimal       | ✅ **SAFE** - Only on error             |

**Critical Performance & Safety Notes:**

- **🚨 Individual callbacks (`onSample`, `onLog`) are fast but dangerous**:

  - Higher raw throughput in microbenchmarks (~6M samples/sec)
  - **Block the Node.js event loop** with millions of synchronous function calls
  - Synchronous I/O operations in callbacks can stall entire pipeline
  - Unpredictable GC pressure from per-call allocations
  - **NOT recommended for production servers**

- **✅ Pooled callbacks (`onBatch`, `onLogBatch`) are production-safe**:

  - Stable, predictable throughput (~3M samples/sec sustained)
  - **Non-blocking**: Batched operations prevent event loop starvation
  - **Backpressure-friendly**: Aligns with real-world telemetry systems (Kafka, Loki, Prometheus)
  - Fixed memory footprint via circular buffer (no unbounded growth)
  - **Recommended for high-throughput production environments**

- **Architecture trade-off**:

  - Individual mode: 2x faster in synthetic benchmarks, but impractical for live servers
  - Pooled mode: Slight raw speed reduction, but guarantees non-blocking safety
  - **Industry standard**: Pooled/batched callbacks match production observability patterns (Kafka producers, OpenTelemetry exporters, Loki agents)

- **Circular buffer implementation**:
  - Fixed capacity: 32 log entries (typical: 2-3 logs per process call)
  - Zero reallocations after initialization
  - Cache-friendly memory access pattern
  - Graceful overflow: Overwrites oldest entries (prevents memory leaks)

See `src/ts/examples/callbacks/` for complete examples including performance comparisons.

---

### Topic-Based Logging (Kafka-Style Filtering)

Filter logs using **Kafka-style hierarchical topics** for efficient, selective subscription:

#### Topic Structure

```
pipeline.debug                         # General debug logs
pipeline.info                          # General info logs
pipeline.warn                          # General warnings
pipeline.error                         # General errors
pipeline.stage.<stageName>.<category>  # Stage-specific logs
  ├── samples                          # Sample-level data
  ├── performance                      # Timing/metrics
  └── error                            # Stage errors
```

#### Basic Topic Filtering

```typescript
const pipeline = createDspPipeline();

// Subscribe to ALL logs (no filter)
pipeline.pipeline({
  onLogBatch: (logs) => {
    logs.forEach((log) => {
      console.log(`[${log.topic}] ${log.level}: ${log.message}`);
      // [pipeline.debug] debug: Starting pipeline processing
      // [pipeline.stage.rms.performance] info: RMS processing complete
    });
  },
});

// Filter by stage (only RMS logs)
pipeline.pipeline({
  onLogBatch: (logs) => {
    logs.forEach((log) => console.log(log.message));
  },
  topicFilter: "pipeline.stage.rms.*", // Only RMS stage logs
});

// Filter by category (only errors)
pipeline.pipeline({
  onLogBatch: (logs) => {
    if (logs.length > 0) {
      alertService.notify("Pipeline errors detected", logs);
    }
  },
  topicFilter: "pipeline.*.error", // All errors from any stage
});

// Multiple filters (errors + performance)
pipeline.pipeline({
  onLogBatch: (logs) => {
    logs.forEach((log) => {
      if (log.topic.includes("error")) {
        errorAlerts.push(log);
      } else {
        metrics.push(log);
      }
    });
  },
  topicFilter: [
    "pipeline.*.error", // All errors
    "pipeline.*.performance", // All performance metrics
  ],
});
```

#### Topic-Based Routing (Production Pattern)

```typescript
const pipeline = createDspPipeline();

pipeline.pipeline({
  onLogBatch: (logs) => {
    // Route logs to different backends based on topic
    logs.forEach((log) => {
      if (log.topic.includes("error")) {
        // Send errors to alerting system (PagerDuty, Slack, etc.)
        await alerting.send(log);
      } else if (
        log.topic.includes("performance") ||
        log.topic.includes("samples")
      ) {
        // Send metrics to monitoring (Prometheus, Datadog, etc.)
        await metrics.record(log.topic, log.context);
      } else {
        // Send debug logs to centralized logging (Loki, Elasticsearch, etc.)
        await logging.send(log);
      }
    });
  },
});
```

**Topic Filter Patterns:**

| Pattern                                        | Matches                                   |
| ---------------------------------------------- | ----------------------------------------- |
| `pipeline.stage.*`                             | All logs from any stage                   |
| `pipeline.stage.rms.*`                         | Only RMS stage logs                       |
| `pipeline.*.error`                             | All errors (any stage)                    |
| `pipeline.*.performance`                       | All performance metrics                   |
| `['pipeline.error', 'pipeline.stage.*.error']` | Multiple patterns (errors from any stage) |

**Production Benefits:**

- ✅ **Selective subscription** - Filter at source, reduce processing overhead
- ✅ **Topic-based routing** - Different topics → different backends (Kafka, Loki, Prometheus)
- ✅ **Industry alignment** - Matches telemetry standards (Kafka topics, NATS subjects, MQTT topics)
- ✅ **Efficient filtering** - Wildcard patterns processed before callback invocation

See `src/ts/examples/callbacks/topic-based-logging.ts` for comprehensive examples.

---

### Topic Router (Fan-Out to Multiple Backends)

The `TopicRouter` provides **production-grade fan-out routing** to multiple observability backends, matching patterns used by Grafana Loki, OpenTelemetry, and FluentBit:

#### Builder Pattern (Recommended)

```typescript
import { createDspPipeline, createTopicRouter } from "dsp-ts-redis";

const router = createTopicRouter()
  // Critical errors → PagerDuty
  .errors(async (log) => {
    await pagerDuty.alert(log);
  })

  // Performance metrics → Prometheus
  .performance(async (log) => {
    await prometheus.record(log.topic, log.context);
  })

  // Debug logs → Loki
  .debug(async (log) => {
    await loki.send(log);
  })

  // Everything else → CloudWatch (backup)
  .default(async (log) => {
    await cloudwatch.send(log);
  })
  .build();

const pipeline = createDspPipeline();
pipeline
  .pipeline({
    onLogBatch: (logs) => router.routeBatch(logs),
  })
  .MovingAverage({ windowSize: 10 })
  .Rms({ windowSize: 5 });
```

#### Custom Route Patterns

```typescript
const router = createTopicRouter()
  .custom(/^pipeline\.error/, pagerDuty.alert, "error-alerts")
  .custom(/^pipeline\.stage\.rms/, prometheusHandler, "rms-metrics")
  .custom(/^pipeline\.performance/, prometheusHandler, "performance")
  .custom(/.*/, loki.send, "default-logs")
  .build();
```

#### Multi-Backend Fan-Out

```typescript
// Route errors to BOTH PagerDuty AND CloudWatch
const router = createTopicRouter()
  .errors(async (log) => {
    await Promise.all([
      pagerDuty.alert(log),
      cloudwatch.send(log), // Backup for audit
    ]);
  })
  .build();
```

#### Stage-Specific Routing

```typescript
const router = createTopicRouter()
  .stage("rms", async (log) => {
    // Only RMS stage logs
    await prometheus.record(log.topic, log.context);
  })
  .stage("movingAverage", async (log) => {
    // Only MovingAverage stage logs
    await loki.send(log);
  })
  .build();
```

**Router API:**

| Method           | Purpose                                        | Example                      |
| ---------------- | ---------------------------------------------- | ---------------------------- |
| `.errors()`      | Route errors to alerting (PagerDuty, Slack)    | Critical alerts              |
| `.performance()` | Route metrics to monitoring (Prometheus, DD)   | Timing, throughput           |
| `.debug()`       | Route debug logs to centralized logging (Loki) | Development traces           |
| `.alerts()`      | Route threshold crossings to alerting          | Anomaly detection            |
| `.stage(name)`   | Route stage-specific logs                      | Per-filter monitoring        |
| `.custom(regex)` | Route with custom pattern                      | Organization-specific topics |
| `.default()`     | Catch-all route (add last)                     | Backup logging               |

**Production Benefits:**

- ✅ **Parallel routing**: All backends called concurrently (`Promise.all`)
- ✅ **Non-blocking**: Async handlers prevent DSP throughput impact
- ✅ **Error isolation**: Failed backend doesn't break pipeline
- ✅ **Type-safe**: Full TypeScript support with RouteHandler type
- ✅ **Extensible**: Add routes without modifying pipeline code
- ✅ **Industry standard**: Matches Loki, OTEL, FluentBit, Vector.dev patterns

See `src/ts/examples/callbacks/production-topic-router.ts` for comprehensive examples.

---

### Debugging with `.tap()`

Inspect pipeline intermediate results at any point using `.tap()` - a pure TypeScript method (no C++ changes):

```typescript
const pipeline = createDspPipeline()
  .MovingAverage({ windowSize: 10 })
  .tap((samples, stage) => {
    console.log(`After ${stage}:`, samples.slice(0, 5));
  })
  .Rectify({ mode: "full" })
  .tap((samples, stage) => {
    const max = Math.max(...samples);
    if (max > THRESHOLD) {
      logger.warn(`High value detected at ${stage}: ${max}`);
    }
  })
  .Rms({ windowSize: 5 });
```

**Use Cases:**

- 🐛 **Debug pipeline behavior** - Inspect values between stages
- 📊 **Collect statistics** - Calculate min/max/mean at any point
- ⚠️ **Threshold monitoring** - Alert on anomalies during processing
- 📝 **Logger integration** - Conditional logging based on sample values
- 🔍 **Development insights** - Understand signal transformations

**Performance:**

- Minimal overhead (~4% with empty callbacks in benchmarks)
- Remove `.tap()` calls in production or use conditional logic
- Errors in tap callbacks are caught and logged (won't break pipeline)

See `src/ts/examples/tap-debugging.ts` for comprehensive examples.

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
- **Running sums/squares**: Maintained for O(1) calculations (moving average uses `runningSum`, RMS uses `runningSumOfSquares`)
- **Per-channel state**: Independent state for each audio channel
- **Metadata**: Window size, channel count, timestamps, filter type

**State format examples:**

Moving Average state:

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

RMS state:

```json
{
  "timestamp": 1761168608,
  "stages": [
    {
      "index": 0,
      "type": "rms",
      "state": {
        "windowSize": 3,
        "numChannels": 1,
        "channels": [
          {
            "buffer": [6, -7, 8],
            "runningSumOfSquares": 149
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

// Process 4-channel EMG with rectification + RMS envelope detection
const pipeline = createDspPipeline();
pipeline
  .Rectify({ mode: "full" }) // Convert bipolar EMG to magnitude
  .Rms({ windowSize: 50 }); // Calculate RMS envelope

// Interleaved 4-channel data
const emgData = new Float32Array(4000); // 1000 samples × 4 channels

const envelope = await pipeline.process(emgData, {
  sampleRate: 2000,
  channels: 4,
});

// Each channel maintains independent filter states
// Output is smooth envelope tracking muscle activation
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
npx tsx ./src/ts/examples/redis/redis-example.ts

# Moving Average examples
npx tsx ./src/ts/examples/MovingAverage/test-state.ts
npx tsx ./src/ts/examples/MovingAverage/test-streaming.ts

# RMS examples
npx tsx ./src/ts/examples/RMS/test-state.ts
npx tsx ./src/ts/examples/RMS/test-streaming.ts

# Rectify examples
npx tsx ./src/ts/examples/Rectify/test-state.ts
npx tsx ./src/ts/examples/Rectify/test-streaming.ts
```

### Implementation Status

- ✅ **Moving Average Filter**: Fully implemented with state persistence
- ✅ **RMS Filter**: Fully implemented with state persistence and envelope detection
- ✅ **Rectify Filter**: Full-wave and half-wave rectification with mode persistence
- ✅ **Circular Buffer**: Optimized with O(1) operations
- ✅ **Multi-Channel Support**: Independent state per channel
- ✅ **Redis State Serialization**: Complete buffer and sum/sum-of-squares persistence
- ✅ **Async Processing**: Background thread via Napi::AsyncWorker
- ✅ **Streaming Tests**: Comprehensive streaming validation with interruption recovery
- 🚧 **Additional Filters**: IIR, FIR, FFT (coming soon)

---

## 📚 Examples

Check out the `/src/ts/examples` directory for complete working examples:

### Redis Integration

- [`redis/redis-example.ts`](./src/ts/examples/redis/redis-example.ts) - Full Redis integration with state persistence

### Moving Average Filter

- [`MovingAverage/test-state.ts`](./src/ts/examples/MovingAverage/test-state.ts) - State management (save/load/clear)
- [`MovingAverage/test-streaming.ts`](./src/ts/examples/MovingAverage/test-streaming.ts) - Streaming data processing with interruption recovery

### RMS Filter

- [`RMS/test-state.ts`](./src/ts/examples/RMS/test-state.ts) - RMS state management with negative values
- [`RMS/test-streaming.ts`](./src/ts/examples/RMS/test-streaming.ts) - Real-time envelope detection and multi-channel RMS

### Rectify Filter

- [`Rectify/test-state.ts`](./src/ts/examples/Rectify/test-state.ts) - Full-wave and half-wave rectification with state persistence
- [`Rectify/test-streaming.ts`](./src/ts/examples/Rectify/test-streaming.ts) - EMG pre-processing and multi-channel rectification

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
