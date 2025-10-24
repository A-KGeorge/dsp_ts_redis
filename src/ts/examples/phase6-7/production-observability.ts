/**
 * Phase 6: Production Observability Example
 *
 * Comprehensive monitoring patterns for production DSP pipelines:
 * - Drift detection with alerting
 * - Performance metrics tracking
 * - Health checks
 * - Graceful error handling
 */

import {
  createDspPipeline,
  DriftDetector,
  detectGaps,
  validateMonotonicity,
  estimateSampleRate,
} from "../../index.js";

console.log("=== Phase 6: Production Observability ===\n");

/**
 * Example 1: Production Monitoring Setup
 */
async function example1_ProductionMonitoring() {
  console.log("\n--- Example 1: Production Monitoring Setup ---\n");

  // Metrics collector
  const metrics = {
    samplesProcessed: 0,
    driftEvents: 0,
    gaps: 0,
    nonMonotonic: 0,
    processingTimeMs: [] as number[],
    lastHealthCheck: Date.now(),
  };

  // Create pipeline with drift detection
  const pipeline = createDspPipeline();
  pipeline
    .MovingAverage({ mode: "moving", windowDuration: 100 })
    .Rms({ mode: "moving", windowDuration: 50 });

  // Simulate sensor data with issues
  const generateBatch = (startIdx: number, count: number) => {
    const samples = new Float32Array(count);
    const timestamps = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      samples[i] = Math.sin((startIdx + i) * 0.1) * 100 + Math.random() * 10;

      // Introduce timing issues
      if (i === 10) {
        // Gap: skip 50ms
        timestamps[i] = Date.now() + (startIdx + i) * 10 + 50;
      } else if (i === 20) {
        // Backwards timestamp
        timestamps[i] = Date.now() + (startIdx + i) * 10 - 20;
      } else {
        timestamps[i] = Date.now() + (startIdx + i) * 10;
      }
    }

    return { samples, timestamps };
  };

  // Process 5 batches
  console.log("Processing batches with monitoring:\n");

  for (let batchIdx = 0; batchIdx < 5; batchIdx++) {
    const { samples, timestamps } = generateBatch(batchIdx * 50, 50);

    const startTime = performance.now();

    try {
      // Process with drift detection
      const processed = await pipeline.process(samples, timestamps, {
        channels: 1,
        sampleRate: 100,
        enableDriftDetection: true,
        driftThreshold: 5.0, // 5% threshold
        onDriftDetected: (stats) => {
          metrics.driftEvents++;
          console.log(
            `   ⚠️  Drift detected: ${stats.relativeDrift.toFixed(
              2
            )}% (expected: ${
              stats.expectedMs
            }ms, actual: ${stats.deltaMs.toFixed(2)}ms)`
          );
        },
      });

      const endTime = performance.now();
      const processingTime = endTime - startTime;
      metrics.processingTimeMs.push(processingTime);

      // Validate data quality
      const gaps = detectGaps(timestamps, 100); // 100 Hz expected
      const violations = validateMonotonicity(timestamps);

      if (gaps.length > 0) {
        metrics.gaps += gaps.length;
        console.log(`   ⚠️  Batch ${batchIdx}: ${gaps.length} gaps detected`);
      }

      if (violations.length > 0) {
        metrics.nonMonotonic++;
        const first = violations[0];
        console.log(
          `   ⚠️  Batch ${batchIdx}: Non-monotonic timestamps at index ${first.index} (${first.violation})`
        );
      }

      metrics.samplesProcessed += samples.length;

      console.log(
        `   ✅ Batch ${batchIdx}: ${
          samples.length
        } samples processed in ${processingTime.toFixed(2)}ms`
      );
    } catch (error: any) {
      console.error(`   ❌ Batch ${batchIdx} failed: ${error.message}`);
    }
  }

  // Health check summary
  console.log("\n📊 Health Check Summary:");
  console.log(`   Total samples processed: ${metrics.samplesProcessed}`);
  console.log(`   Drift events: ${metrics.driftEvents}`);
  console.log(`   Gaps detected: ${metrics.gaps}`);
  console.log(`   Non-monotonic batches: ${metrics.nonMonotonic}`);

  const avgProcessingTime =
    metrics.processingTimeMs.reduce((a, b) => a + b, 0) /
    metrics.processingTimeMs.length;
  const maxProcessingTime = Math.max(...metrics.processingTimeMs);

  console.log(`   Avg processing time: ${avgProcessingTime.toFixed(2)}ms`);
  console.log(`   Max processing time: ${maxProcessingTime.toFixed(2)}ms`);

  console.log("\n✅ Example 1 complete\n");
}

/**
 * Example 2: Alerting Thresholds
 */
