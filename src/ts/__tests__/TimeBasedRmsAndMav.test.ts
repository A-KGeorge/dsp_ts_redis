import { test } from "node:test";
import assert from "node:assert";
import { createDspPipeline } from "../index.js";

test("Time-Based RMS", async (t) => {
  await t.test("should expire samples based on age for RMS", async () => {
    const pipeline = createDspPipeline();
    // 1 second window
    pipeline.Rms({ mode: "moving", windowDuration: 1000 });

    // First 3 samples at 0, 100, 200ms - values 1, 2, 3
    const chunk1 = new Float32Array([1, 2, 3]);
    const ts1 = new Float32Array([0, 100, 200]);
    const result1 = await pipeline.process(chunk1, ts1, { channels: 1 });

    // At 200ms: RMS([1, 2, 3]) = sqrt((1 + 4 + 9) / 3) = sqrt(14/3) ≈ 2.16
    assert.ok(
      Math.abs(result1[2] - Math.sqrt(14 / 3)) < 0.01,
      `Expected RMS ≈ 2.16, got ${result1[2]}`
    );

    // Sample at 2200ms - 2.2 seconds later (>1s window)
    // Samples at 0, 100, 200ms should be EXPIRED
    const chunk2 = new Float32Array([4]);
    const ts2 = new Float32Array([2200]);
    const result2 = await pipeline.process(chunk2, ts2, { channels: 1 });

    // At 2200ms: only sample at 2200ms remains, RMS([4]) = 4
    assert.ok(
      Math.abs(result2[0] - 4.0) < 0.01,
      `Expected RMS = 4.0, got ${result2[0]}`
    );
  });

  await t.test("should work with irregular sampling for RMS", async () => {
    const pipeline = createDspPipeline();
    // 500ms window
    pipeline.Rms({ mode: "moving", windowDuration: 500 });

    const samples = new Float32Array([2, 4, 6, 8]);
    const timestamps = new Float32Array([
      0, // Sample at 0ms
      50, // Sample at 50ms
      600, // Sample at 600ms (550ms gap!)
      650, // Sample at 650ms
    ]);

    const result = await pipeline.process(samples, timestamps, { channels: 1 });

    // At 650ms with 500ms window:
    // - Sample at 0ms EXPIRED (650 - 0 = 650ms > 500ms)
    // - Sample at 50ms EXPIRED (650 - 50 = 600ms > 500ms)
    // - Sample at 600ms KEPT (650 - 600 = 50ms < 500ms)
    // - Sample at 650ms KEPT (current)
    // RMS([6, 8]) = sqrt((36 + 64) / 2) = sqrt(50) ≈ 7.07
    assert.ok(
      Math.abs(result[3] - Math.sqrt(50)) < 0.01,
      `Expected RMS ≈ 7.07, got ${result[3]}`
    );
  });

  await t.test(
    "should handle streaming with time-based windows for RMS",
    async () => {
      const pipeline = createDspPipeline();
      // 300ms window
      pipeline.Rms({ mode: "moving", windowDuration: 300 });

      // First chunk: samples at 0, 100, 200ms
      const chunk1 = new Float32Array([1, 2, 3]);
      const ts1 = new Float32Array([0, 100, 200]);
      const result1 = await pipeline.process(chunk1, ts1, { channels: 1 });

      // At 200ms: RMS([1, 2, 3]) = sqrt(14/3) ≈ 2.16
      assert.ok(
        Math.abs(result1[2] - Math.sqrt(14 / 3)) < 0.01,
        "First chunk RMS should be sqrt(14/3)"
      );

      // Second chunk: samples at 250, 600ms
      const chunk2 = new Float32Array([4, 10]);
      const ts2 = new Float32Array([250, 600]);
      const result2 = await pipeline.process(chunk2, ts2, { channels: 1 });

      // At 250ms: all previous samples still valid (within 300ms)
      // RMS([1, 2, 3, 4]) = sqrt((1 + 4 + 9 + 16) / 4) = sqrt(7.5) ≈ 2.74
      assert.ok(
        Math.abs(result2[0] - Math.sqrt(7.5)) < 0.01,
        `At 250ms expected RMS ≈ 2.74, got ${result2[0]}`
      );

      // At 600ms: samples at 0, 100, 200, 250 all expired (>300ms old)
      // RMS([10]) = 10
      assert.ok(
        Math.abs(result2[1] - 10.0) < 0.01,
        `At 600ms expected RMS = 10, got ${result2[1]}`
      );
    }
  );
});

