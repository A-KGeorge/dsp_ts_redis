import { test } from "node:test";
import assert from "node:assert";
import { createDspPipeline } from "../index.js";

test("Time-Based Variance", async (t) => {
  await t.test("should expire samples based on age for Variance", async () => {
    const pipeline = createDspPipeline();
    // 1 second window
    pipeline.Variance({ mode: "moving", windowDuration: 1000 });

    // First 3 samples at 0, 100, 200ms - values 1, 2, 3
    const chunk1 = new Float32Array([1, 2, 3]);
    const ts1 = new Float32Array([0, 100, 200]);
    const result1 = await pipeline.process(chunk1, ts1, { channels: 1 });

    // At 200ms: Variance([1, 2, 3])
    // Mean = 2, Variance = ((1-2)^2 + (2-2)^2 + (3-2)^2) / 3 = (1 + 0 + 1) / 3 = 0.667
    const expectedVar1 = 2 / 3; // 0.667
    assert.ok(
      Math.abs(result1[2] - expectedVar1) < 0.01,
      `Expected Variance ≈ 0.667, got ${result1[2]}`
    );

    // Sample at 2200ms - 2.2 seconds later (>1s window)
    // Samples at 0, 100, 200ms should be EXPIRED
    const chunk2 = new Float32Array([10]);
    const ts2 = new Float32Array([2200]);
    const result2 = await pipeline.process(chunk2, ts2, { channels: 1 });

    // At 2200ms: only sample at 2200ms remains, Variance([10]) = 0
    assert.ok(
      Math.abs(result2[0] - 0.0) < 0.01,
      `Expected Variance = 0.0, got ${result2[0]}`
    );
  });

  await t.test("should work with irregular sampling for Variance", async () => {
    const pipeline = createDspPipeline();
    // 500ms window
    pipeline.Variance({ mode: "moving", windowDuration: 500 });

    const samples = new Float32Array([2, 4, 10, 12]);
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
    // Variance([10, 12]) = ((10-11)^2 + (12-11)^2) / 2 = (1 + 1) / 2 = 1
    assert.ok(
      Math.abs(result[3] - 1.0) < 0.01,
      `Expected Variance = 1.0, got ${result[3]}`
    );
  });

  await t.test(
    "should handle streaming with time-based windows for Variance",
    async () => {
      const pipeline = createDspPipeline();
      // 300ms window
      pipeline.Variance({ mode: "moving", windowDuration: 300 });

      // First chunk: samples at 0, 100, 200ms - values 2, 4, 6
      const chunk1 = new Float32Array([2, 4, 6]);
      const ts1 = new Float32Array([0, 100, 200]);
      const result1 = await pipeline.process(chunk1, ts1, { channels: 1 });

      // At 200ms: Variance([2, 4, 6])
      // Mean = 4, Variance = ((2-4)^2 + (4-4)^2 + (6-4)^2) / 3 = (4 + 0 + 4) / 3 ≈ 2.667
      assert.ok(
        Math.abs(result1[2] - 8 / 3) < 0.01,
        "First chunk Variance should be ~2.667"
      );

      // Second chunk: samples at 250, 600ms
      const chunk2 = new Float32Array([8, 20]);
      const ts2 = new Float32Array([250, 600]);
      const result2 = await pipeline.process(chunk2, ts2, { channels: 1 });

      // At 250ms: all previous samples still valid (within 300ms)
      // Variance([2, 4, 6, 8])
      // Mean = 5, Variance = ((2-5)^2 + (4-5)^2 + (6-5)^2 + (8-5)^2) / 4 = (9 + 1 + 1 + 9) / 4 = 5
      assert.ok(
        Math.abs(result2[0] - 5.0) < 0.01,
        `At 250ms expected Variance = 5.0, got ${result2[0]}`
      );

      // At 600ms: samples at 0, 100, 200, 250 all expired (>300ms old)
      // Variance([20]) = 0
      assert.ok(
        Math.abs(result2[1] - 0.0) < 0.01,
        `At 600ms expected Variance = 0, got ${result2[1]}`
      );
    }
  );
});

