/**
 * Test streaming data processing with RMS and state continuity
 */

import { createDspPipeline } from "../../bindings.js";

// Simulate streaming chunks of data (e.g., EMG signals, audio)
async function* simulateDataStream(
  totalSamples: number,
  chunkSize: number
): AsyncGenerator<Float32Array> {
  for (let i = 0; i < totalSamples; i += chunkSize) {
    // Simulate data arriving over time (e.g., from sensor, audio device)
    await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms delay

    const remainingSamples = Math.min(chunkSize, totalSamples - i);
    const chunk = new Float32Array(remainingSamples);

    // Generate sample data (e.g., sine wave with varying amplitude + noise)
    for (let j = 0; j < remainingSamples; j++) {
      const t = (i + j) / 100;
      const amplitude = 1 + 0.5 * Math.sin(2 * Math.PI * 0.5 * t); // Slow amplitude modulation
      chunk[j] =
        amplitude * Math.sin(2 * Math.PI * 10 * t) + Math.random() * 0.1; // 10Hz carrier + noise
    }

    yield chunk;
  }
}

async function testStreamingRmsProcessing() {
  console.log("=== Testing Streaming RMS Processing ===\n");

  const pipeline = createDspPipeline();
  pipeline.Rms({ windowSize: 20 }); // Calculate RMS over 20-sample window

  console.log("Pipeline created with 20-sample RMS window");
  console.log(
    "Simulating real-time data stream (100 samples, 20 samples/chunk)\n"
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

    // Process chunk - pipeline remembers state from previous chunks
    const output = await pipeline.process(chunk, {
      sampleRate: 100,
      channels: 1,
    });

    console.log(
      `           RMS output → [${output[0].toFixed(3)}, ${output[1].toFixed(
        3
      )}, ...]\n`
    );

    allOutputs.push(...Array.from(output));
    totalProcessed += chunk.length;
  }

  console.log(`Stream complete: ${totalProcessed} samples processed`);
  console.log(
    `   First 10 RMS values: [${allOutputs
      .slice(0, 10)
      .map((v) => v.toFixed(3))
      .join(", ")}]`
  );
  console.log(
    `   Last 10 RMS values:  [${allOutputs
      .slice(-10)
      .map((v) => v.toFixed(3))
      .join(", ")}]`
  );
}

// Test with state persistence across stream interruption
async function testStreamInterruption() {
  console.log("\n\n=== Testing RMS Stream Interruption & Recovery ===\n");

  const pipeline = createDspPipeline();
  pipeline.Rms({ windowSize: 5 });

  console.log("Processing first part of stream...");
  let chunk1 = new Float32Array([1, -2, 3, -4, 5]);
  let output1 = await pipeline.process(chunk1, {
    sampleRate: 100,
    channels: 1,
  });
  console.log(
    `Chunk 1: [${Array.from(chunk1)}] → [${Array.from(output1).map((v) =>
      v.toFixed(3)
    )}]`
  );

  let chunk2 = new Float32Array([6, -7, 8]);
  let output2 = await pipeline.process(chunk2, {
    sampleRate: 100,
    channels: 1,
  });
  console.log(
    `Chunk 2: [${Array.from(chunk2)}] → [${Array.from(output2).map((v) =>
      v.toFixed(3)
    )}]`
  );

  // Save state (simulate crash/restart)
  console.log("\nSaving state (simulating service restart)...");
  const savedState = await pipeline.saveState();
  const parsedState = JSON.parse(savedState);
  console.log("State saved:");
  console.log("  - Window size:", parsedState.stages[0].state.windowSize);
  console.log("  - Channels:", parsedState.stages[0].state.numChannels);
  console.log(
    "  - Buffer:",
    parsedState.stages[0].state.channels[0].buffer.map((v: number) =>
      v.toFixed(3)
    )
  );
  console.log(
    "  - Running sum of squares:",
    parsedState.stages[0].state.channels[0].runningSumOfSquares.toFixed(3)
  );

  // Create new pipeline and restore
  console.log("\nCreating new pipeline and restoring state...");
  const pipeline2 = createDspPipeline();
  pipeline2.Rms({ windowSize: 5 });
  await pipeline2.loadState(savedState);
  console.log("State restored!");

  // Continue processing
  console.log("\nContinuing stream processing...");
  let chunk3 = new Float32Array([9, -10, 11]);
  let output3 = await pipeline2.process(chunk3, {
    sampleRate: 100,
    channels: 1,
  });
  console.log(
    `Chunk 3: [${Array.from(chunk3)}] → [${Array.from(output3).map((v) =>
      v.toFixed(3)
    )}]`
  );

  console.log("\nRMS stream recovered seamlessly!");
}

