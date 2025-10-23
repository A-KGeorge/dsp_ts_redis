import { createDspPipeline } from "../../bindings.js";

console.log("Z-Score Normalize Filter - State Management Examples\n");

// =============================================================================
// Example 1: Batch Z-Score Normalization (Stateless)
// =============================================================================
console.log("1. Batch Z-Score Normalization (Stateless)");

const pipeline1 = createDspPipeline();
pipeline1.ZScoreNormalize({ mode: "batch" });

const input1 = new Float32Array([10, 20, 30, 40, 50]);
const output1 = await pipeline1.process(input1, {
  sampleRate: 1000,
  channels: 1,
});

console.log(`  Input: [${input1.join(", ")}]`);
console.log(`  Mean: 30, Std Dev: ~14.14`);
console.log(
  `  Output (normalized): [${Array.from(output1)
    .map((v) => v.toFixed(3))
    .join(", ")}]`
);
console.log(
  `  Mean after normalization: ${(
    output1.reduce((s, v) => s + v, 0) / output1.length
  ).toFixed(6)}`
);
console.log(
  `  Variance after normalization: ${(
    output1.reduce((s, v) => s + v * v, 0) / output1.length
  ).toFixed(6)}`
);
console.log("");

// =============================================================================
// Example 2: Moving Z-Score Normalization (Stateful)
// =============================================================================
console.log("2. Moving Z-Score Normalization (Stateful)");

const pipeline2 = createDspPipeline();
pipeline2.ZScoreNormalize({ mode: "moving", windowSize: 3 });

const input2 = new Float32Array([1, 2, 3, 4, 5]);
const output2 = await pipeline2.process(input2, {
  sampleRate: 1000,
  channels: 1,
});

console.log(`  Input: [${input2.join(", ")}]`);
console.log(`  Output (sliding window):`);
console.log(`    [1] -> z-score: ${output2[0].toFixed(3)} (mean=1, stddev=0)`);
console.log(
  `    [1,2] -> z-score: ${output2[1].toFixed(3)} (mean=1.5, stddev=0.5)`
);
console.log(
  `    [1,2,3] -> z-score: ${output2[2].toFixed(3)} (mean=2, stddev≈0.816)`
);
console.log(
  `    [2,3,4] -> z-score: ${output2[3].toFixed(3)} (mean=3, stddev≈0.816)`
);
console.log(
  `    [3,4,5] -> z-score: ${output2[4].toFixed(3)} (mean=4, stddev≈0.816)`
);
console.log("");

// =============================================================================
// Example 3: Save and Restore State
// =============================================================================
console.log("3. Save and Restore State");

const pipeline3 = createDspPipeline();
pipeline3.ZScoreNormalize({ mode: "moving", windowSize: 5 });

// Build up state
const initialData = new Float32Array([10, 15, 20, 25, 30]);
await pipeline3.process(initialData, { sampleRate: 1000, channels: 1 });

// Save state
const stateJson = await pipeline3.saveState();
const state = JSON.parse(stateJson);

console.log(`  Saved state:`);
console.log(`    Mode: ${state.stages[0].state.mode}`);
console.log(`    Window size: ${state.stages[0].state.windowSize}`);
console.log(
  `    Buffer: [${state.stages[0].state.channels[0].buffer.join(", ")}]`
);
console.log(`    Running sum: ${state.stages[0].state.channels[0].runningSum}`);
console.log(
  `    Running sum of squares: ${state.stages[0].state.channels[0].runningSumOfSquares}`
);

// Restore state in a new pipeline
const pipeline3b = createDspPipeline();
pipeline3b.ZScoreNormalize({ mode: "moving", windowSize: 5 });
await pipeline3b.loadState(stateJson);

console.log(`  State restored!`);

// Continue processing with restored state
const continuedData = new Float32Array([35, 40, 45]);
const continuedOutput = await pipeline3b.process(continuedData, {
  sampleRate: 1000,
  channels: 1,
});

console.log(`  Continued with [${continuedData.join(", ")}]`);
console.log(
  `  Output: [${Array.from(continuedOutput)
    .map((v) => v.toFixed(3))
    .join(", ")}]`
);
console.log("");

// =============================================================================
// Example 4: Clear State (Reset)
// =============================================================================
console.log("4. Clear State (Reset)");

const pipeline4 = createDspPipeline();
pipeline4.ZScoreNormalize({ mode: "moving", windowSize: 3 });

// Process some data
await pipeline4.process(new Float32Array([100, 200, 300]), {
  sampleRate: 1000,
  channels: 1,
});

// Clear state
pipeline4.clearState();
console.log(`  State cleared!`);

