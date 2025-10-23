import { createDspPipeline } from "../../bindings.js";

console.log("Z-Score Normalize Filter - Streaming Examples\n");

// =============================================================================
// Example 1: Batch Normalization for Data Preprocessing
// =============================================================================
console.log("1. Batch Normalization for Data Preprocessing");

const pipeline1 = createDspPipeline();
pipeline1.ZScoreNormalize({ mode: "batch" });

// Simulate processing chunks of sensor data before machine learning
const chunks = [
  new Float32Array([23.5, 24.1, 23.8, 24.3, 23.9]), // Temperature readings (°C)
  new Float32Array([100, 102, 98, 101, 99]), // Pressure readings (kPa)
  new Float32Array([5.2, 5.5, 5.1, 5.4, 5.3]), // Flow rate (L/min)
];

console.log("  Normalizing sensor data chunks for ML preprocessing:");
for (let i = 0; i < chunks.length; i++) {
  const output = await pipeline1.process(chunks[i].slice(), {
    sampleRate: 100,
    channels: 1,
  });
  const mean = output.reduce((s, v) => s + v, 0) / output.length;
  const variance = output.reduce((s, v) => s + v * v, 0) / output.length;
  console.log(
    `    Chunk ${i + 1}: mean=${mean.toFixed(6)}, variance=${variance.toFixed(
      6
    )} → NORMALIZED`
  );
}
console.log("");

// =============================================================================
// Example 2: Real-Time Anomaly Detection with Moving Z-Score
// =============================================================================
console.log("2. Real-Time Anomaly Detection with Moving Z-Score");

const pipeline2 = createDspPipeline();
pipeline2.ZScoreNormalize({ mode: "moving", windowSize: 50 });

// Simulate streaming temperature data with an anomaly
const normalData = new Float32Array(40)
  .fill(0)
  .map(() => 20 + Math.random() * 2); // Normal: 20-22°C
const anomalyData = new Float32Array(10).fill(0).map(() => 30 + Math.random()); // Anomaly: 30-31°C
const recoveryData = new Float32Array(20)
  .fill(0)
  .map(() => 20 + Math.random() * 2); // Back to normal

const streamData = new Float32Array([
  ...normalData,
  ...anomalyData,
  ...recoveryData,
]);

const zScores = await pipeline2.process(streamData, {
  sampleRate: 10,
  channels: 1,
});

let anomalyCount = 0;
const anomalyThreshold = 3.0; // Standard threshold for outlier detection

console.log("  Monitoring temperature stream for anomalies (z-score > 3.0):");
for (let i = 0; i < zScores.length; i++) {
  if (Math.abs(zScores[i]) > anomalyThreshold) {
    if (anomalyCount === 0) {
      console.log(
        `    🚨 ANOMALY DETECTED at sample ${i}: z-score = ${zScores[i].toFixed(
          2
        )}`
      );
    }
    anomalyCount++;
  }
}
console.log(`  Total anomalies detected: ${anomalyCount}`);
console.log("");

// =============================================================================
// Example 3: Multi-Channel EEG Signal Normalization
// =============================================================================
console.log("3. Multi-Channel EEG Signal Normalization");

const pipeline3 = createDspPipeline();
pipeline3.ZScoreNormalize({ mode: "moving", windowSize: 100 });

// Simulate 4 EEG channels with different amplitudes
const numSamples = 200;
const numChannels = 4;
const eegData = new Float32Array(numSamples * numChannels);

for (let i = 0; i < numSamples; i++) {
  eegData[i * numChannels + 0] = Math.sin(i * 0.1) * 50; // Channel 0: 50µV amplitude
  eegData[i * numChannels + 1] = Math.sin(i * 0.15) * 100; // Channel 1: 100µV amplitude
  eegData[i * numChannels + 2] = Math.sin(i * 0.2) * 25; // Channel 2: 25µV amplitude
  eegData[i * numChannels + 3] = Math.sin(i * 0.25) * 75; // Channel 3: 75µV amplitude
}

const normalizedEEG = await pipeline3.process(eegData, {
  sampleRate: 256,
  channels: numChannels,
});

// Extract last 20 samples of each channel to check normalization
const extractChannel = (data: Float32Array, ch: number, numCh: number) => {
  const result = [];
  for (let i = ch; i < data.length; i += numCh) {
    result.push(data[i]);
  }
  return result.slice(-20);
};

console.log("  Normalized EEG channels (last 20 samples):");
for (let ch = 0; ch < numChannels; ch++) {
  const samples = extractChannel(normalizedEEG, ch, numChannels);
  const mean = samples.reduce((s, v) => s + v, 0) / samples.length;
  const variance = samples.reduce((s, v) => s + v * v, 0) / samples.length;
  console.log(
    `    Channel ${ch}: mean=${mean.toFixed(3)}, variance=${variance.toFixed(
      3
    )}`
  );
}
console.log("");

// =============================================================================
// Example 4: Interrupted Processing with State Recovery
// =============================================================================
console.log("4. Interrupted Processing with State Recovery");

const pipeline4 = createDspPipeline();
pipeline4.ZScoreNormalize({ mode: "moving", windowSize: 30 });

// Process first chunk
const chunk1 = new Float32Array(50).fill(0).map(() => 100 + Math.random() * 20);
await pipeline4.process(chunk1, { sampleRate: 1000, channels: 1 });

console.log("  Processing stream...");

// Save state (simulating service restart or crash recovery)
const savedState = await pipeline4.saveState();
console.log("  State saved (simulating service restart)");

