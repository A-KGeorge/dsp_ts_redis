# Quick Reference: Logger API

## Installation

```typescript
import { Logger, createConsoleHandler, createLokiHandler } from "dsp-ts-redis";
```

---

## Creating a Logger

### Basic Logger

```typescript
const logger = new Logger([createConsoleHandler()]);
```

### Production Logger (Multiple Backends)

```typescript
const logger = new Logger([
  createConsoleHandler(),
  createLokiHandler({ endpoint: "...", apiKey: "..." }),
  createPrometheusHandler({ endpoint: "..." }),
  createPagerDutyHandler({ endpoint: "...", apiKey: "..." }),
  createCloudWatchHandler({ endpoint: "...", apiKey: "..." }),
  createDatadogHandler({ endpoint: "...", apiKey: "..." }),
]);
```

### With Custom Fallback Handler

```typescript
const customFallback = (log) => {
  fs.appendFileSync("/var/log/dsp-errors.log", JSON.stringify(log));
};

const logger = new Logger([...handlers], customFallback);
```

---

## Logging Methods

### Basic Logging

```typescript
await logger.debug("Debug message");
await logger.info("Info message");
await logger.warn("Warning message");
await logger.error("Error message");
```

### With Topic

```typescript
await logger.info("Connection established", "redis.connection");
await logger.error("Processing failed", "dsp.filter.error");
```

### With Context

```typescript
await logger.info("Processing complete", "dsp.result", {
  channels: 8,
  samples: 10000,
  duration_ms: 142,
  filters: ["MovingAverage", "RMS"],
});
```

---

## Child Loggers

### Creating Child Loggers

```typescript
const appLogger = new Logger([...]);

// Child with prefix "pipeline"
const pipelineLogger = appLogger.child("pipeline");

// Nested child with prefix "pipeline.filter"
const filterLogger = pipelineLogger.child("filter");
```

### Usage

```typescript
// Logs to topic: "pipeline.filter.init"
await filterLogger.info("MovingAverage initialized", "init", {
  windowSize: 10,
});
```

---

## Backend Handlers

### Console Handler

```typescript
createConsoleHandler(config?)
```

- **Use**: Development, debugging
- **Output**: Colored console logs with timestamps

### Loki Handler

```typescript
createLokiHandler({
  endpoint: "https://loki.example.com",
  apiKey: "your-api-key", // Optional
  batchSize: 100, // Default: 100
  flushInterval: 5000, // Default: 5000ms
});
```

- **Use**: Centralized log aggregation
- **Features**: Batching, auto-flush, resilient requeue

### Prometheus Handler

```typescript
createPrometheusHandler({
  endpoint: "https://prometheus-pushgateway.example.com",
});
```

- **Use**: Metrics export
- **Format**: Prometheus text format

### PagerDuty Handler

```typescript
createPagerDutyHandler({
  endpoint: "https://events.pagerduty.com/v2/enqueue",
  apiKey: "your-routing-key",
});
```

- **Use**: Critical alerts, incident management
- **Severity**: error → critical, warn → warning

### CloudWatch Handler

```typescript
createCloudWatchHandler({
  endpoint: "https://logs.amazonaws.com",
  apiKey: "your-aws-credentials",
});
```

- **Use**: AWS-native logging
- **Format**: CloudWatch Logs JSON

### Datadog Handler

```typescript
createDatadogHandler({
  endpoint: "https://http-intake.logs.datadoghq.com", // Default
  apiKey: "your-datadog-api-key",
});
```

- **Use**: Unified observability platform
- **Features**: Tags, custom fields

### Mock Handler (Testing)

```typescript
const mock = createMockHandler((log) => {
  console.log("Log received:", log);
});

// Get all captured logs
const logs = mock.getLogs();

// Clear captured logs
mock.clear();
```

---

## Advanced Patterns

### Error Isolation

```typescript
// One failing handler doesn't stop others
const logger = new Logger([
  workingHandler1,
  failingHandler, // ❌ Will fail
  workingHandler2, // ✅ Still works
]);
```

### Conditional Logging

```typescript
const handlers = [createConsoleHandler()];

if (process.env.NODE_ENV === "production") {
  handlers.push(createLokiHandler({ ... }));
  handlers.push(createPagerDutyHandler({ ... }));
}

const logger = new Logger(handlers);
```

### Custom Handler

```typescript
const customHandler = async (log: LogEntry): Promise<void> => {
  // Your custom logic
  await sendToCustomAPI(log);
};

const logger = new Logger([customHandler, createConsoleHandler()]);
```

---

## Configuration Reference

### BackendConfig

```typescript
interface BackendConfig {
  endpoint?: string; // API endpoint URL
  apiKey?: string; // Authentication key/token
  headers?: Record<string, string>; // Additional HTTP headers
  batchSize?: number; // Batch size for buffering (Loki only)
  flushInterval?: number; // Flush interval in ms (Loki only)
}
```

### LogEntry

```typescript
interface LogEntry {
  level: "debug" | "info" | "warn" | "error";
  message: string;
  topic?: string;
  context?: any;
  timestamp: number; // Unix timestamp (milliseconds)
}
```

---

## Best Practices

### 1. Use Child Loggers for Modules

```typescript
// app.ts
const appLogger = new Logger([...]);

// pipeline.ts
export const pipelineLogger = appLogger.child("pipeline");

// filter.ts
export const filterLogger = pipelineLogger.child("filter");
```

### 2. Structured Context Over String Interpolation

```typescript
// ❌ Bad
await logger.info(`Processing ${count} samples in ${duration}ms`);

// ✅ Good
await logger.info("Processing complete", "dsp", {
  samples: count,
  duration_ms: duration,
});
```

### 3. Topic Naming Convention

```typescript
// Use dot-separated hierarchical topics
await logger.info("...", "app.module.component.event");

// Examples:
("dsp.pipeline.init");
("dsp.filter.mavg.processed");
("redis.connection.established");
("redis.connection.error");
```

### 4. Error Context

```typescript
try {
  await processData();
} catch (error) {
  await logger.error("Processing failed", "dsp.error", {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    input: { samples: data.length },
  });
}
```

---

## Performance Tips

1. **Use batching** for high-volume logging (Loki handler)
2. **Limit concurrent handlers** to 5-10 max
3. **Use child loggers** to avoid repeating topic prefixes
4. **Filter debug logs** in production
5. **Monitor handler errors** via fallback logs

---

## Troubleshooting

### Logs Not Appearing?

- Check endpoint URL is correct
- Verify API keys are valid
- Check network connectivity
- Look for handler errors in fallback logs

### High Latency?

- Reduce number of handlers
- Increase Loki batch size
- Check backend endpoint response times

### Memory Usage High?

- Reduce Loki batch size
- Increase flush interval
- Limit buffer sizes

---

## Examples

See `src/ts/examples/logger-example.ts` for complete working examples.
