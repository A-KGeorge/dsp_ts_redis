/**
 * Test script for Rectify state management (save/load/clear)
 */

import { createDspPipeline } from "../../bindings.js";

async function testRectifyStateManagement() {
  console.log("=== Testing Rectify Pipeline State Management ===\n");

  // Test 1: Full-wave rectification (default)
  console.log("--- Test 1: Full-Wave Rectification (Default) ---");
  const pipelineFull = createDspPipeline();
  pipelineFull.Rectify(); // Default is full-wave

  const inputFull = new Float32Array([1, -2, 3, -4, 5, -6]);
  console.log("Input:", Array.from(inputFull));

  const outputFull = await pipelineFull.processCopy(inputFull, {
    sampleRate: 1000,
    channels: 1,
  });
  console.log(
    "Output (full-wave):",
    Array.from(outputFull).map((v) => v.toFixed(1))
  );
  console.log(
    "Expected: [1.0, 2.0, 3.0, 4.0, 5.0, 6.0] (all positive, absolute values)\n"
  );

  // Test 2: Half-wave rectification
  console.log("--- Test 2: Half-Wave Rectification ---");
  const pipelineHalf = createDspPipeline();
  pipelineHalf.Rectify({ mode: "half" });

  const inputHalf = new Float32Array([1, -2, 3, -4, 5, -6]);
  console.log("Input:", Array.from(inputHalf));

  const outputHalf = await pipelineHalf.processCopy(inputHalf, {
    sampleRate: 1000,
    channels: 1,
  });
  console.log(
    "Output (half-wave):",
    Array.from(outputHalf).map((v) => v.toFixed(1))
  );
  console.log(
    "Expected: [1.0, 0.0, 3.0, 0.0, 5.0, 0.0] (negatives become zero)\n"
  );

  // Test 3: State serialization (full-wave)
  console.log("--- Test 3: State Serialization (Full-Wave) ---");
  const stateFull = await pipelineFull.saveState();
  const parsedStateFull = JSON.parse(stateFull);
  console.log("Saved state:");
  console.log(JSON.stringify(parsedStateFull, null, 2));
  console.log(`Mode: ${parsedStateFull.stages[0].state.mode}\n`);

  // Test 4: State serialization (half-wave)
  console.log("--- Test 4: State Serialization (Half-Wave) ---");
  const stateHalf = await pipelineHalf.saveState();
  const parsedStateHalf = JSON.parse(stateHalf);
  console.log("Saved state:");
  console.log(JSON.stringify(parsedStateHalf, null, 2));
  console.log(`Mode: ${parsedStateHalf.stages[0].state.mode}\n`);

  // Test 5: Load state and verify mode preservation
  console.log("--- Test 5: Load State & Verify Mode ---");
  const pipelineNew = createDspPipeline();
  pipelineNew.Rectify(); // Start with full-wave

  console.log("Loading half-wave state into new pipeline...");
  await pipelineNew.loadState(stateHalf);

  const testInput = new Float32Array([2, -3, 4, -5]);
  const testOutput = await pipelineNew.processCopy(testInput, {
    sampleRate: 1000,
    channels: 1,
  });
  console.log("Input:", Array.from(testInput));
  console.log(
    "Output:",
    Array.from(testOutput).map((v) => v.toFixed(1))
  );
  console.log("Expected: [2.0, 0.0, 4.0, 0.0] (half-wave mode preserved)\n");

  // Test 6: Clear state (no effect on Rectify, but tests the interface)
  console.log("--- Test 6: Clear State ---");
  pipelineNew.clearState();
  console.log("State cleared (Rectify has no internal buffers)\n");

  // Process after clear - should still work with same mode
  const afterClear = await pipelineNew.processCopy(new Float32Array([1, -2]), {
    sampleRate: 1000,
    channels: 1,
  });
  console.log("After clear, input: [1, -2]");
  console.log(
    "Output:",
    Array.from(afterClear).map((v) => v.toFixed(1))
  );
  console.log("Mode still preserved after clear\n");

  console.log("Rectify state management test complete!");
}

// Run test
testRectifyStateManagement().catch(console.error);