// Process new data (should start fresh)
const resetInput = new Float32Array([1, 2, 3]);
const resetOutput = await pipeline4.process(resetInput, {
  sampleRate: 1000,
  channels: 1,
});

console.log(`  After reset, input [${resetInput.join(", ")}]:`);
console.log(
  `  Output: [${Array.from(resetOutput)
    .map((v) => v.toFixed(3))
    .join(", ")}]`
);
console.log(`  (Same as if processing first time)`);
console.log("");

// =============================================================================
// Example 5: Batch vs Moving Comparison
// =============================================================================
console.log("5. Batch vs Moving Comparison");

const inputData = new Float32Array([10, 20, 30, 40, 50]);

// Batch mode
const batchPipeline = createDspPipeline();
batchPipeline.ZScoreNormalize({ mode: "batch" });
const batchOutput = await batchPipeline.process(inputData.slice(), {
  sampleRate: 1000,
  channels: 1,
});

// Moving mode
const movingPipeline = createDspPipeline();
movingPipeline.ZScoreNormalize({ mode: "moving", windowSize: 5 });
const movingOutput = await movingPipeline.process(inputData.slice(), {
  sampleRate: 1000,
  channels: 1,
});

console.log(`  Input: [${inputData.join(", ")}]`);
console.log(
  `  Batch (global normalization): [${Array.from(batchOutput)
    .map((v) => v.toFixed(3))
    .join(", ")}]`
);
console.log(
  `  Moving (evolving window): [${Array.from(movingOutput)
    .map((v) => v.toFixed(3))
    .join(", ")}]`
);
console.log("");
console.log(`  Batch: All samples normalized using entire dataset statistics`);
console.log(`  Moving: Each sample normalized using local window statistics`);
console.log("");

// =============================================================================
// Example 6: Multi-Channel State Management
// =============================================================================
console.log("6. Multi-Channel State Management");

const pipeline6 = createDspPipeline();
pipeline6.ZScoreNormalize({ mode: "moving", windowSize: 3 });

// 2 channels, 5 samples per channel (interleaved)
// Channel 0: [1, 2, 3, 4, 5]
// Channel 1: [100, 200, 300, 400, 500]
const multiChannelInput = new Float32Array([
  1, 100, 2, 200, 3, 300, 4, 400, 5, 500,
]);

await pipeline6.process(multiChannelInput, {
  sampleRate: 1000,
  channels: 2,
});

const state6 = JSON.parse(await pipeline6.saveState());

console.log(`  2-channel processing:`);
console.log(
  `    Channel 0 buffer: [${state6.stages[0].state.channels[0].buffer.join(
    ", "
  )}]`
);
console.log(
  `    Channel 1 buffer: [${state6.stages[0].state.channels[1].buffer.join(
    ", "
  )}]`
);
console.log(`  (Each channel maintains independent state)`);
console.log("");

// =============================================================================
// Example 7: Custom Epsilon for Near-Constant Signals
// =============================================================================
console.log("7. Custom Epsilon for Near-Constant Signals");

const pipeline7a = createDspPipeline();
pipeline7a.ZScoreNormalize({ mode: "batch", epsilon: 1e-6 }); // Default

const pipeline7b = createDspPipeline();
pipeline7b.ZScoreNormalize({ mode: "batch", epsilon: 0.1 }); // Larger epsilon

// Nearly constant signal
const nearConstant = new Float32Array([5.0, 5.001, 4.999, 5.0, 5.001]);

const output7a = await pipeline7a.process(nearConstant.slice(), {
  sampleRate: 1000,
  channels: 1,
});

const output7b = await pipeline7b.process(nearConstant.slice(), {
  sampleRate: 1000,
  channels: 1,
});

console.log(`  Input (nearly constant): [${nearConstant.join(", ")}]`);
console.log(
  `  Default epsilon (1e-6): [${Array.from(output7a)
    .map((v) => v.toFixed(3))
    .join(", ")}]`
);
console.log(
  `  Large epsilon (0.1):   [${Array.from(output7b)
    .map((v) => v.toFixed(3))
    .join(", ")}]`
);
console.log("");

console.log("Key Takeaways:");
console.log(
  "  - Batch mode: Stateless, normalizes using global statistics (mean=0, stddev=1)"
);
console.log(
  "  - Moving mode: Stateful, normalizes using local window statistics"
);
console.log(
  "  - State includes: circular buffer, running sum, running sum of squares"
);
console.log(
  "  - Each channel has independent state for multi-channel processing"
);
console.log("  - Epsilon prevents division by zero when stddev is near 0");
