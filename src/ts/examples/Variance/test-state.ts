import { createDspPipeline } from "../../index.js";

console.log("Variance Filter - State Management Examples\n");

// Example 1: Batch variance (stateless)
console.log("1. Batch Variance (Stateless)");
{
  const pipeline = createDspPipeline().Variance({ mode: "batch" });

  const input = new Float32Array([1, 2, 3, 4, 5]);
  const output = await pipeline.process(input, {
    sampleRate: 1000,
    channels: 1,
  });

  console.log(`  Input: [${Array.from(input).join(", ")}]`);
  console.log(`  Output (all same): ${output[0].toFixed(3)}`);
  console.log(`  Expected variance: 2.0 (spread around mean of 3)`);
}

// Example 2: Moving variance (stateful)
console.log("\n2. Moving Variance (Stateful)");
{
  const pipeline = createDspPipeline().Variance({
    mode: "moving",
    windowSize: 3,
  });

  const input = new Float32Array([1, 2, 3, 4, 5]);
  const output = await pipeline.process(input, {
    sampleRate: 1000,
    channels: 1,
  });

  console.log(`  Input: [${Array.from(input).join(", ")}]`);
  console.log(`  Output (sliding window):`);
  console.log(`    [1] -> variance: ${output[0].toFixed(3)}`);
  console.log(`    [1,2] -> variance: ${output[1].toFixed(3)}`);
  console.log(`    [1,2,3] -> variance: ${output[2].toFixed(3)}`);
  console.log(`    [2,3,4] -> variance: ${output[3].toFixed(3)}`);
  console.log(`    [3,4,5] -> variance: ${output[4].toFixed(3)}`);
}

// Example 3: Save and restore state
console.log("\n3. Save and Restore State");
{
  const pipeline = createDspPipeline().Variance({
    mode: "moving",
    windowSize: 5,
  });

  // Process first batch
  const input1 = new Float32Array([1, 2, 3, 4, 5]);
  await pipeline.process(input1, { sampleRate: 1000, channels: 1 });

  // Save state
  const stateJson = await pipeline.saveState();
  const state = JSON.parse(stateJson);

  console.log("  Saved state:");
  console.log(`    Mode: ${state.stages[0].state.mode}`);
  console.log(`    Window size: ${state.stages[0].state.windowSize}`);
  console.log(
    `    Buffer: [${state.stages[0].state.channels[0].buffer.join(", ")}]`
  );
  console.log(
    `    Running sum: ${state.stages[0].state.channels[0].runningSum}`
  );

  // Create new pipeline and restore
  const pipeline2 = createDspPipeline().Variance({
    mode: "moving",
    windowSize: 5,
  });
  await pipeline2.loadState(stateJson);

  console.log("  State restored!");

  // Continue processing
  const input2 = new Float32Array([6, 7, 8]);
  const output = await pipeline2.process(input2, {
    sampleRate: 1000,
    channels: 1,
  });

  console.log(`  Continued with [6, 7, 8]`);
  console.log(
    `  Output: [${Array.from(output)
      .map((v) => v.toFixed(3))
      .join(", ")}]`
  );
}

// Example 4: Clear state
console.log("\n4. Clear State (Reset)");
{
  const pipeline = createDspPipeline().Variance({
    mode: "moving",
    windowSize: 3,
  });

  // Build up state
  await pipeline.process(new Float32Array([10, 20, 30, 40, 50]), {
    sampleRate: 1000,
    channels: 1,
  });

  // Clear state
  pipeline.clearState();
  console.log("  State cleared!");

  // Process new data - should start fresh
  const input = new Float32Array([1, 2, 3]);
  const output = await pipeline.process(input, {
    sampleRate: 1000,
    channels: 1,
  });

  console.log(`  After reset, input [1, 2, 3]:`);
  console.log(
    `  Output: [${Array.from(output)
      .map((v) => v.toFixed(3))
      .join(", ")}]`
  );
  console.log(`  (Same as if processing first time)`);
}

// Example 5: Batch vs Moving comparison
console.log("\n5. Batch vs Moving Comparison");
{
  const batchPipeline = createDspPipeline().Variance({ mode: "batch" });
  const movingPipeline = createDspPipeline().Variance({
    mode: "moving",
    windowSize: 5,
  });

  const data = new Float32Array([1, 2, 3, 4, 5]);

  const batchOutput = await batchPipeline.process(data.slice(), {
    sampleRate: 1000,
    channels: 1,
  });
  const movingOutput = await movingPipeline.process(data.slice(), {
    sampleRate: 1000,
    channels: 1,
  });

  console.log(`  Input: [${Array.from(data).join(", ")}]`);
  console.log(`  Batch (all same): ${batchOutput[0].toFixed(3)}`);
  console.log(
    `  Moving (evolving): [${Array.from(movingOutput)
      .map((v) => v.toFixed(3))
      .join(", ")}]`
  );
  console.log("\n  Batch: Single variance for entire dataset");
  console.log("  Moving: Variance evolves as window slides");
}

// Example 6: Multi-channel state
console.log("\n6. Multi-Channel State Management");
{
  const pipeline = createDspPipeline().Variance({
    mode: "moving",
    windowSize: 3,
  });

  // 2-channel interleaved data
  const input = new Float32Array([1, 10, 2, 20, 3, 30, 4, 40, 5, 50]);
  await pipeline.process(input, { sampleRate: 1000, channels: 2 });

  const state = JSON.parse(await pipeline.saveState());

  console.log("  2-channel processing:");
  console.log(
    `    Channel 0 buffer: [${state.stages[0].state.channels[0].buffer.join(
      ", "
    )}]`
  );
  console.log(
    `    Channel 1 buffer: [${state.stages[0].state.channels[1].buffer.join(
      ", "
    )}]`
  );
  console.log("  (Each channel maintains independent state)");
}

console.log("\nKey Takeaways:");
console.log("  - Batch mode: Stateless, computes variance over entire batch");
console.log("  - Moving mode: Stateful, maintains sliding window");
console.log(
  "  - State includes: circular buffer, running sum, running sum of squares"
);
console.log(
  "  - Each channel has independent state for multi-channel processing"
);
