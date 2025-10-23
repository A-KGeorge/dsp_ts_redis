/**
 * Production Topic Router Example
 *
 * Demonstrates fan-out routing to multiple observability backends:
 * - Errors → PagerDuty/Alerting
 * - Performance → Prometheus/Metrics
 * - Debug → Loki/Centralized Logging
 */

import { createDspPipeline, createTopicRouter } from "../../index.js";
import type { LogEntry } from "../../types.js";

console.log("Production Topic Router Example\n");

// Simulate observability backends
const backends = {
  pagerDuty: {
    alert: async (log: LogEntry) => {
      console.log(`  🚨 [PagerDuty] ALERT: ${log.message}`);
      console.log(`     Topic: ${log.topic}`);
      console.log(`     Context:`, log.context);
    },
  },

  prometheus: {
    record: async (topic: string, context?: Record<string, any>) => {
      console.log(`  [Prometheus] Metric recorded`);
      console.log(`     Metric: ${topic}`);
      console.log(`     Labels:`, context);
    },
  },

  loki: {
    send: async (log: LogEntry) => {
      console.log(`  [Loki] Log ingested`);
      console.log(`     Level: ${log.level}`);
      console.log(`     Message: ${log.message}`);
    },
  },

  cloudwatch: {
    send: async (log: LogEntry) => {
      console.log(`  [CloudWatch] Log sent`);
      console.log(`     Stream: ${log.topic}`);
    },
  },
};

console.log("1. Builder Pattern (Recommended)\n");
{
  const router = createTopicRouter()
    .errors(backends.pagerDuty.alert)
    .performance((log) => backends.prometheus.record(log.topic!, log.context))
    .debug(backends.loki.send)
    .default(backends.cloudwatch.send) // Catch-all
    .build();

  const pipeline = createDspPipeline();
  pipeline
    .pipeline({
      onLogBatch: (logs) => router.routeBatch(logs),
    })
    .MovingAverage({ windowSize: 3 })
    .Rms({ windowSize: 5 });

  const samples = new Float32Array([1, -2, 3, -4, 5]);
  await pipeline.process(samples, { sampleRate: 1000 });

  console.log();
}

console.log("2. Manual Route Configuration\n");
{
  const router = createTopicRouter()
    .custom(/^pipeline\.error/, backends.pagerDuty.alert, "error-alerts")
    .custom(
      /^pipeline\.stage\.rms/,
      (log) => backends.prometheus.record(log.topic!, log.context),
      "rms-metrics"
    )
    .custom(
      /^pipeline\.performance/,
      (log) => backends.prometheus.record(log.topic!, log.context),
      "performance-metrics"
    )
    .custom(/.*/, backends.loki.send, "default-logs")
    .build();

  const pipeline = createDspPipeline();
  pipeline
    .pipeline({
      onLogBatch: (logs) => router.routeBatch(logs),
    })
    .MovingAverage({ windowSize: 3 });

  const samples = new Float32Array([1, 2, 3]);
  await pipeline.process(samples, { sampleRate: 1000 });

  console.log();
}

console.log("3. Multi-Backend Routing (Fan-Out)\n");
{
  // Route errors to BOTH PagerDuty AND CloudWatch
  const router = createTopicRouter()
    .errors(async (log) => {
      await backends.pagerDuty.alert(log);
      await backends.cloudwatch.send(log);
    })
    .performance((log) => backends.prometheus.record(log.topic!, log.context))
    .default(backends.loki.send)
    .build();

  const pipeline = createDspPipeline();
  pipeline
    .pipeline({
      onLogBatch: (logs) => router.routeBatch(logs),
    })
    .MovingAverage({ windowSize: 3 });

  const samples = new Float32Array([1, 2, 3]);
  await pipeline.process(samples, { sampleRate: 1000 });

  console.log();
}

console.log("4. Stage-Specific Routing\n");
{
  const router = createTopicRouter()
    .stage("rms", async (log) => {
      console.log(`  [RMS-Specific] ${log.message}`);
      await backends.prometheus.record(log.topic!, log.context);
    })
    .stage("movingAverage", async (log) => {
      console.log(`  [MA-Specific] ${log.message}`);
      await backends.loki.send(log);
    })
    .default(backends.cloudwatch.send)
    .build();

  const pipeline = createDspPipeline();
  pipeline
    .pipeline({
      onLogBatch: (logs) => router.routeBatch(logs),
    })
    .MovingAverage({ windowSize: 3 })
    .Rms({ windowSize: 5 });

  const samples = new Float32Array([1, -2, 3, -4, 5]);
  await pipeline.process(samples, { sampleRate: 1000 });

  console.log();
}

console.log("5. Real-World Production Pattern\n");
{
  console.log("  Routing Configuration:");
  console.log("     • Errors        → PagerDuty (critical alerts)");
  console.log("     • Performance   → Prometheus (metrics)");
  console.log("     • Debug         → Loki (centralized logs)");
  console.log("     • Everything    → CloudWatch (backup/audit)\n");

  const router = createTopicRouter()
    // Critical: Alert on errors
    .errors(async (log) => {
      console.log(`  🚨 [CRITICAL] Alerting team via PagerDuty`);
      await backends.pagerDuty.alert(log);
      await backends.cloudwatch.send(log); // Backup to CloudWatch
    })

    // Metrics: Export to Prometheus
    .performance(async (log) => {
      await backends.prometheus.record(log.topic!, log.context);
      await backends.cloudwatch.send(log);
    })

    // Debug: Send to Loki
    .debug(async (log) => {
      await backends.loki.send(log);
      await backends.cloudwatch.send(log);
    })

    // Default: CloudWatch only
    .default(backends.cloudwatch.send)
    .build();

  const pipeline = createDspPipeline();
  pipeline
    .pipeline({
      onLogBatch: (logs) => router.routeBatch(logs),
    })
    .MovingAverage({ windowSize: 10 })
    .Rectify()
    .Rms({ windowSize: 5 });

  const samples = new Float32Array(100).map(() => Math.random() * 10 - 5);
  await pipeline.process(samples, { sampleRate: 48000 });

  console.log("\n  Logs routed to multiple backends in parallel");
}

console.log("\nKey Benefits:");
console.log("   - Fan-out: Single log → Multiple backends");
console.log("   - Non-blocking: All routes processed in parallel");
console.log("   - Extensible: Add new routes without changing pipeline code");
console.log("   - Production-safe: Matches Loki, OTEL, FluentBit patterns");
console.log("   - Type-safe: Full TypeScript support");

console.log("\nProduction Deployment:");
console.log("   • Add rate limiting (p-queue) for alert storms");
console.log("   • Add retry logic for failed backend calls");
console.log("   • Add buffering for network outages");
console.log("   • Add metrics on router performance");
console.log("   • Configure topic conventions for your org");
