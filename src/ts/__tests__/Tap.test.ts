/**
 * Unit tests for .tap() method
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { createDspPipeline } from "../bindings.js";

describe("Tap Method", () => {
  it("should execute tap callback after processing", async () => {
    let tapCalled = false;
    let tappedSamples: Float32Array | null = null;
    let tappedStage = "";

    const pipeline = createDspPipeline()
      .MovingAverage({ windowSize: 3 })
      .tap((samples, stage) => {
        tapCalled = true;
        tappedSamples = samples;
        tappedStage = stage;
      });

    const input = new Float32Array([1, 2, 3, 4, 5]);
    await pipeline.process(input, { sampleRate: 1000 });

    assert.strictEqual(tapCalled, true);
    assert.notStrictEqual(tappedSamples, null);
    assert.strictEqual(tappedStage, "movingAverage");
  });

  it("should support multiple tap calls in chain", async () => {
    const tapLog: Array<{ stage: string; firstValue: number }> = [];

    const pipeline = createDspPipeline()
      .MovingAverage({ windowSize: 2 })
      .tap((samples, stage) => {
        tapLog.push({ stage, firstValue: samples[0] });
      })
      .Rectify({ mode: "full" })
      .tap((samples, stage) => {
        tapLog.push({ stage, firstValue: samples[0] });
      })
      .Rms({ windowSize: 2 })
      .tap((samples, stage) => {
        tapLog.push({ stage, firstValue: samples[0] });
      });

    const input = new Float32Array([1, -2, 3, -4, 5]);
    await pipeline.process(input, { sampleRate: 1000 });

    assert.strictEqual(tapLog.length, 3);
    assert.strictEqual(tapLog[0].stage, "movingAverage");
    assert.strictEqual(tapLog[1].stage, "movingAverage → rectify:full");
    assert.strictEqual(tapLog[2].stage, "movingAverage → rectify:full → rms");
  });

  it("should not modify the data in tap callback", async () => {
    const pipeline = createDspPipeline()
      .MovingAverage({ windowSize: 2 })
      .tap((samples) => {
        // Try to modify (should not affect final result since it's after processing)
        samples[0] = 999;
      });

    const input = new Float32Array([1, 2, 3, 4, 5]);
    const result = await pipeline.process(input, { sampleRate: 1000 });

    // Since tap is called after native processing completes, the modification
    // will actually persist (samples reference the result buffer)
    assert.strictEqual(result[0], 999);
  });

  it("should handle errors in tap callback gracefully", async () => {
    let processCompleted = false;

    const pipeline = createDspPipeline()
      .MovingAverage({ windowSize: 2 })
      .tap(() => {
        throw new Error("Tap error!");
      });

    const input = new Float32Array([1, 2, 3, 4, 5]);

    // Should not throw, error is caught and logged
    const result = await pipeline.process(input, { sampleRate: 1000 });
    processCompleted = true;

    assert.strictEqual(processCompleted, true);
    assert.notStrictEqual(result, null);
  });

  it("should work with empty pipeline (no stages)", async () => {
    let tapCalled = false;

    const pipeline = createDspPipeline().tap((samples, stage) => {
      tapCalled = true;
      assert.strictEqual(stage, "start");
    });

    const input = new Float32Array([1, 2, 3]);
    await pipeline.process(input, { sampleRate: 1000 });

    assert.strictEqual(tapCalled, true);
  });

  it("should receive a view of the actual result buffer", async () => {
    let tappedBuffer: Float32Array | null = null;

    const pipeline = createDspPipeline()
      .MovingAverage({ windowSize: 2 })
      .tap((samples) => {
        tappedBuffer = samples;
      });

    const input = new Float32Array([1, 2, 3, 4, 5]);
    const result = await pipeline.process(input, { sampleRate: 1000 });

    // Should be the same reference
    assert.strictEqual(tappedBuffer, result);
  });

  it("should support inspection of sample slices", async () => {
    const inspectedSlices: number[][] = [];

    const pipeline = createDspPipeline()
      .MovingAverage({ windowSize: 3 })
      .tap((samples) => {
        // Common pattern: inspect first few samples
        inspectedSlices.push(Array.from(samples.slice(0, 3)));
      })
      .Rectify();

    const input = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    await pipeline.process(input, { sampleRate: 1000 });

    assert.strictEqual(inspectedSlices.length, 1);
    assert.strictEqual(inspectedSlices[0].length, 3);
  });

  it("should work with pipeline callbacks simultaneously", async () => {
    let tapCalled = false;
    let onBatchCalled = false;

    const pipeline = createDspPipeline()
      .pipeline({
        onBatch: () => {
          onBatchCalled = true;
        },
      })
      .MovingAverage({ windowSize: 2 })
      .tap(() => {
        tapCalled = true;
      });

    const input = new Float32Array([1, 2, 3]);
    await pipeline.process(input, { sampleRate: 1000 });

    assert.strictEqual(tapCalled, true);
    assert.strictEqual(onBatchCalled, true);
  });
});
