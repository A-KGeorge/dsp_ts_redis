import { describe, it } from "node:test";
import assert from "node:assert";
import { createDspPipeline } from "../bindings.js";

describe("listState Method", () => {
  it("should return basic pipeline summary before processing", () => {
    const pipeline = createDspPipeline()
      .MovingAverage({ windowSize: 10 })
      .Rms({ windowSize: 5 });

    const summary = pipeline.listState();

    assert.strictEqual(summary.stageCount, 2);
    assert.ok(summary.timestamp > 0);
    assert.strictEqual(summary.stages.length, 2);

    // Check first stage
    assert.strictEqual(summary.stages[0].index, 0);
    assert.strictEqual(summary.stages[0].type, "movingAverage");
    assert.strictEqual(summary.stages[0].windowSize, 10);

    // Check second stage
    assert.strictEqual(summary.stages[1].index, 1);
    assert.strictEqual(summary.stages[1].type, "rms");
    assert.strictEqual(summary.stages[1].windowSize, 5);
  });

  it("should include channel info after processing", async () => {
    const pipeline = createDspPipeline().MovingAverage({ windowSize: 5 });

    const input = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    await pipeline.process(input, { sampleRate: 1000, channels: 1 });

    const summary = pipeline.listState();

    assert.strictEqual(summary.stages[0].numChannels, 1);
    assert.strictEqual(summary.stages[0].bufferSize, 5);
    assert.strictEqual(summary.stages[0].channelCount, 1);
  });

  it("should show correct channel count for multi-channel processing", async () => {
    const pipeline = createDspPipeline()
      .MovingAverage({ windowSize: 10 })
      .Rms({ windowSize: 5 });

    // 4-channel interleaved data
    const input = new Float32Array(400).map((_, i) => Math.sin(i * 0.1));
    await pipeline.process(input, { sampleRate: 2000, channels: 4 });

    const summary = pipeline.listState();

    assert.strictEqual(summary.stages[0].channelCount, 4);
    assert.strictEqual(summary.stages[1].channelCount, 4);
  });

  it("should include mode for rectify stage", () => {
    const pipeline = createDspPipeline()
      .Rectify({ mode: "half" })
      .Rms({ windowSize: 10 });

    const summary = pipeline.listState();

    assert.strictEqual(summary.stages[0].type, "rectify");
    assert.strictEqual(summary.stages[0].mode, "half");
  });

  it("should not include buffer data (unlike saveState)", async () => {
    const pipeline = createDspPipeline().MovingAverage({ windowSize: 5 });

    const input = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    await pipeline.process(input, { sampleRate: 1000, channels: 1 });

    const summary = pipeline.listState();
    const summaryJson = JSON.stringify(summary);

    // Should not contain actual buffer values
    assert.ok(!summaryJson.includes('"buffer":['));

    // Should not contain running sum
    assert.ok(!summaryJson.includes('"runningSum"'));
  });

  it("should be smaller than saveState", async () => {
    const pipeline = createDspPipeline()
      .MovingAverage({ windowSize: 100 })
      .Rms({ windowSize: 50 });

    const input = new Float32Array(1000).map((_, i) => Math.sin(i * 0.1));
    await pipeline.process(input, { sampleRate: 1000, channels: 1 });

    const summary = pipeline.listState();
    const fullState = await pipeline.saveState();

    const summarySize = JSON.stringify(summary).length;
    const fullStateSize = fullState.length;

    // listState should be significantly smaller
    assert.ok(
      summarySize < fullStateSize,
      `Summary size (${summarySize}) should be less than full state (${fullStateSize})`
    );

    // Should be at least 50% smaller for this case
    const reduction = 1 - summarySize / fullStateSize;
    assert.ok(
      reduction > 0.5,
      `Reduction should be > 50%, got ${(reduction * 100).toFixed(1)}%`
    );
  });

  it("should work with complex pipeline", async () => {
    const pipeline = createDspPipeline()
      .MovingAverage({ windowSize: 20 })
      .Rectify({ mode: "full" })
      .Rms({ windowSize: 10 })
      .MovingAverage({ windowSize: 5 });

    const input = new Float32Array(100).map((_, i) => Math.sin(i * 0.1));
    await pipeline.process(input, { sampleRate: 1000, channels: 1 });

    const summary = pipeline.listState();

    assert.strictEqual(summary.stageCount, 4);
    assert.strictEqual(summary.stages[0].type, "movingAverage");
    assert.strictEqual(summary.stages[1].type, "rectify");
    assert.strictEqual(summary.stages[2].type, "rms");
    assert.strictEqual(summary.stages[3].type, "movingAverage");

    // Verify each stage has expected properties
    assert.strictEqual(summary.stages[0].windowSize, 20);
    assert.strictEqual(summary.stages[1].mode, "full");
    assert.strictEqual(summary.stages[2].windowSize, 10);
    assert.strictEqual(summary.stages[3].windowSize, 5);
  });

  it("should update timestamp on each call", async () => {
    const pipeline = createDspPipeline().MovingAverage({ windowSize: 5 });

    const summary1 = pipeline.listState();
    const timestamp1 = summary1.timestamp;

    // Wait a moment
    await new Promise((resolve) => setTimeout(resolve, 100));

    const summary2 = pipeline.listState();
    const timestamp2 = summary2.timestamp;

    assert.ok(
      timestamp2 >= timestamp1,
      "Second timestamp should be >= first timestamp"
    );
  });
});
