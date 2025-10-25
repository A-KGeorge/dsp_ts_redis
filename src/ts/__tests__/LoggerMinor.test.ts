/**
 * Tests for minor enhancements: sampling, dynamic levels, retry stats, formatter, traceparent
 */

import { test } from "node:test";
import assert from "node:assert";
import {
  Logger,
  createMockHandler,
  JSONFormatter,
  TextFormatter,
  generateTraceparent,
  type LogEntry,
} from "../index.js";

test("Sampling - logs sampled at configured rate", async () => {
  const mock = createMockHandler();
  const logger = new Logger([mock.handler], {
    sampling: {
      trace: 0, // Never log trace
      debug: 1, // Always log debug
    },
  });

  // Log 100 trace messages - should all be dropped
  for (let i = 0; i < 100; i++) {
    await logger.trace("Trace message");
  }

  // Log 10 debug messages - should all pass
  for (let i = 0; i < 10; i++) {
    await logger.debug("Debug message");
  }

  const logs = mock.getLogs();
  assert.strictEqual(logs.length, 10, "Only debug messages should pass");
  assert.ok(logs.every((l) => l.level === "debug"));
});

test("Dynamic level control - setMinLevel filters logs", async () => {
  const mock = createMockHandler();
  const logger = new Logger([mock.handler], { minLevel: "debug" });

  await logger.trace("Should be filtered");
  await logger.debug("Should pass");
  await logger.info("Should pass");

  assert.strictEqual(mock.getLogs().length, 2);

  // Change to info level
  logger.setMinLevel("info");
  mock.clear();

  await logger.trace("Should be filtered");
  await logger.debug("Should be filtered");
  await logger.info("Should pass");
  await logger.warn("Should pass");

  assert.strictEqual(mock.getLogs().length, 2);
  assert.strictEqual(logger.getMinLevel(), "info");
});

test("Dynamic level control - getMinLevel returns current level", () => {
  const logger = new Logger([], { minLevel: "warn" });
  assert.strictEqual(logger.getMinLevel(), "warn");

  logger.setMinLevel("error");
  assert.strictEqual(logger.getMinLevel(), "error");
});

test("Formatter - JSONFormatter formats as object", () => {
  const formatter = new JSONFormatter();
  const log: LogEntry = {
    level: "info",
    message: "Test",
    timestamp: Date.now(),
  };

  const result = formatter.format(log);
  assert.deepStrictEqual(result, log);
});

test("Formatter - TextFormatter formats as string", () => {
  const formatter = new TextFormatter();
  const log: LogEntry = {
    level: "info",
    message: "Test message",
    topic: "test.topic",
    timestamp: Date.now(),
  };

  const result = formatter.format(log);
  assert.strictEqual(typeof result, "string");
  assert.ok(result.includes("INFO"));
  assert.ok(result.includes("test.topic"));
  assert.ok(result.includes("Test message"));
});

test("Formatter - TextFormatter includes trace ID", () => {
  const formatter = new TextFormatter();
  const log: LogEntry = {
    level: "info",
    message: "Test",
    topic: "test",
    timestamp: Date.now(),
    traceId: "abc123def456",
  };

  const result = formatter.format(log);
  assert.ok(result.includes("[trace:abc123de]"));
});

test("Formatter - custom formatter in Logger", async () => {
  const formattedLogs: string[] = [];
  const customHandler = (log: any) => {
    formattedLogs.push(log);
  };

  const logger = new Logger([customHandler], {
    formatter: new TextFormatter(),
  });

  await logger.info("Test message");

  assert.strictEqual(formattedLogs.length, 1);
  assert.strictEqual(typeof formattedLogs[0], "string");
  assert.ok(formattedLogs[0].includes("Test message"));
});

test("Traceparent - generates valid W3C format", () => {
  const traceId = "0af7651916cd43dd8448eb211c80319c";
  const spanId = "b7ad6b7169203331";

  const result = generateTraceparent(traceId, spanId);
  assert.strictEqual(
    result,
    "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01"
  );
});

test("Traceparent - returns undefined for missing IDs", () => {
  assert.strictEqual(generateTraceparent(undefined, "span123"), undefined);
  assert.strictEqual(generateTraceparent("trace123", undefined), undefined);
  assert.strictEqual(generateTraceparent(undefined, undefined), undefined);
});

test("Auto-shutdown - registers signal handlers", () => {
  // Note: Can't fully test without actually sending signals
  // This just verifies construction doesn't throw
  const logger = new Logger([], { autoShutdown: true });
  assert.ok(logger);
});

test("Child logger - preserves sampling config", async () => {
  const mock = createMockHandler();
  const parentLogger = new Logger([mock.handler], {
    sampling: { trace: 0 },
  });

  const childLogger = parentLogger.child("child");

  await childLogger.trace("Should be filtered by sampling");
  await childLogger.info("Should pass");

  const logs = mock.getLogs();
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0].level, "info");
});

test("Child logger - preserves min level", async () => {
  const mock = createMockHandler();
  const parentLogger = new Logger([mock.handler], { minLevel: "warn" });

  const childLogger = parentLogger.child("child");

  await childLogger.debug("Should be filtered");
  await childLogger.warn("Should pass");

  const logs = mock.getLogs();
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0].level, "warn");
});

test("Child logger - preserves formatter", async () => {
  const formattedLogs: any[] = [];
  const customHandler = (log: any) => {
    formattedLogs.push(log);
  };

  const parentLogger = new Logger([customHandler], {
    formatter: new TextFormatter(),
  });

  const childLogger = parentLogger.child("child");

  await childLogger.info("Test");

  // Child inherits formatter from parent, so output should be formatted
  assert.strictEqual(formattedLogs.length, 1);
  assert.strictEqual(typeof formattedLogs[0], "string");
  assert.ok(formattedLogs[0].includes("child.default")); // Topic prefix added
});

test("Metrics - incrementRetries can be called", () => {
  const logger = new Logger([], { enableMetrics: true });

  logger.incrementRetries();
  logger.incrementRetries();
  logger.incrementRetries();

  const metrics = logger.getMetrics();
  assert.strictEqual(metrics.totalRetries, 3);
});

test("Sampling - info level without sampling config passes through", async () => {
  const mock = createMockHandler();
  const logger = new Logger([mock.handler], {
    sampling: { trace: 0.1 }, // Only sample trace
  });

  await logger.info("Should always pass");
  await logger.info("Should always pass");

  const logs = mock.getLogs();
  assert.strictEqual(logs.length, 2);
});

test("Min level - defaults to trace when not specified", async () => {
  const mock = createMockHandler();
  const logger = new Logger([mock.handler]);

  await logger.trace("Should pass");
  assert.strictEqual(mock.getLogs().length, 1);
  assert.strictEqual(logger.getMinLevel(), "trace");
});

test("Min level - fatal is highest priority", async () => {
  const mock = createMockHandler();
  const logger = new Logger([mock.handler], { minLevel: "fatal" });

  await logger.error("Should be filtered");
  await logger.fatal("Should pass");

  const logs = mock.getLogs();
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0].level, "fatal");
});
