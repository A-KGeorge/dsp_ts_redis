/**
 * Example: Using .tap() for Pipeline Debugging
 * Demonstrates how to inspect intermediate results at any point in the pipeline
 */

import { createDspPipeline } from "../index.js";

console.log("🔍 Pipeline Debugging with .tap()\n");

// Example 1: Basic inspection
console.log("Example 1: Basic Inspection");
const pipeline1 = createDspPipeline()
  .MovingAverage({ mode: "moving", windowSize: 3 })
  .tap((samples, stage) => {
    console.log(`  After ${stage}:`);
    console.log(
      `    First 5 samples: [${Array.from(samples.slice(0, 5))
        .map((v) => v.toFixed(2))
        .join(", ")}]`
    );
    console.log(`    Length: ${samples.length}`);
  })
  .Rectify({ mode: "full" })
  .tap((samples, stage) => {
    console.log(`  After ${stage}:`);
    console.log(
      `    First 5 samples: [${Array.from(samples.slice(0, 5))
        .map((v) => v.toFixed(2))
        .join(", ")}]`
    );
  });

const input1 = Float32Array.from(
  { length: 10 },
  (_, i) => Math.sin(i * 0.5) - 0.5
);
await pipeline1.process(input1, { sampleRate: 1000 });

// Example 2: Conditional alerts based on thresholds
console.log("\n\nExample 2: Threshold Monitoring");
const THRESHOLD = 0.8;
let alertCount = 0;

const pipeline2 = createDspPipeline()
  .MovingAverage({ mode: "moving", windowSize: 5 })
  .Rectify({ mode: "full" })
  .Rms({ mode: "moving", windowSize: 10 })
  .tap((samples, stage) => {
    const max = Math.max(...samples);
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;

    console.log(`  Stats after ${stage}:`);
    console.log(`     Max: ${max.toFixed(4)}, Avg: ${avg.toFixed(4)}`);

    if (max > THRESHOLD) {
      alertCount++;
      console.log(
        `     🚨 ALERT: Max value ${max.toFixed(
          4
        )} exceeds threshold ${THRESHOLD}`
      );
    }
  });

const input2 = Float32Array.from(
  { length: 50 },
  (_, i) => Math.sin(i * 0.3) * (1 + Math.random() * 0.5)
);
await pipeline2.process(input2, { sampleRate: 1000 });
console.log(`\n  Total alerts: ${alertCount}`);

// Example 3: Multiple taps in complex pipeline
console.log("\n\n🔗 Example 3: Multi-Stage Inspection");
const stages: Array<{
  name: string;
  stats: { min: number; max: number; mean: number };
}> = [];

const pipeline3 = createDspPipeline()
  .tap((samples) => {
    const stats = {
      min: Math.min(...samples),
      max: Math.max(...samples),
      mean: samples.reduce((a, b) => a + b, 0) / samples.length,
    };
    stages.push({ name: "raw input", stats });
  })
  .MovingAverage({ mode: "moving", windowSize: 5 })
  .tap((samples, stage) => {
    const stats = {
      min: Math.min(...samples),
      max: Math.max(...samples),
      mean: samples.reduce((a, b) => a + b, 0) / samples.length,
    };
    stages.push({ name: stage, stats });
  })
  .Rectify({ mode: "full" })
  .tap((samples, stage) => {
    const stats = {
      min: Math.min(...samples),
      max: Math.max(...samples),
      mean: samples.reduce((a, b) => a + b, 0) / samples.length,
    };
    stages.push({ name: stage, stats });
  })
  .Rms({ mode: "moving", windowSize: 3 })
  .tap((samples, stage) => {
    const stats = {
      min: Math.min(...samples),
      max: Math.max(...samples),
      mean: samples.reduce((a, b) => a + b, 0) / samples.length,
    };
    stages.push({ name: stage, stats });
  });

const input3 = Float32Array.from(
  { length: 100 },
  (_, i) => Math.sin(i * 0.1) * 2 - 1
);
await pipeline3.process(input3, { sampleRate: 1000 });

