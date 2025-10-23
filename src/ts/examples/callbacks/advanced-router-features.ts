/**
 * Advanced Topic Router Features Example
 *
 * Demonstrates:
 * 1. Concurrency control per route
 * 2. Metrics tracking and monitoring
 * 3. Pluggable backend handlers
 * 4. Production-grade observability
 */

import {
  createDspPipeline,
  createTopicRouter,
  createConsoleHandler,
  createMockHandler,
} from "../../index.js";

console.log("Advanced Topic Router Features\n");

// Example 1: Concurrency Control
console.log("1. Concurrency Control (Prevent Alert Storms)\n");
{
  let alertCount = 0;
  const slowAlertHandler = async () => {
    alertCount++;
    console.log(
      `   [Alert ${alertCount}] Processing (simulating network call)...`
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
    console.log(`   [Alert ${alertCount}] Complete`);
  };

  const router = createTopicRouter()
    .errors(slowAlertHandler, {
      concurrency: 2, // Max 2 concurrent alerts
      trackMetrics: true,
    })
    .default(createConsoleHandler())
    .build();

  const pipeline = createDspPipeline();
  pipeline
    .pipeline({
      onLogBatch: (logs) => router.routeBatch(logs),
    })
    .MovingAverage({ windowSize: 3 });

  console.log("   Processing with concurrency limit of 2...\n");

  const samples = new Float32Array([1, 2, 3]);
  await pipeline.process(samples, { sampleRate: 1000 });

  console.log("\n   Metrics:");
  const metrics = router.getMetrics();
  metrics.forEach((m) => {
    console.log(`   • Route: ${m.name}`);
    console.log(`     Executions: ${m.executionCount}`);
    console.log(`     Avg Duration: ${m.averageDuration.toFixed(2)}ms`);
    console.log(
      `     Min/Max: ${m.minDuration.toFixed(2)}ms / ${m.maxDuration.toFixed(
        2
      )}ms`
    );
  });

  console.log();
}

// Example 2: Metrics Tracking
console.log("2. Metrics Tracking (Mini-OpenTelemetry)\n");
{
  const mock = createMockHandler((log) => {
    console.log(`   Tracked: [${log.topic}] ${log.message}`);
  });

  const router = createTopicRouter()
    .performance(mock.handler, {
      trackMetrics: true,
      concurrency: 5,
    })
    .debug(mock.handler, {
      trackMetrics: true,
    })
    .default(mock.handler, {
      trackMetrics: false, // No tracking for default route
    })
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

  console.log("\n   Route Metrics:");
  const metrics = router.getMetrics();
  metrics.forEach((m) => {
    console.log(`\n   Route: ${m.name}`);
    console.log(`   • Executions: ${m.executionCount}`);
    console.log(`   • Total Duration: ${m.totalDuration.toFixed(2)}ms`);
    console.log(`   • Avg Duration: ${m.averageDuration.toFixed(2)}ms`);
    console.log(
      `   • Min/Max: ${m.minDuration.toFixed(2)}ms / ${m.maxDuration.toFixed(
        2
      )}ms`
    );
    console.log(`   • Errors: ${m.errorCount}`);
    console.log(
      `   • Last Executed: ${
        m.lastExecuted ? new Date(m.lastExecuted).toISOString() : "Never"
      }`
    );
  });

  console.log(`\n   Total logs captured: ${mock.getLogs().length}`);
  console.log();
}

// Example 3: Pluggable Backends
console.log("3. Pluggable Backend Handlers\n");
{
  console.log("   Using built-in handlers:\n");

  // Simulate backend configurations
  const mockPagerDuty = createMockHandler((log) => {
    console.log(`   [PagerDuty] Alert triggered: ${log.message}`);
  });

  const mockPrometheus = createMockHandler((log) => {
    console.log(`   [Prometheus] Metric recorded: ${log.topic}`);
  });

  const mockLoki = createMockHandler((log) => {
    console.log(`   [Loki] Log stored: [${log.level}] ${log.message}`);
  });

  const router = createTopicRouter()
    .errors(mockPagerDuty.handler, { trackMetrics: true })
    .performance(mockPrometheus.handler, { trackMetrics: true })
    .debug(mockLoki.handler, { trackMetrics: true })
    .build();

  const pipeline = createDspPipeline();
  pipeline
    .pipeline({
      onLogBatch: (logs) => router.routeBatch(logs),
    })
    .MovingAverage({ windowSize: 3 });

  const samples = new Float32Array([1, 2, 3]);
  await pipeline.process(samples, { sampleRate: 1000 });

  console.log("\n   Backend Summary:");
  console.log(`   • PagerDuty logs: ${mockPagerDuty.getLogs().length}`);
  console.log(`   • Prometheus logs: ${mockPrometheus.getLogs().length}`);
  console.log(`   • Loki logs: ${mockLoki.getLogs().length}`);
  console.log();
}

// Example 4: Production-Grade Setup
console.log("4. Production-Grade Configuration\n");
{
  console.log("   Multi-tier routing with metrics + concurrency:\n");

  const criticalAlerts = createMockHandler((log) => {
    console.log(`   [CRITICAL] ${log.message}`);
  });

  const performanceMetrics = createMockHandler((log) => {
    console.log(`   [METRICS] ${log.topic}: ${JSON.stringify(log.context)}`);
  });

  const debugLogs = createMockHandler();

  const router = createTopicRouter()
    // Critical errors: Limited concurrency to prevent PagerDuty overload
    .errors(criticalAlerts.handler, {
      concurrency: 3,
      trackMetrics: true,
    })
    // Performance: Higher concurrency for metrics
    .performance(performanceMetrics.handler, {
      concurrency: 10,
      trackMetrics: true,
    })
    // Debug: No concurrency limit, but track metrics
    .debug(debugLogs.handler, {
      trackMetrics: true,
    })
    // Default: Console with no limits
    .default(createConsoleHandler(), {
      trackMetrics: false,
    })
    .build();

  const pipeline = createDspPipeline();
  pipeline
    .pipeline({
      onLogBatch: (logs) => router.routeBatch(logs),
    })
    .MovingAverage({ windowSize: 10 })
    .Rectify()
    .Rms({ windowSize: 5 });

  const samples = new Float32Array(50).map(() => Math.random() * 10 - 5);
  await pipeline.process(samples, { sampleRate: 48000 });

  console.log("\n   Final Metrics Report:");
  const metrics = router.getMetrics();

  console.log(
    "\n   ┌─────────────────────┬──────────┬─────────────┬────────────┐"
  );
  console.log(
    "   │ Route               │ Exec     │ Avg (ms)    │ Errors     │"
  );
  console.log(
    "   ├─────────────────────┼──────────┼─────────────┼────────────┤"
  );

  metrics.forEach((m) => {
    const route = m.name.padEnd(19);
    const exec = String(m.executionCount).padEnd(8);
    const avg = m.averageDuration.toFixed(2).padEnd(11);
    const errors = String(m.errorCount).padEnd(10);
    console.log(`   │ ${route} │ ${exec} │ ${avg} │ ${errors} │`);
  });

  console.log(
    "   └─────────────────────┴──────────┴─────────────┴────────────┘"
  );

  console.log("\n   Performance Insights:");
  const totalExec = metrics.reduce((sum, m) => sum + m.executionCount, 0);
  const avgLatency =
    metrics.reduce((sum, m) => sum + m.averageDuration, 0) / metrics.length;
  const totalErrors = metrics.reduce((sum, m) => sum + m.errorCount, 0);

  console.log(`   • Total Route Executions: ${totalExec}`);
  console.log(`   • Average Route Latency: ${avgLatency.toFixed(2)}ms`);
  console.log(`   • Total Errors: ${totalErrors}`);
  console.log(
    `   • Success Rate: ${((1 - totalErrors / totalExec) * 100).toFixed(2)}%`
  );
}

// Example 5: Priority-Based Routing
console.log("\n5. Priority-Based Routing (NEW)\n");
{
  console.log(
    "   Route critical errors to PagerDuty, warnings to Prometheus\n"
  );

  const pagerDuty = createMockHandler((log) => {
    console.log(
      `   [PagerDuty] ALERT: ${log.message} (priority: ${log.priority})`
    );
  });

  const prometheus = createMockHandler((log) => {
    console.log(
      `   [Prometheus] Metric: ${log.message} (priority: ${log.priority})`
    );
  });

  const loki = createMockHandler((log) => {
    console.log(`   [Loki] Log: ${log.message} (priority: ${log.priority})`);
  });

  const router = createTopicRouter()
    // Critical errors (9-10) → PagerDuty
    .errors(pagerDuty.handler, {
      minPriority: 9,
      maxPriority: 10,
      concurrency: 3,
    })
    // Warnings (7-8) → Prometheus
    .custom(/^pipeline\./, prometheus.handler, {
      minPriority: 7,
      maxPriority: 8,
    })
    // All logs → Loki
    .default(loki.handler, {
      minPriority: 1,
      maxPriority: 10,
    })
    .build();

  const pipeline = createDspPipeline();
  pipeline
    .pipeline({
      onLogBatch: (logs) => router.routeBatch(logs),
    })
    .MovingAverage({ windowSize: 5 });

  const samples = new Float32Array([1, 2, 3, 4, 5]);
  await pipeline.process(samples, { sampleRate: 1000 });

  console.log(`\n   Priority Summary:`);
  console.log(
    `   • PagerDuty (critical 9-10): ${pagerDuty.getLogs().length} alerts`
  );
  console.log(
    `   • Prometheus (warn 7-8): ${prometheus.getLogs().length} metrics`
  );
  console.log(`   • Loki (all): ${loki.getLogs().length} logs`);
}

console.log("\nAdvanced Features Summary:");
console.log("   - Concurrency Control - Prevent backend overload");
console.log("   - Metrics Tracking - Built-in observability");
console.log("   - Pluggable Backends - Drop-in integrations");
console.log("   - Priority Routing - 10-level smart routing (NEW)");
console.log("   - Production-Ready - Real-world patterns");

console.log("\nUse Cases:");
console.log("   • Rate-limit PagerDuty alerts (concurrency: 3)");
console.log("   • Track route performance (trackMetrics: true)");
console.log("   • Monitor error rates per backend");
console.log("   • Route by priority (critical → PagerDuty, warn → metrics)");
console.log("   • Optimize routing strategy with metrics");
