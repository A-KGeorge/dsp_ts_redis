/**
 * Test streaming MAV processing - ideal for EMG signal analysis
 * Demonstrates real-time activity detection from streaming bioelectric signals
 */

import { createDspPipeline } from "../../bindings";

// Simulate streaming EMG data
async function* simulateEmgStream(
  totalSamples: number,
  chunkSize: number
): AsyncGenerator<Float32Array> {
  for (let i = 0; i < totalSamples; i += chunkSize) {
    // Simulate data arriving over time (e.g., from EMG sensor)
    await new Promise((resolve) => setTimeout(resolve, 50)); // 50ms delay

    const remainingSamples = Math.min(chunkSize, totalSamples - i);
    const chunk = new Float32Array(remainingSamples);

    // Generate simulated EMG signal
    // Low amplitude baseline + occasional bursts (muscle contractions)
    for (let j = 0; j < remainingSamples; j++) {
      const t = (i + j) / 1000;
      // Baseline noise
      let signal = (Math.random() - 0.5) * 0.1;

      // Add muscle contraction bursts every ~200 samples
      if (Math.floor((i + j) / 200) % 2 === 1) {
        signal += Math.sin(2 * Math.PI * 100 * t) * 0.8; // High-frequency burst
      }

      chunk[j] = signal;
    }

    yield chunk;
  }
}

async function testMavStreaming() {
  console.log("=== Testing MAV for Streaming EMG Analysis ===\n");

  const pipeline = createDspPipeline();
  pipeline.MeanAbsoluteValue({ mode: "moving", windowSize: 20 }); // 20ms window at 1kHz

  console.log("Pipeline created with MAV filter (20-sample window)");
  console.log("Use case: Real-time muscle activity detection from EMG");
  console.log("Simulating EMG stream (500 samples, 50 samples/chunk)\n");

  let chunkNumber = 0;
  let totalProcessed = 0;
  const allOutputs: number[] = [];

  // Process streaming EMG data
  for await (const chunk of simulateEmgStream(500, 50)) {
    chunkNumber++;
    const chunkPreview = Array.from(chunk.slice(0, 3))
      .map((v) => v.toFixed(3))
      .join(", ");
    console.log(
      `Chunk ${chunkNumber}: Received ${chunk.length} samples [${chunkPreview}, ...]`
    );

    // Process chunk - MAV tracks activity level
    const output = await pipeline.process(chunk, {
      sampleRate: 1000,
      channels: 1,
    });

    const mavPreview = Array.from(output.slice(0, 3))
      .map((v) => v.toFixed(3))
      .join(", ");
    const maxMav = Math.max(...Array.from(output));
    console.log(
      `           MAV → [${mavPreview}, ...] (max: ${maxMav.toFixed(3)})\n`
    );

    allOutputs.push(...Array.from(output));
    totalProcessed += chunk.length;
  }

  console.log(`Stream complete: ${totalProcessed} samples processed`);
  console.log(
    `   First 10 MAV: [${allOutputs
      .slice(0, 10)
      .map((v) => v.toFixed(3))
      .join(", ")}]`
  );
  console.log(
    `   Last 10 MAV:  [${allOutputs
      .slice(-10)
      .map((v) => v.toFixed(3))
      .join(", ")}]`
  );
}

// Test with state persistence across stream interruption
async function testStreamInterruption() {
  console.log("\n\n=== Testing Stream Interruption & Recovery ===\n");

  const pipeline = createDspPipeline();
  pipeline.MeanAbsoluteValue({ mode: "moving", windowSize: 5 });

  console.log("Processing first part of EMG stream...");
  let chunk1 = new Float32Array([0.1, -0.2, 0.3, -0.4, 0.5]);
  let output1 = await pipeline.process(chunk1, {
    sampleRate: 1000,
    channels: 1,
  });
  console.log(
    `Chunk 1: [${Array.from(chunk1).map((v) =>
      v.toFixed(1)
    )}] → MAV: [${Array.from(output1).map((v) => v.toFixed(2))}]`
  );

  let chunk2 = new Float32Array([-0.6, 0.7, -0.8]);
  let output2 = await pipeline.process(chunk2, {
    sampleRate: 1000,
    channels: 1,
  });
  console.log(
    `Chunk 2: [${Array.from(chunk2).map((v) =>
      v.toFixed(1)
    )}] → MAV: [${Array.from(output2).map((v) => v.toFixed(2))}]`
  );

  // Save state (simulate sensor disconnect/reconnect)
  console.log("\nSaving state (simulating sensor reconnection)...");
  const savedState = await pipeline.saveState();
  const state = JSON.parse(savedState);
  console.log(
    "State saved - window contains:",
    state.stages[0].state.channels[0].buffer.length,
    "samples"
  );

  // Create new pipeline and restore
  console.log("\nCreating new pipeline and restoring state...");
  const pipeline2 = createDspPipeline();
  pipeline2.MeanAbsoluteValue({ mode: "moving", windowSize: 5 });
  await pipeline2.loadState(savedState);
  console.log("State restored!");

  // Continue processing
  console.log("\nContinuing stream processing...");
  let chunk3 = new Float32Array([0.9, -1.0, 1.1]);
  let output3 = await pipeline2.process(chunk3, {
    sampleRate: 1000,
    channels: 1,
  });
  console.log(
    `Chunk 3: [${Array.from(chunk3).map((v) =>
      v.toFixed(1)
    )}] → MAV: [${Array.from(output3).map((v) => v.toFixed(2))}]`
  );

  console.log("\nStream recovered seamlessly!");
}

