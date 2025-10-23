import { createDspPipeline } from "../../bindings.js";
import type { PipelineCallbacks, LogLevel } from "../../types.js";

/**
 * Example: Real-time audio monitoring with callbacks
 * Demonstrates selective callback usage for performance monitoring
 */

class PerformanceMonitor {
  private stageTimes = new Map<string, number[]>();

  recordStageTime(stage: string, durationMs: number) {
    if (!this.stageTimes.has(stage)) {
      this.stageTimes.set(stage, []);
    }
    this.stageTimes.get(stage)!.push(durationMs);
  }

  getStats(stage: string) {
    const times = this.stageTimes.get(stage) || [];
    if (times.length === 0) {
      return { min: 0, max: 0, avg: 0, count: 0 };
    }

    return {
      min: Math.min(...times),
      max: Math.max(...times),
      avg: times.reduce((a, b) => a + b, 0) / times.length,
      count: times.length,
    };
  }

  printReport() {
    console.log("\nPerformance Report:");
    console.log("─".repeat(70));
    console.log(
      "Stage".padEnd(30),
      "Count".padEnd(10),
      "Avg (ms)".padEnd(10),
      "Min (ms)".padEnd(10),
      "Max (ms)"
    );
    console.log("─".repeat(70));

    for (const [stage, _] of this.stageTimes) {
      const stats = this.getStats(stage);
      console.log(
        stage.padEnd(30),
        stats.count.toString().padEnd(10),
        stats.avg.toFixed(3).padEnd(10),
        stats.min.toFixed(3).padEnd(10),
        stats.max.toFixed(3)
      );
    }
    console.log("─".repeat(70));
  }
}

class SignalAnalyzer {
  private peakCount = 0;
  private clipCount = 0;

  analyzeSample(value: number, index: number, stage: string) {
    const absValue = Math.abs(value);

    // Detect clipping (value at maximum)
    if (absValue >= 0.99) {
      this.clipCount++;
      console.log(
        `⚠️  Clipping detected at sample ${index} in ${stage}: ${value.toFixed(
          4
        )}`
      );
    }
    // Detect peaks (high amplitude)
    else if (absValue > 0.85) {
      this.peakCount++;
    }
  }

  getReport() {
    return {
      peaks: this.peakCount,
      clips: this.clipCount,
    };
  }
}

async function monitoringExample() {
  console.log("=".repeat(70));
  console.log("Real-time Audio Monitoring with Callbacks");
  console.log("=".repeat(70));
  console.log();

  const monitor = new PerformanceMonitor();
  const analyzer = new SignalAnalyzer();

  const callbacks: PipelineCallbacks = {
    // Analyze every sample for clipping/peaks (can be disabled for performance)
    onSample: (value, index, stage) => {
      analyzer.analyzeSample(value, index, stage);
    },

    // Track performance of each processing run
    onStageComplete: (stage, durationMs) => {
      monitor.recordStageTime(stage, durationMs);
    },

    // Handle errors gracefully
    onError: (stage, error) => {
      console.error(`❌ Error in ${stage}:`, error.message);
    },

    // Structured logging
    onLog: (level, msg, ctx) => {
      const timestamp = new Date().toISOString();
      const emoji = {
        debug: "🔍",
        info: "ℹ️",
        warn: "⚠️",
        error: "❌",
      }[level];

      if (level !== "debug") {
        console.log(
          `${emoji} [${timestamp}] [${level.toUpperCase()}] ${msg}`,
          ctx ? JSON.stringify(ctx) : ""
        );
      }
    },
  };

  // Build pipeline with comprehensive processing
  const pipeline = createDspPipeline()
    .pipeline(callbacks)
    .MovingAverage({ windowSize: 5 })
    .Rectify({ mode: "full" })
    .Rms({ windowSize: 10 });

  console.log("Processing audio batches...\n");

  // Simulate multiple processing batches (like streaming audio)
  const sampleRate = 44100;
  const batchSize = 512; // Typical audio buffer size
  const numBatches = 5;

  for (let batch = 0; batch < numBatches; batch++) {
    console.log(`\nProcessing batch ${batch + 1}/${numBatches}...`);

    // Generate test signal with varying characteristics
    const signal = new Float32Array(batchSize);
    for (let i = 0; i < batchSize; i++) {
      // Add some variation between batches
      const amplitude = 0.5 + batch * 0.1;
      signal[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * amplitude;

      // Add occasional peaks
      if (i % 100 === 0) {
        signal[i] = 0.95;
      }

      // Add occasional clips in later batches
      if (batch >= 3 && i % 150 === 0) {
        signal[i] = 1.0; // Clipping!
      }
    }

    await pipeline.process(signal, { sampleRate, channels: 1 });
  }

  // Print reports
  monitor.printReport();

  const signalStats = analyzer.getReport();
  console.log("\nSignal Analysis:");
  console.log("─".repeat(70));
  console.log(`  Peak samples (> 0.85):       ${signalStats.peaks}`);
  console.log(`  Clipped samples (>= 0.99):   ${signalStats.clips}`);
  console.log("─".repeat(70));

  console.log("\nMonitoring complete!\n");
}

async function selectiveCallbacksExample() {
  console.log("\n" + "=".repeat(70));
  console.log("Selective Callbacks Example (Performance-Optimized)");
  console.log("=".repeat(70));
  console.log();

  let processCount = 0;

  // Use only the callbacks you need for better performance
  const lightweightCallbacks: PipelineCallbacks = {
    // No onSample callback - saves significant overhead for large buffers
    // onSample: undefined,

    onStageComplete: (stage, durationMs) => {
      processCount++;
      console.log(
        `✓ Batch ${processCount}: ${stage} completed in ${durationMs.toFixed(
          3
        )}ms`
      );
    },

    // Only log errors and warnings
    onLog: (level, msg, ctx) => {
      if (level === "error" || level === "warn") {
        console.log(`[${level.toUpperCase()}] ${msg}`, ctx || "");
      }
    },
  };

  const pipeline = createDspPipeline()
    .pipeline(lightweightCallbacks)
    .MovingAverage({ windowSize: 3 })
    .Rms({ windowSize: 5 });

  console.log("Processing large batches without per-sample callbacks...\n");

  // Process larger buffers more efficiently
  const largeBuffer = new Float32Array(4096);
  for (let i = 0; i < largeBuffer.length; i++) {
    largeBuffer[i] = Math.random() * 0.5;
  }

  const iterations = 10;
  const startTime = performance.now();

  for (let i = 0; i < iterations; i++) {
    await pipeline.process(largeBuffer, { sampleRate: 44100, channels: 1 });
  }

  const totalTime = performance.now() - startTime;
  const avgTime = totalTime / iterations;

  console.log("\n" + "─".repeat(70));
  console.log(
    `Processed ${iterations} batches of ${largeBuffer.length} samples`
  );
  console.log(`Total time: ${totalTime.toFixed(2)}ms`);
  console.log(`Average per batch: ${avgTime.toFixed(3)}ms`);
  console.log(
    `Throughput: ${(
      (largeBuffer.length * iterations) /
      (totalTime / 1000)
    ).toFixed(0)} samples/sec`
  );
  console.log("─".repeat(70));

  console.log("\nPerformance test complete!\n");
}

async function main() {
  try {
    // Run both examples
    await monitoringExample();
    await selectiveCallbacksExample();
  } catch (error) {
    console.error("Example failed:", error);
    process.exit(1);
  }
}

main();
