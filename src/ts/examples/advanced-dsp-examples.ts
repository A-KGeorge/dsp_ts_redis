/**
 * Advanced DSP Operations Examples
 *
 * Demonstrates the new advanced DSP features:
 * - Hjorth Parameters (Activity, Mobility, Complexity)
 * - Spectral Features (Centroid, Rolloff, Flux)
 * - Entropy Measures (Shannon, Sample Entropy, Approximate Entropy)
 */

import {
  calculateHjorthParameters,
  calculateSpectralFeatures,
  calculateShannonEntropy,
  calculateSampleEntropy,
  calculateApproximateEntropy,
  HjorthTracker,
  SpectralFeaturesTracker,
  EntropyTracker,
} from "../advanced-dsp.js";
import { FftProcessor } from "../fft.js";

console.log("=== Advanced DSP Operations Examples ===\n");

const sampleRate = 1000; // 1 kHz

// ============================================================
// Example 1: Hjorth Parameters - Signal Complexity Analysis
// ============================================================

console.log("--- Example 1: Hjorth Parameters ---");

// Create test signals with different complexity
const simpleSignal = new Float32Array(200);
const complexSignal = new Float32Array(200);
const noisySignal = new Float32Array(200);

for (let i = 0; i < 200; i++) {
  // Simple: smooth sine wave
  simpleSignal[i] = Math.sin((2 * Math.PI * 5 * i) / sampleRate);

  // Complex: mix of multiple frequencies
  complexSignal[i] =
    Math.sin((2 * Math.PI * 5 * i) / sampleRate) +
    0.5 * Math.sin((2 * Math.PI * 15 * i) / sampleRate) +
    0.3 * Math.sin((2 * Math.PI * 30 * i) / sampleRate);

  // Noisy: sine wave + random noise
  noisySignal[i] =
    Math.sin((2 * Math.PI * 5 * i) / sampleRate) + (Math.random() - 0.5) * 0.3;
}

const hjorthSimple = calculateHjorthParameters(simpleSignal);
const hjorthComplex = calculateHjorthParameters(complexSignal);
const hjorthNoisy = calculateHjorthParameters(noisySignal);

console.log("Simple signal (smooth sine):");
console.log(`  Activity: ${hjorthSimple.activity.toFixed(4)}`);
console.log(`  Mobility: ${hjorthSimple.mobility.toFixed(4)}`);
console.log(`  Complexity: ${hjorthSimple.complexity.toFixed(4)}`);

console.log("\nComplex signal (multi-frequency):");
console.log(`  Activity: ${hjorthComplex.activity.toFixed(4)}`);
console.log(`  Mobility: ${hjorthComplex.mobility.toFixed(4)}`);
console.log(`  Complexity: ${hjorthComplex.complexity.toFixed(4)}`);

console.log("\nNoisy signal:");
console.log(`  Activity: ${hjorthNoisy.activity.toFixed(4)}`);
console.log(`  Mobility: ${hjorthNoisy.mobility.toFixed(4)}`);
console.log(`  Complexity: ${hjorthNoisy.complexity.toFixed(4)}`);

console.log(
  "\n✅ Higher complexity indicates more irregular/unpredictable signal\n"
);

// ============================================================
// Example 2: Hjorth Tracker - Real-Time Monitoring
// ============================================================

console.log("--- Example 2: Hjorth Tracker (Sliding Window) ---");

const tracker = new HjorthTracker(100);

console.log("Processing samples one at a time...");
for (let i = 0; i < 150; i++) {
  const sample =
    Math.sin((2 * Math.PI * 5 * i) / sampleRate) + (Math.random() - 0.5) * 0.1;
  const hjorth = tracker.update(sample);

  if (hjorth && i % 50 === 0) {
    console.log(`  Sample ${i}:`);
    console.log(`    Activity: ${hjorth.activity.toFixed(4)}`);
    console.log(`    Mobility: ${hjorth.mobility.toFixed(4)}`);
    console.log(`    Complexity: ${hjorth.complexity.toFixed(4)}`);
  }
}

