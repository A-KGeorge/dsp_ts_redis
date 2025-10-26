/**
 * Filter Design Examples
 *
 * Demonstrates the filter API:
 * - FIR filters (low-pass, high-pass, band-pass, band-stop)
 * - IIR filters (Butterworth, Chebyshev, Biquad EQ)
 * - Direct class methods for creating filters
 */

import { FirFilter, IirFilter } from "../filters.js";

console.log("=== Filter Design Examples ===\n");

const sampleRate = 8000; // 8 kHz

// ============================================================
// Example 1: FIR Low-Pass Filter
// ============================================================

console.log("--- Example 1: FIR Low-Pass Filter ---");

// Using class static method
const firLowpass1 = FirFilter.createLowPass({
  cutoffFrequency: 1000,
  sampleRate,
  order: 51,
  windowType: "hamming",
});

console.log(`✅ FIR Low-pass (1000 Hz, order 51)`);
console.log(`   Coefficients: ${firLowpass1.getCoefficients().length} taps`);

// Method 2: Using class static method (direct)
const firLowpass2 = FirFilter.createLowPass({
  cutoffFrequency: 1000,
  sampleRate,
  order: 51,
  windowType: "hamming",
});

console.log(`✅ Same filter using FirFilter.createLowPass()`);

// Test with sample data
const testSignal = new Float32Array(100);
for (let i = 0; i < testSignal.length; i++) {
  // Mix 500 Hz (pass) + 2000 Hz (reject)
  testSignal[i] =
    Math.sin((2 * Math.PI * 500 * i) / sampleRate) +
    Math.sin((2 * Math.PI * 2000 * i) / sampleRate);
}

const filtered = await firLowpass1.process(testSignal);
console.log(
  `   Filtered ${testSignal.length} samples (2 kHz component attenuated)\n`
);

// ============================================================
// Example 2: FIR High-Pass Filter
// ============================================================

console.log("--- Example 2: FIR High-Pass Filter ---");

const firHighpass = FirFilter.createHighPass({
  cutoffFrequency: 2000,
  sampleRate,
  order: 61,
  windowType: "hann",
});

console.log(`✅ FIR High-pass (2000 Hz, order 61, Hann window)`);
console.log(`   Coefficients: ${firHighpass.getCoefficients().length} taps\n`);

// ============================================================
// Example 3: FIR Band-Pass Filter (Voice Band)
// ============================================================

console.log("--- Example 3: FIR Band-Pass Filter (Voice Band) ---");

const voiceBandpass = FirFilter.createBandPass({
  lowCutoffFrequency: 300,
  highCutoffFrequency: 3400,
  sampleRate,
  order: 101,
  windowType: "blackman",
});

console.log(`✅ Voice band-pass (300-3400 Hz, order 101, Blackman window)`);
console.log(`   Coefficients: ${voiceBandpass.getCoefficients().length} taps`);
console.log(`   Use case: Telephone/voice communication\n`);

// ============================================================
// Example 4: FIR Band-Stop (Notch) Filter
// ============================================================

console.log("--- Example 4: FIR Band-Stop (Notch) Filter ---");

// Remove 50 Hz powerline hum
const notch50Hz = FirFilter.createBandStop({
  lowCutoffFrequency: 48,
  highCutoffFrequency: 52,
  sampleRate,
  order: 201,
  windowType: "hamming",
});

console.log(`✅ 50 Hz notch filter (48-52 Hz, order 201)`);
console.log(`   Coefficients: ${notch50Hz.getCoefficients().length} taps`);
console.log(`   Use case: Remove powerline interference\n`);

// ============================================================
// Example 5: Butterworth Low-Pass Filter
// ============================================================

console.log("--- Example 5: Butterworth Low-Pass Filter ---");

const butterworthLowpass = IirFilter.createButterworthLowPass({
  cutoffFrequency: 1000,
  sampleRate,
  order: 4,
});

console.log(`✅ Butterworth low-pass (1000 Hz, 4th-order)`);
console.log(
  `   B coefficients: ${butterworthLowpass.getBCoefficients().length}`
);
console.log(
  `   A coefficients: ${butterworthLowpass.getACoefficients().length}`
);
console.log(`   Stable: ${butterworthLowpass.isStable()}`);
console.log(`   Characteristics: Maximally flat passband\n`);

// ============================================================
// Example 6: Butterworth High-Pass Filter
// ============================================================

console.log("--- Example 6: Butterworth High-Pass Filter ---");

const butterworthHighpass = IirFilter.createButterworthHighPass({
  cutoffFrequency: 500,
  sampleRate,
  order: 2,
});

console.log(`✅ Butterworth high-pass (500 Hz, 2nd-order)`);
console.log(`   Use case: Remove DC offset and low-frequency drift\n`);

// ============================================================
// Example 7: Butterworth Band-Pass Filter
// ============================================================

console.log("--- Example 7: Butterworth Band-Pass Filter ---");

const butterworthBandpass = IirFilter.createButterworthBandPass({
  lowCutoffFrequency: 1000,
  highCutoffFrequency: 2000,
  sampleRate,
  order: 3,
});

console.log(`✅ Butterworth band-pass (1000-2000 Hz, 3rd-order)`);
console.log(
  `   Total order: ${butterworthBandpass.getOrder()} (2x3 = 6th-order)`
);
console.log(`   Use case: Extract specific frequency band\n`);

