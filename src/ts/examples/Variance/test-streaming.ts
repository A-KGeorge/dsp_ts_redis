import { createDspPipeline } from "../../index.js";

console.log("Variance Filter - Streaming Examples\n");

// Example 1: Batch variance for signal quality monitoring
console.log("1. Batch Variance for Signal Quality Monitoring");
{
  const pipeline = createDspPipeline().Variance({ mode: "batch" });

  console.log("  Monitoring signal stability across chunks:");

  const chunks = [
    new Float32Array([1, 1.1, 0.9, 1.05, 0.95]), // Stable signal
    new Float32Array([5, 15, 25, 35, 45]), // Increasing signal
    new Float32Array([50, 10, 60, 5, 55]), // Noisy signal
  ];

  for (let i = 0; i < chunks.length; i++) {
    const output = await pipeline.process(chunks[i].slice(), {
      sampleRate: 1000,
      channels: 1,
    });

    const variance = output[0];
    const quality =
      variance < 1 ? "STABLE" : variance < 100 ? "MODERATE" : "NOISY";

    console.log(
      `    Chunk ${i + 1}: variance = ${variance.toFixed(2)} -> ${quality}`
    );
  }
}

// Example 2: Moving variance for real-time variability detection
console.log("\n2. Moving Variance for Real-Time Variability Detection");
{
  const pipeline = createDspPipeline().Variance({
    mode: "moving",
    windowSize: 10,
  });

  console.log("  Detecting variability changes in streaming data:");

  // Simulate streaming sensor data with changing variability
  const chunk1 = new Float32Array(20).map(
    (_, i) => 100 + Math.sin(i * 0.1) * 2
  ); // Low variance
  const chunk2 = new Float32Array(20).map(
    (_, i) => 100 + Math.sin(i * 0.1) * 20
  ); // High variance
  const chunk3 = new Float32Array(20).map(
    (_, i) => 100 + Math.sin(i * 0.1) * 2
  ); // Back to low

  const output1 = await pipeline.process(chunk1, {
    sampleRate: 1000,
    channels: 1,
  });
  const output2 = await pipeline.process(chunk2, {
    sampleRate: 1000,
    channels: 1,
  });
  const output3 = await pipeline.process(chunk3, {
    sampleRate: 1000,
    channels: 1,
  });

  console.log(
    `    Chunk 1 avg variance: ${(
      output1.reduce((a, b) => a + b) / output1.length
    ).toFixed(2)}`
  );
  console.log(
    `    Chunk 2 avg variance: ${(
      output2.reduce((a, b) => a + b) / output2.length
    ).toFixed(2)}`
  );
  console.log(
    `    Chunk 3 avg variance: ${(
      output3.reduce((a, b) => a + b) / output3.length
    ).toFixed(2)}`
  );
  console.log("  (Variance adapts to signal characteristics)");
}

// Example 3: Multi-channel EMG processing with variance
console.log("\n3. Multi-Channel EMG Variance Monitoring");
{
  const pipeline = createDspPipeline().Variance({
    mode: "moving",
    windowSize: 50,
  });

  // Simulate 4-channel EMG data
  const generateEMG = (amplitude: number, length: number) => {
    return new Float32Array(length).map(
      () => (Math.random() - 0.5) * 2 * amplitude
    );
  };

  // Channel 1: High activity, Channel 2: Low activity, etc.
  const ch1 = generateEMG(100, 100);
  const ch2 = generateEMG(20, 100);
  const ch3 = generateEMG(60, 100);
  const ch4 = generateEMG(30, 100);

  // Interleave channels
  const interleaved = new Float32Array(400);
  for (let i = 0; i < 100; i++) {
    interleaved[i * 4] = ch1[i];
    interleaved[i * 4 + 1] = ch2[i];
    interleaved[i * 4 + 2] = ch3[i];
    interleaved[i * 4 + 3] = ch4[i];
  }

  const output = await pipeline.process(interleaved, {
    sampleRate: 2000,
    channels: 4,
  });

  // Calculate average variance per channel
  const avgVariances = [0, 0, 0, 0];
  for (let i = 0; i < output.length; i++) {
    avgVariances[i % 4] += output[i];
  }
  avgVariances.forEach((sum, ch) => {
    avgVariances[ch] = sum / (output.length / 4);
  });

  console.log("  Average variance per muscle channel:");
  avgVariances.forEach((var_, ch) => {
    const activity = var_ > 5000 ? "HIGH" : var_ > 2000 ? "MODERATE" : "LOW";
    console.log(
      `    Channel ${ch}: ${var_.toFixed(0)} -> ${activity} activity`
    );
  });
}