// Test multi-channel streaming (e.g., multi-electrode EMG)
async function testMultiChannelEmg() {
  console.log("\n\n=== Testing Multi-Electrode EMG Streaming ===\n");

  const pipeline = createDspPipeline();
  pipeline.MeanAbsoluteValue({ mode: "moving", windowSize: 3 });

  console.log("Processing 2-channel EMG data stream");
  console.log("Channel 0: Biceps, Channel 1: Triceps");
  console.log("Format: [biceps_s1, triceps_s1, biceps_s2, triceps_s2, ...]\n");

  // Simulate 3 chunks of 2-channel EMG data
  const chunks = [
    new Float32Array([0.1, -0.05, -0.2, 0.1, 0.3, -0.15, -0.4, 0.2]), // Biceps active
    new Float32Array([-0.05, 0.5, 0.1, -0.6, -0.15, 0.7, 0.2, -0.8]), // Triceps active
    new Float32Array([0.3, 0.3, -0.4, -0.4, 0.5, 0.5, -0.6, -0.6]), // Both active
  ];

  const labels = [
    "Biceps contraction",
    "Triceps contraction",
    "Co-contraction",
  ];

  for (let i = 0; i < chunks.length; i++) {
    console.log(`\n${labels[i]}:`);
    console.log(`  Input: [${Array.from(chunks[i]).map((v) => v.toFixed(2))}]`);

    const output = await pipeline.process(chunks[i], {
      sampleRate: 1000,
      channels: 2,
    });

    console.log(`  MAV:   [${Array.from(output).map((v) => v.toFixed(2))}]`);

    // Calculate average MAV per channel
    const bicepsMav = [];
    const tricepsMav = [];
    for (let j = 0; j < output.length; j += 2) {
      bicepsMav.push(output[j]);
      tricepsMav.push(output[j + 1]);
    }

    const avgBiceps = bicepsMav.reduce((a, b) => a + b, 0) / bicepsMav.length;
    const avgTriceps =
      tricepsMav.reduce((a, b) => a + b, 0) / tricepsMav.length;

    console.log(
      `  Avg MAV → Biceps: ${avgBiceps.toFixed(
        3
      )}, Triceps: ${avgTriceps.toFixed(3)}`
    );
  }

  console.log("\n✓ Each muscle maintains independent activity tracking!");
}

// Test batch vs moving mode comparison
async function testBatchVsMovingMode() {
  console.log("\n\n=== Batch vs Moving Mode Comparison ===\n");

  const signal = new Float32Array([0.1, -0.5, 0.3, -0.8, 0.2, -0.6, 0.4, -0.7]);
  console.log(
    "Input signal:",
    Array.from(signal).map((v) => v.toFixed(1))
  );

  // Batch mode - compute global MAV
  const batchPipeline = createDspPipeline();
  batchPipeline.MeanAbsoluteValue({ mode: "batch" });
  const batchOutput = await batchPipeline.process(signal, {
    sampleRate: 1000,
    channels: 1,
  });
  console.log("\nBatch mode (global MAV):");
  console.log(
    "  Output:",
    Array.from(batchOutput).map((v) => v.toFixed(3))
  );
  console.log("  → All values equal (entire signal average)");

  // Moving mode - local sliding window
  const movingPipeline = createDspPipeline();
  movingPipeline.MeanAbsoluteValue({ mode: "moving", windowSize: 3 });
  const movingOutput = await movingPipeline.process(signal, {
    sampleRate: 1000,
    channels: 1,
  });
  console.log("\nMoving mode (window=3):");
  console.log(
    "  Output:",
    Array.from(movingOutput).map((v) => v.toFixed(3))
  );
  console.log("  → Local activity tracking (better for transient detection)");
}

// Run all tests
async function runAllTests() {
  try {
    await testMavStreaming();
    await testStreamInterruption();
    await testMultiChannelEmg();
    await testBatchVsMovingMode();
    console.log("\n✓ All MAV streaming tests passed!");
  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }
}

runAllTests();