// ============================================================
// Example 8: First-Order IIR Filters
// ============================================================

console.log("--- Example 8: First-Order IIR Filters ---");

const simpleLP = IirFilter.createFirstOrderLowPass({
  cutoffFrequency: 1000,
  sampleRate,
});

const simpleHP = IirFilter.createFirstOrderHighPass({
  cutoffFrequency: 100,
  sampleRate,
});

console.log(`✅ First-order low-pass (1000 Hz)`);
console.log(`   Simple RC filter, gentle rolloff (-20 dB/decade)`);
console.log(`✅ First-order high-pass (100 Hz)`);
console.log(`   Use case: Fast, low-latency filtering\n`);

// ============================================================
// Example 9: Comparing FIR vs IIR Performance
// ============================================================

console.log("--- Example 9: FIR vs IIR Performance Comparison ---");

const fir = FirFilter.createLowPass({
  cutoffFrequency: 1000,
  sampleRate,
  order: 51,
});

const iir = IirFilter.createButterworthLowPass({
  cutoffFrequency: 1000,
  sampleRate,
  order: 4,
});

console.log("FIR (51 taps):");
console.log(
  `  - Coefficients: ${
    fir.getCoefficients().length
  } (multiply-accumulates per sample)`
);
console.log(`  - Always stable`);
console.log(`  - Linear phase possible`);

console.log("\nIIR (4th-order Butterworth):");
console.log(
  `  - B coefficients: ${iir.getBCoefficients().length}, A coefficients: ${
    iir.getACoefficients().length
  }`
);
console.log(`  - Much more efficient (fewer operations)`);
console.log(`  - Non-linear phase`);
console.log(`  - Stable: ${iir.isStable()}\n`);

// ============================================================
// Example 10: Real-Time Filtering
// ============================================================

console.log("--- Example 10: Real-Time Filtering ---");

const realtimeFilter = IirFilter.createButterworthLowPass({
  cutoffFrequency: 1000,
  sampleRate,
  order: 4,
});

console.log("Simulating real-time sample-by-sample processing:");

// Simulate streaming samples
for (let i = 0; i < 10; i++) {
  const input = Math.sin((2 * Math.PI * 500 * i) / sampleRate);
  const output = await realtimeFilter.processSample(input);

  if (i < 5) {
    console.log(
      `  Sample ${i}: in=${input.toFixed(4)}, out=${output.toFixed(4)}`
    );
  }
}
console.log("  ...");
console.log(`✅ Processed 10 samples sample-by-sample\n`);

// ============================================================
// Example 11: Filter State Management
// ============================================================

console.log("--- Example 11: Filter State Management ---");

const statefulFilter = FirFilter.createLowPass({
  cutoffFrequency: 1000,
  sampleRate,
  order: 31,
});

// Process first batch
const batch1 = new Float32Array(50);
for (let i = 0; i < batch1.length; i++) {
  batch1[i] = Math.sin((2 * Math.PI * 500 * i) / sampleRate);
}

const out1 = await statefulFilter.process(batch1);
console.log(`✅ Processed batch 1: ${batch1.length} samples`);

// Process second batch (state is maintained)
const batch2 = new Float32Array(50);
for (let i = 0; i < batch2.length; i++) {
  batch2[i] = Math.sin((2 * Math.PI * 500 * (i + 50)) / sampleRate);
}

const out2 = await statefulFilter.process(batch2);
console.log(
  `✅ Processed batch 2: ${batch2.length} samples (state maintained)`
);

// Reset state
statefulFilter.reset();
console.log(`✅ Reset filter state\n`);

// ============================================================
// Summary
// ============================================================

console.log("=== Summary ===");
console.log("\n✅ FIR Filters:");
console.log("   - Low-pass, High-pass, Band-pass, Band-stop/Notch");
console.log("   - Window types: Hamming, Hann, Blackman, Bartlett");
console.log("   - Always stable, linear phase possible");
console.log("   - More taps = sharper transition, more computation");

console.log("\n✅ IIR Filters:");
console.log("   - Butterworth: Maximally flat passband");
console.log("   - Chebyshev: Sharper rolloff with passband ripple");
console.log("   - First-order: Simple, fast, gentle rolloff");
console.log("   - More efficient than FIR (fewer coefficients)");
console.log("   - Non-linear phase, can be unstable");

console.log("\n✅ Filter API:");
console.log("   - FirFilter.createLowPass/HighPass/BandPass/BandStop()");
console.log("   - IirFilter.createButterworthX() - Maximally flat");
console.log("   - IirFilter.createChebyshevX() - Sharp rolloff");
console.log("   - IirFilter.createPeakingEQ/LowShelf/HighShelf() - Biquad EQ");

console.log("\n✅ Use Cases:");
console.log("   - Audio: FIR with Hann/Hamming window");
console.log("   - Real-time: IIR Butterworth (low latency)");
console.log("   - Voice band: 300-3400 Hz band-pass");
console.log("   - Powerline removal: 50/60 Hz notch filter");
console.log("   - DC removal: High-pass filter");

console.log("\n📚 All filter design math is done in C++ for performance!");
console.log("🚀 SIMD-optimized convolution for FIR filters!");
