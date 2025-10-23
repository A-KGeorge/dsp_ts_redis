/**
 * Priority-Based Routing Example
 *
 * Demonstrates 10-level priority system with smart routing:
 * - Low priority (1-3): Debug logs → Console only
 * - Normal priority (4-6): Info logs → Loki
 * - High priority (7-8): Warnings → Prometheus + Loki
 * - Critical priority (9-10): Errors → PagerDuty + All backends
 */

import {
  createDspPipeline,
  createTopicRouter,
  createConsoleHandler,
  createMockHandler,
} from "../../index.js";
import type { LogEntry } from "../../types.js";

console.log("Priority-Based Routing Example\n");

// Example 1: Basic Priority Filtering
console.log("1. Basic Priority Filtering\n");
{
  const lowPriority = createMockHandler((log) => {
    console.log(`   [LOW] Priority ${log.priority}: ${log.message}`);
  });

  const normalPriority = createMockHandler((log) => {
    console.log(`   [NORMAL] Priority ${log.priority}: ${log.message}`);
  });

  const highPriority = createMockHandler((log) => {
    console.log(`   [HIGH] Priority ${log.priority}: ${log.message}`);
  });

  const critical = createMockHandler((log) => {
    console.log(`   [CRITICAL] Priority ${log.priority}: ${log.message}`);
  });

  const router = createTopicRouter()
    .custom(/^pipeline\./, lowPriority.handler, {
      minPriority: 1,
      maxPriority: 3,
    })
    .custom(/^pipeline\./, normalPriority.handler, {
      minPriority: 4,
      maxPriority: 6,
    })
    .custom(/^pipeline\./, highPriority.handler, {
      minPriority: 7,
      maxPriority: 8,
    })
    .custom(/^pipeline\./, critical.handler, {
      minPriority: 9,
      maxPriority: 10,
    })
    .build();

  const pipeline = createDspPipeline();
  pipeline
    .pipeline({
      onLogBatch: (logs) => router.routeBatch(logs),
    })
    .MovingAverage({ mode: "moving", windowSize: 3 });

  const samples = new Float32Array([1, 2, 3]);
  await pipeline.process(samples, { sampleRate: 1000 });

  console.log(`\n   Summary:`);
  console.log(`   • Low priority logs: ${lowPriority.getLogs().length}`);
  console.log(`   • Normal priority logs: ${normalPriority.getLogs().length}`);
  console.log(`   • High priority logs: ${highPriority.getLogs().length}`);
  console.log(`   • Critical logs: ${critical.getLogs().length}\n`);
}

// Example 2: Production Alert Routing
console.log("2. Production Alert Routing (Multi-Tier)\n");
{
  console.log("   Routing Strategy:");
  console.log("   • Priority 1-3 (Debug): Console only");
  console.log("   • Priority 4-6 (Info): Loki (logs storage)");
  console.log("   • Priority 7-8 (Warn): Prometheus + Loki");
  console.log("   • Priority 9-10 (Critical): PagerDuty + Prometheus + Loki\n");

  const consoleBackend = createMockHandler((log) => {
    console.log(`   [Console] ${log.message}`);
  });

  const lokiBackend = createMockHandler((log) => {
    console.log(`   [Loki] Storing: ${log.message}`);
  });

  const prometheusBackend = createMockHandler((log) => {
    console.log(`   [Prometheus] Recording metric for: ${log.message}`);
  });

  const pagerDutyBackend = createMockHandler((log) => {
    console.log(`   [PagerDuty] ALERT triggered: ${log.message}`);
  });

  const router = createTopicRouter()
    // Low priority: Console only
    .custom(/^pipeline\./, consoleBackend.handler, {
      minPriority: 1,
      maxPriority: 3,
    })
    // Normal priority: Loki
    .custom(/^pipeline\./, lokiBackend.handler, {
      minPriority: 4,
      maxPriority: 10, // All normal and above
    })
    // High priority: Prometheus
    .custom(/^pipeline\./, prometheusBackend.handler, {
      minPriority: 7,
      maxPriority: 10,
    })
    // Critical: PagerDuty
    .custom(/^pipeline\./, pagerDutyBackend.handler, {
      minPriority: 9,
      maxPriority: 10,
      concurrency: 3, // Rate-limit alerts
    })
    .build();

  // Simulate logs with different priorities
  await router.routeBatch([
    {
      level: "debug",
      message: "Verbose debug info",
      topic: "pipeline.debug",
      timestamp: Date.now(),
      priority: 2,
    },
    {
      level: "info",
      message: "Normal operation",
      topic: "pipeline.info",
      timestamp: Date.now(),
      priority: 5,
    },
    {
      level: "warn",
      message: "High CPU usage detected",
      topic: "pipeline.warn",
      timestamp: Date.now(),
      priority: 7,
    },
    {
      level: "error",
      message: "Critical system failure!",
      topic: "pipeline.error",
      timestamp: Date.now(),
      priority: 10,
    },
  ]);

  console.log(`\n   Backend Summary:`);
  console.log(`   • Console: ${consoleBackend.getLogs().length} logs`);
  console.log(`   • Loki: ${lokiBackend.getLogs().length} logs`);
  console.log(`   • Prometheus: ${prometheusBackend.getLogs().length} logs`);
  console.log(`   • PagerDuty: ${pagerDutyBackend.getLogs().length} alerts\n`);
}

