import { describe, test } from "node:test";
import assert from "node:assert";
import { createDspPipeline } from "../index.js";

describe("True Time-Based Expiration", () => {
  test("should expire samples based on age, not count", async () => {
    const pipeline = createDspPipeline();
    // 1 second window with timestamps
    pipeline.MovingAverage({ mode: "moving", windowDuration: 1000 });

    // Add 3 samples within 500ms
    const batch1 = new Float32Array([10, 20, 30]);
    const timestamps1 = new Float32Array([0, 100, 200]);

    const result1 = await pipeline.process(batch1, timestamps1, {
      channels: 1,
    });

    // Average of [10, 20, 30] = 20
    assert.ok(Math.abs(result1[2] - 20) < 0.01, "Expected average of ~20");

    // Add a sample 2 seconds later - should expire all previous samples
    const batch2 = new Float32Array([100]);
    const timestamps2 = new Float32Array([2200]); // 2.2 seconds from start

    const result2 = await pipeline.process(batch2, timestamps2, {
      channels: 1,
    });

    // Should only have the new sample (100), since all previous ones are > 1 second old
    assert.ok(
      Math.abs(result2[0] - 100) < 0.01,
      `Expected only new sample (100), got ${result2[0]}`
    );
  });

  test("should work with irregular sampling", async () => {
    const pipeline = createDspPipeline();
    // 500ms window
    pipeline.MovingAverage({ mode: "moving", windowDuration: 500 });

    // Irregular timestamps: 0ms, 50ms, 600ms, 650ms
    const samples = new Float32Array([10, 20, 30, 40]);
    const timestamps = new Float32Array([0, 50, 600, 650]);

    const result = await pipeline.process(samples, timestamps, {
      channels: 1,
    });

    // At timestamp 0: avg([10]) = 10
    assert.ok(Math.abs(result[0] - 10) < 0.01, "First sample should be 10");

    // At timestamp 50: avg([10, 20]) = 15
    assert.ok(
      Math.abs(result[1] - 15) < 0.01,
      "Second should be avg(10,20)=15"
    );

    // At timestamp 600: samples at 0 and 50 are expired (>500ms old)
    // Only sample at 600ms, so avg([30]) = 30
    assert.ok(
      Math.abs(result[2] - 30) < 0.01,
      `Third should be 30 (old samples expired), got ${result[2]}`
    );

    // At timestamp 650: samples at 600 and 650 are within 500ms
    // avg([30, 40]) = 35
    assert.ok(
      Math.abs(result[3] - 35) < 0.01,
      "Fourth should be avg(30,40)=35"
    );
  });

  test("should handle streaming with time-based windows", async () => {
    const pipeline = createDspPipeline();
    // 300ms window
    pipeline.MovingAverage({ mode: "moving", windowDuration: 300 });

    // First chunk: samples at 0, 100, 200ms
    const chunk1 = new Float32Array([10, 20, 30]);
    const ts1 = new Float32Array([0, 100, 200]);
    const result1 = await pipeline.process(chunk1, ts1, { channels: 1 });

    // At 200ms: avg([10, 20, 30]) = 20
    assert.ok(Math.abs(result1[2] - 20) < 0.01, "First chunk avg should be 20");

    // Second chunk: samples at 250, 600ms
    // At 250ms: all previous samples still valid (within 300ms)
    // At 600ms: samples at 0, 100, 200, 250 all expired (>300ms old)
    const chunk2 = new Float32Array([40, 100]);
    const ts2 = new Float32Array([250, 600]);
    const result2 = await pipeline.process(chunk2, ts2, { channels: 1 });

    // At 250ms: avg([10, 20, 30, 40]) = 25
    assert.ok(
      Math.abs(result2[0] - 25) < 0.01,
      `At 250ms expected avg(10,20,30,40)=25, got ${result2[0]}`
    );

    // At 600ms: only sample at 600ms remains, avg([100]) = 100
    assert.ok(
      Math.abs(result2[1] - 100) < 0.01,
      `At 600ms expected 100 (all previous expired), got ${result2[1]}`
    );
  });

  test("should only use time-based expiration when timestamps provided", async () => {
    const pipeline = createDspPipeline();
    // Both windowSize and windowDuration specified
    pipeline.MovingAverage({ mode: "moving", windowDuration: 1000 });

    // Process without timestamps - should use sample-count mode
    const samples1 = new Float32Array([1, 2, 3, 4, 5]);

    // This should work without timestamps (falls back to sample-count mode)
    const result1 = await pipeline.process(samples1, {
      channels: 1,
      sampleRate: 1000, // Required when no timestamps
    });

    assert.ok(result1 instanceof Float32Array);
    assert.strictEqual(result1.length, 5);
  });
});
