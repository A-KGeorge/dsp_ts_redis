/**
 * Advanced TopicRouter Tests
 *
 * Tests for:
 * - Concurrency control
 * - Metrics tracking
 * - RouteOptions configuration
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createTopicRouter, createMockHandler } from "../index.js";
import type { LogEntry } from "../types.js";

describe("TopicRouter Concurrency Control", () => {
  it("should limit concurrent handler executions", async () => {
    let activeCount = 0;
    let maxConcurrent = 0;

    const slowHandler = async () => {
      activeCount++;
      maxConcurrent = Math.max(maxConcurrent, activeCount);
      await new Promise((resolve) => setTimeout(resolve, 10));
      activeCount--;
    };

    const router = createTopicRouter()
      .errors(slowHandler, { concurrency: 2 })
      .build();

    const logs: LogEntry[] = Array.from({ length: 10 }, (_, i) => ({
      level: "error",
      message: `Error ${i}`,
      topic: "pipeline.error",
      timestamp: Date.now(),
    }));

    await router.routeBatch(logs);

    // Should never exceed concurrency limit of 2
    assert.ok(
      maxConcurrent <= 2,
      `Max concurrent was ${maxConcurrent}, expected <= 2`
    );
  });

  it("should queue tasks when concurrency limit is reached", async () => {
    const executionOrder: number[] = [];
    const delays = [50, 30, 10]; // First task takes longest

    const router = createTopicRouter()
      .custom(
        /^pipeline\./,
        async (log: LogEntry) => {
          const taskId = parseInt(log.message.split(" ")[1]);
          await new Promise((resolve) => setTimeout(resolve, delays[taskId]));
          executionOrder.push(taskId);
        },
        { concurrency: 1 }
      ) // Force sequential execution
      .build();

    const logs: LogEntry[] = [0, 1, 2].map((i) => ({
      level: "info",
      message: `Task ${i}`,
      topic: "pipeline.info",
      timestamp: Date.now(),
    }));

    await router.routeBatch(logs);

    // Should execute in order despite varying durations
    assert.deepEqual(executionOrder, [0, 1, 2]);
  });

  it("should allow unlimited concurrency by default", async () => {
    let maxConcurrent = 0;
    let activeCount = 0;

    const handler = async () => {
      activeCount++;
      maxConcurrent = Math.max(maxConcurrent, activeCount);
      await new Promise((resolve) => setTimeout(resolve, 5));
      activeCount--;
    };

    const router = createTopicRouter()
      .errors(handler) // No concurrency limit
      .build();

    const logs: LogEntry[] = Array.from({ length: 20 }, (_, i) => ({
      level: "error",
      message: `Error ${i}`,
      topic: "pipeline.error",
      timestamp: Date.now(),
    }));

    await router.routeBatch(logs);

    // Should run many tasks concurrently
    assert.ok(
      maxConcurrent > 5,
      `Max concurrent was ${maxConcurrent}, expected > 5`
    );
  });

  it("should handle different concurrency limits per route", async () => {
    const route1Active: number[] = [];
    const route2Active: number[] = [];

    const handler1 = async () => {
      route1Active.push(Date.now());
      await new Promise((resolve) => setTimeout(resolve, 10));
    };

    const handler2 = async () => {
      route2Active.push(Date.now());
      await new Promise((resolve) => setTimeout(resolve, 10));
    };

    const router = createTopicRouter()
      .errors(handler1, { concurrency: 1 })
      .debug(handler2, { concurrency: 5 })
      .build();

    const errorLogs: LogEntry[] = Array.from({ length: 5 }, (_, i) => ({
      level: "error",
      message: `Error ${i}`,
      topic: "pipeline.error",
      timestamp: Date.now(),
    }));

    const debugLogs: LogEntry[] = Array.from({ length: 5 }, (_, i) => ({
      level: "debug",
      message: `Debug ${i}`,
      topic: "pipeline.debug",
      timestamp: Date.now(),
    }));

    await Promise.all([
      router.routeBatch(errorLogs),
      router.routeBatch(debugLogs),
    ]);

    assert.equal(route1Active.length, 5);
    assert.equal(route2Active.length, 5);
  });
});

describe("TopicRouter Metrics Tracking", () => {
  it("should track execution count", async () => {
    const mock = createMockHandler();

    const router = createTopicRouter()
      .errors(mock.handler, { trackMetrics: true })
      .build();

    const logs: LogEntry[] = Array.from({ length: 5 }, (_, i) => ({
      level: "error",
      message: `Error ${i}`,
      topic: "pipeline.error",
      timestamp: Date.now(),
    }));

    await router.routeBatch(logs);

    const metrics = router.getMetrics();
    assert.equal(metrics.length, 1);
    assert.equal(metrics[0].executionCount, 5);
  });

  it("should track duration statistics", async () => {
    const delays = [10, 20, 30];

    const router = createTopicRouter()
      .custom(
        /^pipeline\./,
        async (log: LogEntry) => {
          const taskId = parseInt(log.message.split(" ")[1]);
          await new Promise((resolve) => setTimeout(resolve, delays[taskId]));
        },
        { trackMetrics: true }
      )
      .build();

    const logs: LogEntry[] = [0, 1, 2].map((i) => ({
      level: "info",
      message: `Task ${i}`,
      topic: "pipeline.info",
      timestamp: Date.now(),
    }));

    await router.routeBatch(logs);

    const metrics = router.getMetrics();
    assert.equal(metrics.length, 1);

    const m = metrics[0];
    // Use >= 9 instead of >= 10 to account for timing variability across systems
    assert.ok(
      m.minDuration >= 9,
      `Min duration ${m.minDuration} should be >= 9ms`
    );
    assert.ok(
      m.maxDuration >= 29,
      `Max duration ${m.maxDuration} should be >= 29ms`
    );
    assert.ok(
      m.averageDuration >= 14,
      `Avg duration ${m.averageDuration} should be >= 14ms`
    );
    assert.ok(m.totalDuration > 0);
  });

  it("should track error count", async () => {
    let callCount = 0;

    const handler = async () => {
      callCount++;
      if (callCount > 1) {
        throw new Error("Handler error");
      }
    };

    const router = createTopicRouter()
      .errors(handler, { trackMetrics: true })
      .build();

    // Process 3 logs: first succeeds, next two fail
    await router.routeBatch([
      {
        level: "error",
        message: "Call 1",
        topic: "pipeline.error",
        timestamp: Date.now(),
      },
      {
        level: "error",
        message: "Call 2",
        topic: "pipeline.error",
        timestamp: Date.now(),
      },
      {
        level: "error",
        message: "Call 3",
        topic: "pipeline.error",
        timestamp: Date.now(),
      },
    ]);

    const metrics = router.getMetrics();
    assert.equal(metrics.length, 1);
    assert.equal(metrics[0].executionCount, 3);
    assert.equal(metrics[0].errorCount, 2);
  });

  it("should track last executed timestamp", async () => {
    const mock = createMockHandler();

    const router = createTopicRouter()
      .errors(mock.handler, { trackMetrics: true })
      .build();

    const beforeTime = Date.now();

    await router.route({
      level: "error",
      message: "Test",
      topic: "pipeline.error",
      timestamp: Date.now(),
    });

    const afterTime = Date.now();

    const metrics = router.getMetrics();
    assert.equal(metrics.length, 1);
    assert.ok(metrics[0].lastExecuted);
    assert.ok(metrics[0].lastExecuted >= beforeTime);
    assert.ok(metrics[0].lastExecuted <= afterTime);
  });

  it("should not track metrics when trackMetrics is false", async () => {
    const mock = createMockHandler();

    const router = createTopicRouter()
      .errors(mock.handler, { trackMetrics: false })
      .build();

    await router.route({
      level: "error",
      message: "Test",
      topic: "pipeline.error",
      timestamp: Date.now(),
    });

    // When trackMetrics is false, getMetrics() should not return this route
    const metrics = router.getMetrics();
    assert.equal(metrics.length, 0); // Filtered out because trackMetrics is false

    // But the handler should still be called
    assert.equal(mock.getLogs().length, 1);
  });

  it("should reset metrics correctly", async () => {
    const mock = createMockHandler();

    const router = createTopicRouter()
      .errors(mock.handler, { trackMetrics: true })
      .build();

    await router.routeBatch([
      {
        level: "error",
        message: "Error 1",
        topic: "pipeline.error",
        timestamp: Date.now(),
      },
      {
        level: "error",
        message: "Error 2",
        topic: "pipeline.error",
        timestamp: Date.now(),
      },
    ]);

    let metrics = router.getMetrics();
    assert.equal(metrics[0].executionCount, 2);

    router.resetMetrics();

    metrics = router.getMetrics();
    assert.equal(metrics[0].executionCount, 0);
    assert.equal(metrics[0].totalDuration, 0);
    assert.equal(metrics[0].errorCount, 0);
    assert.equal(metrics[0].lastExecuted, undefined);
  });

  it("should track metrics independently per route", async () => {
    const mock1 = createMockHandler();
    const mock2 = createMockHandler();

    const router = createTopicRouter()
      .errors(mock1.handler, { trackMetrics: true })
      .debug(mock2.handler, { trackMetrics: true })
      .build();

    await router.routeBatch([
      {
        level: "error",
        message: "Error 1",
        topic: "pipeline.error",
        timestamp: Date.now(),
      },
      {
        level: "error",
        message: "Error 2",
        topic: "pipeline.error",
        timestamp: Date.now(),
      },
      {
        level: "debug",
        message: "Debug 1",
        topic: "pipeline.debug",
        timestamp: Date.now(),
      },
    ]);

    const metrics = router.getMetrics();
    assert.equal(metrics.length, 2);

    // Sort by execution count to get consistent ordering
    const sorted = metrics.sort((a, b) => b.executionCount - a.executionCount);

    // First route should have 2 executions (errors)
    assert.equal(sorted[0].executionCount, 2);

    // Second route should have 1 execution (debug)
    assert.equal(sorted[1].executionCount, 1);
  });
});

describe("TopicRouter RouteOptions Integration", () => {
  it("should support both concurrency and metrics tracking", async () => {
    let activeCount = 0;
    let maxConcurrent = 0;

    const handler = async () => {
      activeCount++;
      maxConcurrent = Math.max(maxConcurrent, activeCount);
      await new Promise((resolve) => setTimeout(resolve, 10));
      activeCount--;
    };

    const router = createTopicRouter()
      .errors(handler, {
        concurrency: 2,
        trackMetrics: true,
      })
      .build();

    const logs: LogEntry[] = Array.from({ length: 10 }, (_, i) => ({
      level: "error",
      message: `Error ${i}`,
      topic: "pipeline.error",
      timestamp: Date.now(),
    }));

    await router.routeBatch(logs);

    // Check concurrency
    assert.ok(maxConcurrent <= 2);

    // Check metrics
    const metrics = router.getMetrics();
    assert.equal(metrics.length, 1);
    assert.equal(metrics[0].executionCount, 10);
    assert.ok(metrics[0].totalDuration > 0);
  });

  it("should support partial options (only concurrency)", async () => {
    let activeCount = 0;
    let maxConcurrent = 0;

    const handler = async () => {
      activeCount++;
      maxConcurrent = Math.max(maxConcurrent, activeCount);
      await new Promise((resolve) => setTimeout(resolve, 5));
      activeCount--;
    };

    const router = createTopicRouter()
      .errors(handler, { concurrency: 1 })
      .build();

    const logs: LogEntry[] = Array.from({ length: 5 }, (_, i) => ({
      level: "error",
      message: `Error ${i}`,
      topic: "pipeline.error",
      timestamp: Date.now(),
    }));

    await router.routeBatch(logs);

    assert.equal(maxConcurrent, 1);
  });

  it("should support partial options (only trackMetrics)", async () => {
    const mock = createMockHandler();

    const router = createTopicRouter()
      .errors(mock.handler, { trackMetrics: true })
      .build();

    await router.route({
      level: "error",
      message: "Test",
      topic: "pipeline.error",
      timestamp: Date.now(),
    });

    const metrics = router.getMetrics();
    assert.equal(metrics[0].executionCount, 1);
  });

  it("should handle no options (default behavior)", async () => {
    const mock = createMockHandler();

    const router = createTopicRouter()
      .errors(mock.handler) // No options
      .build();

    await router.route({
      level: "error",
      message: "Test",
      topic: "pipeline.error",
      timestamp: Date.now(),
    });

    // Should work fine with defaults
    assert.equal(mock.getLogs().length, 1);
  });
});
