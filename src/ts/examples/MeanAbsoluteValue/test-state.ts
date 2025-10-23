/**
 * Test script for Mean Absolute Value filter state management
 * Demonstrates save/load/clear operations for stateful MAV processing
 */

import { createDspPipeline } from "../../bindings";

async function testMavStateManagement() {
  console.log("=== Testing MAV Filter State Management ===\n");

  // 1. Create pipeline with MAV filter
  const pipeline = createDspPipeline();
  pipeline.MeanAbsoluteValue({ mode: "moving", windowSize: 3 });

  console.log("Pipeline created with MAV filter (window=3)");

  // 2. Process EMG-like signal data
  const input1 = new Float32Array([1, -2, 3, -4, 5]);
  console.log("\nProcessing first batch (simulated EMG):", Array.from(input1));

  const output1 = await pipeline.processCopy(input1, {
    sampleRate: 1000,
    channels: 1,
  });
  console.log(
    "MAV Output:",
    Array.from(output1).map((v) => v.toFixed(2))
  );

  // 3. Save state to JSON
  console.log("\n--- Saving State ---");
  const stateJson = await pipeline.saveState();
  const state = JSON.parse(stateJson);
  console.log("State saved:");
  console.log(JSON.stringify(state, null, 2));

  // 4. Continue processing
  const input2 = new Float32Array([-6, 7, -8]);
  console.log("\nProcessing second batch:", Array.from(input2));

  const output2 = await pipeline.processCopy(input2, {
    sampleRate: 1000,
    channels: 1,
  });
  console.log(
    "MAV Output:",
    Array.from(output2).map((v) => v.toFixed(2))
  );

  // 5. Save state again
  const stateJson2 = await pipeline.saveState();
  console.log("\nState after second batch:");
  console.log(JSON.stringify(JSON.parse(stateJson2), null, 2));

  // 6. Create new pipeline and load state
  console.log("\n--- Creating New Pipeline ---");
  const pipeline2 = createDspPipeline();
  pipeline2.MeanAbsoluteValue({ mode: "moving", windowSize: 3 });

  console.log("Loading previous state...");
  const loaded = await pipeline2.loadState(stateJson2);
  console.log("Load successful:", loaded);

  // 7. Process with restored state
  const input3 = new Float32Array([9, -10]);
  console.log("\nProcessing with restored pipeline:", Array.from(input3));

  const output3 = await pipeline2.processCopy(input3, {
    sampleRate: 1000,
    channels: 1,
  });
  console.log(
    "MAV Output:",
    Array.from(output3).map((v) => v.toFixed(2))
  );

  // 8. Clear state
  console.log("\n--- Clearing State ---");
  pipeline2.clearState();
  console.log("State cleared");

  // 9. Process after clear (should start fresh)
  const input4 = new Float32Array([1, -2, 3]);
  console.log("\nProcessing after clear:", Array.from(input4));

  const output4 = await pipeline2.processCopy(input4, {
    sampleRate: 1000,
    channels: 1,
  });
  console.log(
    "MAV Output (fresh start):",
    Array.from(output4).map((v) => v.toFixed(2))
  );

  console.log("\n✓ State management test complete!");
}

// Run test
testMavStateManagement().catch(console.error);
