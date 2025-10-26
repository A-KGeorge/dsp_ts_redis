/**
 * FFT Examples - Demonstrating Radix-2 Handling and Windowing
 *
 * This example demonstrates:
 * 1. Power-of-2 requirement and auto-padding
 * 2. FFT vs DFT performance comparison
 * 3. Windowing for spectral leakage reduction
 * 4. Practical audio analysis scenarios
 */

import {
  FftProcessor,
  MovingFftProcessor,
  FftUtils,
  type ComplexArray,
} from "../fft.js";

console.log("=== FFT Examples: Radix-2 and Windowing ===\n");

// ============================================================
// Example 1: Power-of-2 Requirement
// ============================================================

console.log("--- Example 1: Power-of-2 Requirement ---");

// Generate a signal with non-power-of-2 length
const signalLength = 1000; // Not a power of 2!
const rawSignal = new Float32Array(signalLength);
for (let i = 0; i < signalLength; i++) {
  rawSignal[i] = Math.sin((2 * Math.PI * 10 * i) / 1000); // 10 Hz sine wave
}

console.log(`Original signal length: ${signalLength}`);
console.log(`Is power of 2: ${FftUtils.isPowerOfTwo(signalLength)}`);

// Try to use FFT directly (this will fail)
try {
  const badFft = new FftProcessor(signalLength);
  badFft.rfft(rawSignal);
  console.log("❌ This should have thrown an error!");
} catch (error) {
  console.log(`✅ Expected error: ${(error as Error).message}`);
}

// Solution 1: Auto-padding (recommended)
console.log("\n✅ Solution 1: Auto-padding");
const padded = FftUtils.padToPowerOfTwo(rawSignal);
console.log(`Padded length: ${padded.length}`);
console.log(`Is power of 2: ${FftUtils.isPowerOfTwo(padded.length)}`);

const fftWithPadding = new FftProcessor(padded.length);
const spectrum1 = fftWithPadding.rfft(padded);
console.log(`Spectrum size: ${spectrum1.real.length} bins`);

// Solution 2: Use DFT (slower but exact)
console.log("\n✅ Solution 2: Use DFT");
const dftProcessor = new FftProcessor(signalLength);
const spectrum2 = dftProcessor.rdft(rawSignal);
console.log(`Spectrum size: ${spectrum2.real.length} bins`);

// ============================================================
// Example 2: FFT vs DFT Performance Comparison
// ============================================================

console.log("\n--- Example 2: FFT vs DFT Performance ---");

const sizes = [256, 1024, 4096];

for (const size of sizes) {
  const testSignal = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    testSignal[i] = Math.random();
  }

  // FFT timing
  const fft = new FftProcessor(size);
  const fftStart = performance.now();
  for (let i = 0; i < 100; i++) {
    fft.rfft(testSignal);
  }
  const fftTime = (performance.now() - fftStart) / 100;

  // DFT timing
  const dft = new FftProcessor(size);
  const dftStart = performance.now();
  for (let i = 0; i < 10; i++) {
    // Only 10 iterations for DFT (it's slow!)
    dft.rdft(testSignal);
  }
  const dftTime = (performance.now() - dftStart) / 10;

  const speedup = dftTime / fftTime;
  console.log(
    `Size ${size}: FFT=${fftTime.toFixed(3)}ms, DFT=${dftTime.toFixed(
      3
    )}ms, Speedup=${speedup.toFixed(1)}x`
  );
}

// ============================================================
// Example 3: Windowing for Spectral Leakage Reduction
// ============================================================

console.log("\n--- Example 3: Windowing Effects ---");

const fftSize = 1024;
const sampleRate = 8000; // 8 kHz

// Generate a pure tone (100 Hz) with some noise
const pureSignal = new Float32Array(fftSize);
const targetFreq = 100; // Hz
for (let i = 0; i < fftSize; i++) {
  pureSignal[i] =
    Math.sin((2 * Math.PI * targetFreq * i) / sampleRate) + 0.1 * Math.random(); // Add 10% noise
}