console.log("✅ Real-time Hjorth tracking for continuous monitoring\n");

// ============================================================
// Example 3: Spectral Features - Frequency Content Analysis
// ============================================================

console.log("--- Example 3: Spectral Features ---");

// Create test signal with specific frequency content
const fftSize = 2048;
const testSignal = new Float32Array(fftSize);

// Low-frequency dominated signal
for (let i = 0; i < fftSize; i++) {
  testSignal[i] =
    2.0 * Math.sin((2 * Math.PI * 100 * i) / sampleRate) + // Strong 100 Hz
    0.5 * Math.sin((2 * Math.PI * 500 * i) / sampleRate); // Weak 500 Hz
}

// Perform FFT
const fft = new FftProcessor(fftSize);
const spectrum = fft.rfft(testSignal);
const magnitude = fft.getMagnitude(spectrum);

// Calculate spectral features
const features = calculateSpectralFeatures(magnitude, sampleRate);

console.log("Signal with 100 Hz (strong) + 500 Hz (weak):");
console.log(`  Spectral Centroid: ${features.centroid.toFixed(2)} Hz`);
console.log(`  Spectral Rolloff (85%): ${features.rolloff.toFixed(2)} Hz`);
console.log(`  Spectral Flux: ${features.flux.toFixed(4)}`);

console.log("\n✅ Centroid shows center of frequency mass");
console.log("✅ Rolloff shows where most energy is contained\n");

// ============================================================
// Example 4: Spectral Features Tracker - Frame-by-Frame
// ============================================================

console.log("--- Example 4: Spectral Features Tracker ---");

const spectralTracker = new SpectralFeaturesTracker();

// Simulate changing frequency content over frames
console.log("Processing frames with changing frequency content...");

for (let frame = 0; frame < 3; frame++) {
  const frameSignal = new Float32Array(fftSize);
  const baseFreq = 200 + frame * 100; // Frequency increases each frame

  for (let i = 0; i < fftSize; i++) {
    frameSignal[i] = Math.sin((2 * Math.PI * baseFreq * i) / sampleRate);
  }

  const spectrum = fft.rfft(frameSignal);
  const magnitude = fft.getMagnitude(spectrum);
  const frameFeatures = spectralTracker.calculate(magnitude, sampleRate);

  console.log(`  Frame ${frame + 1} (${baseFreq} Hz):`);
  console.log(`    Centroid: ${frameFeatures.centroid.toFixed(2)} Hz`);
  console.log(`    Flux: ${frameFeatures.flux.toFixed(4)}`);
}

console.log("✅ Flux tracks changes in spectrum between consecutive frames\n");

// ============================================================
// Example 5: Shannon Entropy - Signal Randomness
// ============================================================

console.log("--- Example 5: Shannon Entropy ---");

// Deterministic signal (low entropy)
const deterministicSignal = new Float32Array(1000);
for (let i = 0; i < 1000; i++) {
  deterministicSignal[i] = Math.sin((2 * Math.PI * 10 * i) / sampleRate);
}

// Random signal (high entropy)
const randomSignal = new Float32Array(1000);
for (let i = 0; i < 1000; i++) {
  randomSignal[i] = Math.random() * 2 - 1;
}

// Mixed signal (medium entropy)
const mixedSignal = new Float32Array(1000);
for (let i = 0; i < 1000; i++) {
  mixedSignal[i] =
    0.7 * Math.sin((2 * Math.PI * 10 * i) / sampleRate) +
    0.3 * (Math.random() * 2 - 1);
}

const entropyDeterministic = calculateShannonEntropy(deterministicSignal, 256);
const entropyRandom = calculateShannonEntropy(randomSignal, 256);
const entropyMixed = calculateShannonEntropy(mixedSignal, 256);

console.log("Deterministic signal (pure sine):");
console.log(`  Shannon Entropy: ${entropyDeterministic.toFixed(4)} bits`);