console.log("\n  Pipeline Statistics Table:");
console.log(
  "  ┌─────────────────────────────────┬──────────┬──────────┬──────────┐"
);
console.log(
  "  │ Stage                           │ Min      │ Max      │ Mean     │"
);
console.log(
  "  ├─────────────────────────────────┼──────────┼──────────┼──────────┤"
);
stages.forEach(({ name, stats }) => {
  const paddedName = name.padEnd(31);
  console.log(
    `  │ ${paddedName} │ ${stats.min.toFixed(4).padStart(8)} │ ${stats.max
      .toFixed(4)
      .padStart(8)} │ ${stats.mean.toFixed(4).padStart(8)} │`
  );
});
console.log(
  "  └─────────────────────────────────┴──────────┴──────────┴──────────┘"
);

// Example 4: Debugging with logger integration
console.log("\n\nExample 4: Logger Integration");
const logger = {
  debug: (msg: string, data?: any) =>
    console.log(`  [DEBUG] ${msg}`, data || ""),
  info: (msg: string, data?: any) =>
    console.log(`  [INFO]  ${msg}`, data || ""),
  warn: (msg: string, data?: any) =>
    console.log(`  [WARN]  ${msg}`, data || ""),
};

const pipeline4 = createDspPipeline()
  .MovingAverage({ mode: "moving", windowSize: 10 })
  .tap((samples, stage) =>
    logger.debug(`Processed ${stage}`, { sampleCount: samples.length })
  )
  .Rectify()
  .tap((samples, stage) => {
    const hasNegative = samples.some((v) => v < 0);
    if (hasNegative) {
      logger.warn(`Unexpected negative values after ${stage}`);
    } else {
      logger.info(`${stage} completed successfully`);
    }
  })
  .Rms({ mode: "moving", windowSize: 5 })
  .tap((samples, stage) => {
    const max = Math.max(...samples);
    logger.debug(`Max RMS value`, { value: max.toFixed(4) });
  });

const input4 = Float32Array.from({ length: 20 }, (_, i) => Math.cos(i * 0.2));
await pipeline4.process(input4, { sampleRate: 1000 });

// Example 5: Performance impact measurement
console.log("\n\nExample 5: Performance Impact of .tap()");
const iterations = 1000;
const sampleSize = 1000;

// Without tap
const pipelineNoTap = createDspPipeline()
  .MovingAverage({ mode: "moving", windowSize: 10 })
  .Rectify()
  .Rms({ mode: "moving", windowSize: 5 });

const startNoTap = performance.now();
for (let i = 0; i < iterations; i++) {
  const input = Float32Array.from({ length: sampleSize }, () => Math.random());
  await pipelineNoTap.process(input, { sampleRate: 1000 });
}
const durationNoTap = performance.now() - startNoTap;

// With tap (minimal work)
const pipelineWithTap = createDspPipeline()
  .MovingAverage({ mode: "moving", windowSize: 10 })
  .tap(() => {}) // Empty tap
  .Rectify()
  .tap(() => {}) // Empty tap
  .Rms({ mode: "moving", windowSize: 5 })
  .tap(() => {}); // Empty tap

const startWithTap = performance.now();
for (let i = 0; i < iterations; i++) {
  const input = Float32Array.from({ length: sampleSize }, () => Math.random());
  await pipelineWithTap.process(input, { sampleRate: 1000 });
}
const durationWithTap = performance.now() - startWithTap;

console.log(
  `  Without .tap(): ${durationNoTap.toFixed(2)}ms for ${iterations} iterations`
);
console.log(
  `  With .tap():    ${durationWithTap.toFixed(
    2
  )}ms for ${iterations} iterations`
);
console.log(
  `  Overhead:       ${(durationWithTap - durationNoTap).toFixed(2)}ms (${(
    (durationWithTap / durationNoTap - 1) *
    100
  ).toFixed(2)}%)`
);
console.log(
  `\n  Tip: Remove .tap() calls in production or use conditional logic`
);

console.log("\nAll examples completed!");
