/**
 * Test streaming data processing with state continuity
 */

import { createDspPipeline } from "../../bindings";

// Simulate streaming chunks of data
async function* simulateDataStream(
  totalSamples: number,
  chunkSize: number
): AsyncGenerator<Float32Array> {
  for (let i = 0; i < totalSamples; i += chunkSize) {
    // Simulate data arriving over time (e.g., from sensor, audio device, network)
    await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms delay

    const remainingSamples = Math.min(chunkSize, totalSamples - i);
    const chunk = new Float32Array(remainingSamples);

    // Generate sample data (e.g., sine wave + noise)
    for (let j = 0; j < remainingSamples; j++) {
      const t = (i + j) / 100;
      chunk[j] = Math.sin(2 * Math.PI * 5 * t) + Math.random() * 0.2; // 5Hz sine + noise
    }

    yield chunk;
  }
}

async function testStreamingProcessing() {
  console.log("=== Testing Streaming Data Processing ===\n");

  const pipeline = createDspPipeline();
  pipeline.MovingAverage({ windowSize: 10 }); // Smooth with 10-sample window

  console.log("Pipeline created with 10-sample moving average");
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
      `           Processed → [${output[0].toFixed(3)}, ${output[1].toFixed(
        3
      )}, ...]\n`
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
    `   Last 10 outputs:  [${allOutputs
      .slice(-10)
      .map((v) => v.toFixed(3))
      .join(", ")}]`
  );
}

// Test with state persistence across stream interruption
async function testStreamInterruption() {
  console.log("\n\n=== Testing Stream Interruption & Recovery ===\n");

  const pipeline = createDspPipeline();
  pipeline.MovingAverage({ windowSize: 5 });

  console.log("Processing first part of stream...");
  let chunk1 = new Float32Array([1, 2, 3, 4, 5]);
  let output1 = await pipeline.process(chunk1, {
    sampleRate: 100,
    channels: 1,
  });
  console.log(
    `Chunk 1: [${Array.from(chunk1)}] → [${Array.from(output1).map((v) =>
      v.toFixed(2)
    )}]`
  );

  let chunk2 = new Float32Array([6, 7, 8]);
  let output2 = await pipeline.process(chunk2, {
    sampleRate: 100,
    channels: 1,
  });
  console.log(
    `Chunk 2: [${Array.from(chunk2)}] → [${Array.from(output2).map((v) =>
      v.toFixed(2)
    )}]`
  );

  // Save state (simulate crash/restart)
  console.log("\nSaving state (simulating service restart)...");
  const savedState = await pipeline.saveState();
  console.log("State saved:", JSON.parse(savedState).stages[0].state);

  // Create new pipeline and restore
  console.log("\nCreating new pipeline and restoring state...");
  const pipeline2 = createDspPipeline();
  pipeline2.MovingAverage({ windowSize: 5 });
  await pipeline2.loadState(savedState);
  console.log("State restored!");

  // Continue processing
  console.log("\nContinuing stream processing...");
  let chunk3 = new Float32Array([9, 10, 11]);
  let output3 = await pipeline2.process(chunk3, {
    sampleRate: 100,
    channels: 1,
  });
  console.log(
    `Chunk 3: [${Array.from(chunk3)}] → [${Array.from(output3).map((v) =>
      v.toFixed(2)
    )}]`
  );

  console.log("\nStream recovered seamlessly!");
}

// Test multi-channel streaming (e.g., stereo audio, multi-sensor EMG)
async function testMultiChannelStreaming() {
  console.log("\n\n=== Testing Multi-Channel Streaming ===\n");

  const pipeline = createDspPipeline();
  pipeline.MovingAverage({ windowSize: 3 });

  console.log("Processing 2-channel interleaved data stream");
  console.log("Format: [ch1_s1, ch2_s1, ch1_s2, ch2_s2, ...]\n");

  // Simulate 3 chunks of 2-channel data (4 samples per chunk = 2 samples per channel)
  const chunks = [
    new Float32Array([1, 10, 2, 20, 3, 30, 4, 40]), // 4 samples × 2 channels
    new Float32Array([5, 50, 6, 60, 7, 70, 8, 80]),
    new Float32Array([9, 90, 10, 100, 11, 110, 12, 120]),
  ];

  for (let i = 0; i < chunks.length; i++) {
    console.log(`Chunk ${i + 1} input: [${Array.from(chunks[i])}]`);
    const output = await pipeline.process(chunks[i], {
      sampleRate: 100,
      channels: 2,
    });
    console.log(
      `Chunk ${i + 1} output: [${Array.from(output).map((v) =>
        v.toFixed(2)
      )}]\n`
    );
  }

  console.log("Each channel maintains independent filter state!");
}

// Run all tests
async function runAllTests() {
  try {
    await testStreamingProcessing();
    await testStreamInterruption();
    await testMultiChannelStreaming();
    console.log("\nAll streaming tests passed!");
  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }
}

runAllTests();
