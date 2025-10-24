/**
 * Tests for DriftDetector and utilities (Phase 5)
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  DriftDetector,
  detectGaps,
  validateMonotonicity,
  estimateSampleRate,
} from "../DriftDetector.js";

describe("DriftDetector", () => {
  describe("processSample()", () => {
    it("should not detect drift for consistent timing", () => {
      let driftDetected = false;

      const detector = new DriftDetector({
        expectedSampleRate: 100,
        driftThreshold: 5.0,
        onDriftDetected: () => {
          driftDetected = true;
        },
      });

      // Simulate perfect 10ms intervals (100 Hz)
      let timestamp = 1000;
      for (let i = 0; i < 100; i++) {
        detector.processSample(timestamp);
        timestamp += 10;
      }

      assert.strictEqual(driftDetected, false);
    });

    it("should detect positive drift (samples arriving too fast)", () => {
      let driftCount = 0;

      const detector = new DriftDetector({
        expectedSampleRate: 100, // 10ms expected
        driftThreshold: 5.0,
        onDriftDetected: () => {
          driftCount++;
        },
      });

      // First sample establishes baseline
      detector.processSample(1000);

      // Samples arriving every 8ms (125 Hz instead of 100 Hz = 25% too fast)
      for (let i = 1; i < 10; i++) {
        detector.processSample(1000 + i * 8);
      }

      assert.ok(driftCount > 0);
    });

    it("should detect negative drift (samples arriving too slow)", () => {
      let driftCount = 0;

      const detector = new DriftDetector({
        expectedSampleRate: 100, // 10ms expected
        driftThreshold: 5.0,
        onDriftDetected: () => {
          driftCount++;
        },
      });

      detector.processSample(1000);

      // Samples arriving every 15ms (66.7 Hz instead of 100 Hz = 33% too slow)
      for (let i = 1; i < 10; i++) {
        detector.processSample(1000 + i * 15);
      }

      assert.ok(driftCount > 0);
    });

    it("should respect drift threshold", () => {
      let driftCount = 0;

      const detector = new DriftDetector({
        expectedSampleRate: 100,
        driftThreshold: 10.0, // 10% threshold
        onDriftDetected: () => {
          driftCount++;
        },
      });

      detector.processSample(1000);

      // 9% drift should not trigger (10.9ms interval = 91.7 Hz = 8.3% drift)
      for (let i = 1; i < 10; i++) {
        detector.processSample(1000 + i * 10.9);
      }

      assert.strictEqual(driftCount, 0);

      // 15% drift should trigger (11.5ms interval = 87 Hz = 13% drift)
      for (let i = 10; i < 20; i++) {
        detector.processSample(1000 + 10 * 10.9 + (i - 10) * 11.5);
      }

      assert.ok(driftCount > 0);
    });
  });

  describe("processBatch()", () => {
    it("should process batch of timestamps", () => {
      const detector = new DriftDetector({
        expectedSampleRate: 100,
        driftThreshold: 5.0,
      });

      const timestamps = new Float32Array(10);
      for (let i = 0; i < 10; i++) {
        timestamps[i] = 1000 + i * 10; // Perfect 10ms intervals
      }

      detector.processBatch(timestamps);

      const stats = detector.getMetrics();
      assert.strictEqual(stats.samplesProcessed, 10);
      assert.strictEqual(stats.driftEventsCount, 0);
    });

    it("should detect drift in batch", () => {
      const detector = new DriftDetector({
        expectedSampleRate: 100,
        driftThreshold: 5.0,
      });

      const timestamps = new Float32Array(10);
      // First 5 perfect, last 5 with drift
      for (let i = 0; i < 5; i++) {
        timestamps[i] = 1000 + i * 10;
      }
      for (let i = 5; i < 10; i++) {
        timestamps[i] = 1000 + 5 * 10 + (i - 5) * 15; // 50% slower
      }

      detector.processBatch(timestamps);

      const stats = detector.getMetrics();
      assert.ok(stats.driftEventsCount > 0);
    });
  });

  describe("getMetrics()", () => {
    it("should return accurate statistics", () => {
      const detector = new DriftDetector({
        expectedSampleRate: 100,
        driftThreshold: 5.0,
      });

      const timestamps = new Float32Array([1000, 1010, 1020, 1030, 1040]);
      detector.processBatch(timestamps);

      const stats = detector.getMetrics();

      assert.strictEqual(stats.samplesProcessed, 5);
      assert.ok(Math.abs(stats.minDelta - 10) < 0.1);
      assert.ok(Math.abs(stats.maxDelta - 10) < 0.1);
      assert.ok(Math.abs(stats.averageDelta - 10) < 0.1);
      assert.strictEqual(stats.driftEventsCount, 0);
    });

    it("should track min/max deltas", () => {
      const detector = new DriftDetector({
        expectedSampleRate: 100,
        driftThreshold: 20.0, // High threshold so drift doesn't trigger
      });

      const timestamps = new Float32Array([1000, 1005, 1020, 1025, 1040]);
      detector.processBatch(timestamps);

      const stats = detector.getMetrics();

      assert.ok(Math.abs(stats.minDelta - 5) < 0.1);
      assert.ok(Math.abs(stats.maxDelta - 15) < 0.1);
      assert.ok(Math.abs(stats.averageDelta - 10) < 0.1);
    });
  });

  describe("reset()", () => {
    it("should reset all statistics", () => {
      const detector = new DriftDetector({
        expectedSampleRate: 100,
        driftThreshold: 5.0,
      });

      const timestamps = new Float32Array([1000, 1010, 1020]);
      detector.processBatch(timestamps);

      assert.strictEqual(detector.getMetrics().samplesProcessed, 3);

      detector.reset();

      const stats = detector.getMetrics();
      assert.strictEqual(stats.samplesProcessed, 0);
      assert.strictEqual(stats.minDelta, 0);
      assert.strictEqual(stats.maxDelta, 0);
      assert.strictEqual(stats.averageDelta, 0);
      assert.strictEqual(stats.driftEventsCount, 0);
    });
  });
});

describe("detectGaps()", () => {
  it("should detect no gaps in continuous data", () => {
    const timestamps = new Float32Array(10);
    for (let i = 0; i < 10; i++) {
      timestamps[i] = 1000 + i * 10; // Perfect 10ms intervals
    }

    const gaps = detectGaps(timestamps, 100);

    assert.strictEqual(gaps.length, 0);
  });

  it("should detect single gap", () => {
    const timestamps = new Float32Array([1000, 1010, 1020, 1050, 1060]);
    //                                                 ^^^^ 30ms gap (3 missing samples)

    const gaps = detectGaps(timestamps, 100);

    assert.strictEqual(gaps.length, 1);
    assert.strictEqual(gaps[0].startIndex, 2);
    assert.strictEqual(gaps[0].endIndex, 3);
    assert.ok(Math.abs(gaps[0].durationMs - 30) < 0.1);
    assert.strictEqual(gaps[0].expectedSamples, 2); // Should have had 2 more samples
  });

  it("should detect multiple gaps", () => {
    const timestamps = new Float32Array([
      1000, 1010, 1040, 1050, 1080, 1090,
      //         ^^^^ gap1   ^^^^ gap2
    ]);

    const gaps = detectGaps(timestamps, 100);

    assert.strictEqual(gaps.length, 2);
    assert.ok(Math.abs(gaps[0].durationMs - 30) < 0.1);
    assert.ok(Math.abs(gaps[1].durationMs - 30) < 0.1);
  });

  it("should respect gap threshold", () => {
    const timestamps = new Float32Array([1000, 1010, 1020, 1025, 1040]);
    //                                                        ^^^^ 15ms gap from 1025

    // With default threshold (2.0x), 15ms gap should not be detected (20ms minimum)
    const gaps1 = detectGaps(timestamps, 100);
    assert.strictEqual(gaps1.length, 0);

    // With lower threshold (1.0x), 15ms gap should be detected (10ms minimum)
    const gaps2 = detectGaps(timestamps, 100, 1.0);
    assert.ok(gaps2.length > 0);
  });
});

describe("validateMonotonicity()", () => {
  it("should validate monotonically increasing timestamps", () => {
    const timestamps = new Float32Array([1000, 1010, 1020, 1030, 1040]);

    const violations = validateMonotonicity(timestamps);

    assert.strictEqual(violations.length, 0);
  });

  it("should detect backwards timestamps", () => {
    const timestamps = new Float32Array([1000, 1010, 1005, 1020, 1030]);
    //                                                ^^^^ backwards

    const violations = validateMonotonicity(timestamps);

    assert.strictEqual(violations.length, 1);
    assert.strictEqual(violations[0].index, 2);
    assert.strictEqual(violations[0].violation, "backwards");
    assert.strictEqual(violations[0].currentTimestamp, 1005);
    assert.strictEqual(violations[0].previousTimestamp, 1010);
  });

  it("should detect duplicate timestamps", () => {
    const timestamps = new Float32Array([1000, 1010, 1010, 1020, 1030]);
    //                                                ^^^^ duplicate

    const violations = validateMonotonicity(timestamps);

    assert.strictEqual(violations.length, 1);
    assert.strictEqual(violations[0].index, 2);
    assert.strictEqual(violations[0].violation, "duplicate");
    assert.strictEqual(violations[0].currentTimestamp, 1010);
    assert.strictEqual(violations[0].previousTimestamp, 1010);
  });

  it("should detect multiple violations", () => {
    const timestamps = new Float32Array([1000, 1010, 1005, 1020, 1020, 1015]);
    //                                                ^^^^ back  ^^^^ dup ^^^^ back

    const violations = validateMonotonicity(timestamps);

    assert.strictEqual(violations.length, 3);
    assert.strictEqual(violations[0].violation, "backwards");
    assert.strictEqual(violations[1].violation, "duplicate");
    assert.strictEqual(violations[2].violation, "backwards");
  });
});

describe("estimateSampleRate()", () => {
  it("should estimate correct sample rate", () => {
    const timestamps = new Float32Array(100);
    for (let i = 0; i < 100; i++) {
      timestamps[i] = 1000 + i * 10; // 10ms intervals = 100 Hz
    }

    const estimate = estimateSampleRate(timestamps);

    assert.ok(Math.abs(estimate.estimatedRate - 100) < 1);
    assert.ok(Math.abs(estimate.averageInterval - 10) < 0.1);
    assert.strictEqual(estimate.regularity, "excellent");
  });

  it("should estimate different sample rates", () => {
    const testCases = [
      { intervalMs: 20, expectedRate: 50 }, // 50 Hz
      { intervalMs: 5, expectedRate: 200 }, // 200 Hz
      { intervalMs: 100, expectedRate: 10 }, // 10 Hz
    ];

    for (const testCase of testCases) {
      const timestamps = new Float32Array(100);
      for (let i = 0; i < 100; i++) {
        timestamps[i] = 1000 + i * testCase.intervalMs;
      }

      const estimate = estimateSampleRate(timestamps);
      assert.ok(Math.abs(estimate.estimatedRate - testCase.expectedRate) < 1);
    }
  });

  it("should assess regularity", () => {
    // Perfect regularity
    const perfect = new Float32Array(100);
    for (let i = 0; i < 100; i++) {
      perfect[i] = 1000 + i * 10;
    }
    assert.strictEqual(estimateSampleRate(perfect).regularity, "excellent");

    // Slight jitter
    const jittery = new Float32Array(100);
    for (let i = 0; i < 100; i++) {
      jittery[i] = 1000 + i * 10 + (Math.random() - 0.5) * 0.5; // ±0.25ms jitter
    }
    const jitterEstimate = estimateSampleRate(jittery);
    assert.ok(["excellent", "good"].includes(jitterEstimate.regularity));

    // Highly irregular
    const irregular = new Float32Array(100);
    for (let i = 0; i < 100; i++) {
      irregular[i] = 1000 + i * 10 + (Math.random() - 0.5) * 5; // ±2.5ms jitter
    }
    const irregularEstimate = estimateSampleRate(irregular);
    assert.ok(
      ["fair", "poor", "irregular"].includes(irregularEstimate.regularity)
    );
  });

  it("should handle edge case: too few samples", () => {
    const timestamps = new Float32Array([1000]);

    const estimate = estimateSampleRate(timestamps);

    assert.strictEqual(estimate.estimatedRate, 0);
    assert.strictEqual(estimate.regularity, "irregular");
  });

  it("should calculate coefficient of variation", () => {
    const timestamps = new Float32Array(100);
    for (let i = 0; i < 100; i++) {
      timestamps[i] = 1000 + i * 10;
    }

    const estimate = estimateSampleRate(timestamps);

    // Perfect timing should have very low CV
    assert.ok(estimate.coefficientOfVariation < 0.01);
  });
});
