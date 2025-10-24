/**
 * EMG Feature Extraction Example
 *
 * Demonstrates how to use SSC, WAMP, and Waveform Length together
 * for comprehensive EMG signal analysis.
 *
 * These features are commonly used in:
 * - Muscle activity detection
 * - Gesture recognition
 * - Prosthetic control
 * - Rehabilitation monitoring
 */

import { createDspPipeline } from "../bindings";

async function emgFeaturesExample() {
  console.log("=== EMG Feature Extraction Example ===\n");

  // Example 1: Individual Feature Analysis
  console.log("Example 1: Computing Individual EMG Features\n");

  // Create pipelines for each feature
  const sscPipeline = createDspPipeline();
  const wampPipeline = createDspPipeline();
  const wlPipeline = createDspPipeline();

  // Window size: 250 samples (typical for EMG at 1kHz = 250ms window)
  const windowSize = 250;

  sscPipeline.SlopeSignChange({
    windowSize,
    threshold: 0.01, // Small threshold to filter noise
  });

  wampPipeline.WillisonAmplitude({
    windowSize,
    threshold: 0.05, // Threshold for significant amplitude changes
  });

  wlPipeline.WaveformLength({
    windowSize,
  });

  // Generate synthetic EMG-like signal (burst of activity)
  const signal = new Float32Array(500);
  for (let i = 0; i < 500; i++) {
    // Resting phase (0-150)
    if (i < 150) {
      signal[i] = (Math.random() - 0.5) * 0.02; // Low noise
    }
    // Active phase (150-350)
    else if (i < 350) {
      const envelope = Math.sin(((i - 150) * Math.PI) / 200); // Smooth envelope
      signal[i] = envelope * Math.sin(i * 0.5) + (Math.random() - 0.5) * 0.1;
    }
    // Recovery phase (350-500)
    else {
      signal[i] = (Math.random() - 0.5) * 0.03; // Low noise
    }
  }

  // Process with each feature extractor
  const sscResult = new Float32Array(signal);
  const wampResult = new Float32Array(signal);
  const wlResult = new Float32Array(signal);

  await sscPipeline.process(sscResult, { channels: 1 });
  await wampPipeline.process(wampResult, { channels: 1 });
  await wlPipeline.process(wlResult, { channels: 1 });

  // Analyze features at different phases
  const restingIdx = 200; // Middle of resting phase
  const activeIdx = 250; // Middle of active phase
  const recoveryIdx = 400; // Middle of recovery phase

  console.log("Resting Phase (low activity):");
  console.log(`  SSC: ${sscResult[restingIdx].toFixed(2)}`);
  console.log(`  WAMP: ${wampResult[restingIdx].toFixed(2)}`);
  console.log(`  WL: ${wlResult[restingIdx].toFixed(4)}\n`);

  console.log("Active Phase (high activity):");
  console.log(`  SSC: ${sscResult[activeIdx].toFixed(2)}`);
  console.log(`  WAMP: ${wampResult[activeIdx].toFixed(2)}`);
  console.log(`  WL: ${wlResult[activeIdx].toFixed(4)}\n`);

  console.log("Recovery Phase (returning to rest):");
  console.log(`  SSC: ${sscResult[recoveryIdx].toFixed(2)}`);
  console.log(`  WAMP: ${wampResult[recoveryIdx].toFixed(2)}`);
  console.log(`  WL: ${wlResult[recoveryIdx].toFixed(4)}\n`);

  // Example 2: Multi-Channel EMG (e.g., multiple muscles)
  console.log("Example 2: Multi-Channel EMG Analysis\n");

  const multiPipeline = createDspPipeline();
  multiPipeline.SlopeSignChange({
    windowSize: 200,
    threshold: 0.01,
  });

  // 3 channels representing different muscles
  const numChannels = 3;
  const numSamples = 300;
  const multiSignal = new Float32Array(numSamples * numChannels);

  for (let i = 0; i < numSamples; i++) {
    // Channel 0: Biceps (active early)
    const bicepsActivity = i < 150 ? Math.sin(i * 0.3) * (i / 150) : 0.1;
    multiSignal[i * numChannels] =
      bicepsActivity + (Math.random() - 0.5) * 0.05;

    // Channel 1: Triceps (active later)
    const tricepsActivity =
      i > 150 ? Math.sin(i * 0.3) * ((numSamples - i) / 150) : 0.1;
    multiSignal[i * numChannels + 1] =
      tricepsActivity + (Math.random() - 0.5) * 0.05;

    // Channel 2: Forearm (continuously active)
    const forearmActivity = Math.sin(i * 0.2) * 0.5;
    multiSignal[i * numChannels + 2] =
      forearmActivity + (Math.random() - 0.5) * 0.03;
  }

  await multiPipeline.process(multiSignal, { channels: numChannels });

  // Extract features at a specific time point
  const timeIdx = 250;
  console.log(`SSC at sample ${timeIdx}:`);
  console.log(
    `  Biceps (Ch0): ${multiSignal[timeIdx * numChannels].toFixed(2)}`
  );
  console.log(
    `  Triceps (Ch1): ${multiSignal[timeIdx * numChannels + 1].toFixed(2)}`
  );
  console.log(
    `  Forearm (Ch2): ${multiSignal[timeIdx * numChannels + 2].toFixed(2)}\n`
  );

  // Example 3: Real-time Feature Extraction with Buffering
  console.log("Example 3: Real-time Processing Simulation\n");

  const realtimePipeline = createDspPipeline();
  realtimePipeline.Rectify({ mode: "full" });
  realtimePipeline.WillisonAmplitude({
    windowSize: 100,
    threshold: 0.05,
  });

  console.log("Processing 5 consecutive batches of 50 samples each:");

  for (let batch = 0; batch < 5; batch++) {
    const batchData = new Float32Array(50);

    // Simulate different activity levels per batch
    const intensity = batch === 2 ? 1.5 : 0.5; // High activity in batch 2

    for (let i = 0; i < 50; i++) {
      batchData[i] =
        Math.sin(i * 0.4) * intensity + (Math.random() - 0.5) * 0.1;
    }

    await realtimePipeline.process(batchData, { channels: 1 });

    // Get the last value (most recent feature value)
    const currentFeature = batchData[batchData.length - 1];
    console.log(`  Batch ${batch + 1}: WAMP = ${currentFeature.toFixed(2)}`);
  }

  console.log();

  // Example 4: Feature-based Activity Detection
  console.log("Example 4: Activity Detection Threshold\n");

  const detectorPipeline = createDspPipeline();
  detectorPipeline.WaveformLength({ windowSize: 150 });

  const testSignal = new Float32Array(400);
  for (let i = 0; i < 400; i++) {
    // Simulate muscle contraction from sample 150-250
    const isActive = i >= 150 && i <= 250;
    const amplitude = isActive ? 1.0 : 0.1;
    testSignal[i] =
      Math.sin(i * 0.3) * amplitude + (Math.random() - 0.5) * 0.05;
  }

  await detectorPipeline.process(testSignal, { channels: 1 });

  // Define threshold for activity detection
  const activityThreshold = 5.0;

  let activityStart = -1;
  let activityEnd = -1;

  for (let i = 0; i < testSignal.length; i++) {
    if (testSignal[i] > activityThreshold && activityStart === -1) {
      activityStart = i;
    }
    if (
      testSignal[i] < activityThreshold &&
      activityStart !== -1 &&
      activityEnd === -1
    ) {
      activityEnd = i;
    }
  }

  console.log(
    `Activity detected from sample ${activityStart} to ${activityEnd}`
  );
  console.log(`Duration: ${activityEnd - activityStart} samples`);
  console.log(`Expected activity: samples 150-250\n`);

  // Example 5: Feature Comparison for Classification
  console.log("Example 5: Feature Vector for Classification\n");

  const featurePipeline1 = createDspPipeline();
  const featurePipeline2 = createDspPipeline();
  const featurePipeline3 = createDspPipeline();

  featurePipeline1.SlopeSignChange({
    windowSize: 200,
    threshold: 0,
  });
  featurePipeline2.WillisonAmplitude({
    windowSize: 200,
    threshold: 0.03,
  });
  featurePipeline3.WaveformLength({ windowSize: 200 });

  // Two different gesture patterns
  const gesture1 = new Float32Array(300);
  const gesture2 = new Float32Array(300);

  // Gesture 1: Fast oscillation
  for (let i = 0; i < 300; i++) {
    gesture1[i] = Math.sin(i * 0.5) * 0.8;
  }

  // Gesture 2: Slow oscillation with bursts
  for (let i = 0; i < 300; i++) {
    const burst = Math.floor(i / 60) % 2 === 0 ? 1.0 : 0.3;
    gesture2[i] = Math.sin(i * 0.1) * burst;
  }

  // Process each gesture
  const g1ssc = new Float32Array(gesture1);
  const g1wamp = new Float32Array(gesture1);
  const g1wl = new Float32Array(gesture1);

  await featurePipeline1.process(g1ssc, { channels: 1 });
  await featurePipeline2.process(g1wamp, { channels: 1 });
  await featurePipeline3.process(g1wl, { channels: 1 });

  featurePipeline1.clearState();
  featurePipeline2.clearState();
  featurePipeline3.clearState();

  const g2ssc = new Float32Array(gesture2);
  const g2wamp = new Float32Array(gesture2);
  const g2wl = new Float32Array(gesture2);

  await featurePipeline1.process(g2ssc, { channels: 1 });
  await featurePipeline2.process(g2wamp, { channels: 1 });
  await featurePipeline3.process(g2wl, { channels: 1 });

  // Extract features at middle of signals
  const midIdx = 250;

  console.log("Gesture 1 (fast oscillation) features:");
  console.log(`  SSC: ${g1ssc[midIdx].toFixed(2)}`);
  console.log(`  WAMP: ${g1wamp[midIdx].toFixed(2)}`);
  console.log(`  WL: ${g1wl[midIdx].toFixed(4)}\n`);

  console.log("Gesture 2 (slow with bursts) features:");
  console.log(`  SSC: ${g2ssc[midIdx].toFixed(2)}`);
  console.log(`  WAMP: ${g2wamp[midIdx].toFixed(2)}`);
  console.log(`  WL: ${g2wl[midIdx].toFixed(4)}\n`);

  console.log("These feature vectors can be used for ML classification!\n");

  console.log("=== Example Complete ===");
}

// Run the example
emgFeaturesExample().catch(console.error);
