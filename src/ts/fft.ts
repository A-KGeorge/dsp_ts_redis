/**
 * FFT/DFT TypeScript Bindings
 *
 * Provides all 8 Fourier transforms with full type safety:
 * - FFT/IFFT: Fast Fourier Transform (complex, O(N log N))
 * - DFT/IDFT: Discrete Fourier Transform (complex, O(N²))
 * - RFFT/IRFFT: Real-input FFT (outputs N/2+1 bins)
 * - RDFT/IRDFT: Real-input DFT (outputs N/2+1 bins)
 *
 * Plus moving/batched FFT for streaming applications
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// Try multiple paths to find the native module
let DspAddon: any;
const possiblePaths = [
  join(__dirname, "../build/dsp-ts-redis.node"),
  join(__dirname, "../../build/Release/dsp-ts-redis.node"),
  join(__dirname, "../../prebuilds/win32-x64/dsp-js-native.node"),
];

for (const path of possiblePaths) {
  try {
    DspAddon = require(path);
    break;
  } catch (err) {
    // Continue to next path
  }
}

if (!DspAddon) {
  throw new Error(
    "Could not load native module. Tried paths:\n" + possiblePaths.join("\n")
  );
}

/**
 * Complex number representation
 */
export interface ComplexArray {
  /** Real part */
  real: Float32Array;
  /** Imaginary part */
  imag: Float32Array;
}

/**
 * Window function types for spectral analysis
 */
export type WindowType =
  | "none" // Rectangular (no windowing)
  | "hann" // Hann window (cosine taper)
  | "hamming" // Hamming window
  | "blackman" // Blackman window (better sidelobe rejection)
  | "bartlett"; // Triangular window

/**
 * FFT processing mode
 */
export type FftMode =
  | "moving" // Sliding window, updates on every sample
  | "batched"; // Process complete frames

/**
 * FFT Processor - Core transform engine
 *
 * @example
 * ```ts
 * const fft = new FftProcessor(512);
 *
 * // Real-input FFT (most common)
 * const signal = new Float32Array(512);
 * const spectrum = fft.rfft(signal);
 *
 * // Get magnitude spectrum
 * const magnitudes = fft.getMagnitude(spectrum);
 *
 * // Inverse transform
 * const reconstructed = fft.irfft(spectrum);
 * ```
 */
export class FftProcessor {
  private native: any;

  /**
   * Create FFT processor
   *
   * @param size FFT size (must be power of 2 for FFT/RFFT, any size for DFT/RDFT)
   */
  constructor(size: number) {
    this.native = new DspAddon.FftProcessor(size);
  }

  // ========== Complex Transforms ==========

  /**
   * Forward FFT (complex -> complex)
   *
   * Computes: X[k] = Σ x[n] * e^(-j2πkn/N)
   *
   * Time complexity: O(N log N)
   * Requires: size must be power of 2
   *
   * @param input Complex input signal { real, imag }
   * @returns Complex frequency spectrum
   */
  fft(input: ComplexArray): ComplexArray {
    return this.native.fft(input);
  }

  /**
   * Inverse FFT (complex -> complex)
   *
   * Computes: x[n] = (1/N) * Σ X[k] * e^(j2πkn/N)
   *
   * @param spectrum Complex frequency spectrum
   * @returns Complex time-domain signal
   */
  ifft(spectrum: ComplexArray): ComplexArray {
    return this.native.ifft(spectrum);
  }

  /**
   * Forward DFT (complex -> complex)
   *
   * Direct computation, slower but works for any size
   * Time complexity: O(N²)
   *
   * @param input Complex input signal
   * @returns Complex frequency spectrum
   */
  dft(input: ComplexArray): ComplexArray {
    return this.native.dft(input);
  }

  /**
   * Inverse DFT (complex -> complex)
   *
   * @param spectrum Complex frequency spectrum
   * @returns Complex time-domain signal
   */
  idft(spectrum: ComplexArray): ComplexArray {
    return this.native.idft(spectrum);
  }

  // ========== Real-Input Transforms ==========

  /**
   * Forward RFFT (real -> complex half-spectrum)
   *
   * Exploits Hermitian symmetry for real inputs: X[k] = X*[N-k]
   * Returns only positive frequencies (N/2+1 bins)
   *
   * Time complexity: O(N log N)
   * Output size: N/2 + 1 (includes DC and Nyquist)
   *
   * @param input Real input signal (size N)
   * @returns Complex half-spectrum (size N/2+1)
   *
   * @example
   * ```ts
   * const fft = new FftProcessor(1024);
   * const signal = new Float32Array(1024);
   * const spectrum = fft.rfft(signal);
   * // spectrum has 513 bins (DC + 512 positive frequencies)
   * ```
   */
  rfft(input: Float32Array): ComplexArray {
    return this.native.rfft(input);
  }

