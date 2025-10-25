/**
 * Example: Production-Ready Unified Logger
 *
 * This example demonstrates the new Logger class with multiple backend handlers,
 * error isolation, and structured logging capabilities.
 */

import {
  Logger,
  createConsoleHandler,
  createLokiHandler,
  createPrometheusHandler,
  createPagerDutyHandler,
} from "../index.js";

// Example 1: Basic logger with console output
const basicLogger = new Logger([createConsoleHandler()]);

await basicLogger.info("Pipeline initialized");
await basicLogger.warn("High latency detected", "performance", {
  latency: 450,
});
await basicLogger.error("Connection failed", "redis.connection", {
  host: "localhost",
  port: 6379,
});

// Example 2: Production logger with multiple backends
const productionLogger = new Logger([
  // Console for local debugging
  createConsoleHandler(),

  // Loki for centralized log aggregation
  createLokiHandler({
    endpoint: "https://loki.example.com",
    apiKey: "your-loki-api-key",
    batchSize: 100,
    flushInterval: 5000,
  }),

  // Prometheus for metrics
  createPrometheusHandler({
    endpoint: "https://prometheus-pushgateway.example.com",
  }),

  // PagerDuty for critical alerts
  createPagerDutyHandler({
    endpoint: "https://events.pagerduty.com/v2/enqueue",
    apiKey: "your-routing-key",
  }),
]);

// Example 3: Child logger with topic prefix
const pipelineLogger = productionLogger.child("dsp.pipeline");
const filterLogger = pipelineLogger.child("filter");

await filterLogger.info("MovingAverage initialized", "init", {
  windowSize: 10,
  sampleRate: 1000,
});

// Example 4: Error isolation demonstration
const resilientLogger = new Logger([
  createConsoleHandler(), // This will work

  // Simulate a failing handler
  async () => {
    throw new Error("Network timeout");
  },

  createConsoleHandler(), // This will still work!
]);

// All handlers are isolated - one failure doesn't break others
await resilientLogger.info("Resilient logging works!");

// Example 5: Structured logging with rich context
await productionLogger.info("DSP processing complete", "dsp.result", {
  channels: 8,
  samples: 10000,
  duration_ms: 142,
  filters: ["MovingAverage", "RMS", "ZScoreNormalize"],
  metrics: {
    throughput: 70422, // samples/sec
    memory_mb: 3.2,
    cpu_percent: 12.5,
  },
  tags: ["production", "high-performance"],
});

console.log("\n✅ All examples completed successfully!");
