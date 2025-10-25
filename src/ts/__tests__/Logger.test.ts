/**
 * Tests for unified Logger class and backend utilities
 */

import { test } from "node:test";
import assert from "node:assert";
import {
  Logger,
  createConsoleHandler,
  createMockHandler,
  type LogEntry,
} from "../index.js";

test("Logger - basic logging", async () => {
  const mock = createMockHandler();
  const logger = new Logger([mock.handler]);

  await logger.info("Test message", "test.topic", { key: "value" });

  const logs = mock.getLogs();
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0].level, "info");
  assert.strictEqual(logs[0].message, "Test message");
  assert.strictEqual(logs[0].topic, "test.topic");
  assert.deepStrictEqual(logs[0].context, { key: "value" });
});

test("Logger - multiple handlers dispatch", async () => {
  const mock1 = createMockHandler();
  const mock2 = createMockHandler();
  const logger = new Logger([mock1.handler, mock2.handler]);

  await logger.error("Error message");

  assert.strictEqual(mock1.getLogs().length, 1);
  assert.strictEqual(mock2.getLogs().length, 1);
  assert.strictEqual(mock1.getLogs()[0].level, "error");
  assert.strictEqual(mock2.getLogs()[0].level, "error");
});

test("Logger - error isolation (one handler fails)", async () => {
  const mock = createMockHandler();
  const failingHandler = async () => {
    throw new Error("Handler failure");
  };

  // Should not throw despite failing handler
  const logger = new Logger([mock.handler, failingHandler]);
  await logger.warn("Test warning");

  // Successful handler should still receive log
  assert.strictEqual(mock.getLogs().length, 1);
  assert.strictEqual(mock.getLogs()[0].message, "Test warning");
});

test("Logger - structured error logging to fallback", async () => {
  const fallbackMock = createMockHandler();
  const failingHandler = async () => {
    throw new Error("Network timeout");
  };

  const logger = new Logger([failingHandler], {
    fallbackHandler: fallbackMock.handler,
  });
  await logger.info("Original message");

  // Fallback should receive error log
  const fallbackLogs = fallbackMock.getLogs();
  assert.strictEqual(fallbackLogs.length, 1);
  assert.strictEqual(fallbackLogs[0].level, "error");
  assert.ok(fallbackLogs[0].message.includes("Handler error"));
  assert.ok(fallbackLogs[0].message.includes("Network timeout"));
  assert.strictEqual(fallbackLogs[0].topic, "logger.handler.error");
});

test("Logger - child logger with topic prefix", async () => {
  const mock = createMockHandler();
  const logger = new Logger([mock.handler]);
  const childLogger = logger.child("pipeline.stage1");

  await childLogger.debug("Stage initialized", "init");

  const logs = mock.getLogs();
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0].topic, "pipeline.stage1.init");
});

test("Logger - all log levels", async () => {
  const mock = createMockHandler();
  const logger = new Logger([mock.handler]);

  await logger.debug("Debug message");
  await logger.info("Info message");
  await logger.warn("Warn message");
  await logger.error("Error message");

  const logs = mock.getLogs();
  assert.strictEqual(logs.length, 4);
  assert.strictEqual(logs[0].level, "debug");
  assert.strictEqual(logs[1].level, "info");
  assert.strictEqual(logs[2].level, "warn");
  assert.strictEqual(logs[3].level, "error");
});

test("Logger - timestamp generation", async () => {
  const mock = createMockHandler();
  const logger = new Logger([mock.handler]);

  const before = Date.now();
  await logger.info("Timestamp test");
  const after = Date.now();

  const logs = mock.getLogs();
  assert.strictEqual(logs.length, 1);
  assert.ok(logs[0].timestamp >= before);
  assert.ok(logs[0].timestamp <= after);
});

test("Logger - default topic", async () => {
  const mock = createMockHandler();
  const logger = new Logger([mock.handler]);

  await logger.info("No topic specified");

  const logs = mock.getLogs();
  assert.strictEqual(logs[0].topic, "default");
});

test("Logger - complex context object", async () => {
  const mock = createMockHandler();
  const logger = new Logger([mock.handler]);

  const complexContext = {
    user: { id: 123, name: "Alice" },
    metrics: { latency: 45, throughput: 1000 },
    tags: ["production", "critical"],
  };

  await logger.info("Complex context", "app.event", complexContext);

  const logs = mock.getLogs();
  assert.deepStrictEqual(logs[0].context, complexContext);
});

test("MockHandler - clear functionality", () => {
  const mock = createMockHandler();

  mock.handler({
    level: "info",
    message: "Test",
    topic: "test",
    timestamp: Date.now(),
  });

  assert.strictEqual(mock.getLogs().length, 1);
  mock.clear();
  assert.strictEqual(mock.getLogs().length, 0);
});

test("MockHandler - onLog callback", () => {
  let callbackInvoked = false;
  const mock = createMockHandler((log: LogEntry) => {
    callbackInvoked = true;
    assert.strictEqual(log.message, "Callback test");
  });

  mock.handler({
    level: "info",
    message: "Callback test",
    topic: "test",
    timestamp: Date.now(),
  });

  assert.ok(callbackInvoked);
});

test("Logger - synchronous handler support", async () => {
  const logs: LogEntry[] = [];
  const syncHandler = (log: LogEntry) => {
    logs.push(log);
  };

  const logger = new Logger([syncHandler]);
  await logger.info("Sync handler test");

  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0].message, "Sync handler test");
});

test("Logger - mixed sync/async handlers", async () => {
  const syncLogs: LogEntry[] = [];
  const asyncLogs: LogEntry[] = [];

  const syncHandler = (log: LogEntry) => {
    syncLogs.push(log);
  };

  const asyncHandler = async (log: LogEntry) => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    asyncLogs.push(log);
  };

  const logger = new Logger([syncHandler, asyncHandler]);
  await logger.info("Mixed handlers");

  assert.strictEqual(syncLogs.length, 1);
  assert.strictEqual(asyncLogs.length, 1);
});
