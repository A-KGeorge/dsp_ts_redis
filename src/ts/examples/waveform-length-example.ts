/**
 * Waveform Length Example
 *
 * Demonstrates how to use the waveformLength stage to compute
 * the total path length of a signal over a sliding window.
 *
 * Waveform Length (WL) is useful for:
 * - EMG signal analysis
 * - Detecting signal complexity
 * - Measuring signal variability
 */

import { createDspPipeline } from "../bindings";

async function waveformLengthExample() {
  console.log("=== Waveform Length Example ===\n");

  // Create a pipeline with waveform length computation
  const pipeline = createDspPipeline();

  // Add waveform length stage with a 100-sample window
  pipeline.WaveformLength({ windowSize: 100 });

  // Example 1: Smooth sine wave (low waveform length)
  console.log("Example 1: Smooth Sine Wave");
  const smoothSignal = new Float32Array(200);
  for (let i = 0; i < smoothSignal.length; i++) {
    smoothSignal[i] = Math.sin(i * 0.1);
  }

  await pipeline.process(smoothSignal, { channels: 1 });

  // Average WL in the middle of the signal (after window fills)
  const smoothAvg =
    smoothSignal.slice(100, 150).reduce((a, b) => a + b, 0) / 50;
  console.log(`Average WL (smooth): ${smoothAvg.toFixed(3)}`);
  console.log("Smooth signals have lower waveform length\n");

  // Reset for next example
  pipeline.clearState();

  // Example 2: Noisy signal (high waveform length)
  console.log("Example 2: Noisy Signal");
  const noisySignal = new Float32Array(200);
  for (let i = 0; i < noisySignal.length; i++) {
    noisySignal[i] = Math.sin(i * 0.1) + (Math.random() - 0.5) * 0.5;
  }

  await pipeline.process(noisySignal, { channels: 1 });

  const noisyAvg = noisySignal.slice(100, 150).reduce((a, b) => a + b, 0) / 50;
  console.log(`Average WL (noisy): ${noisyAvg.toFixed(3)}`);
  console.log("Noisy signals have higher waveform length\n");

  // Reset for next example
  pipeline.clearState();

  // Example 3: Multi-channel EMG-like signal
  console.log("Example 3: Multi-Channel Processing (2 channels)");
  const multiChannel = new Float32Array(400); // 200 samples × 2 channels

  for (let i = 0; i < 200; i++) {
    // Channel 0: High-frequency component
    multiChannel[i * 2] = Math.sin(i * 0.3) * Math.exp(-i / 100);

    // Channel 1: Low-frequency component
    multiChannel[i * 2 + 1] = Math.sin(i * 0.05) * 0.5;
  }

  await pipeline.process(multiChannel, { channels: 2 });

  // Extract and analyze each channel separately
  const channel0 = new Float32Array(200);
  const channel1 = new Float32Array(200);
  for (let i = 0; i < 200; i++) {
    channel0[i] = multiChannel[i * 2];
    channel1[i] = multiChannel[i * 2 + 1];
  }

  const ch0Avg = channel0.slice(100, 150).reduce((a, b) => a + b, 0) / 50;
  const ch1Avg = channel1.slice(100, 150).reduce((a, b) => a + b, 0) / 50;

  console.log(`Channel 0 avg WL: ${ch0Avg.toFixed(3)} (high frequency)`);
  console.log(`Channel 1 avg WL: ${ch1Avg.toFixed(3)} (low frequency)`);
  console.log("Higher frequency signals have higher waveform length\n");

  // Example 4: Real-time processing with state persistence
  console.log("Example 4: State Persistence (Redis-ready)");
  pipeline.clearState();

  // Process first batch
  const batch1 = new Float32Array(100);
  for (let i = 0; i < 100; i++) {
    batch1[i] = Math.sin(i * 0.2);
  }
  await pipeline.process(batch1, { channels: 1 });

  // Save state (would be stored in Redis in production)
  const state = await pipeline.saveState();
  console.log("State saved after first batch");

  // Create new pipeline with same structure and restore state
  const newPipeline = createDspPipeline();
  newPipeline.WaveformLength({ windowSize: 100 }); // Must match original pipeline
  await newPipeline.loadState(state);

  // Process second batch with restored state
  const batch2 = new Float32Array(100);
  for (let i = 0; i < 100; i++) {
    batch2[i] = Math.sin((i + 100) * 0.2);
  }
  await newPipeline.process(batch2, { channels: 1 });

  console.log("State restored and processing continued seamlessly\n");

  // Example 5: Chaining with other stages
  console.log("Example 5: Pipeline Chaining");
  const chainPipeline = createDspPipeline();

  // Rectify → Waveform Length
  chainPipeline.Rectify({ mode: "full" });
  chainPipeline.WaveformLength({ windowSize: 50 });

  const chainSignal = new Float32Array(150);
  for (let i = 0; i < 150; i++) {
    chainSignal[i] = Math.sin(i * 0.15) * 2 - 1; // Oscillating signal
  }

  await chainPipeline.process(chainSignal, { channels: 1 });

  const chainAvg = chainSignal.slice(50, 100).reduce((a, b) => a + b, 0) / 50;
  console.log(`WL after rectification: ${chainAvg.toFixed(3)}`);
  console.log("Rectification can change the waveform length characteristics\n");

  console.log("=== Example Complete ===");
}

// Run the example
waveformLengthExample().catch(console.error);