// Test multi-channel streaming (e.g., stereo audio, multi-sensor EMG)
async function testMultiChannelRmsStreaming() {
  console.log("\n\n=== Testing Multi-Channel RMS Streaming ===\n");

  const pipeline = createDspPipeline();
  pipeline.Rms({ windowSize: 3 });

  console.log("Processing 2-channel interleaved data stream (RMS per channel)");
  console.log("Format: [ch1_s1, ch2_s1, ch1_s2, ch2_s2, ...]\n");

  // Simulate 3 chunks of 2-channel data (4 samples per chunk = 2 samples per channel)
  // Channel 1: positive values, Channel 2: negative values
  const chunks = [
    new Float32Array([1, -10, 2, -20, 3, -30, 4, -40]), // 4 samples × 2 channels
    new Float32Array([5, -50, 6, -60, 7, -70, 8, -80]),
    new Float32Array([9, -90, 10, -100, 11, -110, 12, -120]),
  ];

  for (let i = 0; i < chunks.length; i++) {
    console.log(`Chunk ${i + 1} input: [${Array.from(chunks[i])}]`);
    const output = await pipeline.process(chunks[i], {
      sampleRate: 100,
      channels: 2,
    });
    console.log(
      `Chunk ${i + 1} RMS output: [${Array.from(output).map((v) =>
        v.toFixed(2)
      )}]\n`
    );
  }

  console.log("Each channel maintains independent RMS filter state!");
  console.log(
    "Note: RMS converts negative values to positive (magnitude only)"
  );
}

// Test RMS with actual use case: envelope detection
async function testEnvelopeDetection() {
  console.log("\n\n=== Testing RMS for Envelope Detection ===\n");

  const pipeline = createDspPipeline();
  pipeline.Rms({ windowSize: 10 }); // 10-sample RMS window for envelope

  console.log("Use case: Detecting signal envelope/amplitude over time");
  console.log("Input: Amplitude-modulated sine wave\n");

  // Generate amplitude-modulated signal: carrier × envelope
  const samples = 50;
  const carrierFreq = 20; // Hz
  const envelopeFreq = 2; // Hz (slow amplitude change)

  const input = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const t = i / 100;
    const envelope = 0.5 + 0.5 * Math.sin(2 * Math.PI * envelopeFreq * t);
    const carrier = Math.sin(2 * Math.PI * carrierFreq * t);
    input[i] = envelope * carrier;
  }

  console.log(
    "First 10 input samples:",
    Array.from(input.slice(0, 10)).map((v) => v.toFixed(3))
  );

  const output = await pipeline.process(input, {
    sampleRate: 100,
    channels: 1,
  });

  console.log(
    "First 10 RMS values (envelope):",
    Array.from(output.slice(0, 10)).map((v) => v.toFixed(3))
  );
  console.log(
    "Last 10 RMS values (envelope):",
    Array.from(output.slice(-10)).map((v) => v.toFixed(3))
  );

  console.log("\nRMS successfully tracks signal envelope!");
}

// Run all tests
async function runAllTests() {
  try {
    await testStreamingRmsProcessing();
    await testStreamInterruption();
    await testMultiChannelRmsStreaming();
    await testEnvelopeDetection();
    console.log("\nAll RMS streaming tests passed!");
  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }
}

runAllTests();
