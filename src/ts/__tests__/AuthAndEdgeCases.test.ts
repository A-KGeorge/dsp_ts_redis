/**
 * Tests for authentication error handling and edge cases
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  Logger,
  TextFormatter,
  JSONFormatter,
  createMockHandler,
} from "../backends.js";
import type { LogEntry } from "../types.js";

describe("Authentication Error Handling", () => {
  it("should provide clear error messages for authentication failures", async () => {
    const errors: string[] = [];
    const mockHandler = async (log: LogEntry) => {
      // Simulate 401 auth error
      const error = new Error("HTTP 401 - Unauthorized");
      errors.push(error.message);
      throw error;
    };

    const logger = new Logger([mockHandler]);

    // Should catch and log error without crashing
    await logger.info("test", "auth.test");

    assert.strictEqual(errors.length, 1);
    assert.ok(errors[0].includes("401"));
  });

  it("should warn when handlers are created without credentials", async () => {
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (msg: string) => warnings.push(msg);

    try {
      // Import and create handlers without config
      const { createPagerDutyHandler, createDatadogHandler } = await import(
        "../backends.js"
      );

      createPagerDutyHandler({});
      createDatadogHandler({});

      assert.ok(warnings.length > 0);
      assert.ok(warnings.some((w) => w.includes("not configured")));
    } finally {
      console.warn = originalWarn;
    }
  });
});

describe("Circular Reference Handling", () => {
  it("should handle circular references in TextFormatter", () => {
    const formatter = new TextFormatter();

    // Create circular reference
    const circular: any = { name: "test" };
    circular.self = circular;

    const log: LogEntry = {
      level: "info",
      message: "Test message",
      topic: "circular.test",
      context: circular,
      timestamp: Date.now(),
    };

    const result = formatter.format(log);

    assert.ok(result.includes("Test message"));
    assert.ok(result.includes("[Unable to stringify:"));
  });

  it("should handle deeply nested objects in TextFormatter", () => {
    const formatter = new TextFormatter();

    const deepNested: any = { level1: {} };
    let current = deepNested.level1;

    // Create 100 levels of nesting
    for (let i = 2; i <= 100; i++) {
      current[`level${i}`] = {};
      current = current[`level${i}`];
    }

    const log: LogEntry = {
      level: "info",
      message: "Deep nested test",
      topic: "nested.test",
      context: deepNested,
      timestamp: Date.now(),
    };

    // Should not throw
    const result = formatter.format(log);
    assert.ok(result.includes("Deep nested test"));
  });

  it("should handle objects with non-serializable values", () => {
    const formatter = new TextFormatter();

    const log: LogEntry = {
      level: "info",
      message: "Non-serializable test",
      topic: "serialize.test",
      context: {
        func: () => {},
        symbol: Symbol("test"),
        undef: undefined,
      },
      timestamp: Date.now(),
    };

    // Should not throw
    const result = formatter.format(log);
    assert.ok(result.includes("Non-serializable test"));
  });

  it("should handle empty context gracefully", () => {
    const formatter = new TextFormatter();

    const log: LogEntry = {
      level: "info",
      message: "Empty context",
      topic: "empty.test",
      context: {},
      timestamp: Date.now(),
    };

    const result = formatter.format(log);
    assert.ok(result.includes("Empty context"));
    assert.ok(!result.includes("Context:"));
  });

  it("should handle missing context gracefully", () => {
    const formatter = new TextFormatter();

    const log: LogEntry = {
      level: "info",
      message: "No context",
      topic: "nocontext.test",
      timestamp: Date.now(),
    };

    const result = formatter.format(log);
    assert.ok(result.includes("No context"));
    assert.ok(!result.includes("Context:"));
  });
});

describe("JSONFormatter Edge Cases", () => {
  it("should pass through log entry unchanged", () => {
    const formatter = new JSONFormatter();

    const log: LogEntry = {
      level: "info",
      message: "Test",
      topic: "json.test",
      context: { key: "value" },
      timestamp: Date.now(),
    };

    const result = formatter.format(log);
    assert.deepStrictEqual(result, log);
  });

  it("should handle log entry with circular reference (passed to handler)", () => {
    const formatter = new JSONFormatter();
    const mock = createMockHandler();

    // Create circular reference
    const circular: any = { name: "test" };
    circular.self = circular;

    const log: LogEntry = {
      level: "info",
      message: "Circular",
      topic: "circular.json",
      context: circular,
      timestamp: Date.now(),
    };

    // JSONFormatter passes through, handler should catch serialization error
    const result = formatter.format(log);
    assert.strictEqual(result.context, circular);

    // Note: Actual JSON.stringify will happen in handler (e.g., postJSON)
    // which should have its own error handling for circular refs
  });
});

describe("Handler Configuration Warnings", () => {
  it("should warn about missing CloudWatch SDK recommendation", async () => {
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (msg: string) => warnings.push(msg);

    try {
      const { createCloudWatchHandler } = await import("../backends.js");
      createCloudWatchHandler({});

      assert.ok(warnings.some((w) => w.includes("@aws-sdk")));
    } finally {
      console.warn = originalWarn;
    }
  });

  it("should warn about Loki authentication options", async () => {
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (msg: string) => warnings.push(msg);

    try {
      const { createLokiHandler } = await import("../backends.js");
      createLokiHandler({});

      assert.ok(warnings.some((w) => w.includes("endpoint not configured")));
    } finally {
      console.warn = originalWarn;
    }
  });

  it("should warn about Prometheus authentication requirements", async () => {
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (msg: string) => warnings.push(msg);

    try {
      const { createPrometheusHandler } = await import("../backends.js");
      createPrometheusHandler({});

      assert.ok(warnings.some((w) => w.includes("endpoint not configured")));
    } finally {
      console.warn = originalWarn;
    }
  });
});
