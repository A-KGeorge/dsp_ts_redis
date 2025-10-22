import { createDspPipeline } from "../../bindings.js";
import type { PipelineCallbacks } from "../../types.js";

/**
 * Example demonstrating the new pipeline callback API
 * for monitoring, observability, and alerting
 */

// Simulated metrics collector
const metrics = {
  durations: [] as number[],
  record(key: string, value: number) {
    console.log(`Metric: ${key} = ${value.toFixed(2)}ms`);
    this.durations.push(value);
  },
  getAverage() {
    return this.durations.reduce((a, b) => a + b, 0) / this.durations.length;
  },
};

// Simulated logger
const logger = {
  error(msg: string, err: Error) {
    console.error(`❌ ${msg}:`, err.message);
  },
  info(msg: string, ctx?: any) {
    console.log(`${msg}`, ctx || "");
  },
};

// Alert threshold
const THRESHOLD = 0.8;
let alertCount = 0;

function triggerAlert(index: number, stage: string, value: number) {
  alertCount++;
  console.log(
    `ALERT #${alertCount}: Sample ${index} in ${stage} exceeded threshold: ${value.toFixed(
      4
    )} > ${THRESHOLD}`
  );
}

// Configure callbacks
const callbacks: PipelineCallbacks = {
  onSample: (value, i, stage) => {
    // Only trigger alerts for samples exceeding threshold
    if (Math.abs(value) > THRESHOLD) {
      triggerAlert(i, stage, value);
    }
  },

  onStageComplete: (stage, durationMs) => {
    metrics.record(`dsp.${stage}.duration`, durationMs);
  },

  onError: (stage, err) => {
    logger.error(`Stage ${stage} failed`, err);
  },

  onLog: (level, msg, ctx) => {
    // Filter out debug logs for cleaner output
    if (level === "debug") return;

    const emoji = {
      info: "ℹ️",
      warn: "⚠️",
      error: "❌",
      debug: "🔍",
    }[level];

    console.log(`${emoji} [${level.toUpperCase()}] ${msg}`, ctx || "");
  },
};

async function main() {
  console.log("=".repeat(60));
  console.log("Pipeline Callbacks Example");
  console.log("=".repeat(60));
  console.log();

  // Create pipeline with callbacks configured
  const pipeline = createDspPipeline()
    .pipeline(callbacks) // Configure callbacks first
    .MovingAverage({ windowSize: 3 })
    .Rectify({ mode: "full" })
    .Rms({ windowSize: 5 });

  // Generate test signal with some peaks
  const sampleRate = 44100;
  const duration = 0.01; // 10ms = 441 samples
  const numSamples = Math.floor(sampleRate * duration);
  const testSignal = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    // Mix of normal samples and some peaks
    if (i % 100 === 0) {
      // Inject peaks that will trigger alerts
      testSignal[i] = 0.9 + Math.random() * 0.1;
    } else if (i % 50 === 0) {
      testSignal[i] = -0.85;
    } else {
      // Normal random signal
      testSignal[i] = Math.random() * 0.4 - 0.2;
    }
  }

  console.log(`Input: ${numSamples} samples`);
  console.log(`Pipeline: MovingAverage(3) → Rectify(full) → RMS(5)`);
  console.log();

  // Process with callbacks
  const result = await pipeline.process(testSignal, {
    sampleRate,
    channels: 1,
  });

  console.log();
  console.log("=".repeat(60));
  console.log("Results Summary");
  console.log("=".repeat(60));
  console.log(`Output: ${result.length} samples`);
  console.log(`Total alerts triggered: ${alertCount}`);
  console.log(`Average processing time: ${metrics.getAverage().toFixed(3)}ms`);
  console.log(
    `Output range: [${Math.min(...result).toFixed(4)}, ${Math.max(
      ...result
    ).toFixed(4)}]`
  );
  console.log();
}

// Run the example
main().catch((err) => {
  console.error("Example failed:", err);
  process.exit(1);
});
