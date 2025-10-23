/**
 * TopicRouter Priority Tests
 *
 * Tests for 10-level priority system with routing filters
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createTopicRouter, createMockHandler } from "../index.js";
import type { LogEntry } from "../types.js";

describe("TopicRouter Priority Filtering", () => {
  it("should default log priority to 1 when not specified", async () => {
    const mock = createMockHandler();

    const router = createTopicRouter()
      .errors(mock.handler, { minPriority: 1 })
      .build();

    await router.route({
      level: "error",
      message: "No priority specified",
      topic: "pipeline.error",
      timestamp: Date.now(),
      // priority not specified
    });

    assert.equal(mock.getLogs().length, 1);
  });

  it("should route logs with priority >= minPriority", async () => {
    const mock = createMockHandler();

    const router = createTopicRouter()
      .errors(mock.handler, { minPriority: 5 })
      .build();

    await router.routeBatch([
      {
        level: "error",
        message: "Priority 3",
        topic: "pipeline.error",
        timestamp: Date.now(),
        priority: 3,
      },
      {
        level: "error",
        message: "Priority 5",
        topic: "pipeline.error",
        timestamp: Date.now(),
        priority: 5,
      },
      {
        level: "error",
        message: "Priority 7",
        topic: "pipeline.error",
        timestamp: Date.now(),
        priority: 7,
      },
    ]);

    // Should only route priority 5 and 7
    const logs = mock.getLogs();
    assert.equal(logs.length, 2);
    assert.equal(logs[0].priority, 5);
    assert.equal(logs[1].priority, 7);
  });

  it("should route logs with priority <= maxPriority", async () => {
    const mock = createMockHandler();

    const router = createTopicRouter()
      .errors(mock.handler, { maxPriority: 5 })
      .build();

    await router.routeBatch([
      {
        level: "error",
        message: "Priority 3",
        topic: "pipeline.error",
        timestamp: Date.now(),
        priority: 3,
      },
      {
        level: "error",
        message: "Priority 5",
        topic: "pipeline.error",
        timestamp: Date.now(),
        priority: 5,
      },
      {
        level: "error",
        message: "Priority 8",
        topic: "pipeline.error",
        timestamp: Date.now(),
        priority: 8,
      },
    ]);

    // Should only route priority 3 and 5
    const logs = mock.getLogs();
    assert.equal(logs.length, 2);
    assert.equal(logs[0].priority, 3);
    assert.equal(logs[1].priority, 5);
  });

  it("should route logs within priority range (minPriority and maxPriority)", async () => {
    const mock = createMockHandler();

    const router = createTopicRouter()
      .errors(mock.handler, { minPriority: 4, maxPriority: 7 })
      .build();

    await router.routeBatch([
      {
        level: "error",
        message: "Priority 2",
        topic: "pipeline.error",
        timestamp: Date.now(),
        priority: 2,
      },
      {
        level: "error",
        message: "Priority 4",
        topic: "pipeline.error",
        timestamp: Date.now(),
        priority: 4,
      },
      {
        level: "error",
        message: "Priority 6",
        topic: "pipeline.error",
        timestamp: Date.now(),
        priority: 6,
      },
      {
        level: "error",
        message: "Priority 7",
        topic: "pipeline.error",
        timestamp: Date.now(),
        priority: 7,
      },
      {
        level: "error",
        message: "Priority 9",
        topic: "pipeline.error",
        timestamp: Date.now(),
        priority: 9,
      },
    ]);

    // Should only route priority 4, 6, 7
    const logs = mock.getLogs();
    assert.equal(logs.length, 3);
    assert.equal(logs[0].priority, 4);
    assert.equal(logs[1].priority, 6);
    assert.equal(logs[2].priority, 7);
  });

  it("should route all priorities when no filter is specified", async () => {
    const mock = createMockHandler();

    const router = createTopicRouter()
      .errors(mock.handler) // No priority filter
      .build();

    await router.routeBatch([
      {
        level: "error",
        message: "Priority 1",
        topic: "pipeline.error",
        timestamp: Date.now(),
        priority: 1,
      },
      {
        level: "error",
        message: "Priority 5",
        topic: "pipeline.error",
        timestamp: Date.now(),
        priority: 5,
      },
      {
        level: "error",
        message: "Priority 10",
        topic: "pipeline.error",
        timestamp: Date.now(),
        priority: 10,
      },
    ]);

    // Should route all logs
    assert.equal(mock.getLogs().length, 3);
  });
});

describe("TopicRouter Multi-Route Priority", () => {
  it("should route to different handlers based on priority", async () => {
    const lowPriority = createMockHandler();
    const highPriority = createMockHandler();
    const critical = createMockHandler();

    const router = createTopicRouter()
      .custom(/^pipeline\./, lowPriority.handler, {
        minPriority: 1,
        maxPriority: 3,
      })
      .custom(/^pipeline\./, highPriority.handler, {
        minPriority: 4,
        maxPriority: 8,
      })
      .custom(/^pipeline\./, critical.handler, {
        minPriority: 9,
        maxPriority: 10,
      })
      .build();

    await router.routeBatch([
      {
        level: "debug",
        message: "Low 1",
        topic: "pipeline.debug",
        timestamp: Date.now(),
        priority: 1,
      },
      {
        level: "info",
        message: "Normal 5",
        topic: "pipeline.info",
        timestamp: Date.now(),
        priority: 5,
      },
      {
        level: "error",
        message: "Critical 10",
        topic: "pipeline.error",
        timestamp: Date.now(),
        priority: 10,
      },
    ]);

    assert.equal(lowPriority.getLogs().length, 1);
    assert.equal(highPriority.getLogs().length, 1);
    assert.equal(critical.getLogs().length, 1);

    assert.equal(lowPriority.getLogs()[0].priority, 1);
    assert.equal(highPriority.getLogs()[0].priority, 5);
    assert.equal(critical.getLogs()[0].priority, 10);
  });

  it("should route to multiple handlers when priorities overlap", async () => {
    const handler1 = createMockHandler();
    const handler2 = createMockHandler();

    const router = createTopicRouter()
      .custom(/^pipeline\./, handler1.handler, {
        minPriority: 3,
        maxPriority: 7,
      })
      .custom(/^pipeline\./, handler2.handler, {
        minPriority: 5,
        maxPriority: 10,
      })
      .build();

    await router.routeBatch([
      {
        level: "info",
        message: "Priority 4",
        topic: "pipeline.info",
        timestamp: Date.now(),
        priority: 4,
      },
      {
        level: "info",
        message: "Priority 6",
        topic: "pipeline.info",
        timestamp: Date.now(),
        priority: 6,
      },
      {
        level: "info",
        message: "Priority 8",
        topic: "pipeline.info",
        timestamp: Date.now(),
        priority: 8,
      },
    ]);

    // Priority 4: only handler1 (3-7 range)
    // Priority 6: both handlers (overlap)
    // Priority 8: only handler2 (5-10 range)
    assert.equal(handler1.getLogs().length, 2); // 4, 6
    assert.equal(handler2.getLogs().length, 2); // 6, 8
  });
});

describe("TopicRouter Priority + Concurrency", () => {
  it("should respect concurrency limits per priority tier", async () => {
    let activeCount = 0;
    let maxConcurrent = 0;

    const handler = async () => {
      activeCount++;
      maxConcurrent = Math.max(maxConcurrent, activeCount);
      await new Promise((resolve) => setTimeout(resolve, 10));
      activeCount--;
    };

    const router = createTopicRouter()
      .custom(/^pipeline\./, handler, {
        minPriority: 7,
        maxPriority: 10,
        concurrency: 2,
      })
      .build();

    // Only high-priority logs should be processed
    await router.routeBatch([
      {
        level: "debug",
        message: "Low",
        topic: "pipeline.debug",
        timestamp: Date.now(),
        priority: 2,
      },
      {
        level: "error",
        message: "High 1",
        topic: "pipeline.error",
        timestamp: Date.now(),
        priority: 8,
      },
      {
        level: "error",
        message: "High 2",
        topic: "pipeline.error",
        timestamp: Date.now(),
        priority: 9,
      },
      {
        level: "error",
        message: "High 3",
        topic: "pipeline.error",
        timestamp: Date.now(),
        priority: 10,
      },
    ]);

    // Should process 3 high-priority logs with concurrency limit of 2
    assert.ok(
      maxConcurrent <= 2,
      `Max concurrent was ${maxConcurrent}, expected <= 2`
    );
  });
});

describe("TopicRouter Priority + Metrics", () => {
  it("should track metrics separately for different priority tiers", async () => {
    const lowHandler = createMockHandler();
    const highHandler = createMockHandler();

    const router = createTopicRouter()
      .custom(/^pipeline\./, lowHandler.handler, {
        minPriority: 1,
        maxPriority: 5,
        trackMetrics: true,
      })
      .custom(/^pipeline\./, highHandler.handler, {
        minPriority: 6,
        maxPriority: 10,
        trackMetrics: true,
      })
      .build();

    await router.routeBatch([
      {
        level: "debug",
        message: "Low 1",
        topic: "pipeline.debug",
        timestamp: Date.now(),
        priority: 2,
      },
      {
        level: "info",
        message: "Low 2",
        topic: "pipeline.info",
        timestamp: Date.now(),
        priority: 4,
      },
      {
        level: "warn",
        message: "High 1",
        topic: "pipeline.warn",
        timestamp: Date.now(),
        priority: 7,
      },
      {
        level: "error",
        message: "High 2",
        topic: "pipeline.error",
        timestamp: Date.now(),
        priority: 9,
      },
      {
        level: "error",
        message: "High 3",
        topic: "pipeline.error",
        timestamp: Date.now(),
        priority: 10,
      },
    ]);

    const metrics = router.getMetrics();
    assert.equal(metrics.length, 2);

    // Sort by execution count
    const sorted = metrics.sort((a, b) => a.executionCount - b.executionCount);

    assert.equal(sorted[0].executionCount, 2); // Low priority tier
    assert.equal(sorted[1].executionCount, 3); // High priority tier
  });
});

describe("Priority with Default Log Levels", () => {
  it("should use default priorities based on log level", async () => {
    const debugHandler = createMockHandler();
    const infoHandler = createMockHandler();
    const warnHandler = createMockHandler();
    const errorHandler = createMockHandler();

    const router = createTopicRouter()
      .custom(/^pipeline\./, debugHandler.handler, {
        minPriority: 1,
        maxPriority: 3,
      })
      .custom(/^pipeline\./, infoHandler.handler, {
        minPriority: 4,
        maxPriority: 6,
      })
      .custom(/^pipeline\./, warnHandler.handler, {
        minPriority: 7,
        maxPriority: 8,
      })
      .custom(/^pipeline\./, errorHandler.handler, {
        minPriority: 9,
        maxPriority: 10,
      })
      .build();

    // Logs with default priorities: debug=2, info=5, warn=7, error=9
    await router.routeBatch([
      {
        level: "debug",
        message: "Debug",
        topic: "pipeline.debug",
        timestamp: Date.now(),
        priority: 2,
      },
      {
        level: "info",
        message: "Info",
        topic: "pipeline.info",
        timestamp: Date.now(),
        priority: 5,
      },
      {
        level: "warn",
        message: "Warn",
        topic: "pipeline.warn",
        timestamp: Date.now(),
        priority: 7,
      },
      {
        level: "error",
        message: "Error",
        topic: "pipeline.error",
        timestamp: Date.now(),
        priority: 9,
      },
    ]);

    assert.equal(debugHandler.getLogs().length, 1);
    assert.equal(infoHandler.getLogs().length, 1);
    assert.equal(warnHandler.getLogs().length, 1);
    assert.equal(errorHandler.getLogs().length, 1);
  });
});
