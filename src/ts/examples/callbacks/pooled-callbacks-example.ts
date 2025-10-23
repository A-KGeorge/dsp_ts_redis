/**
 * Pooled Callbacks Example
 * Demonstrates the performance benefits of using batched callbacks
 * over individual per-sample/per-log callbacks
 */

import {
  createDspPipeline,
  type LogEntry,
  type SampleBatch,
} from "../../index.js";

// Performance metrics collector using pooled callbacks
class PooledMonitor {
  private batchCount = 0;
  private totalSamples = 0;
  private sampleSum = 0;
  private sampleMin = Infinity;
  private sampleMax = -Infinity;

  onBatch(batch: SampleBatch): void {
    this.batchCount++;
    this.totalSamples += batch.count;

    // Process entire batch efficiently (SIMD-friendly)
    for (let i = 0; i < batch.samples.length; i++) {
      const value = batch.samples[i];
      this.sampleSum += value;
      if (value < this.sampleMin) this.sampleMin = value;
      if (value > this.sampleMax) this.sampleMax = value;
    }
  }

  onLogBatch(logs: LogEntry[]): void {
    console.log(`\n📦 Received ${logs.length} pooled log entries:`);
    logs.forEach((log) => {
      const emoji =
        log.level === "debug"
          ? "🐛"
          : log.level === "info"
          ? "ℹ️"
          : log.level === "warn"
          ? "⚠️"
          : "❌";
      console.log(
        `  ${emoji} [${log.level.toUpperCase()}] ${log.message}`,
        log.context || ""
      );
    });
  }

  report(): void {
    console.log("\nPooled Monitoring Report:");
    console.log(`   Batches processed: ${this.batchCount}`);
    console.log(`   Total samples: ${this.totalSamples}`);
    console.log(
      `   Sample range: [${this.sampleMin.toFixed(4)}, ${this.sampleMax.toFixed(
        4
      )}]`
    );
    console.log(
      `   Sample average: ${(this.sampleSum / this.totalSamples).toFixed(4)}`
    );
  }
}

async function compareCallbackPerformance() {
  console.log("Comparing Callback Performance\n");

  // Generate test signal (10 batches of 4096 samples each)
  const batchSize = 4096;
  const numBatches = 10;

  // ============================================================
  // Test 1: Using POOLED callbacks (onBatch + onLogBatch)
  // ============================================================
  console.log("Test 1: POOLED Callbacks (onBatch + onLogBatch)");
  const monitor1 = new PooledMonitor();
  const pipeline1 = createDspPipeline()
    .pipeline({
      onBatch: (batch) => monitor1.onBatch(batch),
      onLogBatch: (logs) => monitor1.onLogBatch(logs),
      onStageComplete: (stage, duration) => {
        console.log(`Stage ${stage} completed in ${duration.toFixed(3)}ms`);
      },
    })
    .MovingAverage({ windowSize: 10 })
    .Rectify({ mode: "full" })
    .Rms({ windowSize: 10 });

  const startPooled = performance.now();
  for (let batch = 0; batch < numBatches; batch++) {
    const input = Float32Array.from({ length: batchSize }, (_, i) =>
      Math.sin(2 * Math.PI * 440 * (i / 48000))
    );
    await pipeline1.process(input, { sampleRate: 48000 });
  }
  const durationPooled = performance.now() - startPooled;

  monitor1.report();
  console.log(
    `\nTotal time (pooled): ${durationPooled.toFixed(3)}ms for ${
      numBatches * batchSize
    } samples`
  );
  console.log(
    `   Throughput: ${(
      (numBatches * batchSize) /
      (durationPooled / 1000)
    ).toLocaleString()} samples/sec`
  );

  // ============================================================
  // Test 2: Using INDIVIDUAL callbacks (onSample + onLog)
  // ============================================================
  console.log("\n\nTest 2: INDIVIDUAL Callbacks (onSample + onLog)");
  console.log("⚠️  WARNING: This will make 40,960+ callback invocations!\n");

  let sampleCallCount = 0;
  let logCallCount = 0;
  let sampleSum2 = 0;
  let sampleMin2 = Infinity;
  let sampleMax2 = -Infinity;

  const pipeline2 = createDspPipeline()
    .pipeline({
      onSample: (value, _index, _stage) => {
        sampleCallCount++;
        // Realistic work: aggregate stats per sample (expensive!)
        sampleSum2 += value;
        if (value < sampleMin2) sampleMin2 = value;
        if (value > sampleMax2) sampleMax2 = value;
      },
      onLog: (level, message, context) => {
        logCallCount++;
        // Realistic work: format and store log
        const timestamp = Date.now();
        const _logEntry = { level, message, context, timestamp };
        // In real app: push to log buffer or write to file
      },
      onStageComplete: (stage, duration) => {
        console.log(`Stage ${stage} completed in ${duration.toFixed(3)}ms`);
      },
    })
    .MovingAverage({ windowSize: 10 })
    .Rectify({ mode: "full" })
    .Rms({ windowSize: 10 });

  const startIndividual = performance.now();
  for (let batch = 0; batch < numBatches; batch++) {
    const input = Float32Array.from({ length: batchSize }, (_, i) =>
      Math.sin(2 * Math.PI * 440 * (i / 48000))
    );
    await pipeline2.process(input, { sampleRate: 48000 });
  }
  const durationIndividual = performance.now() - startIndividual;

  console.log(`\nIndividual Callbacks Report:`);
  console.log(
    `   onSample() called: ${sampleCallCount.toLocaleString()} times`
  );
  console.log(`   onLog() called: ${logCallCount} times`);
  console.log(
    `   Sample range: [${sampleMin2.toFixed(4)}, ${sampleMax2.toFixed(4)}]`
  );
  console.log(
    `   Sample average: ${(sampleSum2 / sampleCallCount).toFixed(4)}`
  );
  console.log(
    `\nTotal time (individual): ${durationIndividual.toFixed(3)}ms for ${
      numBatches * batchSize
    } samples`
  );
  console.log(
    `   Throughput: ${(
      (numBatches * batchSize) /
      (durationIndividual / 1000)
    ).toLocaleString()} samples/sec`
  );

  // ============================================================
  // Performance Comparison
  // ============================================================
  console.log("\n\nPerformance Comparison:");
  console.log(
    `   Pooled callbacks:     ${durationPooled.toFixed(3)}ms (baseline)`
  );
  console.log(`   Individual callbacks: ${durationIndividual.toFixed(3)}ms`);
  console.log(
    `   Slowdown: ${(durationIndividual / durationPooled).toFixed(2)}x`
  );
  console.log(
    `   Overhead: +${(durationIndividual - durationPooled).toFixed(3)}ms`
  );
  console.log(
    `\nRecommendation: Use onBatch and onLogBatch for high-throughput scenarios`
  );
}

// Run the comparison
compareCallbackPerformance().catch(console.error);