// Create new pipeline and restore state
const pipeline4b = createDspPipeline();
pipeline4b.ZScoreNormalize({ mode: "moving", windowSize: 30 });
await pipeline4b.loadState(savedState);

console.log("  State restored!");

// Continue processing
const chunk2 = new Float32Array(30).fill(0).map(() => 100 + Math.random() * 20);
const output = await pipeline4b.process(chunk2, {
  sampleRate: 1000,
  channels: 1,
});

console.log(`  Resumed processing: ${output.length} samples processed`);
console.log(`  (Seamless continuation from saved state)`);
console.log("");

// =============================================================================
// Example 5: Feature Extraction Pipeline (Rectify → Z-Score)
// =============================================================================
console.log("5. Feature Extraction Pipeline (Rectify → Z-Score)");

const pipeline5 = createDspPipeline();
pipeline5.Rectify({ mode: "full" }).ZScoreNormalize({
  mode: "moving",
  windowSize: 50,
});

// Generate bipolar signal with noise
const signalLength = 200;
const rawSignal = new Float32Array(signalLength);
for (let i = 0; i < signalLength; i++) {
  rawSignal[i] = Math.sin(i * 0.1) * 10 + (Math.random() - 0.5) * 5;
}

const features = await pipeline5.process(rawSignal, {
  sampleRate: 100,
  channels: 1,
});

// Calculate feature statistics
const mean = features.reduce((s, v) => s + v, 0) / features.length;
const variance = features.reduce((s, v) => s + v * v, 0) / features.length;
const recentMean = features.slice(-20).reduce((s, v) => s + v, 0) / 20;

console.log(`  Input signal: ${signalLength} samples (bipolar with noise)`);
console.log(`  After Rectify: All positive values`);
console.log(`  After Z-Score: Normalized features`);
console.log(`  Overall mean: ${mean.toFixed(3)}`);
console.log(`  Overall variance: ${variance.toFixed(3)}`);
console.log(`  Recent avg z-score: ${recentMean.toFixed(3)}`);
console.log(`  (Ready for ML feature extraction)`);
console.log("");

// =============================================================================
// Example 6: Adaptive Threshold Alerting
// =============================================================================
console.log("6. Adaptive Threshold Alerting");

const pipeline6 = createDspPipeline();
pipeline6.ZScoreNormalize({ mode: "moving", windowSize: 50 });

// Simulate streaming data with gradual drift
const generateChunk = (baseline: number, drift: number) => {
  return new Float32Array(100)
    .fill(0)
    .map(() => baseline + drift + (Math.random() - 0.5) * 5);
};

const chunks6 = [
  generateChunk(100, 0), // Baseline
  generateChunk(100, 5), // Small drift
  generateChunk(100, 20), // Significant drift
];

const alertThreshold = 2.5;

console.log(`  Monitoring for z-score > ${alertThreshold}:`);
for (let i = 0; i < chunks6.length; i++) {
  const zScores = await pipeline6.process(chunks6[i], {
    sampleRate: 100,
    channels: 1,
  });

  const alertCount = zScores.filter((z) => Math.abs(z) > alertThreshold).length;

  if (alertCount > 10) {
    console.log(
      `    Chunk ${i + 1}: 🚨 ALERT - ${alertCount} samples exceeded threshold`
    );
  } else {
    console.log(`    Chunk ${i + 1}: ✓ OK - drift within normal range`);
  }
}
console.log("");

// =============================================================================
// Example 7: Streaming Data Standardization for Neural Network
// =============================================================================
console.log("7. Streaming Data Standardization for Neural Network");

const pipeline7 = createDspPipeline();
pipeline7.ZScoreNormalize({ mode: "moving", windowSize: 100 });

// Simulate streaming accelerometer data (3 axes, interleaved)
const streamLength = 300; // 100 samples per axis
const accelData = new Float32Array(streamLength);

for (let i = 0; i < streamLength / 3; i++) {
  accelData[i * 3 + 0] = Math.sin(i * 0.1) * 2 + 9.8; // X-axis (with gravity)
  accelData[i * 3 + 1] = Math.cos(i * 0.1) * 1.5; // Y-axis
  accelData[i * 3 + 2] = Math.sin(i * 0.15) * 1.0; // Z-axis
}

const normalizedAccel = await pipeline7.process(accelData, {
  sampleRate: 50,
  channels: 3,
});

// Verify normalization for each axis
const axes = ["X", "Y", "Z"];
console.log("  Accelerometer data normalized for neural network:");
for (let axis = 0; axis < 3; axis++) {
  const axisData = [];
  for (let i = axis; i < normalizedAccel.length; i += 3) {
    axisData.push(normalizedAccel[i]);
  }
  const mean = axisData.reduce((s, v) => s + v, 0) / axisData.length;
  const variance = axisData.reduce((s, v) => s + v * v, 0) / axisData.length;

  console.log(
    `    ${axes[axis]}-axis: mean=${mean.toFixed(
      4
    )}, variance=${variance.toFixed(4)} → READY`
  );
}
console.log("");

console.log("Streaming Use Cases:");
console.log(
  "  - Data preprocessing: Normalize features before machine learning"
);
console.log(
  "  - Anomaly detection: Identify outliers using z-score thresholds (±3σ)"
);
console.log(
  "  - Multi-channel normalization: EEG, EMG, accelerometer standardization"
);
console.log("  - Crash recovery: Maintain state across service restarts");
console.log(
  "  - Feature extraction: Combine with other filters (Rectify, RMS, etc.)"
);
console.log(
  "  - Adaptive alerting: Detect drift and anomalies in streaming data"
);
console.log(
  "  - Neural network preprocessing: Standardize input features for deep learning"
);
