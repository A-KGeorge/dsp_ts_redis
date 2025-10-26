/**
 * Tests for FFT/DFT Engine
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  FftProcessor,
  MovingFftProcessor,
  FftUtils,
  type ComplexArray,
} from "../fft.js";

describe("FftProcessor - Basic Transforms", () => {
  it("should create FFT processor with power-of-2 size", () => {
    const fft = new FftProcessor(256);
    assert.strictEqual(fft.getSize(), 256);
    assert.strictEqual(fft.getHalfSize(), 129);
    assert.strictEqual(fft.isPowerOfTwo(), true);
  });

  it("should create DFT processor with non-power-of-2 size", () => {
    const fft = new FftProcessor(100);
    assert.strictEqual(fft.getSize(), 100);
    assert.strictEqual(fft.isPowerOfTwo(), false);
  });

  it("should compute RFFT for real signal", () => {
    const size = 256;
    const fft = new FftProcessor(size);

    // Generate sine wave at bin 10 (10 * sampleRate / 256)
    const signal = new Float32Array(size);
    const freq = 10;
    for (let i = 0; i < size; i++) {
      signal[i] = Math.sin((2 * Math.PI * freq * i) / size);
    }

    const spectrum = fft.rfft(signal);

    assert.ok(spectrum.real instanceof Float32Array);
    assert.ok(spectrum.imag instanceof Float32Array);
    assert.strictEqual(spectrum.real.length, fft.getHalfSize());
    assert.strictEqual(spectrum.imag.length, fft.getHalfSize());

    // Check peak is at bin 10
    const magnitudes = fft.getMagnitude(spectrum);
    let peakBin = 0;
    let peakValue = 0;

    for (let i = 0; i < magnitudes.length; i++) {
      if (magnitudes[i] > peakValue) {
        peakValue = magnitudes[i];
        peakBin = i;
      }
    }

    assert.strictEqual(peakBin, freq);
  });

  it("should reconstruct signal with IRFFT", () => {
    const size = 128;
    const fft = new FftProcessor(size);

    // Original signal
    const original = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      original[i] = Math.sin((2 * Math.PI * 5 * i) / size);
    }

    // Forward -> Inverse
    const spectrum = fft.rfft(original);
    const reconstructed = fft.irfft(spectrum);

    // Check reconstruction accuracy
    for (let i = 0; i < size; i++) {
      assert.ok(Math.abs(reconstructed[i] - original[i]) < 1e-5);
    }
  });

  it("should compute DFT for non-power-of-2 sizes", () => {
    const size = 100;
    const fft = new FftProcessor(size);

    const signal = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      signal[i] = Math.cos((2 * Math.PI * 7 * i) / size);
    }

    const spectrum = fft.rdft(signal);

    assert.strictEqual(spectrum.real.length, 51); // 100/2 + 1
    assert.ok(spectrum.real instanceof Float32Array);
  });
});

describe("FftProcessor - Complex Transforms", () => {
  it("should compute FFT for complex signal", () => {
    const size = 64;
    const fft = new FftProcessor(size);

    const input: ComplexArray = {
      real: new Float32Array(size),
      imag: new Float32Array(size),
    };

    // Create complex exponential: e^(j2πk/N)
    const k = 5;
    for (let n = 0; n < size; n++) {
      input.real[n] = Math.cos((2 * Math.PI * k * n) / size);
      input.imag[n] = Math.sin((2 * Math.PI * k * n) / size);
    }

    const spectrum = fft.fft(input);

    assert.strictEqual(spectrum.real.length, size);
    assert.strictEqual(spectrum.imag.length, size);

    // Peak should be at bin k
    const magnitudes = fft.getMagnitude(spectrum);
    let peakBin = 0;
    let peakValue = 0;

    for (let i = 0; i < magnitudes.length; i++) {
      if (magnitudes[i] > peakValue) {
        peakValue = magnitudes[i];
        peakBin = i;
      }
    }

    assert.strictEqual(peakBin, k);
  });

  it("should reconstruct complex signal with IFFT", () => {
    const size = 32;
    const fft = new FftProcessor(size);

    const original: ComplexArray = {
      real: new Float32Array(size),
      imag: new Float32Array(size),
    };

    for (let i = 0; i < size; i++) {
      original.real[i] = Math.sin((2 * Math.PI * 3 * i) / size);
      original.imag[i] = Math.cos((2 * Math.PI * 3 * i) / size);
    }

    const spectrum = fft.fft(original);
    const reconstructed = fft.ifft(spectrum);

    for (let i = 0; i < size; i++) {
      assert.ok(Math.abs(reconstructed.real[i] - original.real[i]) < 1e-5);
      assert.ok(Math.abs(reconstructed.imag[i] - original.imag[i]) < 1e-5);
    }
  });
});

describe("FftProcessor - Spectral Analysis", () => {
  it("should compute magnitude spectrum", () => {
    const size = 128;
    const fft = new FftProcessor(size);

    const signal = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      signal[i] = Math.sin((2 * Math.PI * 8 * i) / size);
    }

    const spectrum = fft.rfft(signal);
    const magnitudes = fft.getMagnitude(spectrum);

    assert.strictEqual(magnitudes.length, fft.getHalfSize());
    assert.ok(magnitudes.every((m) => m >= 0)); // Magnitudes always positive
  });

  it("should compute phase spectrum", () => {
    const size = 64;
    const fft = new FftProcessor(size);

    const signal = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      signal[i] = Math.cos((2 * Math.PI * 4 * i) / size);
    }

    const spectrum = fft.rfft(signal);
    const phases = fft.getPhase(spectrum);

    assert.strictEqual(phases.length, fft.getHalfSize());
    // Phase should be near 0 for cosine (even function)
    assert.ok(Math.abs(phases[4]) < 0.1);
  });

  it("should compute power spectrum", () => {
    const size = 256;
    const fft = new FftProcessor(size);

    const signal = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      signal[i] = Math.sin((2 * Math.PI * 10 * i) / size);
    }

    const spectrum = fft.rfft(signal);
    const power = fft.getPower(spectrum);

    assert.strictEqual(power.length, fft.getHalfSize());
    assert.ok(power.every((p) => p >= 0));

    // Power = magnitude²
    const magnitudes = fft.getMagnitude(spectrum);
    for (let i = 0; i < power.length; i++) {
      assert.ok(Math.abs(power[i] - magnitudes[i] ** 2) < 1e-4);
    }
  });

  it("should compute frequency bins correctly", () => {
    const size = 1024;
    const sampleRate = 44100;
    const fft = new FftProcessor(size);

    const freqs = fft.getFrequencyBins(sampleRate);

    assert.strictEqual(freqs.length, fft.getHalfSize());
    assert.strictEqual(freqs[0], 0); // DC
    assert.ok(Math.abs(freqs[freqs.length - 1] - sampleRate / 2) < 1); // Nyquist
  });
});

describe("FftProcessor - Parseval's Theorem", () => {
  it("should conserve energy (Parseval)", () => {
    const size = 256;
    const fft = new FftProcessor(size);

    const signal = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      signal[i] = Math.random() * 2 - 1; // Random signal
    }

    // Time-domain energy
    let timeEnergy = 0;
    for (let i = 0; i < size; i++) {
      timeEnergy += signal[i] * signal[i];
    }

    // Frequency-domain energy
    const spectrum = fft.rfft(signal);
    const power = fft.getPower(spectrum);

    let freqEnergy = 0;
    freqEnergy += power[0]; // DC
    for (let i = 1; i < power.length - 1; i++) {
      freqEnergy += 2 * power[i]; // Account for negative frequencies
    }
    freqEnergy += power[power.length - 1]; // Nyquist
    freqEnergy /= size; // Normalize

    // Check energy conservation
    assert.ok(Math.abs(timeEnergy - freqEnergy) / timeEnergy < 0.01);
  });
});

describe("MovingFftProcessor - Batched Mode", () => {
  it("should process batched FFT with hop size", () => {
    const fftSize = 128;
    const hopSize = 64;

    const movingFft = new MovingFftProcessor({
      fftSize,
      hopSize,
      mode: "batched",
      windowType: "hann",
    });

    const samples = new Float32Array(256);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin((2 * Math.PI * 10 * i) / fftSize);
    }

    let spectrumCount = 0;
    movingFft.addSamples(samples, (spectrum, size) => {
      assert.strictEqual(size, fftSize / 2 + 1);
      spectrumCount++;
    });

    // Should produce 3 spectra: at samples 128, 192, 256
    assert.strictEqual(spectrumCount, 3);
  });

  it("should apply windowing correctly", () => {
    const fftSize = 64;

    const movingFft = new MovingFftProcessor({
      fftSize,
      mode: "batched",
      windowType: "hann",
    });

    // Fill buffer
    const samples = new Float32Array(fftSize);
    samples.fill(1.0); // Constant signal

    movingFft.addSamples(samples);
    const spectrum = movingFft.computeSpectrum();

    // Windowing should reduce spectral leakage
    assert.ok(spectrum.real[0] > 0); // DC component preserved
  });

  it("should reset state correctly", () => {
    const movingFft = new MovingFftProcessor({
      fftSize: 64,
      hopSize: 32,
    });

    const samples = new Float32Array(128);
    movingFft.addSamples(samples);
    movingFft.reset();

    // After reset, should need full buffer again
    const samples2 = new Float32Array(32);
    let called = false;
    movingFft.addSamples(samples2, () => {
      called = true;
    });

    assert.strictEqual(called, false); // Not enough samples yet
  });
});

describe("FftUtils - Helper Functions", () => {
  it("should find peak frequency", () => {
    const fftSize = 1024;
    const sampleRate = 44100;
    const targetFreq = 440; // A4

    const fft = new FftProcessor(fftSize);

    const signal = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      signal[i] = Math.sin((2 * Math.PI * targetFreq * i) / sampleRate);
    }

    const spectrum = fft.rfft(signal);
    const magnitudes = fft.getMagnitude(spectrum);

    const peakFreq = FftUtils.findPeakFrequency(
      magnitudes,
      sampleRate,
      fftSize
    );

    assert.ok(Math.abs(peakFreq - targetFreq) < sampleRate / fftSize);
  });

  it("should convert to decibels", () => {
    const magnitudes = new Float32Array([1.0, 0.5, 0.1, 0.01]);
    const db = FftUtils.toDecibels(magnitudes);

    assert.ok(Math.abs(db[0] - 0) < 0.1); // 1.0 = 0 dB
    assert.ok(Math.abs(db[1] - -6.02) < 0.1); // 0.5 ≈ -6 dB
    assert.ok(Math.abs(db[2] - -20) < 0.1); // 0.1 = -20 dB
    assert.ok(Math.abs(db[3] - -40) < 0.1); // 0.01 = -40 dB
  });

  it("should compute next power of 2", () => {
    assert.strictEqual(FftUtils.nextPowerOfTwo(100), 128);
    assert.strictEqual(FftUtils.nextPowerOfTwo(256), 256);
    assert.strictEqual(FftUtils.nextPowerOfTwo(1000), 1024);
    assert.strictEqual(FftUtils.nextPowerOfTwo(2048), 2048);
  });

  it("should zero-pad signal", () => {
    const signal = new Float32Array([1, 2, 3, 4, 5]);
    const padded = FftUtils.zeroPad(signal, 10);

    assert.strictEqual(padded.length, 10);
    assert.strictEqual(padded[0], 1);
    assert.strictEqual(padded[4], 5);
    assert.strictEqual(padded[5], 0);
    assert.strictEqual(padded[9], 0);
  });
});

describe("FFT - Edge Cases", () => {
  it("should handle DC-only signal", () => {
    const size = 64;
    const fft = new FftProcessor(size);

    const signal = new Float32Array(size);
    signal.fill(1.0); // DC only

    const spectrum = fft.rfft(signal);
    const magnitudes = fft.getMagnitude(spectrum);

    // All energy should be in DC bin
    assert.ok(magnitudes[0] > size * 0.9);
    for (let i = 1; i < magnitudes.length; i++) {
      assert.ok(magnitudes[i] < 0.1);
    }
  });

  it("should handle Nyquist frequency", () => {
    const size = 128;
    const fft = new FftProcessor(size);

    // Alternating +1, -1 = Nyquist frequency
    const signal = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      signal[i] = i % 2 === 0 ? 1 : -1;
    }

    const spectrum = fft.rfft(signal);
    const magnitudes = fft.getMagnitude(spectrum);

    // Peak should be at Nyquist bin (last bin)
    let peakBin = 0;
    let peakValue = 0;
    for (let i = 0; i < magnitudes.length; i++) {
      if (magnitudes[i] > peakValue) {
        peakValue = magnitudes[i];
        peakBin = i;
      }
    }

    assert.strictEqual(peakBin, magnitudes.length - 1);
  });

  it("should handle zero signal", () => {
    const size = 256;
    const fft = new FftProcessor(size);

    const signal = new Float32Array(size);
    // All zeros

    const spectrum = fft.rfft(signal);
    const magnitudes = fft.getMagnitude(spectrum);

    for (let i = 0; i < magnitudes.length; i++) {
      assert.ok(Math.abs(magnitudes[i]) < 1e-6);
    }
  });
});

describe("FFT - Hermitian Symmetry", () => {
  it("should exhibit Hermitian symmetry for real inputs", () => {
    const size = 256;
    const fft = new FftProcessor(size);

    const signal = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      signal[i] =
        Math.sin((2 * Math.PI * 7 * i) / size) +
        Math.cos((2 * Math.PI * 13 * i) / size);
    }

    // Full complex FFT
    const complexInput: ComplexArray = {
      real: signal,
      imag: new Float32Array(size),
    };

    const fullSpectrum = fft.fft(complexInput);

    // Check X[k] = conj(X[N-k])
    // Hermitian symmetry: Real[k] = Real[N-k], Imag[k] = -Imag[N-k]
    for (let k = 1; k < size / 2; k++) {
      const realDiff = Math.abs(
        fullSpectrum.real[k] - fullSpectrum.real[size - k]
      );
      const imagDiff = Math.abs(
        fullSpectrum.imag[k] + fullSpectrum.imag[size - k]
      );

      // Use relative tolerance for better numerical stability
      const tolerance = 1e-4;
      assert.ok(
        realDiff < tolerance,
        `Real part symmetry at k=${k}: diff=${realDiff}`
      );
      assert.ok(
        imagDiff < tolerance,
        `Imag part symmetry at k=${k}: diff=${imagDiff}`
      );
    }
  });
});