console.log(
  `\nAnalyzing ${targetFreq} Hz tone at ${sampleRate} Hz sample rate`
);

// Test different window types
const windowTypes = ["none", "hann", "hamming", "blackman"] as const;

for (const windowType of windowTypes) {
  const fft = new MovingFftProcessor({
    fftSize,
    windowType,
    realInput: true,
  });

  // Add all samples at once
  fft.addSamples(pureSignal, () => {});

  // Force computation
  fft.computeSpectrum();
  const magnitudes = fft.getMagnitudeSpectrum();
  const freqs = fft.getFrequencyBins(sampleRate);

  // Find peak
  let maxIdx = 0;
  let maxMag = 0;
  for (let i = 0; i < magnitudes.length; i++) {
    if (magnitudes[i] > maxMag) {
      maxMag = magnitudes[i];
      maxIdx = i;
    }
  }

  const peakFreq = freqs[maxIdx];

  // Calculate total power in neighboring bins (leakage indicator)
  let leakagePower = 0;
  const peakBin = Math.round((targetFreq * fftSize) / sampleRate);
  for (let i = peakBin - 5; i <= peakBin + 5; i++) {
    if (i >= 0 && i < magnitudes.length && i !== peakBin) {
      leakagePower += magnitudes[i] * magnitudes[i];
    }
  }

  console.log(
    `Window: ${windowType.padEnd(8)} | Peak: ${peakFreq.toFixed(
      2
    )} Hz | Leakage: ${leakagePower.toFixed(6)}`
  );
}

// ============================================================
// Example 4: Practical Audio Spectral Analysis
// ============================================================

console.log("\n--- Example 4: Audio Spectral Analysis ---");

// Simulate audio with multiple frequencies
const audioLength = 4096;
const audioSampleRate = 44100; // 44.1 kHz
const audioSignal = new Float32Array(audioLength);

// Mix: 440 Hz (A4) + 880 Hz (A5) + 1320 Hz (E6)
const frequencies = [440, 880, 1320];
for (let i = 0; i < audioLength; i++) {
  audioSignal[i] = 0;
  for (const freq of frequencies) {
    audioSignal[i] +=
      Math.sin((2 * Math.PI * freq * i) / audioSampleRate) / frequencies.length;
  }
}

// Analyze with Hann windowing (standard for audio)
const audioFft = new MovingFftProcessor({
  fftSize: audioLength,
  windowType: "hann", // ✅ Recommended for audio
  realInput: true,
});

audioFft.addSamples(audioSignal, () => {});
audioFft.computeSpectrum();

const audioMagnitudes = audioFft.getMagnitudeSpectrum();
const audioFreqs = audioFft.getFrequencyBins(audioSampleRate);
const audioDb = FftUtils.toDecibels(audioMagnitudes);

// Find top 3 peaks
interface Peak {
  frequency: number;
  magnitude: number;
  db: number;
}

const peaks: Peak[] = [];
for (let i = 1; i < audioMagnitudes.length - 1; i++) {
  // Local maxima
  if (
    audioMagnitudes[i] > audioMagnitudes[i - 1] &&
    audioMagnitudes[i] > audioMagnitudes[i + 1]
  ) {
    if (audioMagnitudes[i] > 0.01) {
      // Threshold
      peaks.push({
        frequency: audioFreqs[i],
        magnitude: audioMagnitudes[i],
        db: audioDb[i],
      });
    }
  }
}

peaks.sort((a, b) => b.magnitude - a.magnitude);

console.log("\nDetected frequencies:");
for (let i = 0; i < Math.min(3, peaks.length); i++) {
  console.log(
    `${i + 1}. ${peaks[i].frequency.toFixed(2)} Hz (${peaks[i].db.toFixed(
      2
    )} dB, mag=${peaks[i].magnitude.toFixed(4)})`
  );
}