async function example2_AlertingThresholds() {
  console.log("\n--- Example 2: Alerting Thresholds ---\n");

  // Alert configuration
  const alertConfig = {
    maxDriftPercent: 5.0,
    maxGapsPerBatch: 2,
    maxProcessingTimeMs: 50,
    alertCallback: (level: "warning" | "critical", message: string) => {
      const prefix = level === "critical" ? "🔴" : "🟡";
      console.log(`${prefix} [${level.toUpperCase()}] ${message}`);
    },
  };

  const pipeline = createDspPipeline();
  pipeline.MovingAverage({ mode: "moving", windowDuration: 100 });

  // Simulate problematic data
  const samples = new Float32Array(100);
  const timestamps = new Float32Array(100);

  for (let i = 0; i < 100; i++) {
    samples[i] = Math.sin(i * 0.1) * 100;

    // Introduce multiple issues
    if (i < 50) {
      timestamps[i] = Date.now() + i * 10; // Normal
    } else {
      // Large drift in second half
      timestamps[i] = Date.now() + i * 15; // 150 Hz instead of 100 Hz
    }
  }

  console.log("Processing data with alerting thresholds:\n");

  const startTime = performance.now();

  await pipeline.process(samples, timestamps, {
    channels: 1,
    sampleRate: 100,
    enableDriftDetection: true,
    driftThreshold: alertConfig.maxDriftPercent,
    onDriftDetected: (stats) => {
      if (Math.abs(stats.relativeDrift) > alertConfig.maxDriftPercent * 2) {
        alertConfig.alertCallback(
          "critical",
          `Severe drift: ${stats.relativeDrift.toFixed(2)}%`
        );
      } else {
        alertConfig.alertCallback(
          "warning",
          `Drift: ${stats.relativeDrift.toFixed(2)}%`
        );
      }
    },
  });

  const endTime = performance.now();
  const processingTime = endTime - startTime;

  // Check processing time
  if (processingTime > alertConfig.maxProcessingTimeMs) {
    alertConfig.alertCallback(
      "warning",
      `Processing time (${processingTime.toFixed(2)}ms) exceeded threshold (${
        alertConfig.maxProcessingTimeMs
      }ms)`
    );
  }

  // Check for gaps
  const gaps = detectGaps(timestamps, 100);
  if (gaps.length > alertConfig.maxGapsPerBatch) {
    alertConfig.alertCallback("critical", `Too many gaps: ${gaps.length}`);
  }

  console.log("\n✅ Example 2 complete\n");
}

/**
 * Example 3: Sample Rate Validation
 */
async function example3_SampleRateValidation() {
  console.log("\n--- Example 3: Sample Rate Validation ---\n");

  const expectedRate = 100; // Hz
  const tolerance = 0.05; // 5%

  // Generate data with varying sample rates
  const testCases = [
    { name: "Correct rate (100 Hz)", rate: 100 },
    { name: "Slightly fast (103 Hz)", rate: 103 },
    { name: "Slightly slow (97 Hz)", rate: 97 },
    { name: "Too fast (120 Hz)", rate: 120 },
    { name: "Too slow (80 Hz)", rate: 80 },
  ];

  for (const testCase of testCases) {
    const count = 100;
    const timestamps = new Float32Array(count);
    const intervalMs = 1000 / testCase.rate;

    for (let i = 0; i < count; i++) {
      timestamps[i] = Date.now() + i * intervalMs;
    }

    const rateInfo = estimateSampleRate(timestamps);
    const deviation =
      Math.abs(rateInfo.estimatedRate - expectedRate) / expectedRate;

    if (deviation <= tolerance) {
      console.log(
        `✅ ${testCase.name}: ${rateInfo.estimatedRate.toFixed(
          2
        )} Hz (within tolerance)`
      );
    } else {
      console.log(
        `⚠️  ${testCase.name}: ${rateInfo.estimatedRate.toFixed(
          2
        )} Hz (exceeds ${(tolerance * 100).toFixed(0)}% tolerance)`
      );
    }

    console.log(`   Regularity: ${rateInfo.regularity}`);
  }

  console.log("\n✅ Example 3 complete\n");
}

/**
 * Example 4: Production Health Check Endpoint
 */
class DspHealthMonitor {
  private metrics = {
    totalSamples: 0,
    totalBatches: 0,
    failedBatches: 0,
    driftEvents: 0,
    gaps: 0,
    processingTimes: [] as number[],
    lastProcessedAt: 0,
  };

  private readonly maxMetricHistory = 100;

  recordBatchSuccess(sampleCount: number, processingTimeMs: number): void {
    this.metrics.totalSamples += sampleCount;
    this.metrics.totalBatches++;
    this.metrics.processingTimes.push(processingTimeMs);
    this.metrics.lastProcessedAt = Date.now();

    // Keep history bounded
    if (this.metrics.processingTimes.length > this.maxMetricHistory) {
      this.metrics.processingTimes.shift();
    }
  }

  recordBatchFailure(): void {
    this.metrics.failedBatches++;
    this.metrics.totalBatches++;
  }

  recordDriftEvent(): void {
    this.metrics.driftEvents++;
  }

  recordGap(): void {
    this.metrics.gaps++;
  }