  /**
   * Inverse RFFT (complex half-spectrum -> real)
   *
   * Reconstructs real signal from half spectrum using Hermitian symmetry
   *
   * @param spectrum Complex half-spectrum (size N/2+1)
   * @returns Real time-domain signal (size N)
   */
  irfft(spectrum: ComplexArray): Float32Array {
    return this.native.irfft(spectrum);
  }

  /**
   * Forward RDFT (real -> complex half-spectrum)
   *
   * Direct computation version of RFFT
   * Time complexity: O(N²)
   *
   * @param input Real input signal
   * @returns Complex half-spectrum
   */
  rdft(input: Float32Array): ComplexArray {
    return this.native.rdft(input);
  }

  /**
   * Inverse RDFT (complex half-spectrum -> real)
   *
   * Direct computation version of IRFFT
   *
   * @param spectrum Complex half-spectrum
   * @returns Real time-domain signal
   */
  irdft(spectrum: ComplexArray): Float32Array {
    return this.native.irdft(spectrum);
  }

  // ========== Utility Methods ==========

  /**
   * Get FFT size
   */
  getSize(): number {
    return this.native.getSize();
  }

  /**
   * Get half-spectrum size (for real transforms)
   * Returns N/2 + 1
   */
  getHalfSize(): number {
    return this.native.getHalfSize();
  }

  /**
   * Check if FFT size is power of 2
   */
  isPowerOfTwo(): boolean {
    return this.native.isPowerOfTwo();
  }

  /**
   * Get magnitude spectrum from complex spectrum
   *
   * Computes: |X[k]| = sqrt(Re²(X[k]) + Im²(X[k]))
   *
   * @param spectrum Complex spectrum
   * @returns Magnitude array
   */
  getMagnitude(spectrum: ComplexArray): Float32Array {
    return this.native.getMagnitude(spectrum);
  }

  /**
   * Get phase spectrum from complex spectrum
   *
   * Computes: ∠X[k] = atan2(Im(X[k]), Re(X[k]))
   *
   * @param spectrum Complex spectrum
   * @returns Phase array (radians, -π to π)
   */
  getPhase(spectrum: ComplexArray): Float32Array {
    return this.native.getPhase(spectrum);
  }

  /**
   * Get power spectrum (magnitude squared)
   *
   * Computes: P[k] = |X[k]|²
   *
   * @param spectrum Complex spectrum
   * @returns Power array
   */
  getPower(spectrum: ComplexArray): Float32Array {
    return this.native.getPower(spectrum);
  }

  /**
   * Compute frequency bins for spectrum
   *
   * @param sampleRate Sample rate in Hz
   * @returns Frequency array in Hz
   *
   * @example
   * ```ts
   * const fft = new FftProcessor(1024);
   * const freqs = fft.getFrequencyBins(44100); // 44.1 kHz sample rate
   * // freqs[0] = 0 Hz (DC)
   * // freqs[1] = 43.07 Hz
   * // freqs[512] = 22050 Hz (Nyquist)
   * ```
   */
  getFrequencyBins(sampleRate: number): Float32Array {
    const size = this.isPowerOfTwo() ? this.getHalfSize() : this.getSize();
    const freqs = new Float32Array(size);
    const binWidth = sampleRate / this.getSize();

    for (let i = 0; i < size; i++) {
      freqs[i] = i * binWidth;
    }

    return freqs;
  }
}

/**
 * Moving FFT Processor - Streaming/batched transforms
 *
 * Provides sliding-window and frame-based FFT processing:
 * - Moving mode: Updates spectrum on every sample
 * - Batched mode: Processes complete frames with hop size
 * - Automatic windowing
 * - Overlap-add support
 *
 * Uses native C++ implementation for high performance.
 *
 * @example
 * ```ts
 * // Batched processing with 50% overlap
 * const movingFft = new MovingFftProcessor({
 *   fftSize: 2048,
 *   hopSize: 1024,
 *   mode: "batched",
 *   windowType: "hann"
 * });
 *
 * // Stream audio samples
 * const samples = new Float32Array(4096);
 * movingFft.addSamples(samples, (spectrum, size) => {
 *   console.log(`Spectrum ready: ${size} bins`);
 * });
 * ```
 */
export class MovingFftProcessor {
  private native: any;

  constructor(options: {
    fftSize: number;
    hopSize?: number;
    mode?: FftMode;
    windowType?: WindowType;
    realInput?: boolean;
  }) {
    // Build options object with only defined properties
    const nativeOptions: any = {
      fftSize: options.fftSize,
      realInput: options.realInput ?? true,
    };

    if (options.hopSize !== undefined) {
      nativeOptions.hopSize = options.hopSize;
    }

    if (options.mode !== undefined) {
      nativeOptions.mode = options.mode;
    }

    if (options.windowType !== undefined) {
      nativeOptions.windowType = options.windowType;
    }

    this.native = new DspAddon.MovingFftProcessor(nativeOptions);
  }

  /**
   * Add single sample and optionally compute FFT
   *
   * @param sample Input sample
   * @returns Spectrum if computed, null otherwise
   */
  addSample(sample: number): ComplexArray | null {
    return this.native.addSample(sample);
  }

