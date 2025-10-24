/**
 * Comparison: Sample-Based vs Time-Based Processing
 *
 * This example demonstrates the difference between legacy sample-based
 * and new time-based processing, especially with irregular data.
 */

import { createDspPipeline } from "../../bindings";

/**
 * Generate uniform sensor data (ideal case)
 */
function generateUniformData(count: number, sampleRate: number) {
  const samples = new Float32Array(count);
  const timestamps = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    samples[i] = Math.sin(i * 0.1) * 10 + (Math.random() - 0.5) * 2;
    timestamps[i] = i * (1000 / sampleRate); // Milliseconds
  }

  return { samples, timestamps };
}

/**
 * Generate irregular sensor data (realistic case)
 */
function generateIrregularData(count: number, avgInterval: number) {
  const samples = new Float32Array(count);
  const timestamps = new Float32Array(count);
  let currentTime = 0;

  for (let i = 0; i < count; i++) {
    samples[i] = Math.sin(i * 0.1) * 10 + (Math.random() - 0.5) * 2;

    // Random interval: 50% to 150% of average
    const interval = avgInterval * (0.5 + Math.random());
    currentTime += interval;
    timestamps[i] = currentTime;
  }

  return { samples, timestamps };
}

/**
 * Compare sample-based vs time-based on UNIFORM data
 */
async function compareUniformData() {
  console.log("=== Comparison on UNIFORM Data (Ideal Case) ===\n");

  const sampleRate = 100; // 100 Hz
  const { samples, timestamps } = generateUniformData(100, sampleRate);

  // Sample-based pipeline (legacy)
  const pipelineSample = createDspPipeline();
  pipelineSample.MovingAverage({
    mode: "moving",
    windowSize: 50, // 50 samples
  });

  // Time-based pipeline (new)
  const pipelineTime = createDspPipeline();
  pipelineTime.MovingAverage({
    mode: "moving",
    windowDuration: 500, // 500ms (equivalent to 50 samples at 100 Hz)
  });

  // Process with sample-based
  const resultSample = await pipelineSample.process(samples, {
    sampleRate,
    channels: 1,
  });

  // Process with time-based
  const resultTime = await pipelineTime.process(samples, timestamps, {
    channels: 1,
  });

  // Compare results
  console.log("Input: Uniform 100 Hz sampling, 100 samples");
  console.log("Window: 50 samples (sample-based) vs 500ms (time-based)");
  console.log("\nComparison (first 5 samples):");
  console.log("  Index | Input    | Sample-Based | Time-Based | Difference");
  console.log("  ------|----------|--------------|------------|------------");

  for (let i = 0; i < 5; i++) {
    const diff = Math.abs(resultSample[i] - resultTime[i]);
    console.log(
      `  ${i.toString().padStart(5)} | ${samples[i]
        .toFixed(3)
        .padStart(8)} | ` +
        `${resultSample[i].toFixed(3).padStart(12)} | ${resultTime[i]
          .toFixed(3)
          .padStart(10)} | ` +
        `${diff.toFixed(6).padStart(10)}`
    );
  }

  // Calculate max difference
  let maxDiff = 0;
  for (let i = 0; i < samples.length; i++) {
    maxDiff = Math.max(maxDiff, Math.abs(resultSample[i] - resultTime[i]));
  }

  console.log(
    `\n✅ Max difference: ${maxDiff.toFixed(6)} (essentially identical)`
  );
  console.log(
    "   → On uniform data, both methods produce equivalent results\n"
  );
}

/**
 * Compare sample-based vs time-based on IRREGULAR data
 */