  getHealthStatus(): {
    status: "healthy" | "degraded" | "unhealthy";
    metrics: any;
    issues: string[];
  } {
    const issues: string[] = [];
    let status: "healthy" | "degraded" | "unhealthy" = "healthy";

    // Check failure rate
    const failureRate =
      this.metrics.failedBatches / Math.max(1, this.metrics.totalBatches);
    if (failureRate > 0.1) {
      issues.push(`High failure rate: ${(failureRate * 100).toFixed(1)}%`);
      status = "unhealthy";
    } else if (failureRate > 0.05) {
      issues.push(`Elevated failure rate: ${(failureRate * 100).toFixed(1)}%`);
      status = status === "healthy" ? "degraded" : status;
    }

    // Check drift events
    const driftRate =
      this.metrics.driftEvents / Math.max(1, this.metrics.totalBatches);
    if (driftRate > 0.2) {
      issues.push(`High drift rate: ${(driftRate * 100).toFixed(1)}%`);
      status = status === "healthy" ? "degraded" : status;
    }

    // Check processing time
    if (this.metrics.processingTimes.length > 0) {
      const avgTime =
        this.metrics.processingTimes.reduce((a, b) => a + b, 0) /
        this.metrics.processingTimes.length;

      if (avgTime > 100) {
        issues.push(`Slow processing: ${avgTime.toFixed(2)}ms avg`);
        status = status === "healthy" ? "degraded" : status;
      }
    }

    // Check last processed timestamp
    const timeSinceLastProcess = Date.now() - this.metrics.lastProcessedAt;
    if (this.metrics.lastProcessedAt > 0 && timeSinceLastProcess > 60000) {
      issues.push("No data processed in last 60 seconds");
      status = "unhealthy";
    }

    return {
      status,
      metrics: {
        ...this.metrics,
        avgProcessingTimeMs:
          this.metrics.processingTimes.length > 0
            ? this.metrics.processingTimes.reduce((a, b) => a + b, 0) /
              this.metrics.processingTimes.length
            : 0,
      },
      issues,
    };
  }
}

async function example4_HealthCheckEndpoint() {
  console.log("\n--- Example 4: Production Health Check ---\n");

  const monitor = new DspHealthMonitor();
  const pipeline = createDspPipeline();
  pipeline.MovingAverage({ mode: "moving", windowDuration: 100 });

  // Simulate processing batches
  console.log("Simulating production workload:\n");

  for (let i = 0; i < 10; i++) {
    const samples = new Float32Array(50);
    const timestamps = new Float32Array(50);

    for (let j = 0; j < 50; j++) {
      samples[j] = Math.sin((i * 50 + j) * 0.1) * 100;
      timestamps[j] = Date.now() + (i * 50 + j) * 10;
    }

    const startTime = performance.now();

    try {
      await pipeline.process(samples, timestamps, {
        channels: 1,
        sampleRate: 100,
        enableDriftDetection: true,
        driftThreshold: 5.0,
        onDriftDetected: () => {
          monitor.recordDriftEvent();
        },
      });

      const endTime = performance.now();
      monitor.recordBatchSuccess(samples.length, endTime - startTime);
    } catch (error) {
      monitor.recordBatchFailure();
    }

    // Simulate occasional issues
    if (i === 5) {
      monitor.recordGap();
    }
  }

  // Get health status
  const health = monitor.getHealthStatus();

  console.log("📊 Health Check Result:");
  console.log(`   Status: ${health.status.toUpperCase()}`);
  console.log(`   Total samples: ${health.metrics.totalSamples}`);
  console.log(`   Total batches: ${health.metrics.totalBatches}`);
  console.log(`   Failed batches: ${health.metrics.failedBatches}`);
  console.log(`   Drift events: ${health.metrics.driftEvents}`);
  console.log(`   Gaps: ${health.metrics.gaps}`);
  console.log(
    `   Avg processing time: ${health.metrics.avgProcessingTimeMs.toFixed(2)}ms`
  );

  if (health.issues.length > 0) {
    console.log("\n   Issues:");
    health.issues.forEach((issue) => {
      console.log(`   ⚠️  ${issue}`);
    });
  }

  console.log("\n💡 Expose this as HTTP endpoint:");
  console.log("   GET /health → { status, metrics, issues }");
  console.log("\n✅ Example 4 complete\n");
}

// Run all examples
async function main() {
  console.log("📚 Production observability patterns for DSP pipelines\n");

  await example1_ProductionMonitoring();
  await example2_AlertingThresholds();
  await example3_SampleRateValidation();
  await example4_HealthCheckEndpoint();

  console.log("=== Phase 6 Complete ===\n");
  console.log("✅ Production observability includes:");
  console.log("   • Comprehensive metrics tracking");
  console.log("   • Alerting with configurable thresholds");
  console.log("   • Sample rate validation");
  console.log("   • Health check endpoints");
  console.log("   • Graceful error handling\n");

  console.log("💡 Integration ideas:");
  console.log("   • Export metrics to Prometheus");
  console.log("   • Send alerts to PagerDuty/Slack");
  console.log("   • Create Grafana dashboards");
  console.log("   • Log to structured logging system\n");
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
