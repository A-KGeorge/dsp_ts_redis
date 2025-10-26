/**
 * Tests for Advanced DSP Functions
 * - Hjorth Parameters (Activity, Mobility, Complexity)
 * - Spectral Features (Centroid, Rolloff, Flux)
 * - Entropy Measures (Shannon, SampEn, ApEn)
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  calculateHjorthParameters,
  HjorthTracker,
  calculateSpectralCentroid,
  calculateSpectralRolloff,
  calculateSpectralFlux,
  calculateSpectralFeatures,
  SpectralFeaturesTracker,
  calculateShannonEntropy,
  calculateSampleEntropy,
  calculateApproximateEntropy,
  EntropyTracker,
  FftProcessor,
} from "../index.js";

describe("Hjorth Parameters - Basic Calculation", () => {
  it("should calculate Hjorth parameters for simple sine wave", () => {
    const size = 1000;
    const signal = new Float32Array(size);

    // Simple sine wave - predictable complexity
    for (let i = 0; i < size; i++) {
      signal[i] = Math.sin((2 * Math.PI * 5 * i) / size);
    }

    const hjorth = calculateHjorthParameters(signal);

    assert.ok(hjorth.activity > 0, "Activity should be positive");
    assert.ok(hjorth.mobility > 0, "Mobility should be positive");
    assert.ok(hjorth.complexity > 0, "Complexity should be positive");

    // Simple sine should have relatively low complexity
    assert.ok(hjorth.complexity < 2, "Sine wave should have low complexity");
  });

  it("should calculate higher complexity for noisy signal", () => {
    const size = 1000;
    const clean = new Float32Array(size);
    const noisy = new Float32Array(size);

    // Create clean and noisy versions
    for (let i = 0; i < size; i++) {
      clean[i] = Math.sin((2 * Math.PI * 5 * i) / size);
      noisy[i] = clean[i] + (Math.random() - 0.5) * 0.5; // Add noise
    }

    const hjorthClean = calculateHjorthParameters(clean);
    const hjorthNoisy = calculateHjorthParameters(noisy);

    // Noisy signal should have higher activity and complexity
    assert.ok(
      hjorthNoisy.activity > hjorthClean.activity,
      "Noisy signal should have higher activity"
    );
    assert.ok(
      hjorthNoisy.complexity > hjorthClean.complexity,
      "Noisy signal should have higher complexity"
    );
  });

  it("should handle constant signal", () => {
    const size = 100;
    const signal = new Float32Array(size);
    signal.fill(1.0);

    const hjorth = calculateHjorthParameters(signal);

    // Constant signal has zero variance - mobility and complexity may be NaN or 0
    assert.strictEqual(hjorth.activity, 0, "Constant signal has zero activity");
    assert.ok(
      hjorth.mobility === 0 || Number.isNaN(hjorth.mobility),
      "Constant signal has zero or NaN mobility"
    );
    assert.ok(
      hjorth.complexity === 0 || Number.isNaN(hjorth.complexity),
      "Constant signal has zero or NaN complexity"
    );
  });

  it("should throw error for too short signal", () => {
    const signal = new Float32Array(2); // Need at least 3 samples
    signal[0] = 1;
    signal[1] = 2;

    assert.throws(
      () => calculateHjorthParameters(signal),
      /at least 3 samples/,
      "Should throw for insufficient samples"
    );
  });
});

describe("HjorthTracker - Real-time Tracking", () => {
  it("should track Hjorth parameters with sliding window", () => {
    const windowSize = 100;
    const tracker = new HjorthTracker(windowSize);

    // Fill the window
    let result = null;
    for (let i = 0; i < windowSize; i++) {
      const sample = Math.sin((2 * Math.PI * 5 * i) / windowSize);
      result = tracker.update(sample);
    }

    // Should return result after window is full
    assert.ok(result !== null, "Should return result after window is full");
    assert.ok(result!.activity > 0);
    assert.ok(result!.mobility > 0);
    assert.ok(result!.complexity > 0);
  });

  it("should return null until window is full", () => {
    const windowSize = 50;
    const tracker = new HjorthTracker(windowSize);

    // Add samples but don't fill window
    for (let i = 0; i < windowSize - 1; i++) {
      const result = tracker.update(Math.random());
      assert.strictEqual(
        result,
        null,
        "Should return null until window is full"
      );
    }

    // Fill window completely
    const result = tracker.update(Math.random());
    assert.ok(result !== null, "Should return result when window is full");
  });

  it("should reset state correctly", () => {
    const windowSize = 50;
    const tracker = new HjorthTracker(windowSize);

    // Fill window
    for (let i = 0; i < windowSize; i++) {
      tracker.update(Math.random());
    }

    // Reset
    tracker.reset();

    // Should need to fill window again
    for (let i = 0; i < windowSize - 1; i++) {
      const result = tracker.update(Math.random());
      assert.strictEqual(result, null, "Should return null after reset");
    }
  });
});

describe("Spectral Features - Centroid", () => {
  it("should calculate spectral centroid correctly", () => {
    const sampleRate = 1000;
    const fftSize = 128;

    // Create signal with peak at 100 Hz
    const signal = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      signal[i] = Math.sin((2 * Math.PI * 100 * i) / sampleRate);
    }

    const fft = new FftProcessor(fftSize);
    const spectrum = fft.rfft(signal);
    const magnitude = fft.getMagnitude(spectrum);

    const centroid = calculateSpectralCentroid(magnitude, sampleRate);

    // Centroid should be near 100 Hz for single-frequency signal
    // Allow larger tolerance due to FFT bin resolution and spectral leakage
    assert.ok(
      Math.abs(centroid - 100) < 50,
      `Centroid should be near 100 Hz, got ${centroid}`
    );
  });

  it("should calculate higher centroid for high-frequency signal", () => {
    const sampleRate = 1000;
    const fftSize = 256;
    const fft = new FftProcessor(fftSize);

    // Low frequency signal
    const lowFreq = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      lowFreq[i] = Math.sin((2 * Math.PI * 50 * i) / sampleRate);
    }
    const spectrumLow = fft.rfft(lowFreq);
    const magnitudeLow = fft.getMagnitude(spectrumLow);
    const centroidLow = calculateSpectralCentroid(magnitudeLow, sampleRate);

    // High frequency signal
    const highFreq = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      highFreq[i] = Math.sin((2 * Math.PI * 200 * i) / sampleRate);
    }
    const spectrumHigh = fft.rfft(highFreq);
    const magnitudeHigh = fft.getMagnitude(spectrumHigh);
    const centroidHigh = calculateSpectralCentroid(magnitudeHigh, sampleRate);

    assert.ok(
      centroidHigh > centroidLow,
      `High-frequency signal should have higher centroid: ${centroidHigh} > ${centroidLow}`
    );
  });
});

describe("Spectral Features - Rolloff", () => {
  it("should calculate spectral rolloff", () => {
    const sampleRate = 1000;
    const fftSize = 128;

    const signal = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      signal[i] = Math.sin((2 * Math.PI * 100 * i) / sampleRate);
    }

    const fft = new FftProcessor(fftSize);
    const spectrum = fft.rfft(signal);
    const magnitude = fft.getMagnitude(spectrum);

    const rolloff85 = calculateSpectralRolloff(magnitude, sampleRate, 85);
    const rolloff95 = calculateSpectralRolloff(magnitude, sampleRate, 95);

    // 95% rolloff should be higher than 85% rolloff
    assert.ok(rolloff95 >= rolloff85, "95% rolloff should be >= 85% rolloff");

    // Both should be positive
    assert.ok(rolloff85 > 0, "Rolloff should be positive");
    assert.ok(rolloff95 > 0, "Rolloff should be positive");
  });
});

describe("Spectral Features - Flux", () => {
  it("should calculate zero flux for identical spectra", () => {
    const magnitude = new Float32Array([1, 2, 3, 4, 5]);
    const flux = calculateSpectralFlux(magnitude, magnitude);

    assert.strictEqual(flux, 0, "Flux should be zero for identical spectra");
  });

  it("should calculate positive flux for different spectra", () => {
    const mag1 = new Float32Array([1, 2, 3, 4, 5]);
    const mag2 = new Float32Array([2, 3, 4, 5, 6]);

    const flux = calculateSpectralFlux(mag2, mag1);

    assert.ok(flux > 0, "Flux should be positive for different spectra");
  });

  it("should return 0 when no previous spectrum provided", () => {
    const magnitude = new Float32Array([1, 2, 3, 4, 5]);
    const flux = calculateSpectralFlux(magnitude, null);

    assert.strictEqual(flux, 0, "Flux should be 0 without previous spectrum");
  });
});

describe("Spectral Features - Unified Interface", () => {
  it("should calculate all spectral features", () => {
    const sampleRate = 1000;
    const fftSize = 128;

    const signal = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      signal[i] = Math.sin((2 * Math.PI * 100 * i) / sampleRate);
    }

    const fft = new FftProcessor(fftSize);
    const spectrum = fft.rfft(signal);
    const magnitude = fft.getMagnitude(spectrum);

    const features = calculateSpectralFeatures(magnitude, sampleRate);

    assert.ok(features.centroid > 0, "Centroid should be positive");
    assert.ok(features.rolloff > 0, "Rolloff should be positive");
    assert.strictEqual(features.flux, 0, "Flux should be 0 without previous");
  });

  it("should calculate flux when previous spectrum provided", () => {
    const sampleRate = 1000;
    const magnitude = new Float32Array(65);
    const previous = new Float32Array(65);

    // Different spectra
    for (let i = 0; i < 65; i++) {
      magnitude[i] = Math.random();
      previous[i] = Math.random();
    }

    const features = calculateSpectralFeatures(magnitude, sampleRate, previous);

    assert.ok(
      features.flux > 0,
      "Flux should be positive with different spectra"
    );
  });
});

describe("SpectralFeaturesTracker - Frame Tracking", () => {
  it("should track spectral features frame-by-frame", () => {
    const sampleRate = 1000;
    const fftSize = 128;
    const tracker = new SpectralFeaturesTracker();
    const fft = new FftProcessor(fftSize);

    // First frame
    const signal1 = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      signal1[i] = Math.sin((2 * Math.PI * 100 * i) / sampleRate);
    }
    const spectrum1 = fft.rfft(signal1);
    const magnitude1 = fft.getMagnitude(spectrum1);

    const features1 = tracker.calculate(magnitude1, sampleRate);
    assert.strictEqual(features1.flux, 0, "First frame should have zero flux");

    // Second frame (different)
    const signal2 = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      signal2[i] = Math.sin((2 * Math.PI * 150 * i) / sampleRate);
    }
    const spectrum2 = fft.rfft(signal2);
    const magnitude2 = fft.getMagnitude(spectrum2);

    const features2 = tracker.calculate(magnitude2, sampleRate);
    assert.ok(features2.flux > 0, "Second frame should have positive flux");
  });

  it("should reset previous spectrum", () => {
    const tracker = new SpectralFeaturesTracker();
    const magnitude = new Float32Array(65);
    magnitude.fill(1.0);

    // Calculate twice
    tracker.calculate(magnitude, 1000);
    tracker.reset();
    const features = tracker.calculate(magnitude, 1000);

    assert.strictEqual(features.flux, 0, "Flux should be 0 after reset");
  });
});

describe("Shannon Entropy", () => {
  it("should calculate zero entropy for constant signal", () => {
    const signal = new Float32Array(100);
    signal.fill(1.0);

    const entropy = calculateShannonEntropy(signal);

    assert.strictEqual(entropy, 0, "Constant signal should have zero entropy");
  });

  it("should calculate higher entropy for random signal", () => {
    const deterministic = new Float32Array(100);
    for (let i = 0; i < 100; i++) {
      deterministic[i] = Math.sin((2 * Math.PI * i) / 100);
    }

    const random = new Float32Array(100);
    for (let i = 0; i < 100; i++) {
      random[i] = Math.random();
    }

    const entropyDet = calculateShannonEntropy(deterministic);
    const entropyRand = calculateShannonEntropy(random);

    assert.ok(
      entropyRand > entropyDet,
      "Random signal should have higher entropy than deterministic"
    );
  });

  it("should handle different bin counts", () => {
    const signal = new Float32Array(1000);
    for (let i = 0; i < 1000; i++) {
      signal[i] = Math.random();
    }

    const entropy128 = calculateShannonEntropy(signal, 128);
    const entropy256 = calculateShannonEntropy(signal, 256);

    // Both should be positive
    assert.ok(entropy128 > 0, "Entropy with 128 bins should be positive");
    assert.ok(entropy256 > 0, "Entropy with 256 bins should be positive");
  });
});

describe("Sample Entropy (SampEn)", () => {
  it("should calculate low SampEn for regular signal", () => {
    const signal = new Float32Array(200);
    for (let i = 0; i < 200; i++) {
      signal[i] = Math.sin((2 * Math.PI * 10 * i) / 200);
    }

    const sampEn = calculateSampleEntropy(signal, 2);

    assert.ok(sampEn >= 0, "SampEn should be non-negative");
    assert.ok(sampEn < 2, "Regular signal should have low SampEn");
  });

  it("should calculate higher SampEn for irregular signal", () => {
    const regular = new Float32Array(200);
    for (let i = 0; i < 200; i++) {
      regular[i] = Math.sin((2 * Math.PI * 10 * i) / 200);
    }

    const irregular = new Float32Array(200);
    for (let i = 0; i < 200; i++) {
      irregular[i] = Math.random();
    }

    const sampEnRegular = calculateSampleEntropy(regular, 2);
    const sampEnIrregular = calculateSampleEntropy(irregular, 2);

    assert.ok(
      sampEnIrregular > sampEnRegular,
      "Irregular signal should have higher SampEn"
    );
  });

  it("should use automatic tolerance when not provided", () => {
    const signal = new Float32Array(100);
    for (let i = 0; i < 100; i++) {
      signal[i] = Math.sin((2 * Math.PI * 5 * i) / 100);
    }

    const sampEn = calculateSampleEntropy(signal, 2); // No r parameter

    assert.ok(sampEn >= 0, "SampEn should work with automatic tolerance");
  });
});

describe("Approximate Entropy (ApEn)", () => {
  it("should calculate low ApEn for regular signal", () => {
    const signal = new Float32Array(200);
    for (let i = 0; i < 200; i++) {
      signal[i] = Math.sin((2 * Math.PI * 10 * i) / 200);
    }

    const apEn = calculateApproximateEntropy(signal, 2);

    assert.ok(apEn >= 0, "ApEn should be non-negative");
    assert.ok(apEn < 2, "Regular signal should have low ApEn");
  });

  it("should calculate higher ApEn for random signal", () => {
    const regular = new Float32Array(200);
    for (let i = 0; i < 200; i++) {
      regular[i] = Math.sin((2 * Math.PI * 10 * i) / 200);
    }

    const random = new Float32Array(200);
    for (let i = 0; i < 200; i++) {
      random[i] = Math.random();
    }

    const apEnRegular = calculateApproximateEntropy(regular, 2);
    const apEnRandom = calculateApproximateEntropy(random, 2);

    assert.ok(
      apEnRandom > apEnRegular,
      "Random signal should have higher ApEn"
    );
  });

  it("should handle custom tolerance", () => {
    const signal = new Float32Array(150);
    for (let i = 0; i < 150; i++) {
      signal[i] = Math.sin((2 * Math.PI * 5 * i) / 150);
    }

    const apEnDefault = calculateApproximateEntropy(signal, 2);
    const apEnCustom = calculateApproximateEntropy(signal, 2, 0.1);

    // Both should be valid
    assert.ok(apEnDefault >= 0, "ApEn with default r should be valid");
    assert.ok(apEnCustom >= 0, "ApEn with custom r should be valid");
  });
});

describe("EntropyTracker - Real-time Entropy", () => {
  it("should track Shannon entropy with sliding window", () => {
    const windowSize = 100;
    const tracker = new EntropyTracker(windowSize, 128);

    // Fill window
    let result = null;
    for (let i = 0; i < windowSize; i++) {
      result = tracker.update(Math.random());
    }

    assert.ok(result !== null, "Should return result after window is full");
    assert.ok(result! > 0, "Entropy should be positive for random data");
  });

  it("should return null until window is full", () => {
    const windowSize = 50;
    const tracker = new EntropyTracker(windowSize);

    for (let i = 0; i < windowSize - 1; i++) {
      const result = tracker.update(Math.random());
      assert.strictEqual(
        result,
        null,
        "Should return null until window is full"
      );
    }

    const result = tracker.update(Math.random());
    assert.ok(result !== null, "Should return result when window is full");
  });

  it("should reset correctly", () => {
    const windowSize = 50;
    const tracker = new EntropyTracker(windowSize);

    // Fill window
    for (let i = 0; i < windowSize; i++) {
      tracker.update(Math.random());
    }

    tracker.reset();

    // Should need to fill again
    for (let i = 0; i < windowSize - 1; i++) {
      const result = tracker.update(Math.random());
      assert.strictEqual(result, null, "Should return null after reset");
    }
  });
});

describe("Advanced DSP - Edge Cases", () => {
  it("should handle NaN values in Hjorth (may produce NaN result)", () => {
    const signal = new Float32Array([1, 2, NaN, 4, 5]);

    const hjorth = calculateHjorthParameters(signal);

    // NaN in input produces NaN in output
    assert.ok(
      Number.isNaN(hjorth.activity) || hjorth.activity >= 0,
      "Should handle NaN in input (may produce NaN)"
    );
  });

  it("should handle empty spectrum in spectral features", () => {
    const magnitude = new Float32Array(0);

    const centroid = calculateSpectralCentroid(magnitude, 1000);

    // Empty spectrum returns 0
    assert.strictEqual(centroid, 0, "Empty spectrum should return 0");
  });

  it("should handle mismatched spectrum lengths in flux", () => {
    const mag1 = new Float32Array(100);
    const mag2 = new Float32Array(50);

    // Fill with some values
    mag1.fill(1.0);
    mag2.fill(1.0);

    const flux = calculateSpectralFlux(mag1, mag2);

    // Mismatched lengths - flux uses minimum length
    assert.ok(flux >= 0, "Should handle mismatched lengths gracefully");
  });

  it("should handle very small signal in entropy", () => {
    const signal = new Float32Array(10);
    for (let i = 0; i < 10; i++) {
      signal[i] = 0.001 * Math.random();
    }

    const entropy = calculateShannonEntropy(signal);
    assert.ok(entropy >= 0, "Should handle very small signal");
  });
});