test("Time-Based Z-Score Normalization", async (t) => {
  await t.test("should expire samples based on age for Z-Score", async () => {
    const pipeline = createDspPipeline();
    // 1 second window
    pipeline.ZScoreNormalize({
      mode: "moving",
      windowDuration: 1000,
      epsilon: 1e-6,
    });

    // First 3 samples at 0, 100, 200ms - values 10, 20, 30
    const chunk1 = new Float32Array([10, 20, 30]);
    const ts1 = new Float32Array([0, 100, 200]);
    const result1 = await pipeline.process(chunk1, ts1, { channels: 1 });

    // At 200ms: Z-Score of 30 given [10, 20, 30]
    // Mean = 20, StdDev = sqrt(Variance) = sqrt(66.667) ≈ 8.165
    // Z-Score = (30 - 20) / 8.165 ≈ 1.225
    const mean1 = 20;
    const variance1 = 200 / 3; // ((10-20)^2 + (20-20)^2 + (30-20)^2) / 3
    const stddev1 = Math.sqrt(variance1);
    const expectedZ1 = (30 - mean1) / stddev1;
    assert.ok(
      Math.abs(result1[2] - expectedZ1) < 0.01,
      `Expected Z-Score ≈ ${expectedZ1.toFixed(3)}, got ${result1[2]}`
    );

    // Sample at 2200ms - 2.2 seconds later (>1s window)
    // Samples at 0, 100, 200ms should be EXPIRED
    const chunk2 = new Float32Array([50]);
    const ts2 = new Float32Array([2200]);
    const result2 = await pipeline.process(chunk2, ts2, { channels: 1 });

    // At 2200ms: only sample at 2200ms remains
    // Z-Score([50]) = 0 (stddev is 0, so returns 0)
    assert.ok(
      Math.abs(result2[0] - 0.0) < 0.01,
      `Expected Z-Score = 0.0, got ${result2[0]}`
    );
  });

  await t.test("should work with irregular sampling for Z-Score", async () => {
    const pipeline = createDspPipeline();
    // 500ms window
    pipeline.ZScoreNormalize({
      mode: "moving",
      windowDuration: 500,
      epsilon: 1e-6,
    });

    const samples = new Float32Array([10, 20, 100, 110]);
    const timestamps = new Float32Array([
      0, // Sample at 0ms
      50, // Sample at 50ms
      600, // Sample at 600ms (550ms gap!)
      650, // Sample at 650ms
    ]);

    const result = await pipeline.process(samples, timestamps, {
      channels: 1,
    });

    // At 650ms with 500ms window:
    // - Sample at 0ms EXPIRED (650 - 0 = 650ms > 500ms)
    // - Sample at 50ms EXPIRED (650 - 50 = 600ms > 500ms)
    // - Sample at 600ms KEPT (650 - 600 = 50ms < 500ms)
    // - Sample at 650ms KEPT (current)
    // Z-Score of 110 given [100, 110]
    // Mean = 105, StdDev = sqrt(25) = 5
    // Z-Score = (110 - 105) / 5 = 1.0
    assert.ok(
      Math.abs(result[3] - 1.0) < 0.01,
      `Expected Z-Score = 1.0, got ${result[3]}`
    );
  });

  await t.test(
    "should handle streaming with time-based windows for Z-Score",
    async () => {
      const pipeline = createDspPipeline();
      // 300ms window
      pipeline.ZScoreNormalize({
        mode: "moving",
        windowDuration: 300,
        epsilon: 1e-6,
      });

      // First chunk: samples at 0, 100, 200ms - values 0, 10, 20
      const chunk1 = new Float32Array([0, 10, 20]);
      const ts1 = new Float32Array([0, 100, 200]);
      const result1 = await pipeline.process(chunk1, ts1, { channels: 1 });

      // At 200ms: Z-Score of 20 given [0, 10, 20]
      // Mean = 10, Variance = 66.667, StdDev ≈ 8.165
      // Z-Score = (20 - 10) / 8.165 ≈ 1.225
      const mean1 = 10;
      const variance1 = 200 / 3;
      const stddev1 = Math.sqrt(variance1);
      const expectedZ1 = (20 - mean1) / stddev1;
      assert.ok(
        Math.abs(result1[2] - expectedZ1) < 0.01,
        "First chunk Z-Score should be ~1.225"
      );

      // Second chunk: samples at 250, 600ms
      const chunk2 = new Float32Array([30, 100]);
      const ts2 = new Float32Array([250, 600]);
      const result2 = await pipeline.process(chunk2, ts2, { channels: 1 });

      // At 250ms: all previous samples still valid (within 300ms)
      // Z-Score of 30 given [0, 10, 20, 30]
      // Mean = 15, Variance = 125, StdDev ≈ 11.18
      // Z-Score = (30 - 15) / 11.18 ≈ 1.342
      const mean2 = 15;
      const variance2 = 125;
      const stddev2 = Math.sqrt(variance2);
      const expectedZ2 = (30 - mean2) / stddev2;
      assert.ok(
        Math.abs(result2[0] - expectedZ2) < 0.01,
        `At 250ms expected Z-Score ≈ ${expectedZ2.toFixed(3)}, got ${
          result2[0]
        }`
      );

      // At 600ms: samples at 0, 100, 200, 250 all expired (>300ms old)
      // Z-Score([100]) = 0 (single sample, stddev = 0)
      assert.ok(
        Math.abs(result2[1] - 0.0) < 0.01,
        `At 600ms expected Z-Score = 0, got ${result2[1]}`
      );
    }
  );
});

test("Backward Compatibility - Variance and Z-Score", async (t) => {
  await t.test("Variance should work without timestamps", async () => {
    const pipeline = createDspPipeline();
    pipeline.Variance({ mode: "moving", windowSize: 3 });

    const samples = new Float32Array([1, 2, 3, 10]);
    const result = await pipeline.process(samples, { channels: 1 });

    // Should use sample-count mode (last 3 samples)
    // At sample 4: Variance([2, 3, 10])
    // Mean = 5, Variance = ((2-5)^2 + (3-5)^2 + (10-5)^2) / 3 = (9 + 4 + 25) / 3 ≈ 12.667
    assert.ok(
      Math.abs(result[3] - 38 / 3) < 0.01,
      "Variance should work in sample-count mode"
    );
  });

  await t.test("Z-Score should work without timestamps", async () => {
    const pipeline = createDspPipeline();
    pipeline.ZScoreNormalize({
      mode: "moving",
      windowSize: 3,
      epsilon: 1e-6,
    });

    const samples = new Float32Array([10, 20, 30, 100]);
    const result = await pipeline.process(samples, { channels: 1 });

    // Should use sample-count mode (last 3 samples)
    // At sample 4: Z-Score of 100 given [20, 30, 100]
    // Mean = 50, Variance = ((20-50)^2 + (30-50)^2 + (100-50)^2) / 3 = (900 + 400 + 2500) / 3 = 3800/3
    // StdDev ≈ 35.59
    // Z-Score = (100 - 50) / 35.59 ≈ 1.405
    const mean = 50;
    const variance = 3800 / 3;
    const stddev = Math.sqrt(variance);
    const expectedZ = (100 - mean) / stddev;
    assert.ok(
      Math.abs(result[3] - expectedZ) < 0.01,
      `Z-Score should work in sample-count mode, expected ${expectedZ.toFixed(
        3
      )}, got ${result[3]}`
    );
  });
});
