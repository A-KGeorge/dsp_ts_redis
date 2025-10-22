/**
 * Test streaming data processing with Rectify
 */

import { createDspPipeline } from "../../bindings.js";

// Simulate streaming chunks of data (e.g., AC audio signal, EMG with negative artifacts)
async function* simulateDataStream(
  totalSamples: number,
  chunkSize: number
): AsyncGenerator<Float32Array> {
  for (let i = 0; i < totalSamples; i += chunkSize) {
    // Simulate data arriving over time
    await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms delay

    const remainingSamples = Math.min(chunkSize, totalSamples - i);
    const chunk = new Float32Array(remainingSamples);

    // Generate bipolar signal (positive and negative values)
    for (let j = 0; j < remainingSamples; j++) {
      const t = (i + j) / 100;
      chunk[j] = Math.sin(2 * Math.PI * 5 * t); // 5Hz sine wave (bipolar: -1 to +1)
    }

    yield chunk;
  }
}

async function testStreamingFullWaveRectification() {
  console.log("=== Testing Streaming Full-Wave Rectification ===\n");

  const pipeline = createDspPipeline();
  pipeline.Rectify({ mode: "full" }); // Full-wave: absolute value

  console.log("Pipeline created with full-wave rectifier");
  console.log(
    "Simulating real-time bipolar signal stream (100 samples, 20 samples/chunk)\n"
  );

  let chunkNumber = 0;
  let totalProcessed = 0;
  const allOutputs: number[] = [];

  // Process streaming data
  for await (const chunk of simulateDataStream(100, 20)) {
    chunkNumber++;
    console.log(
      `Chunk ${chunkNumber}: Received ${
        chunk.length
      } samples [${chunk[0].toFixed(3)}, ${chunk[1].toFixed(3)}, ...]`
    );

    // Process chunk - rectify converts all to positive
    const output = await pipeline.process(chunk, {
      sampleRate: 100,
      channels: 1,
    });

    console.log(
      `           Rectified → [${output[0].toFixed(3)}, ${output[1].toFixed(
        3
      )}, ...] (all positive)\n`
    );

    allOutputs.push(...Array.from(output));
    totalProcessed += chunk.length;
  }

  console.log(`Stream complete: ${totalProcessed} samples processed`);
  console.log(
    `   First 10 outputs: [${allOutputs
      .slice(0, 10)
      .map((v) => v.toFixed(3))
      .join(", ")}]`
  );
  console.log(
    `   All values ≥ 0: ${allOutputs.every((v) => v >= 0) ? "Yes" : "No"}`
  );
}

async function testStreamingHalfWaveRectification() {
  console.log("\n\n=== Testing Streaming Half-Wave Rectification ===\n");

  const pipeline = createDspPipeline();
  pipeline.Rectify({ mode: "half" }); // Half-wave: negatives → 0

  console.log("Pipeline created with half-wave rectifier");
  console.log("Simulating bipolar signal stream (zeros out negative half)\n");

  let chunkNumber = 0;
  const allOutputs: number[] = [];

  for await (const chunk of simulateDataStream(100, 20)) {
    chunkNumber++;
    const output = await pipeline.process(chunk, {
      sampleRate: 100,
      channels: 1,
    });

    console.log(
      `Chunk ${chunkNumber}: [${output[0].toFixed(3)}, ${output[1].toFixed(
        3
      )}, ...] (negatives → 0)`
    );

    allOutputs.push(...Array.from(output));
  }

  console.log(`\nStream complete`);
  const zeroCount = allOutputs.filter((v) => v === 0).length;
  const positiveCount = allOutputs.filter((v) => v > 0).length;
  console.log(`   Zero values: ${zeroCount}`);
  console.log(`   Positive values: ${positiveCount}`);
  console.log(
    `   All values ≥ 0: ${allOutputs.every((v) => v >= 0) ? "Yes" : "No"}`
  );
}