// ============================================================
// Example 5: Streaming Spectrogram
// ============================================================

console.log("\n--- Example 5: Streaming Spectrogram ---");

const spectrogramFft = new MovingFftProcessor({
  fftSize: 512,
  hopSize: 128, // 75% overlap
  mode: "batched",
  windowType: "hann",
  realInput: true,
});

// Simulate streaming audio (2 seconds at 8 kHz)
const streamDuration = 2.0; // seconds
const streamSampleRate = 8000;
const totalSamples = streamDuration * streamSampleRate;
const chunkSize = 512;

console.log(
  `\nStreaming ${streamDuration}s of audio at ${streamSampleRate} Hz`
);
console.log(`Chunk size: ${chunkSize}, FFT size: 512, Hop: 128 (75% overlap)`);

let frameCount = 0;
for (let offset = 0; offset < totalSamples; offset += chunkSize) {
  const chunk = new Float32Array(chunkSize);

  // Generate chunk: sweep from 100 Hz to 2000 Hz over 2 seconds
  for (let i = 0; i < chunkSize; i++) {
    const t = (offset + i) / streamSampleRate;
    const freq = 100 + (1900 * t) / streamDuration; // Linear sweep
    chunk[i] = Math.sin(2 * Math.PI * freq * t);
  }

  // Process chunk
  const numFrames = spectrogramFft.addSamples(
    chunk,
    (_spectrum: ComplexArray, _size: number) => {
      frameCount++;
    }
  );

  if (numFrames > 0) {
    const mags = spectrogramFft.getMagnitudeSpectrum();
    const freqs = spectrogramFft.getFrequencyBins(streamSampleRate);

    // Find peak in current frame
    let maxIdx = 0;
    let maxMag = 0;
    for (let i = 0; i < mags.length; i++) {
      if (mags[i] > maxMag) {
        maxMag = mags[i];
        maxIdx = i;
      }
    }

    const peakFreq = freqs[maxIdx];

    // Only print every 10th frame
    if (frameCount % 10 === 0) {
      console.log(`Frame ${frameCount}: Peak at ${peakFreq.toFixed(2)} Hz`);
    }
  }
}

console.log(`Total spectrogram frames: ${frameCount}`);

// ============================================================
// Example 6: Zero-Padding Effects
// ============================================================

console.log("\n--- Example 6: Zero-Padding Effects ---");

// Short signal
const shortSignal = new Float32Array(100);
for (let i = 0; i < 100; i++) {
  shortSignal[i] = Math.sin((2 * Math.PI * 5 * i) / 100);
}

console.log("\nOriginal signal: 100 samples");
const paddedSizes = [128, 256, 512, 1024];

for (const padSize of paddedSizes) {
  const padded = FftUtils.zeroPad(shortSignal, padSize);
  const fft = new FftProcessor(padded.length);
  const spectrum = fft.rfft(padded);

  console.log(
    `Padded to ${padSize}: ${spectrum.real.length} frequency bins (spectral interpolation)`
  );
}

console.log(
  "\n⚠️  Note: More bins ≠ better resolution! Resolution is determined by original signal length."
);

// ============================================================
// Summary
// ============================================================

console.log("\n=== Summary ===");
console.log("✅ Use FftUtils.padToPowerOfTwo() for non-power-of-2 signals");
console.log("✅ FFT is 100-1000x faster than DFT for large signals");
console.log(
  "✅ Always use windowing (hann, hamming, blackman) to reduce spectral leakage"
);
console.log("✅ Hann window is recommended for general audio analysis");
console.log("✅ Use 50-75% overlap for smooth spectrograms");
console.log("✅ Zero-padding increases bins but NOT spectral resolution");
console.log("\n📚 See docs/FFT_USER_GUIDE.md for detailed explanations");