async function compareIrregularData() {
  console.log("=== Comparison on IRREGULAR Data (Realistic Case) ===\n");

  const avgInterval = 10; // ~100 Hz average, but irregular
  const { samples, timestamps } = generateIrregularData(100, avgInterval);

  // Calculate actual intervals
  const intervals: number[] = [];
  for (let i = 1; i < timestamps.length; i++) {
    intervals.push(timestamps[i] - timestamps[i - 1]);
  }
  const avgActualInterval =
    intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const minInterval = Math.min(...intervals);
  const maxInterval = Math.max(...intervals);

  console.log("Input: Irregular sampling");
  console.log(
    `  Average interval: ${avgActualInterval.toFixed(2)}ms (~${(
      1000 / avgActualInterval
    ).toFixed(0)} Hz)`
  );
  console.log(
    `  Interval range: ${minInterval.toFixed(2)}ms - ${maxInterval.toFixed(
      2
    )}ms`
  );
  console.log(
    `  Jitter: ${(
      ((maxInterval - minInterval) / avgActualInterval) *
      100
    ).toFixed(1)}%\n`
  );

  // Sample-based pipeline (treats irregular data as uniform)
  const pipelineSample = createDspPipeline();
  pipelineSample.MovingAverage({
    mode: "moving",
    windowSize: 50, // 50 samples (ignores timestamps)
  });

  // Time-based pipeline (respects timestamps)
  const pipelineTime = createDspPipeline();
  pipelineTime.MovingAverage({
    mode: "moving",
    windowDuration: 500, // 500ms (uses actual timestamps)
  });

  // Process with sample-based (ignores irregularity)
  const resultSample = await pipelineSample.process(samples, {
    channels: 1, // No sampleRate = sequential timestamps [0,1,2,...]
  });

  // Process with time-based (respects timestamps)
  const resultTime = await pipelineTime.process(samples, timestamps, {
    channels: 1,
  });

  // Compare results
  console.log("Window: 50 samples (sample-based) vs 500ms (time-based)");
  console.log("\nComparison (samples 20-24, where differences emerge):");
  console.log(
    "  Index | Input    | Sample-Based | Time-Based | Difference | Δt (ms)"
  );
  console.log(
    "  ------|----------|--------------|------------|------------|--------"
  );

  for (let i = 20; i < 25; i++) {
    const diff = Math.abs(resultSample[i] - resultTime[i]);
    const deltaT = i > 0 ? timestamps[i] - timestamps[i - 1] : 0;
    console.log(
      `  ${i.toString().padStart(5)} | ${samples[i]
        .toFixed(3)
        .padStart(8)} | ` +
        `${resultSample[i].toFixed(3).padStart(12)} | ${resultTime[i]
          .toFixed(3)
          .padStart(10)} | ` +
        `${diff.toFixed(3).padStart(10)} | ${deltaT.toFixed(2).padStart(6)}`
    );
  }

  // Calculate statistics on differences
  let sumDiff = 0;
  let maxDiff = 0;
  for (let i = 0; i < samples.length; i++) {
    const diff = Math.abs(resultSample[i] - resultTime[i]);
    sumDiff += diff;
    maxDiff = Math.max(maxDiff, diff);
  }
  const avgDiff = sumDiff / samples.length;

  console.log(`\n⚠️  Average difference: ${avgDiff.toFixed(3)}`);
  console.log(`⚠️  Max difference: ${maxDiff.toFixed(3)}`);
  console.log("   → On irregular data, results diverge significantly!");
  console.log("   → Time-based processing accounts for actual timing\n");
}

/**
 * Demonstrate when to use each approach
 */
async function showUseCases() {
  console.log("=== When to Use Each Approach ===\n");

  console.log("✅ USE SAMPLE-BASED (windowSize) when:");
  console.log("   • Data is uniformly sampled (ADC, audio, high-rate sensors)");
  console.log("   • Sample count is more important than time");
  console.log("   • Maximum performance is critical");
  console.log("   • Working with legacy code\n");

  console.log("✅ USE TIME-BASED (windowDuration) when:");
  console.log("   • Data arrives at irregular intervals (network, IoT)");
  console.log('   • Time-based analysis is required ("last 5 seconds")');
  console.log("   • Dealing with real-world sensor delays/jitter");
  console.log("   • Need intuitive window specification\n");

  console.log("✅ USE BOTH (windowSize + windowDuration) when:");
  console.log("   • Need to enforce maximum sample count AND time window");
  console.log("   • Want memory limits with time-based semantics");
  console.log("   • Processing variable-rate data with hard limits\n");
}

/**
 * Migration example: converting existing code
 */
async function showMigration() {
  console.log("=== Migration Example ===\n");

  console.log("BEFORE (Sample-Based):");
  console.log("```typescript");
  console.log("const pipeline = createDspPipeline();");
  console.log("pipeline.MovingAverage({ mode: 'moving', windowSize: 100 });");
  console.log("");
  console.log("await pipeline.process(samples, {");
  console.log("  sampleRate: 1000, // 1000 Hz");
  console.log("  channels: 1");
  console.log("});");
  console.log("```\n");

  console.log("AFTER (Time-Based):");
  console.log("```typescript");
  console.log("const pipeline = createDspPipeline();");
  console.log("// 100 samples at 1000 Hz = 100ms");
  console.log(
    "pipeline.MovingAverage({ mode: 'moving', windowDuration: 100 });"
  );
  console.log("");
  console.log("// Generate timestamps from your data source");
  console.log("const timestamps = new Float32Array(samples.length);");
  console.log("for (let i = 0; i < samples.length; i++) {");
  console.log("  timestamps[i] = i; // 1ms per sample for 1000 Hz");
  console.log("}");
  console.log("");
  console.log("await pipeline.process(samples, timestamps, { channels: 1 });");
  console.log("```\n");

  console.log("Conversion Formula:");
  console.log("  windowDuration (ms) = (windowSize / sampleRate) * 1000\n");
}

// Run all comparisons
async function main() {
  await compareUniformData();
  await compareIrregularData();
  await showUseCases();
  await showMigration();

  console.log("=== Comparison Complete ===");
  console.log("\n💡 Key Takeaway:");
  console.log("   • Uniform data: Both methods equivalent");
  console.log("   • Irregular data: Time-based processing essential");
  console.log("   • Choose based on your data characteristics!\n");
}

main().catch(console.error);
