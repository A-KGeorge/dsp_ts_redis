import { describe, test } from "node:test";
import assert from "node:assert";
import { createDspPipeline } from "../index.js";

describe("Time-Series Processing", () => {
  describe("Process with Timestamps", () => {
    test("should accept timestamps array (legacy sample-based)", async () => {
      const pipeline = createDspPipeline();
      pipeline.MovingAverage({ mode: "moving", windowSize: 3 });

      const samples = new Float32Array([1, 2, 3, 4, 5]);
      const timestamps = new Float32Array([0, 1, 2, 3, 4]); // Sample indices

      const output = await pipeline.process(samples, timestamps, {
        channels: 1,
      });

      assert.ok(output instanceof Float32Array);
      assert.strictEqual(output.length, 5);
    });

    test("should accept timestamps with milliseconds", async () => {
      const pipeline = createDspPipeline();
      pipeline.MovingAverage({ mode: "moving", windowSize: 3 });

      const samples = new Float32Array([1, 2, 3, 4, 5]);
      // Timestamps at 100ms intervals
      const timestamps = new Float32Array([0, 100, 200, 300, 400]);

      const output = await pipeline.process(samples, timestamps, {
        channels: 1,
      });

      assert.ok(output instanceof Float32Array);
      assert.strictEqual(output.length, 5);
    });

    test("should validate timestamp length matches sample length", async () => {
      const pipeline = createDspPipeline();
      pipeline.MovingAverage({ mode: "moving", windowSize: 3 });

      const samples = new Float32Array([1, 2, 3, 4, 5]);
      const timestamps = new Float32Array([0, 100, 200]); // Wrong length!

      await assert.rejects(
        async () => {
          await pipeline.process(samples, timestamps, { channels: 1 });
        },
        {
          message: /Timestamp.*length.*must match.*sample.*length/i,
        }
      );
    });

    test("should auto-generate timestamps from sampleRate", async () => {
      const pipeline = createDspPipeline();
      pipeline.MovingAverage({ mode: "moving", windowSize: 3 });

      const samples = new Float32Array([1, 2, 3, 4, 5]);

      // Legacy mode: auto-generates timestamps from sampleRate
      const output = await pipeline.process(samples, {
        sampleRate: 100, // 100 Hz = 10ms per sample
        channels: 1,
      });

      assert.ok(output instanceof Float32Array);
      assert.strictEqual(output.length, 5);
    });

    test("should work with windowDuration parameter", async () => {
      const pipeline = createDspPipeline();
      // Using windowDuration instead of windowSize
      pipeline.MovingAverage({ mode: "moving", windowDuration: 5000 }); // 5 seconds

      const samples = new Float32Array([1, 2, 3, 4, 5]);
      const timestamps = new Float32Array([0, 1000, 2000, 3000, 4000]);

      const output = await pipeline.process(samples, timestamps, {
        channels: 1,
      });

      assert.ok(output instanceof Float32Array);
      assert.strictEqual(output.length, 5);
    });

    test("should work with processCopy and timestamps", async () => {
      const pipeline = createDspPipeline();
      pipeline.MovingAverage({ mode: "moving", windowSize: 3 });

      const samples = new Float32Array([1, 2, 3, 4, 5]);
      const timestamps = new Float32Array([0, 100, 200, 300, 400]);

      const output = await pipeline.processCopy(samples, timestamps, {
        channels: 1,
      });

      // Original should be unchanged
      assert.deepStrictEqual(
        Array.from(samples),
        [1, 2, 3, 4, 5],
        "Original samples should be unchanged"
      );

      // Output should be different
      assert.ok(output instanceof Float32Array);
      assert.strictEqual(output.length, 5);
    });

    test("should support multi-channel with timestamps", async () => {
      const pipeline = createDspPipeline();
      pipeline.MovingAverage({ mode: "moving", windowSize: 3 });

      // 2 channels, 3 samples per channel = 6 total samples (interleaved)
      const samples = new Float32Array([1, 10, 2, 20, 3, 30]);
      const timestamps = new Float32Array([0, 0, 100, 100, 200, 200]); // Timestamps per sample

      const output = await pipeline.process(samples, timestamps, {
        channels: 2,
      });

      assert.ok(output instanceof Float32Array);
      assert.strictEqual(output.length, 6);
    });
  });

  describe("Backwards Compatibility", () => {
    test("should work without timestamps (legacy mode)", async () => {
      const pipeline = createDspPipeline();
      pipeline.MovingAverage({ mode: "moving", windowSize: 3 });

      const samples = new Float32Array([1, 2, 3, 4, 5]);

      // Legacy API: no timestamps
      const output = await pipeline.process(samples, { channels: 1 });

      assert.ok(output instanceof Float32Array);
      assert.strictEqual(output.length, 5);
    });

    test("should maintain same results in legacy mode", async () => {
      const pipeline1 = createDspPipeline();
      pipeline1.MovingAverage({ mode: "moving", windowSize: 3 });

      const pipeline2 = createDspPipeline();
      pipeline2.MovingAverage({ mode: "moving", windowSize: 3 });

      const samples1 = new Float32Array([1, 2, 3, 4, 5]);
      const samples2 = new Float32Array([1, 2, 3, 4, 5]);

      // Legacy mode
      const output1 = await pipeline1.process(samples1, { channels: 1 });

      // With explicit sequential timestamps (should behave the same)
      const timestamps = new Float32Array([0, 1, 2, 3, 4]);
      const output2 = await pipeline2.process(samples2, timestamps, {
        channels: 1,
      });

      // Results should be identical
      for (let i = 0; i < output1.length; i++) {
        assert.ok(
          Math.abs(output1[i] - output2[i]) < 0.0001,
          `Expected outputs to match at index ${i}: ${output1[i]} vs ${output2[i]}`
        );
      }
    });
  });

  describe("Filter Parameter Validation", () => {
    test("should accept windowSize (legacy)", () => {
      const pipeline = createDspPipeline();
      assert.doesNotThrow(() => {
        pipeline.MovingAverage({ mode: "moving", windowSize: 10 });
      });
    });

    test("should accept windowDuration (new)", () => {
      const pipeline = createDspPipeline();
      assert.doesNotThrow(() => {
        pipeline.MovingAverage({ mode: "moving", windowDuration: 5000 });
      });
    });

    test("should accept both windowSize and windowDuration", () => {
      const pipeline = createDspPipeline();
      assert.doesNotThrow(() => {
        pipeline.MovingAverage({
          mode: "moving",
          windowSize: 10,
          windowDuration: 5000,
        });
      });
    });

    test("should reject neither windowSize nor windowDuration", () => {
      const pipeline = createDspPipeline();
      assert.throws(
        () => {
          pipeline.MovingAverage({ mode: "moving" } as any);
        },
        {
          name: "TypeError",
          message:
            /either windowSize or windowDuration must be specified for "moving" mode/,
        }
      );
    });

    test("should reject invalid windowDuration", () => {
      const pipeline = createDspPipeline();
      assert.throws(
        () => {
          pipeline.MovingAverage({ mode: "moving", windowDuration: -100 });
        },
        {
          name: "TypeError",
          message: /windowDuration must be positive/,
        }
      );
    });
  });

  describe("All Filters Support Time-Series", () => {
    test("Rms should accept windowDuration", () => {
      const pipeline = createDspPipeline();
      assert.doesNotThrow(() => {
        pipeline.Rms({ mode: "moving", windowDuration: 5000 });
      });
    });

    test("Variance should accept windowDuration", () => {
      const pipeline = createDspPipeline();
      assert.doesNotThrow(() => {
        pipeline.Variance({ mode: "moving", windowDuration: 5000 });
      });
    });

    test("ZScoreNormalize should accept windowDuration", () => {
      const pipeline = createDspPipeline();
      assert.doesNotThrow(() => {
        pipeline.ZScoreNormalize({ mode: "moving", windowDuration: 5000 });
      });
    });

    test("MeanAbsoluteValue should accept windowDuration", () => {
      const pipeline = createDspPipeline();
      assert.doesNotThrow(() => {
        pipeline.MeanAbsoluteValue({ mode: "moving", windowDuration: 5000 });
      });
    });
  });
});
