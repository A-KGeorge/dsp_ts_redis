import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createDspPipeline, DspProcessor } from "../bindings.js";

const DEFAULT_OPTIONS = { channels: 1, sampleRate: 44100 };

function assertCloseTo(actual: number, expected: number, precision = 5) {
  const tolerance = Math.pow(10, -precision);
  assert.ok(
    Math.abs(actual - expected) < tolerance,
    `Expected ${actual} to be close to ${expected} (tolerance: ${tolerance})`
  );
}

describe("MovingAverage Filter", () => {
  let processor: DspProcessor;

  beforeEach(() => {
    processor = createDspPipeline();
  });

  describe("Basic Functionality", () => {
    test("should compute moving average with window size 3", async () => {
      processor.MovingAverage({ windowSize: 3 });

      const input = new Float32Array([1, 2, 3, 4, 5]);
      const output = await processor.process(input, DEFAULT_OPTIONS);

      // First value: [1] → avg = 1
      // Second value: [1, 2] → avg = 1.5
      // Third value: [1, 2, 3] → avg = 2
      // Fourth value: [2, 3, 4] → avg = 3
      // Fifth value: [3, 4, 5] → avg = 4
      assert.equal(output.length, 5);
      assertCloseTo(output[0], 1);
      assertCloseTo(output[1], 1.5);
      assertCloseTo(output[2], 2);
      assertCloseTo(output[3], 3);
      assertCloseTo(output[4], 4);
    });

    test("should handle single sample window", async () => {
      processor.MovingAverage({ windowSize: 1 });

      const input = new Float32Array([10, 20, 30]);
      const output = await processor.process(input, DEFAULT_OPTIONS);

      assert.deepEqual(Array.from(output), [10, 20, 30]); // No smoothing with window size 1
    });

    test("should handle negative values", async () => {
      processor.MovingAverage({ windowSize: 2 });

      const input = new Float32Array([-5, 5, -10, 10]);
      const output = await processor.process(input, DEFAULT_OPTIONS);

      assertCloseTo(output[0], -5);
      assertCloseTo(output[1], 0); // (-5 + 5) / 2
      assertCloseTo(output[2], -2.5); // (5 + -10) / 2
      assertCloseTo(output[3], 0); // (-10 + 10) / 2
    });

    test("should maintain state across multiple process calls", async () => {
      processor.MovingAverage({ windowSize: 3 });

      // Process first chunk
      const output1 = await processor.process(
        new Float32Array([1, 2]),
        DEFAULT_OPTIONS
      );
      assertCloseTo(output1[0], 1);
      assertCloseTo(output1[1], 1.5);

      // Process second chunk - should continue from previous state
      const output2 = await processor.process(
        new Float32Array([3, 4]),
        DEFAULT_OPTIONS
      );
      assertCloseTo(output2[0], 2); // (1 + 2 + 3) / 3
      assertCloseTo(output2[1], 3); // (2 + 3 + 4) / 3
    });
  });

  describe("State Management", () => {
    test("should serialize and deserialize state correctly", async () => {
      processor.MovingAverage({ windowSize: 3 });

      // Process some data to build state
      await processor.process(
        new Float32Array([1, 2, 3, 4, 5]),
        DEFAULT_OPTIONS
      );

      // Save state
      const stateJson = await processor.saveState();
      const state = JSON.parse(stateJson);

      assert.ok(state);
      assert.ok(state.timestamp);
      assert.equal(state.stages.length, 1);
      assert.equal(state.stages[0].type, "movingAverage");

      // Create new processor with same pipeline structure and load state
      const processor2 = createDspPipeline();
      processor2.MovingAverage({ windowSize: 3 }); // Must match original pipeline
      await processor2.loadState(stateJson);

      // Process should continue from saved state
      const output1 = await processor.process(
        new Float32Array([6]),
        DEFAULT_OPTIONS
      );
      const output2 = await processor2.process(
        new Float32Array([6]),
        DEFAULT_OPTIONS
      );

      assertCloseTo(output2[0], output1[0]);
    });

    test("should reset state correctly", async () => {
      processor.MovingAverage({ windowSize: 3 });

      // Build up state
      await processor.process(new Float32Array([1, 2, 3]), DEFAULT_OPTIONS);

      // Reset
      processor.clearState();

      // Should start fresh
      const output = await processor.process(
        new Float32Array([10]),
        DEFAULT_OPTIONS
      );
      assertCloseTo(output[0], 10); // Only 10 in buffer
    });

    test("should validate runningSum on state load", async () => {
      processor.MovingAverage({ windowSize: 3 });
      await processor.process(new Float32Array([1, 2, 3]), DEFAULT_OPTIONS);

      const stateJson = await processor.saveState();
      const state = JSON.parse(stateJson);

      // Corrupt the runningSum (note: it's in state.stages[0].state.channels)
      if (state.stages[0].state.channels && state.stages[0].state.channels[0]) {
        state.stages[0].state.channels[0].runningSum = 9999;
      }

      // Should throw when loading corrupted state
      const processor2 = createDspPipeline();
      processor2.MovingAverage({ windowSize: 3 }); // Must match original pipeline
      await assert.rejects(
        async () => await processor2.loadState(JSON.stringify(state)),
        /Running sum validation failed/
      );
    });

    test("should validate window size on state load", async () => {
      processor.MovingAverage({ windowSize: 3 });
      await processor.process(new Float32Array([1, 2, 3]), DEFAULT_OPTIONS);

      const stateJson = await processor.saveState();
      const state = JSON.parse(stateJson);

      // Corrupt the window size parameter itself
      if (state.stages[0].state) {
        state.stages[0].state.windowSize = 5; // Change from 3 to 5
      }

      // Should throw when loading corrupted state
      const processor2 = createDspPipeline();
      processor2.MovingAverage({ windowSize: 3 }); // Original window size
      await assert.rejects(
        async () => await processor2.loadState(JSON.stringify(state)),
        /Window size mismatch/
      );
    });
  });

  describe("Error Handling", () => {
    test("should throw error for invalid window size (zero)", () => {
      assert.throws(() => {
        processor.MovingAverage({ windowSize: 0 });
      });
    });

    test("should throw error for invalid window size (negative)", () => {
      assert.throws(() => {
        processor.MovingAverage({ windowSize: -1 });
      });
    });

    test("should handle empty input array", async () => {
      processor.MovingAverage({ windowSize: 3 });
      const output = await processor.process(
        new Float32Array([]),
        DEFAULT_OPTIONS
      );
      assert.equal(output.length, 0);
    });
  });

  describe("Multi-channel Processing", () => {
    test("should process data with stateful continuity", async () => {
      processor.MovingAverage({ windowSize: 2 });

      // Process first batch
      const output1 = await processor.process(
        new Float32Array([1, 2, 3]),
        DEFAULT_OPTIONS
      );
      assertCloseTo(output1[0], 1); // [1]
      assertCloseTo(output1[1], 1.5); // [1, 2]
      assertCloseTo(output1[2], 2.5); // [2, 3]

      // Process second batch - state continues from previous
      const output2 = await processor.process(
        new Float32Array([10, 20, 30]),
        DEFAULT_OPTIONS
      );
      assertCloseTo(output2[0], 6.5); // [3, 10]
      assertCloseTo(output2[1], 15); // [10, 20]
      assertCloseTo(output2[2], 25); // [20, 30]

      // Process third batch - state continues
      const output3 = await processor.process(
        new Float32Array([4]),
        DEFAULT_OPTIONS
      );
      assertCloseTo(output3[0], 17); // [30, 4]
    });
  });
});