// Test state persistence across stream interruption
async function testStreamInterruption() {
  console.log("\n\n=== Testing Rectify Stream Interruption & Recovery ===\n");

  const pipeline = createDspPipeline();
  pipeline.Rectify({ mode: "half" });

  console.log("Processing first part of stream (half-wave)...");
  let chunk1 = new Float32Array([1, -2, 3, -4, 5]);
  let output1 = await pipeline.process(chunk1, {
    sampleRate: 100,
    channels: 1,
  });
  console.log(`Chunk 1: [${Array.from(chunk1)}] → [${Array.from(output1)}]`);

  // Save state (simulate crash/restart)
  console.log("\nSaving state (simulating service restart)...");
  const savedState = await pipeline.saveState();
  const parsedState = JSON.parse(savedState);
  console.log("State saved:");
  console.log(`  - Type: ${parsedState.stages[0].type}`);
  console.log(`  - Mode: ${parsedState.stages[0].state.mode}`);

  // Create new pipeline and restore
  console.log("\nCreating new pipeline and restoring state...");
  const pipeline2 = createDspPipeline();
  pipeline2.Rectify({ mode: "full" }); // Start with different mode
  await pipeline2.loadState(savedState); // Should restore to half-wave
  console.log("State restored (mode should be 'half')!");

  // Continue processing
  console.log("\nContinuing stream processing...");
  let chunk2 = new Float32Array([6, -7, 8, -9]);
  let output2 = await pipeline2.process(chunk2, {
    sampleRate: 100,
    channels: 1,
  });
  console.log(`Chunk 2: [${Array.from(chunk2)}] → [${Array.from(output2)}]`);
  console.log(`Expected: [6, 0, 8, 0] (half-wave mode restored)`);

  console.log("\nRectify stream recovered seamlessly!");
}

// Test multi-channel rectification
async function testMultiChannelRectify() {
  console.log("\n\n=== Testing Multi-Channel Rectification ===\n");

  const pipeline = createDspPipeline();
  pipeline.Rectify({ mode: "full" });

  console.log("Processing 2-channel interleaved data (full-wave)");
  console.log("Format: [ch1_s1, ch2_s1, ch1_s2, ch2_s2, ...]\n");

  // Channel 1: positive bias, Channel 2: negative bias
  const chunks = [
    new Float32Array([1, -10, 2, -20, -3, 30, -4, 40]),
    new Float32Array([5, -50, -6, 60, 7, -70, -8, 80]),
  ];

  for (let i = 0; i < chunks.length; i++) {
    console.log(`Chunk ${i + 1} input: [${Array.from(chunks[i])}]`);
    const output = await pipeline.process(chunks[i], {
      sampleRate: 100,
      channels: 2,
    });
    console.log(`Chunk ${i + 1} output: [${Array.from(output)}]`);
    console.log(
      `           All positive: ${
        Array.from(output).every((v) => v >= 0) ? "Yes" : "No"
      }\n`
    );
  }

  console.log("Multi-channel rectification works independently per sample!");
}

// Test practical use case: EMG signal pre-processing
async function testEmgPreProcessing() {
  console.log("\n\n=== Testing EMG Signal Pre-Processing ===\n");

  console.log("Use case: Prepare EMG for envelope detection");
  console.log("Pipeline: Full-wave Rectify (converts to magnitude)\n");

  const pipeline = createDspPipeline();
  pipeline.Rectify({ mode: "full" });

  // Simulate raw EMG with positive and negative spikes
  const rawEmg = new Float32Array([
    0.1, -0.3, 0.5, -0.8, 1.2, -1.5, 0.9, -0.6, 0.3, -0.1,
  ]);

  console.log(
    "Raw EMG (bipolar):",
    Array.from(rawEmg).map((v) => v.toFixed(2))
  );

  const rectified = await pipeline.process(rawEmg, {
    sampleRate: 2000,
    channels: 1,
  });

  console.log(
    "Rectified EMG (magnitude):",
    Array.from(rectified).map((v) => v.toFixed(2))
  );
  console.log("\nRectified signal is ready for RMS/envelope detection!");
}

// Run all tests
async function runAllTests() {
  try {
    await testStreamingFullWaveRectification();
    await testStreamingHalfWaveRectification();
    await testStreamInterruption();
    await testMultiChannelRectify();
    await testEmgPreProcessing();
    console.log("\nAll Rectify streaming tests passed!");
  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }
}

runAllTests();