console.log("\nRandom signal (uniform noise):");
console.log(`  Shannon Entropy: ${entropyRandom.toFixed(4)} bits`);

console.log("\nMixed signal (sine + noise):");
console.log(`  Shannon Entropy: ${entropyMixed.toFixed(4)} bits`);

console.log("\n✅ Higher entropy = more unpredictable/random signal\n");

// ============================================================
// Example 6: Entropy Tracker - Real-Time Randomness Monitoring
// ============================================================

console.log("--- Example 6: Entropy Tracker ---");

const entropyTracker = new EntropyTracker(200, 128);

console.log(
  "Monitoring entropy as signal transitions from periodic to random..."
);

for (let i = 0; i < 300; i++) {
  // Transition from sine wave to noise
  const noiseLevel = Math.min(i / 300, 1.0);
  const sample =
    (1 - noiseLevel) * Math.sin((2 * Math.PI * 10 * i) / sampleRate) +
    noiseLevel * (Math.random() * 2 - 1);

  const entropy = entropyTracker.update(sample);

  if (entropy !== null && i % 100 === 0) {
    console.log(`  Sample ${i}: Entropy = ${entropy.toFixed(4)} bits`);
  }
}

console.log("✅ Entropy increases as signal becomes more random\n");

// ============================================================
// Example 7: Sample Entropy (SampEn) - Pattern Regularity
// ============================================================

console.log("--- Example 7: Sample Entropy ---");

// Regular periodic signal
const regularSignal = new Float32Array(500);
for (let i = 0; i < 500; i++) {
  regularSignal[i] = Math.sin((2 * Math.PI * 5 * i) / sampleRate);
}

// Chaotic signal (more irregular)
const chaoticSignal = new Float32Array(500);
for (let i = 0; i < 500; i++) {
  chaoticSignal[i] =
    Math.sin((2 * Math.PI * 5 * i) / sampleRate) +
    0.5 * Math.sin((2 * Math.PI * 13.7 * i) / sampleRate) +
    0.3 * Math.sin((2 * Math.PI * 23.1 * i) / sampleRate);
}

try {
  const sampEnRegular = calculateSampleEntropy(regularSignal, 2);
  const sampEnChaotic = calculateSampleEntropy(chaoticSignal, 2);

  console.log("Regular periodic signal:");
  console.log(`  Sample Entropy: ${sampEnRegular.toFixed(4)}`);

  console.log("\nChaotic signal:");
  console.log(`  Sample Entropy: ${sampEnChaotic.toFixed(4)}`);

  console.log(
    "\n✅ Lower SampEn = more regular patterns, Higher SampEn = more chaotic\n"
  );
} catch (error) {
  console.log("Note: SampEn calculation can be computationally intensive\n");
}

// ============================================================
// Example 8: Approximate Entropy (ApEn) - Faster Alternative
// ============================================================

console.log("--- Example 8: Approximate Entropy ---");

const apEnRegular = calculateApproximateEntropy(regularSignal, 2);
const apEnChaotic = calculateApproximateEntropy(chaoticSignal, 2);

console.log("Regular periodic signal:");
console.log(`  Approximate Entropy: ${apEnRegular.toFixed(4)}`);

console.log("\nChaotic signal:");
console.log(`  Approximate Entropy: ${apEnChaotic.toFixed(4)}`);

console.log("\n✅ ApEn is faster than SampEn but may have more bias\n");

// ============================================================
// Example 9: Real-World Application - EMG Signal Analysis
// ============================================================

console.log("--- Example 9: EMG Signal Analysis Use Case ---");

// Simulate EMG signal (muscle activity)
const emgSignal = new Float32Array(2000);
for (let i = 0; i < 2000; i++) {
  // Mix of frequencies typical in EMG (20-450 Hz)
  emgSignal[i] =
    0.3 * Math.sin((2 * Math.PI * 50 * i) / sampleRate) +
    0.5 * Math.sin((2 * Math.PI * 120 * i) / sampleRate) +
    0.4 * Math.sin((2 * Math.PI * 250 * i) / sampleRate) +
    0.2 * (Math.random() * 2 - 1);
}

