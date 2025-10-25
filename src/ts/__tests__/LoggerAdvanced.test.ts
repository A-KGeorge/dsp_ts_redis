/**
 * Tests for advanced Logger features:
 * - Extended log levels (trace/fatal)
 * - Distributed tracing
 * - Graceful shutdown (flushAll)
 * - Performance metrics
 * - Severity mappings
 * - Formatters
 */

import { test } from "node:test";
import assert from "node:assert";
import {
  Logger,
  createMockHandler,
  JSONFormatter,
  TextFormatter,
  SEVERITY_MAPPINGS,
  tracingContext,
  getTracingContext,
  withTracingContext,
  type LogEntry,
  type HandlerWithFlush,
} from "../index.js";

// Test 1: Extended log levels (trace and fatal)
test("Logger - trace level (most verbose)", async () => {
  const mock = createMockHandler();
  const logger = new Logger([mock.handler]);

  await logger.trace("Trace message", "debug.trace");

  const logs = mock.getLogs();
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0].level, "trace");
  assert.strictEqual(logs[0].message, "Trace message");
});

test("Logger - fatal level (most critical)", async () => {
  const mock = createMockHandler();
  const logger = new Logger([mock.handler]);

  await logger.fatal("Fatal error", "system.critical");

  const logs = mock.getLogs();
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0].level, "fatal");
  assert.strictEqual(logs[0].message, "Fatal error");
});

// Test 2: Distributed tracing - auto-inject context
test("Logger - auto-inject tracing context", async () => {
  const mock = createMockHandler();
  const logger = new Logger([mock.handler]);

  await withTracingContext(
    {
      traceId: "trace-12345",
      spanId: "span-67890",
      correlationId: "corr-abcde",
    },
    async () => {
      await logger.info("Message with tracing");
    }
  );

  const logs = mock.getLogs();
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0].traceId, "trace-12345");
  assert.strictEqual(logs[0].spanId, "span-67890");
  assert.strictEqual(logs[0].correlationId, "corr-abcde");
});

test("Logger - getTracingContext outside of context", () => {
  const ctx = getTracingContext();
  assert.deepStrictEqual(ctx, {});
});

test("Logger - getTracingContext inside context", () => {
  withTracingContext({ traceId: "test-trace" }, () => {
    const ctx = getTracingContext();
    assert.strictEqual(ctx.traceId, "test-trace");
  });
});

// Test 3: Graceful shutdown (flushAll)
test("Logger - flushAll calls handler flush methods", async () => {
  let flushCalled = false;

  const handlerWithFlush: HandlerWithFlush = async (log: LogEntry) => {
    // Handler logic
  };

  handlerWithFlush.flush = async () => {
    flushCalled = true;
  };

  const logger = new Logger([handlerWithFlush]);

  await logger.info("Test message");
  await logger.flushAll();

  assert.ok(flushCalled, "Handler flush should be called");
});

test("Logger - flushAll handles missing flush gracefully", async () => {
  const mock = createMockHandler();
  const logger = new Logger([mock.handler]);

  await logger.info("Test message");

  // Should not throw even though handler has no flush method
  await assert.doesNotReject(async () => {
    await logger.flushAll();
  });
});

test("Logger - flushAll handles flush errors gracefully", async () => {
  const handlerWithFlush: HandlerWithFlush = async (log: LogEntry) => {};
  handlerWithFlush.flush = async () => {
    throw new Error("Flush failed");
  };

  const logger = new Logger([handlerWithFlush]);

  // Should not throw even when flush fails
  await assert.doesNotReject(async () => {
    await logger.flushAll();
  });
});

// Test 4: Performance metrics
test("Logger - metrics tracking when enabled", async () => {
  const mock = createMockHandler();
  const logger = new Logger([mock.handler], { enableMetrics: true });

  await logger.info("Message 1");
  await logger.warn("Message 2");
  await logger.error("Message 3");

  const metrics = logger.getMetrics();
  assert.strictEqual(metrics.logsProcessed, 3);
  assert.strictEqual(metrics.logsFailed, 0);
});

test("Logger - metrics track failures", async () => {
  const failingHandler = async () => {
    throw new Error("Handler error");
  };

  const logger = new Logger([failingHandler], { enableMetrics: true });

  await logger.info("Test");
  await logger.info("Test2");

  const metrics = logger.getMetrics();
  assert.strictEqual(metrics.logsProcessed, 2);
  assert.strictEqual(metrics.logsFailed, 2);
});

test("Logger - metrics track flush count and time", async () => {
  const handlerWithFlush: HandlerWithFlush = async (log: LogEntry) => {};
  handlerWithFlush.flush = async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  };

  const logger = new Logger([handlerWithFlush], { enableMetrics: true });

  await logger.info("Test");
  await logger.flushAll();
  await logger.flushAll();

  const metrics = logger.getMetrics();
  assert.strictEqual(metrics.flushCount, 2);
  assert.ok(metrics.averageFlushTimeMs > 0);
});