// Example 4: Interrupted processing with state recovery
console.log("\n4. Interrupted Processing with State Recovery");
{
  const pipeline = createDspPipeline().Variance({
    mode: "moving",
    windowSize: 20,
  });

  // Simulate streaming with interruption
  console.log("  Processing stream...");

  // Process first chunk
  const chunk1 = new Float32Array(30).map((_, i) => Math.sin(i * 0.1) * 50);
  await pipeline.process(chunk1, { sampleRate: 1000, channels: 1 });

  // Save state before interruption
  const savedState = await pipeline.saveState();
  console.log("  State saved (simulating service restart)");

  // Simulate restart - create new pipeline
  const pipeline2 = createDspPipeline().Variance({
    mode: "moving",
    windowSize: 20,
  });
  await pipeline2.loadState(savedState);
  console.log("  State restored!");

  // Continue processing
  const chunk2 = new Float32Array(30).map(
    (_, i) => Math.sin((i + 30) * 0.1) * 50
  );
  const output = await pipeline2.process(chunk2, {
    sampleRate: 1000,
    channels: 1,
  });

  console.log(`  Resumed processing: ${output.length} samples processed`);
  console.log("  (Seamless continuation from saved state)");
}

// Example 5: Combining with other filters for feature extraction
console.log("\n5. Feature Extraction Pipeline (Rectify → Variance)");
{
  const pipeline = createDspPipeline()
    .Rectify({ mode: "full" })
    .Variance({ mode: "moving", windowSize: 100 });

  // Simulate biosignal with varying amplitude
  const signal = new Float32Array(200).map((_, i) => {
    const base = Math.sin(i * 0.05) * 100;
    const noise = (Math.random() - 0.5) * 20;
    return base + noise;
  });

  const output = await pipeline.process(signal, {
    sampleRate: 1000,
    channels: 1,
  });

  // Get last 10 variance values
  const recentVariance = Array.from(output.slice(-10));
  const avgVariance =
    recentVariance.reduce((a, b) => a + b) / recentVariance.length;

  console.log(`  Input signal: 200 samples (bipolar with noise)`);
  console.log(`  After Rectify: All positive values`);
  console.log(`  After Variance: Variability measure`);
  console.log(`  Recent avg variance: ${avgVariance.toFixed(2)}`);
  console.log("  (Can detect changes in signal amplitude variability)");
}

// Example 6: Threshold-based alerts
console.log("\n6. Variance-Based Alerting");
{
  const pipeline = createDspPipeline().Variance({
    mode: "moving",
    windowSize: 50,
  });

  const VARIANCE_THRESHOLD = 100;
  let alertCount = 0;

  console.log(`  Monitoring for variance > ${VARIANCE_THRESHOLD}:`);

  // Simulate multiple data chunks
  const chunks = [
    new Float32Array(100).map((_, i) => 50 + Math.sin(i * 0.1) * 5), // Low variance
    new Float32Array(100).map((_, i) => 50 + Math.sin(i * 0.1) * 50), // High variance
    new Float32Array(100).map((_, i) => 50 + Math.sin(i * 0.1) * 10), // Moderate variance
  ];

  for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
    const output = await pipeline.process(chunks[chunkIdx], {
      sampleRate: 1000,
      channels: 1,
    });

    // Check for threshold crossings
    const exceedances = output.filter((v) => v > VARIANCE_THRESHOLD).length;

    if (exceedances > 0) {
      alertCount++;
      console.log(
        `    Chunk ${
          chunkIdx + 1
        }: ALERT - ${exceedances} samples exceeded threshold`
      );
    } else {
      console.log(`    Chunk ${chunkIdx + 1}: OK - variance within limits`);
    }
  }

  console.log(`  Total alerts: ${alertCount}`);
}

console.log("\nStreaming Use Cases:");
console.log("  - Signal quality monitoring (batch variance per chunk)");
console.log("  - Real-time variability detection (moving window)");
console.log("  - Multi-channel muscle activity monitoring (EMG)");
console.log("  - Crash recovery with state persistence");
console.log("  - Feature extraction pipelines (combine with other filters)");
console.log("  - Threshold-based alerting for anomaly detection");