const emgHjorth = calculateHjorthParameters(emgSignal);
const emgEntropy = calculateShannonEntropy(emgSignal, 256);

console.log("EMG Signal Analysis:");
console.log(`  Hjorth Activity: ${emgHjorth.activity.toFixed(4)}`);
console.log(`  Hjorth Mobility: ${emgHjorth.mobility.toFixed(4)}`);
console.log(`  Hjorth Complexity: ${emgHjorth.complexity.toFixed(4)}`);
console.log(`  Shannon Entropy: ${emgEntropy.toFixed(4)} bits`);

console.log("\n✅ Combined features useful for:");
console.log("   - Muscle fatigue detection (Hjorth Mobility trends)");
console.log("   - Signal quality assessment (Entropy)");
console.log("   - Activity level classification (Hjorth Activity)\n");

// ============================================================
// Example 10: EEG/Biosignal Monitoring Pipeline
// ============================================================

console.log("--- Example 10: Complete Monitoring Pipeline ---");

console.log("Real-time biosignal monitoring:");

const monitoringTracker = new HjorthTracker(250);
const monitoringEntropy = new EntropyTracker(250, 128);

// Simulate streaming data
console.log("Processing 1000 samples in sliding windows...");

let complexityWarnings = 0;
let entropyWarnings = 0;

for (let i = 0; i < 1000; i++) {
  // Simulate changing signal conditions
  const signal =
    Math.sin((2 * Math.PI * 10 * i) / sampleRate) +
    (Math.random() - 0.5) * (i > 500 ? 0.8 : 0.2); // Noise increases halfway

  const hjorth = monitoringTracker.update(signal);
  const entropy = monitoringEntropy.update(signal);

  if (hjorth && entropy !== null && i % 250 === 0) {
    console.log(`  Checkpoint at sample ${i}:`);
    console.log(`    Complexity: ${hjorth.complexity.toFixed(4)}`);
    console.log(`    Entropy: ${entropy.toFixed(4)} bits`);

    // Detect abnormal conditions
    if (hjorth.complexity > 2.0) {
      console.log(`    ⚠️  High complexity detected`);
      complexityWarnings++;
    }
    if (entropy > 6.0) {
      console.log(`    ⚠️  High entropy detected`);
      entropyWarnings++;
    }
  }
}

console.log(`\n✅ Detected ${complexityWarnings} complexity warnings`);
console.log(`✅ Detected ${entropyWarnings} entropy warnings`);
console.log("✅ Real-time monitoring enables early anomaly detection\n");

// ============================================================
// Summary
// ============================================================

console.log("=== Summary ===");

console.log("\n✅ Hjorth Parameters:");
console.log("   - Activity: Signal variance (power)");
console.log("   - Mobility: Rate of change");
console.log("   - Complexity: Change of change (irregularity)");
console.log("   - Use: EMG/EEG analysis, signal quality");

console.log("\n✅ Spectral Features:");
console.log("   - Centroid: Frequency center of mass");
console.log("   - Rolloff: Energy concentration point");
console.log("   - Flux: Frame-to-frame spectral change");
console.log("   - Use: Audio analysis, speech processing");

console.log("\n✅ Entropy Measures:");
console.log("   - Shannon: Amplitude distribution randomness");
console.log("   - Sample Entropy: Pattern regularity");
console.log("   - Approximate Entropy: Faster alternative to SampEn");
console.log("   - Use: Complexity analysis, anomaly detection");

console.log("\n✅ Stateful Trackers:");
console.log("   - HjorthTracker: Sliding window Hjorth parameters");
console.log("   - SpectralFeaturesTracker: Frame-by-frame features");
console.log("   - EntropyTracker: Sliding window entropy");
console.log("   - Use: Real-time monitoring, streaming analysis");

console.log("\n📚 All implemented in pure TypeScript for flexibility!");
console.log(
  "🚀 Use with existing FFT and filter operations for complete DSP pipelines!"
);