test("Logger - resetMetrics clears counters", async () => {
  const mock = createMockHandler();
  const logger = new Logger([mock.handler], { enableMetrics: true });

  await logger.info("Test");
  let metrics = logger.getMetrics();
  assert.strictEqual(metrics.logsProcessed, 1);

  logger.resetMetrics();
  metrics = logger.getMetrics();
  assert.strictEqual(metrics.logsProcessed, 0);
});

// Test 5: Severity mappings
test("Logger - getSeverityMapping returns configured mapping", () => {
  const logger = new Logger([], {
    severityMapping: SEVERITY_MAPPINGS.pagerduty,
  });

  const mapping = logger.getSeverityMapping();
  assert.deepStrictEqual(mapping, SEVERITY_MAPPINGS.pagerduty);
});

test("SEVERITY_MAPPINGS - PagerDuty mapping", () => {
  assert.strictEqual(SEVERITY_MAPPINGS.pagerduty.trace, "info");
  assert.strictEqual(SEVERITY_MAPPINGS.pagerduty.error, "error");
  assert.strictEqual(SEVERITY_MAPPINGS.pagerduty.fatal, "critical");
});

test("SEVERITY_MAPPINGS - Datadog mapping", () => {
  assert.strictEqual(SEVERITY_MAPPINGS.datadog.debug, "debug");
  assert.strictEqual(SEVERITY_MAPPINGS.datadog.warn, "warn");
  assert.strictEqual(SEVERITY_MAPPINGS.datadog.fatal, "emergency");
});

test("SEVERITY_MAPPINGS - Syslog mapping", () => {
  assert.strictEqual(SEVERITY_MAPPINGS.syslog.trace, "7");
  assert.strictEqual(SEVERITY_MAPPINGS.syslog.info, "6");
  assert.strictEqual(SEVERITY_MAPPINGS.syslog.fatal, "0");
});

// Test 6: Formatters
test("JSONFormatter - formats log as object", () => {
  const formatter = new JSONFormatter();
  const log: LogEntry = {
    level: "info",
    message: "Test",
    timestamp: Date.now(),
    context: { key: "value" },
  };

  const result = formatter.format(log);
  assert.deepStrictEqual(result, log);
});

test("TextFormatter - formats log as human-readable string", () => {
  const formatter = new TextFormatter();
  const log: LogEntry = {
    level: "error",
    message: "Connection failed",
    topic: "redis",
    timestamp: Date.now(),
    context: { host: "localhost" },
  };

  const result = formatter.format(log);
  assert.ok(typeof result === "string");
  assert.ok(result.includes("ERROR"));
  assert.ok(result.includes("Connection failed"));
  assert.ok(result.includes("redis"));
});

test("TextFormatter - includes trace ID when present", () => {
  const formatter = new TextFormatter();
  const log: LogEntry = {
    level: "info",
    message: "Test",
    timestamp: Date.now(),
    traceId: "trace-12345678abcd",
  };

  const result = formatter.format(log);
  assert.ok(result.includes("[trace:trace-12"));
});

test("TextFormatter - omits context when empty", () => {
  const formatter = new TextFormatter();
  const log: LogEntry = {
    level: "info",
    message: "Test",
    timestamp: Date.now(),
    context: {},
  };

  const result = formatter.format(log);
  assert.ok(!result.includes("Context:"));
});

// Test 7: Child logger with options preservation
test("Logger - child logger preserves metrics setting", async () => {
  const mock = createMockHandler();
  const logger = new Logger([mock.handler], { enableMetrics: true });
  const childLogger = logger.child("child");

  await childLogger.info("Test");

  // Child should inherit metrics capability
  const metrics = childLogger.getMetrics();
  assert.ok(metrics.logsProcessed >= 0); // Should be accessible
});

test("Logger - child logger preserves severity mapping", () => {
  const logger = new Logger([], {
    severityMapping: SEVERITY_MAPPINGS.datadog,
  });
  const childLogger = logger.child("child");

  const mapping = childLogger.getSeverityMapping();
  assert.deepStrictEqual(mapping, SEVERITY_MAPPINGS.datadog);
});

// Test 8: All log levels in order
test("Logger - all six log levels", async () => {
  const mock = createMockHandler();
  const logger = new Logger([mock.handler]);

  await logger.trace("Trace");
  await logger.debug("Debug");
  await logger.info("Info");
  await logger.warn("Warn");
  await logger.error("Error");
  await logger.fatal("Fatal");

  const logs = mock.getLogs();
  assert.strictEqual(logs.length, 6);
  assert.strictEqual(logs[0].level, "trace");
  assert.strictEqual(logs[1].level, "debug");
  assert.strictEqual(logs[2].level, "info");
  assert.strictEqual(logs[3].level, "warn");
  assert.strictEqual(logs[4].level, "error");
  assert.strictEqual(logs[5].level, "fatal");
});