test("Time-Based Mean Absolute Value", async (t) => {
  await t.test("should expire samples based on age for MAV", async () => {
    const pipeline = createDspPipeline();
    // 1 second window
    pipeline.MeanAbsoluteValue({ mode: "moving", windowDuration: 1000 });

    // First 3 samples at 0, 100, 200ms - values -1, 2, -3
    const chunk1 = new Float32Array([-1, 2, -3]);
    const ts1 = new Float32Array([0, 100, 200]);
    const result1 = await pipeline.process(chunk1, ts1, { channels: 1 });

    // At 200ms: MAV([-1, 2, -3]) = (1 + 2 + 3) / 3 = 2
    assert.ok(
      Math.abs(result1[2] - 2.0) < 0.01,
      `Expected MAV = 2.0, got ${result1[2]}`
    );

    // Sample at 2200ms - 2.2 seconds later (>1s window)
    // Samples at 0, 100, 200ms should be EXPIRED
    const chunk2 = new Float32Array([-5]);
    const ts2 = new Float32Array([2200]);
    const result2 = await pipeline.process(chunk2, ts2, { channels: 1 });

    // At 2200ms: only sample at 2200ms remains, MAV([-5]) = 5
    assert.ok(
      Math.abs(result2[0] - 5.0) < 0.01,
      `Expected MAV = 5.0, got ${result2[0]}`
    );
  });

  await t.test("should work with irregular sampling for MAV", async () => {
    const pipeline = createDspPipeline();
    // 500ms window
    pipeline.MeanAbsoluteValue({ mode: "moving", windowDuration: 500 });

    const samples = new Float32Array([-2, 4, -6, 8]);
    const timestamps = new Float32Array([
      0, // Sample at 0ms
      50, // Sample at 50ms
      600, // Sample at 600ms (550ms gap!)
      650, // Sample at 650ms
    ]);

    const result = await pipeline.process(samples, timestamps, { channels: 1 });

    // At 650ms with 500ms window:
    // - Sample at 0ms EXPIRED (650 - 0 = 650ms > 500ms)
    // - Sample at 50ms EXPIRED (650 - 50 = 600ms > 500ms)
    // - Sample at 600ms KEPT (650 - 600 = 50ms < 500ms)
    // - Sample at 650ms KEPT (current)
    // MAV([-6, 8]) = (6 + 8) / 2 = 7
    assert.ok(
      Math.abs(result[3] - 7.0) < 0.01,
      `Expected MAV = 7.0, got ${result[3]}`
    );
  });

  await t.test(
    "should handle streaming with time-based windows for MAV",
    async () => {
      const pipeline = createDspPipeline();
      // 300ms window
      pipeline.MeanAbsoluteValue({ mode: "moving", windowDuration: 300 });

      // First chunk: samples at 0, 100, 200ms
      const chunk1 = new Float32Array([-1, -2, 3]);
      const ts1 = new Float32Array([0, 100, 200]);
      const result1 = await pipeline.process(chunk1, ts1, { channels: 1 });

      // At 200ms: MAV([-1, -2, 3]) = (1 + 2 + 3) / 3 = 2
      assert.ok(
        Math.abs(result1[2] - 2.0) < 0.01,
        "First chunk MAV should be 2.0"
      );

      // Second chunk: samples at 250, 600ms
      const chunk2 = new Float32Array([-4, 10]);
      const ts2 = new Float32Array([250, 600]);
      const result2 = await pipeline.process(chunk2, ts2, { channels: 1 });

      // At 250ms: all previous samples still valid (within 300ms)
      // MAV([-1, -2, 3, -4]) = (1 + 2 + 3 + 4) / 4 = 2.5
      assert.ok(
        Math.abs(result2[0] - 2.5) < 0.01,
        `At 250ms expected MAV = 2.5, got ${result2[0]}`
      );

      // At 600ms: samples at 0, 100, 200, 250 all expired (>300ms old)
      // MAV([10]) = 10
      assert.ok(
        Math.abs(result2[1] - 10.0) < 0.01,
        `At 600ms expected MAV = 10, got ${result2[1]}`
      );
    }
  );
});

test("Backward Compatibility", async (t) => {
  await t.test("RMS should work without timestamps", async () => {
    const pipeline = createDspPipeline();
    pipeline.Rms({ mode: "moving", windowSize: 3 });

    const samples = new Float32Array([1, 2, 3, 4]);
    const result = await pipeline.process(samples, { channels: 1 });

    // Should use sample-count mode (last 3 samples)
    // At sample 4: RMS([2, 3, 4]) = sqrt((4 + 9 + 16) / 3) = sqrt(29/3) ≈ 3.11
    assert.ok(
      Math.abs(result[3] - Math.sqrt(29 / 3)) < 0.01,
      "RMS should work in sample-count mode"
    );
  });

  await t.test("MAV should work without timestamps", async () => {
    const pipeline = createDspPipeline();
    pipeline.MeanAbsoluteValue({ mode: "moving", windowSize: 3 });

    const samples = new Float32Array([-1, -2, 3, -4]);
    const result = await pipeline.process(samples, { channels: 1 });

    // Should use sample-count mode (last 3 samples)
    // At sample 4: MAV([3, -4]) = (3 + 4) / 2 = 3.5
    // Wait, with windowSize=3, at index 3 we have [2, 3, 4] in the window
    // MAV([-2, 3, -4]) = (2 + 3 + 4) / 3 = 3
    assert.ok(
      Math.abs(result[3] - 3.0) < 0.01,
      "MAV should work in sample-count mode"
    );
  });
});
