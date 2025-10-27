# Advanced Features

This document covers advanced observability, monitoring, and debugging features for production deployments.

---

## Table of Contents

- [Pipeline Callbacks (Monitoring & Observability)](#pipeline-callbacks-monitoring--observability)
- [Topic-Based Logging (Kafka-Style Filtering)](#topic-based-logging-kafka-style-filtering)
- [Topic Router (Fan-Out to Multiple Backends)](#topic-router-fan-out-to-multiple-backends)
- [Priority-Based Routing (10-Level System)](#priority-based-routing-10-level-system)
- [Debugging with `.tap()`](#debugging-with-tap)

---

## Pipeline Callbacks (Monitoring & Observability)

Configure callbacks for monitoring, alerting, and observability. The library supports both **individual** and **pooled/batched** callbacks:

### Basic Usage

```typescript
import { createDspPipeline } from "dspx";
import type { PipelineCallbacks } from "dspx";

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

### Pooled/Batched Callbacks (Better Performance)

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

### Callback Comparison

| Callback Type     | Best For                                                      | Throughput       | Production Safety                       |
| ----------------- | ------------------------------------------------------------- | ---------------- | --------------------------------------- |
| `onSample`        | Peak detection, threshold alerts, individual value monitoring | ~6M samples/sec  | ⚠️ **RISKY** - Blocks event loop        |
| `onBatch`         | Batch aggregation, efficient sample processing                | ~23M samples/sec | ✅ **SAFE** - Non-blocking              |
| `onLog`           | Real-time logging, immediate output                           | Variable         | ⚠️ **RISKY** - Synchronous I/O per call |
| `onLogBatch`      | External logging services, log aggregation                    | ~3M samples/sec  | ✅ **SAFE** - Batched, non-blocking     |
| `onStageComplete` | Performance metrics, timing                                   | ✅ Minimal       | ✅ **SAFE** - 1 call per process        |
| `onError`         | Error handling                                                | ✅ Minimal       | ✅ **SAFE** - Only on error             |

### Critical Performance & Safety Notes

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

## Topic-Based Logging (Kafka-Style Filtering)

Filter logs using **Kafka-style hierarchical topics** for efficient, selective subscription:

### Topic Structure

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

### Basic Topic Filtering

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

### Topic-Based Routing (Production Pattern)

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

### Topic Filter Patterns

| Pattern                                        | Matches                                   |
| ---------------------------------------------- | ----------------------------------------- |
| `pipeline.stage.*`                             | All logs from any stage                   |
| `pipeline.stage.rms.*`                         | Only RMS stage logs                       |
| `pipeline.*.error`                             | All errors (any stage)                    |
| `pipeline.*.performance`                       | All performance metrics                   |
| `['pipeline.error', 'pipeline.stage.*.error']` | Multiple patterns (errors from any stage) |

### Production Benefits

- ✅ **Selective subscription** - Filter at source, reduce processing overhead
- ✅ **Topic-based routing** - Different topics → different backends (Kafka, Loki, Prometheus)
- ✅ **Industry alignment** - Matches telemetry standards (Kafka topics, NATS subjects, MQTT topics)
- ✅ **Efficient filtering** - Wildcard patterns processed before callback invocation

See `src/ts/examples/callbacks/topic-based-logging.ts` for comprehensive examples.

---

## Topic Router (Fan-Out to Multiple Backends)

The `TopicRouter` provides **production-grade fan-out routing** to multiple observability backends, matching patterns used by Grafana Loki, OpenTelemetry, and FluentBit:

### Builder Pattern (Recommended)

```typescript
import { createDspPipeline, createTopicRouter } from "dspx";

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

### Custom Route Patterns

```typescript
const router = createTopicRouter()
  .custom(/^pipeline\.error/, pagerDuty.alert, "error-alerts")
  .custom(/^pipeline\.stage\.rms/, prometheusHandler, "rms-metrics")
  .custom(/^pipeline\.performance/, prometheusHandler, "performance")
  .custom(/.*/, loki.send, "default-logs")
  .build();
```

### Multi-Backend Fan-Out

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

### Stage-Specific Routing

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

### Router API

| Method           | Purpose                                        | Example                      |
| ---------------- | ---------------------------------------------- | ---------------------------- |
| `.errors()`      | Route errors to alerting (PagerDuty, Slack)    | Critical alerts              |
| `.performance()` | Route metrics to monitoring (Prometheus, DD)   | Timing, throughput           |
| `.debug()`       | Route debug logs to centralized logging (Loki) | Development traces           |
| `.alerts()`      | Route threshold crossings to alerting          | Anomaly detection            |
| `.stage(name)`   | Route stage-specific logs                      | Per-filter monitoring        |
| `.custom(regex)` | Route with custom pattern                      | Organization-specific topics |
| `.default()`     | Catch-all route (add last)                     | Backup logging               |

### Production Benefits

- ✅ **Parallel routing**: All backends called concurrently (`Promise.all`)
- ✅ **Non-blocking**: Async handlers prevent DSP throughput impact
- ✅ **Error isolation**: Failed backend doesn't break pipeline
- ✅ **Type-safe**: Full TypeScript support with RouteHandler type
- ✅ **Extensible**: Add routes without modifying pipeline code
- ✅ **Industry standard**: Matches Loki, OTEL, FluentBit, Vector.dev patterns

See `src/ts/examples/callbacks/production-topic-router.ts` for comprehensive examples.

---

## Priority-Based Routing (10-Level System)

The library supports a **10-level priority system** for fine-grained log filtering and routing. Each log can be assigned a priority from 1 (lowest) to 10 (highest), with default priorities automatically assigned based on log level.

### Default Priority Mapping

| Log Level | Priority | Use Case                   |
| --------- | -------- | -------------------------- |
| `debug`   | 2        | Development traces         |
| `info`    | 5        | General information        |
| `warn`    | 7        | Warnings, potential issues |
| `error`   | 9        | Critical errors, failures  |

Logs without an explicit priority default to **priority 1**.

### Basic Priority Filtering

```typescript
import { createDspPipeline, createTopicRouter } from "dspx";
import type { LogPriority } from "dspx";

// Route only high-priority logs (priority >= 7) to alerting
const router = createTopicRouter()
  .errors(pagerDuty.alert, {
    minPriority: 7, // Only warnings (7) and errors (9)
  })
  .performance(prometheus.record, {
    minPriority: 5, // Info (5) and above
    maxPriority: 7, // Exclude critical errors
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

### Custom Priority Assignment

```typescript
import type { LogEntry, LogPriority } from "dspx";

// Assign custom priorities in your backend handlers
const router = createTopicRouter()
  .custom(/^pipeline\.stage\.rms/, async (log: LogEntry) => {
    // Override priority based on context
    const priority: LogPriority = log.context?.rmsValue > 100 ? 10 : 5;

    await monitoring.send({
      ...log,
      priority,
      customField: "rms-analysis",
    });
  })
  .build();
```

### Multi-Tier Routing by Priority

```typescript
// Route logs to different backends based on priority tiers
const router = createTopicRouter()
  // Critical (9-10): Immediate alerting
  .custom(/.*/, pagerDuty.alert, "critical-alerts", {
    minPriority: 9,
  })

  // High (7-8): Slack notifications
  .custom(/.*/, slack.notify, "high-priority", {
    minPriority: 7,
    maxPriority: 8,
  })

  // Medium (4-6): Centralized logging
  .custom(/.*/, loki.send, "medium-priority", {
    minPriority: 4,
    maxPriority: 6,
  })

  // Low (1-3): Debug logs only
  .custom(/.*/, debugLogger.write, "low-priority", {
    maxPriority: 3,
  })
  .build();
```

### Priority with Metrics Tracking

```typescript
const router = createTopicRouter()
  .errors(async (log: LogEntry) => {
    // Track priority distribution
    metrics.increment("logs.priority", {
      level: log.level,
      priority: log.priority ?? 1,
    });

    // Only alert on high-priority errors
    if ((log.priority ?? 1) >= 8) {
      await pagerDuty.alert(log);
    }
  })
  .build();
```

### Dynamic Priority Assignment

```typescript
const router = createTopicRouter()
  .custom(/^pipeline\.performance/, async (log: LogEntry) => {
    // Calculate priority based on performance metrics
    const duration = log.context?.durationMs || 0;
    const priority: LogPriority =
      duration > 1000
        ? 10 // Critical slowdown
        : duration > 500
        ? 8 // High latency
        : duration > 100
        ? 5 // Normal
        : 2; // Fast

    await monitoring.send({
      ...log,
      priority,
      severity: priority >= 8 ? "high" : "normal",
    });
  })
  .build();
```

### Priority Filtering Options

| Option        | Type          | Description                      |
| ------------- | ------------- | -------------------------------- |
| `minPriority` | `LogPriority` | Minimum priority to route (1-10) |
| `maxPriority` | `LogPriority` | Maximum priority to route (1-10) |

### Production Benefits

- **Fine-grained control**: 10 priority levels for precise filtering
- **Default mapping**: Automatic priority assignment based on log level
- **Cost optimization**: Route low-priority logs to cheaper storage
- **Alert fatigue reduction**: Only high-priority logs trigger pages
- **Flexible thresholds**: Adjust priority cutoffs without code changes
- **Type-safe**: `LogPriority` type enforces valid values (1-10)

See `src/ts/examples/callbacks/priority-routing-example.ts` for comprehensive examples.

---

## Debugging with `.tap()`

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

### Use Cases

- 🐛 **Debug pipeline behavior** - Inspect values between stages
- 📊 **Collect statistics** - Calculate min/max/mean at any point
- ⚠️ **Threshold monitoring** - Alert on anomalies during processing
- 📝 **Logger integration** - Conditional logging based on sample values
- 🔍 **Development insights** - Understand signal transformations

### Performance

- Minimal overhead (~4% with empty callbacks in benchmarks)
- Remove `.tap()` calls in production or use conditional logic
- Errors in tap callbacks are caught and logged (won't break pipeline)

See `src/ts/examples/tap-debugging.ts` for comprehensive examples.

---

## Back to Main Documentation

[← Back to README](../README.md)