// Example 3: Priority with Metrics Tracking
console.log("3. Priority Tiers with Metrics Tracking\n");
{
  const router = createTopicRouter()
    .custom(/^pipeline\./, createConsoleHandler(), {
      minPriority: 1,
      maxPriority: 5,
      trackMetrics: true,
    })
    .custom(/^pipeline\./, createConsoleHandler(), {
      minPriority: 6,
      maxPriority: 10,
      trackMetrics: true,
    })
    .build();

  const pipeline = createDspPipeline();
  pipeline
    .pipeline({
      onLogBatch: (logs) => router.routeBatch(logs),
    })
    .MovingAverage({ mode: "moving", windowSize: 10 })
    .Rectify()
    .Rms({ mode: "moving", windowSize: 5 });

  const samples = new Float32Array(100).map(() => Math.random() * 10 - 5);
  await pipeline.process(samples, { sampleRate: 48000 });

  console.log("   Metrics by Priority Tier:\n");
  const metrics = router.getMetrics();

  console.log("   ┌──────────────┬──────────┬─────────────┐");
  console.log("   │ Priority     │ Exec     │ Avg (ms)    │");
  console.log("   ├──────────────┼──────────┼─────────────┤");

  metrics.forEach((m, idx) => {
    const tier = idx === 0 ? "Low (1-5)" : "High (6-10)";
    const exec = String(m.executionCount).padEnd(8);
    const avg = m.averageDuration.toFixed(2).padEnd(11);
    console.log(`   │ ${tier.padEnd(12)} │ ${exec} │ ${avg} │`);
  });

  console.log("   └──────────────┴──────────┴─────────────┘\n");
}

// Example 4: Dynamic Priority Assignment
console.log("4. Dynamic Priority Based on Context\n");
{
  const mockHandler = createMockHandler((log) => {
    const priority = log.priority ?? 1;
    const emoji =
      priority >= 9 ? "🚨" : priority >= 7 ? "⚠️" : priority >= 4 ? "ℹ️" : "🔍";
    console.log(`   ${emoji} [P${priority}] ${log.message}`);
  });

  const router = createTopicRouter()
    .custom(/^pipeline\./, mockHandler.handler)
    .build();

  // Custom logs with varying priorities
  const customLogs: LogEntry[] = [
    {
      level: "debug",
      message: "Trace-level debugging",
      topic: "pipeline.debug",
      timestamp: Date.now(),
      priority: 1,
    },
    {
      level: "info",
      message: "User action completed",
      topic: "pipeline.info",
      timestamp: Date.now(),
      priority: 5,
    },
    {
      level: "warn",
      message: "Memory usage at 80%",
      topic: "pipeline.warn",
      timestamp: Date.now(),
      priority: 7,
    },
    {
      level: "error",
      message: "Database connection lost",
      topic: "pipeline.error",
      timestamp: Date.now(),
      priority: 9,
    },
    {
      level: "error",
      message: "SYSTEM CRITICAL: Out of memory",
      topic: "pipeline.error",
      timestamp: Date.now(),
      priority: 10,
    },
  ];

  await router.routeBatch(customLogs);
  console.log();
}

console.log("Priority System Summary:");
console.log("   - 10-level priority (1=lowest, 10=highest)");
console.log("   - Default priorities: debug=2, info=5, warn=7, error=9");
console.log("   - Route filtering with minPriority/maxPriority");
console.log("   - Multi-tier routing (low→console, high→alerts)");
console.log("   - Priority-aware metrics tracking");

console.log("\nUse Cases:");
console.log("   • Route critical errors (9-10) to PagerDuty");
console.log("   • Send warnings (7-8) to Prometheus + Loki");
console.log("   • Store info logs (4-6) in Loki only");
console.log("   • Keep debug logs (1-3) local/console");