  /**
   * Add batch of samples
   *
   * @param samples Input samples
   * @param callback Called for each computed spectrum
   * @returns Number of spectra computed
   */
  addSamples(
    samples: Float32Array,
    callback?: (spectrum: ComplexArray, size: number) => void
  ): number {
    if (!callback) {
      // If no callback, just process and return count
      return this.native.addSamples(samples, () => {});
    }
    return this.native.addSamples(samples, callback);
  }

  /**
   * Force compute spectrum from current buffer
   */
  computeSpectrum(): ComplexArray {
    return this.native.computeSpectrum();
  }

  /**
   * Reset processor state
   */
  reset(): void {
    this.native.reset();
  }

  /**
   * Get FFT size
   */
  getFftSize(): number {
    return this.native.getFftSize();
  }

  /**
   * Get spectrum size (N/2+1 for real, N for complex)
   */
  getSpectrumSize(): number {
    return this.native.getSpectrumSize();
  }

  /**
   * Get hop size
   */
  getHopSize(): number {
    return this.native.getHopSize();
  }

  /**
   * Get buffer fill level
   */
  getFillLevel(): number {
    return this.native.getFillLevel();
  }

  /**
   * Check if ready to compute FFT
   */
  isReady(): boolean {
    return this.native.isReady();
  }

  /**
   * Set window type
   */
  setWindowType(type: WindowType): void {
    this.native.setWindowType(type);
  }

  /**
   * Get magnitude spectrum
   */
  getMagnitudeSpectrum(): Float32Array {
    return this.native.getMagnitudeSpectrum();
  }

  /**
   * Get power spectrum
   */
  getPowerSpectrum(): Float32Array {
    return this.native.getPowerSpectrum();
  }

  /**
   * Get phase spectrum
   */
  getPhaseSpectrum(): Float32Array {
    return this.native.getPhaseSpectrum();
  }

  /**
   * Get frequency bins
   */
  getFrequencyBins(sampleRate: number): Float32Array {
    return this.native.getFrequencyBins(sampleRate);
  }
}

/**
 * Helper functions for common FFT operations
 */
export namespace FftUtils {
  /**
   * Find peak frequency in spectrum
   *
   * @param magnitudes Magnitude spectrum
   * @param sampleRate Sample rate in Hz
   * @param fftSize FFT size
   * @returns Peak frequency in Hz
   */
  export function findPeakFrequency(
    magnitudes: Float32Array,
    sampleRate: number,
    fftSize: number
  ): number {
    let maxIdx = 0;
    let maxVal = magnitudes[0];

    for (let i = 1; i < magnitudes.length; i++) {
      if (magnitudes[i] > maxVal) {
        maxVal = magnitudes[i];
        maxIdx = i;
      }
    }

    return (maxIdx * sampleRate) / fftSize;
  }

  /**
   * Convert magnitude spectrum to decibels
   *
   * @param magnitudes Magnitude spectrum
   * @param refLevel Reference level (default: 1.0)
   * @returns Spectrum in dB
   */
  export function toDecibels(
    magnitudes: Float32Array,
    refLevel: number = 1.0
  ): Float32Array {
    const db = new Float32Array(magnitudes.length);

    for (let i = 0; i < magnitudes.length; i++) {
      db[i] = 20 * Math.log10(Math.max(magnitudes[i], 1e-10) / refLevel);
    }

    return db;
  }

  /**
   * Apply A-weighting to frequency spectrum (perceptual audio)
   *
   * @param magnitudes Magnitude spectrum
   * @param frequencies Frequency bins in Hz
   * @returns A-weighted magnitudes
   */
  export function applyAWeighting(
    magnitudes: Float32Array,
    frequencies: Float32Array
  ): Float32Array {
    const weighted = new Float32Array(magnitudes.length);

    for (let i = 0; i < magnitudes.length; i++) {
      const f = frequencies[i];
      const f2 = f * f;
      const f4 = f2 * f2;

      // A-weighting formula
      const numerator = 12194 * 12194 * f4;
      const denominator =
        (f2 + 20.6 * 20.6) *
        Math.sqrt((f2 + 107.7 * 107.7) * (f2 + 737.9 * 737.9)) *
        (f2 + 12194 * 12194);

      const weight = numerator / denominator;
      weighted[i] = magnitudes[i] * weight;
    }

    return weighted;
  }

  /**
   * Compute next power of 2
   */
  export function nextPowerOfTwo(n: number): number {
    if (n <= 0) return 1;

    let power = 1;
    while (power < n) {
      power *= 2;
    }

    return power;
  }

  /**
   * Zero-pad signal to target length
   */
  export function zeroPad(
    signal: Float32Array,
    targetLength: number
  ): Float32Array {
    if (signal.length >= targetLength) {
      return signal;
    }

    const padded = new Float32Array(targetLength);
    padded.set(signal);

    return padded;
  }
}
