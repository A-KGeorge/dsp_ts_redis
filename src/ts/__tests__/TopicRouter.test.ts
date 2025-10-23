/**
 * Unit tests for TopicRouter
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { TopicRouter, createTopicRouter } from "../TopicRouter.js";
import type { LogEntry } from "../types.js";

describe("TopicRouter", () => {
  it("should route logs to matching handlers", async () => {
    const router = new TopicRouter();
    const routed: string[] = [];

    router.addRoute(/^pipeline\.error/, (log) => {
      routed.push(`error: ${log.message}`);
    });

    router.addRoute(/^pipeline\.info/, (log) => {
      routed.push(`info: ${log.message}`);
    });

    await router.route({
      topic: "pipeline.error",
      level: "error",
      message: "Test error",
      timestamp: 1,
    });

    await router.route({
      topic: "pipeline.info",
      level: "info",
      message: "Test info",
      timestamp: 2,
    });

    assert.strictEqual(routed.length, 2);
    assert.strictEqual(routed[0], "error: Test error");
    assert.strictEqual(routed[1], "info: Test info");
  });

  it("should support async handlers", async () => {
    const router = new TopicRouter();
    const routed: string[] = [];

    router.addRoute(/^pipeline\./, async (log) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      routed.push(log.message);
    });

    await router.route({
      topic: "pipeline.test",
      level: "info",
      message: "Async test",
      timestamp: 1,
    });

    assert.strictEqual(routed.length, 1);
    assert.strictEqual(routed[0], "Async test");
  });

  it("should route to multiple matching handlers", async () => {
    const router = new TopicRouter();
    const calls: string[] = [];

    router.addRoute(/^pipeline\./, () => {
      calls.push("handler1");
    });

    router.addRoute(/^pipeline\.error/, () => {
      calls.push("handler2");
    });

    await router.route({
      topic: "pipeline.error",
      level: "error",
      message: "Test",
      timestamp: 1,
    });

    assert.strictEqual(calls.length, 2);
    assert.ok(calls.includes("handler1"));
    assert.ok(calls.includes("handler2"));
  });

  it("should handle batch routing", async () => {
    const router = new TopicRouter();
    const routed: string[] = [];

    router.addRoute(/^pipeline\./, (log) => {
      routed.push(log.message);
    });

    const logs: LogEntry[] = [
      {
        topic: "pipeline.error",
        level: "error",
        message: "Error 1",
        timestamp: 1,
      },
      {
        topic: "pipeline.info",
        level: "info",
        message: "Info 1",
        timestamp: 2,
      },
      {
        topic: "pipeline.debug",
        level: "debug",
        message: "Debug 1",
        timestamp: 3,
      },
    ];

    await router.routeBatch(logs);

    assert.strictEqual(routed.length, 3);
    assert.ok(routed.includes("Error 1"));
    assert.ok(routed.includes("Info 1"));
    assert.ok(routed.includes("Debug 1"));
  });

  it("should skip logs without topics", async () => {
    const router = new TopicRouter();
    let called = false;

    router.addRoute(/.*/, () => {
      called = true;
    });

    await router.route({
      level: "info",
      message: "No topic",
      timestamp: 1,
    });

    assert.strictEqual(called, false);
  });

  it("should handle errors in handlers gracefully", async () => {
    const router = new TopicRouter();
    const calls: string[] = [];

    router.addRoute(/^pipeline\./, () => {
      calls.push("before-error");
      throw new Error("Handler error");
    });

    router.addRoute(/^pipeline\./, () => {
      calls.push("after-error");
    });

    // Should not throw
    await router.route({
      topic: "pipeline.test",
      level: "info",
      message: "Test",
      timestamp: 1,
    });

    // Both handlers should have been called
    assert.strictEqual(calls.length, 2);
  });

  it("should support chainable addRoute", () => {
    const router = new TopicRouter();

    const result = router
      .addRoute(/^pipeline\.error/, () => {})
      .addRoute(/^pipeline\.info/, () => {})
      .addRoute(/.*/, () => {});

    assert.strictEqual(result, router);
    assert.strictEqual(router.getRoutes().length, 3);
  });

  it("should clear routes", () => {
    const router = new TopicRouter();

    router.addRoute(/^pipeline\./, () => {});
    router.addRoute(/.*/, () => {});

    assert.strictEqual(router.getRoutes().length, 2);

    router.clearRoutes();

    assert.strictEqual(router.getRoutes().length, 0);
  });
});

describe("TopicRouterBuilder", () => {
  it("should build router with error route", async () => {
    const routed: string[] = [];

    const router = createTopicRouter()
      .errors((log) => {
        routed.push(`error: ${log.message}`);
      })
      .build();

    await router.route({
      topic: "pipeline.error",
      level: "error",
      message: "Test error",
      timestamp: 1,
    });

    await router.route({
      topic: "pipeline.stage.rms.error",
      level: "error",
      message: "Stage error",
      timestamp: 2,
    });

    assert.strictEqual(routed.length, 2);
  });

  it("should build router with performance route", async () => {
    const routed: string[] = [];

    const router = createTopicRouter()
      .performance((log) => {
        routed.push(`perf: ${log.message}`);
      })
      .build();

    await router.route({
      topic: "pipeline.stage.rms.performance",
      level: "info",
      message: "RMS timing",
      timestamp: 1,
    });

    assert.strictEqual(routed.length, 1);
    assert.strictEqual(routed[0], "perf: RMS timing");
  });

  it("should build router with stage-specific route", async () => {
    const routed: string[] = [];

    const router = createTopicRouter()
      .stage("rms", (log) => {
        routed.push(`rms: ${log.message}`);
      })
      .build();

    await router.route({
      topic: "pipeline.stage.rms.performance",
      level: "info",
      message: "RMS log",
      timestamp: 1,
    });

    await router.route({
      topic: "pipeline.stage.movingAverage.performance",
      level: "info",
      message: "MA log",
      timestamp: 2,
    });

    assert.strictEqual(routed.length, 1);
    assert.strictEqual(routed[0], "rms: RMS log");
  });

  it("should build router with debug route", async () => {
    const routed: string[] = [];

    const router = createTopicRouter()
      .debug((log) => {
        routed.push(log.message);
      })
      .build();

    await router.route({
      topic: "pipeline.debug",
      level: "debug",
      message: "Debug message",
      timestamp: 1,
    });

    assert.strictEqual(routed.length, 1);
  });

  it("should build router with default route", async () => {
    const routed: string[] = [];

    const router = createTopicRouter()
      .default((log) => {
        routed.push(log.message);
      })
      .build();

    await router.route({
      topic: "pipeline.anything",
      level: "info",
      message: "Any message",
      timestamp: 1,
    });

    assert.strictEqual(routed.length, 1);
  });

  it("should build router with custom route", async () => {
    const routed: string[] = [];

    const router = createTopicRouter()
      .custom(/^custom\./, (log) => {
        routed.push(log.message);
      })
      .build();

    await router.route({
      topic: "custom.topic",
      level: "info",
      message: "Custom message",
      timestamp: 1,
    });

    assert.strictEqual(routed.length, 1);
  });

  it("should support method chaining", () => {
    const router = createTopicRouter()
      .errors(() => {})
      .performance(() => {})
      .debug(() => {})
      .default(() => {})
      .build();

    assert.strictEqual(router.getRoutes().length, 4);
  });
});
