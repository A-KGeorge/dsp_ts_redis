// src/ts/examples/test-chaining.ts
import { createDspPipeline } from "../../bindings";

async function testChaining() {
  console.log("=== Testing DSP Stage Chaining ===\n");

  const pipeline = createDspPipeline();
  pipeline.MovingAverage({ mode: "moving", windowSize: 3 }).Rms({ mode: "moving", windowSize: 3 }).Rectify();

  console.log("Pipeline: MovingAverage → RMS → Rectify");

  const input = new Float32Array([1, -2, 3, -4, 5, -6]);
  console.log("Input:", Array.from(input));

  // sampleRate REQUIRED, channels optional
  const output = await pipeline.processCopy(input, {
    sampleRate: 1000, // required
    // channels: 1      // optional; defaults to 1
  });

  console.log(
    "Output:",
    Array.from(output).map((v) => v.toFixed(4))
  );

  const state = await pipeline.saveState();
  console.log("\n--- Saved State ---");
  console.log(JSON.stringify(JSON.parse(state), null, 2));

  // Simulate restart
  const pipeline2 = createDspPipeline();
  pipeline2.MovingAverage({ mode: "moving", windowSize: 3 }).Rms({ mode: "moving", windowSize: 3 }).Rectify();

  await pipeline2.loadState(state);
  console.log("\nState restored.");

  const nextInput = new Float32Array([7, -8, 9]);
  const nextOutput = await pipeline2.processCopy(nextInput, {
    sampleRate: 1000, // required
    // channels: 1
  });

  console.log("Next input:", Array.from(nextInput));
  console.log(
    "Next output:",
    Array.from(nextOutput).map((v) => v.toFixed(4))
  );

  console.log("\nChaining test complete!");
}

testChaining().catch(console.error);
