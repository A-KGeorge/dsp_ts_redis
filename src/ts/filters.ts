/**
 * Filter Design Module
 *
 * Provides high-level API for creating digital filters:
 * - FIR filters (Finite Impulse Response)
 * - IIR filters (Infinite Impulse Response)
 * - Butterworth, Chebyshev, Bessel, Biquad
 * - Low-pass, High-pass, Band-pass, Band-stop/Notch
 *
 * All filter design math is done in C++ for performance.
 * This module provides a clean TypeScript API.
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
  join(__dirname, "../build/dspx.node"),
  join(__dirname, "../../build/Release/dspx.node"),
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

// ============================================================
// Types
// ============================================================

/**
 * Filter type (topology/algorithm)
 */
export type FilterType =
  | "fir"
  | "iir"
  | "butterworth"
  | "chebyshev"
  | "bessel"
  | "biquad";

/**
 * Filter mode (frequency response)
 */
export type FilterMode =
  | "lowpass"
  | "highpass"
  | "bandpass"
  | "bandstop"
  | "notch";

/**
 * Window function for FIR filter design
 */
export type WindowType = "hamming" | "hann" | "blackman" | "bartlett";

/**
 * Common filter options
 */
export interface BaseFilterOptions {
  /** Sample rate in Hz (e.g., 44100) */
  sampleRate: number;

  /** Filter mode */
  mode: FilterMode;

  /** Cutoff frequency in Hz (for lowpass/highpass) */
  cutoffFrequency?: number;

  /** Low cutoff frequency in Hz (for bandpass/bandstop) */
  lowCutoffFrequency?: number;

  /** High cutoff frequency in Hz (for bandpass/bandstop) */
  highCutoffFrequency?: number;

  /** Whether filter maintains state between process calls (default: true) */
  stateful?: boolean;
}

/**
 * FIR filter specific options
 */
export interface FirFilterOptions extends BaseFilterOptions {
  type: "fir";

  /** Number of filter taps/coefficients (higher = sharper transition) */
  order: number;

  /** Window function (default: "hamming") */
  windowType?: WindowType;
}

/**
 * IIR filter specific options (generic)
 */
export interface IirFilterOptions extends BaseFilterOptions {
  type: "iir";

  /** Filter order (1-8 recommended) */
  order: number;
}

/**
 * Butterworth filter options (maximally flat passband)
 */
export interface ButterworthFilterOptions extends BaseFilterOptions {
  type: "butterworth";

  /** Filter order (1-8 recommended, higher = sharper rolloff) */
  order: number;
}

/**
 * Chebyshev filter options (steeper rolloff than Butterworth)
 */
export interface ChebyshevFilterOptions extends BaseFilterOptions {
  type: "chebyshev";

  /** Filter order (1-8 recommended) */
  order: number;

  /** Passband ripple in dB (default: 0.5 dB) */
  ripple?: number;

  /** Chebyshev type: 1 (passband ripple) or 2 (stopband ripple) */
  chebyshevType?: 1 | 2;
}

/**
 * Biquad filter options (2nd-order IIR section)
 */
export interface BiquadFilterOptions extends BaseFilterOptions {
  type: "biquad";

  /** Q factor / bandwidth (default: 0.707 for Butterworth) */
  q?: number;

  /** Gain in dB (for peak/shelf filters, default: 0) */
  gain?: number;
}

/**
 * Union of all filter option types
 */
export type FilterOptions =
  | FirFilterOptions
  | IirFilterOptions
  | ButterworthFilterOptions
  | ChebyshevFilterOptions
  | BiquadFilterOptions;

// ============================================================
// Filter Classes (Wrappers around native code)
// ============================================================

/**
 * FIR (Finite Impulse Response) Filter
 *
 * - Always stable (no feedback)
 * - Linear phase possible
 * - Requires more coefficients than IIR for same frequency response
 * - Uses SIMD-optimized convolution
 *
 * @example
 * ```ts
 * const filter = FirFilter.createLowPass({
 *   cutoffFrequency: 1000,
 *   sampleRate: 8000,
 *   order: 51,
 *   windowType: "hamming"
 * });
 *
 * const output = await filter.processSample(input);
 * ```
 */
export class FirFilter {
  private native: any;

  private constructor(nativeFilter: any) {
    this.native = nativeFilter;
  }

  /**
   * Create low-pass FIR filter
   */
  static createLowPass(options: {
    cutoffFrequency: number;
    sampleRate: number;
    order: number;
    windowType?: WindowType;
  }): FirFilter {
    const {
      cutoffFrequency,
      sampleRate,
      order,
      windowType = "hamming",
    } = options;

    // Normalize cutoff frequency: fc / (fs/2)
    const normalizedCutoff = cutoffFrequency / (sampleRate / 2);

    if (normalizedCutoff <= 0 || normalizedCutoff >= 1) {
      throw new Error(
        `Cutoff frequency must be between 0 and ${
          sampleRate / 2
        } Hz (Nyquist frequency)`
      );
    }

    const nativeFilter = DspAddon.FirFilter.createLowPass(
      normalizedCutoff,
      order,
      windowType
    );
    return new FirFilter(nativeFilter);
  }

  /**
   * Create high-pass FIR filter
   */
  static createHighPass(options: {
    cutoffFrequency: number;
    sampleRate: number;
    order: number;
    windowType?: WindowType;
  }): FirFilter {
    const {
      cutoffFrequency,
      sampleRate,
      order,
      windowType = "hamming",
    } = options;

    const normalizedCutoff = cutoffFrequency / (sampleRate / 2);

    if (normalizedCutoff <= 0 || normalizedCutoff >= 1) {
      throw new Error(
        `Cutoff frequency must be between 0 and ${sampleRate / 2} Hz`
      );
    }

    const nativeFilter = DspAddon.FirFilter.createHighPass(
      normalizedCutoff,
      order,
      windowType
    );
    return new FirFilter(nativeFilter);
  }

  /**
   * Create band-pass FIR filter
   */
  static createBandPass(options: {
    lowCutoffFrequency: number;
    highCutoffFrequency: number;
    sampleRate: number;
    order: number;
    windowType?: WindowType;
  }): FirFilter {
    const {
      lowCutoffFrequency,
      highCutoffFrequency,
      sampleRate,
      order,
      windowType = "hamming",
    } = options;

    const normalizedLow = lowCutoffFrequency / (sampleRate / 2);
    const normalizedHigh = highCutoffFrequency / (sampleRate / 2);

    if (
      normalizedLow <= 0 ||
      normalizedHigh >= 1 ||
      normalizedLow >= normalizedHigh
    ) {
      throw new Error(
        `Invalid band: low=${lowCutoffFrequency} Hz, high=${highCutoffFrequency} Hz (Nyquist=${
          sampleRate / 2
        } Hz)`
      );
    }

    const nativeFilter = DspAddon.FirFilter.createBandPass(
      normalizedLow,
      normalizedHigh,
      order,
      windowType
    );
    return new FirFilter(nativeFilter);
  }

  /**
   * Create band-stop (notch) FIR filter
   */
  static createBandStop(options: {
    lowCutoffFrequency: number;
    highCutoffFrequency: number;
    sampleRate: number;
    order: number;
    windowType?: WindowType;
  }): FirFilter {
    const {
      lowCutoffFrequency,
      highCutoffFrequency,
      sampleRate,
      order,
      windowType = "hamming",
    } = options;

    const normalizedLow = lowCutoffFrequency / (sampleRate / 2);
    const normalizedHigh = highCutoffFrequency / (sampleRate / 2);

    if (
      normalizedLow <= 0 ||
      normalizedHigh >= 1 ||
      normalizedLow >= normalizedHigh
    ) {
      throw new Error(
        `Invalid band: low=${lowCutoffFrequency} Hz, high=${highCutoffFrequency} Hz`
      );
    }

    const nativeFilter = DspAddon.FirFilter.createBandStop(
      normalizedLow,
      normalizedHigh,
      order,
      windowType
    );
    return new FirFilter(nativeFilter);
  }

  /**
   * Process single sample
   */
  async processSample(input: number): Promise<number> {
    return this.native.processSample(input);
  }

  /**
   * Process batch of samples
   */
  async process(input: Float32Array): Promise<Float32Array> {
    return this.native.process(input);
  }

  /**
   * Reset filter state
   */
  reset(): void {
    this.native.reset();
  }

  /**
   * Get filter coefficients
   */
  getCoefficients(): Float32Array {
    return this.native.getCoefficients();
  }

  /**
   * Get filter order
   */
  getOrder(): number {
    return this.native.getOrder();
  }
}

/**
 * IIR (Infinite Impulse Response) Filter
 *
 * - Recursive structure (feedback)
 * - More efficient than FIR (fewer coefficients needed)
 * - Can be unstable if poles outside unit circle
 * - Non-linear phase
 *
 * Common types: Butterworth, Chebyshev, Bessel, Biquad
 *
 * @example
 * ```ts
 * const filter = IirFilter.createButterworthLowPass({
 *   cutoffFrequency: 1000,
 *   sampleRate: 8000,
 *   order: 4
 * });
 *
 * const output = await filter.processSample(input);
 * ```
 */
export class IirFilter {
  private native: any;

  private constructor(nativeFilter: any) {
    this.native = nativeFilter;
  }

  /**
   * Create Butterworth low-pass filter (maximally flat passband)
   */
  static createButterworthLowPass(options: {
    cutoffFrequency: number;
    sampleRate: number;
    order: number;
  }): IirFilter {
    const { cutoffFrequency, sampleRate, order } = options;

    const normalizedCutoff = cutoffFrequency / (sampleRate / 2);

    if (normalizedCutoff <= 0 || normalizedCutoff >= 1) {
      throw new Error(
        `Cutoff frequency must be between 0 and ${sampleRate / 2} Hz`
      );
    }

    if (order < 1 || order > 8) {
      throw new Error("Order must be between 1 and 8");
    }

    const nativeFilter = DspAddon.IirFilter.createButterworthLowPass(
      normalizedCutoff,
      order
    );
    return new IirFilter(nativeFilter);
  }

  /**
   * Create Butterworth high-pass filter
   */
  static createButterworthHighPass(options: {
    cutoffFrequency: number;
    sampleRate: number;
    order: number;
  }): IirFilter {
    const { cutoffFrequency, sampleRate, order } = options;

    const normalizedCutoff = cutoffFrequency / (sampleRate / 2);

    if (normalizedCutoff <= 0 || normalizedCutoff >= 1) {
      throw new Error(
        `Cutoff frequency must be between 0 and ${sampleRate / 2} Hz`
      );
    }

    if (order < 1 || order > 8) {
      throw new Error("Order must be between 1 and 8");
    }

    const nativeFilter = DspAddon.IirFilter.createButterworthHighPass(
      normalizedCutoff,
      order
    );
    return new IirFilter(nativeFilter);
  }

  /**
   * Create Butterworth band-pass filter
   */
  static createButterworthBandPass(options: {
    lowCutoffFrequency: number;
    highCutoffFrequency: number;
    sampleRate: number;
    order: number;
  }): IirFilter {
    const { lowCutoffFrequency, highCutoffFrequency, sampleRate, order } =
      options;

    const normalizedLow = lowCutoffFrequency / (sampleRate / 2);
    const normalizedHigh = highCutoffFrequency / (sampleRate / 2);

    if (
      normalizedLow <= 0 ||
      normalizedHigh >= 1 ||
      normalizedLow >= normalizedHigh
    ) {
      throw new Error(
        `Invalid band: low=${lowCutoffFrequency} Hz, high=${highCutoffFrequency} Hz`
      );
    }

    if (order < 1 || order > 8) {
      throw new Error("Order must be between 1 and 8");
    }

    const nativeFilter = DspAddon.IirFilter.createButterworthBandPass(
      normalizedLow,
      normalizedHigh,
      order
    );
    return new IirFilter(nativeFilter);
  }

  /**
   * Create first-order low-pass filter (simple RC filter)
   */
  static createFirstOrderLowPass(options: {
    cutoffFrequency: number;
    sampleRate: number;
  }): IirFilter {
    const { cutoffFrequency, sampleRate } = options;

    const normalizedCutoff = cutoffFrequency / (sampleRate / 2);

    if (normalizedCutoff <= 0 || normalizedCutoff >= 1) {
      throw new Error(
        `Cutoff frequency must be between 0 and ${sampleRate / 2} Hz`
      );
    }

    const nativeFilter =
      DspAddon.IirFilter.createFirstOrderLowPass(normalizedCutoff);
    return new IirFilter(nativeFilter);
  }

  /**
   * Create first-order high-pass filter
   */
  static createFirstOrderHighPass(options: {
    cutoffFrequency: number;
    sampleRate: number;
  }): IirFilter {
    const { cutoffFrequency, sampleRate } = options;

    const normalizedCutoff = cutoffFrequency / (sampleRate / 2);

    if (normalizedCutoff <= 0 || normalizedCutoff >= 1) {
      throw new Error(
        `Cutoff frequency must be between 0 and ${sampleRate / 2} Hz`
      );
    }

    const nativeFilter =
      DspAddon.IirFilter.createFirstOrderHighPass(normalizedCutoff);
    return new IirFilter(nativeFilter);
  }

  /**
   * Create Chebyshev Type I low-pass filter (passband ripple)
   */
  static createChebyshevLowPass(options: {
    cutoffFrequency: number;
    sampleRate: number;
    order: number;
    rippleDb?: number;
  }): IirFilter {
    const { cutoffFrequency, sampleRate, order, rippleDb = 0.5 } = options;

    const normalizedCutoff = cutoffFrequency / (sampleRate / 2);

    if (normalizedCutoff <= 0 || normalizedCutoff >= 1) {
      throw new Error(
        `Cutoff frequency must be between 0 and ${sampleRate / 2} Hz`
      );
    }

    if (order < 1 || order > 8) {
      throw new Error("Order must be between 1 and 8");
    }

    if (rippleDb <= 0 || rippleDb > 3) {
      throw new Error("Ripple must be between 0 and 3 dB");
    }

    const nativeFilter = DspAddon.IirFilter.createChebyshevLowPass(
      normalizedCutoff,
      order,
      rippleDb
    );
    return new IirFilter(nativeFilter);
  }

  /**
   * Create Chebyshev Type I high-pass filter (passband ripple)
   */
  static createChebyshevHighPass(options: {
    cutoffFrequency: number;
    sampleRate: number;
    order: number;
    rippleDb?: number;
  }): IirFilter {
    const { cutoffFrequency, sampleRate, order, rippleDb = 0.5 } = options;

    const normalizedCutoff = cutoffFrequency / (sampleRate / 2);

    if (normalizedCutoff <= 0 || normalizedCutoff >= 1) {
      throw new Error(
        `Cutoff frequency must be between 0 and ${sampleRate / 2} Hz`
      );
    }

    if (order < 1 || order > 8) {
      throw new Error("Order must be between 1 and 8");
    }

    if (rippleDb <= 0 || rippleDb > 3) {
      throw new Error("Ripple must be between 0 and 3 dB");
    }

    const nativeFilter = DspAddon.IirFilter.createChebyshevHighPass(
      normalizedCutoff,
      order,
      rippleDb
    );
    return new IirFilter(nativeFilter);
  }

  /**
   * Create Chebyshev Type I band-pass filter (passband ripple)
   */
  static createChebyshevBandPass(options: {
    lowCutoffFrequency: number;
    highCutoffFrequency: number;
    sampleRate: number;
    order: number;
    rippleDb?: number;
  }): IirFilter {
    const {
      lowCutoffFrequency,
      highCutoffFrequency,
      sampleRate,
      order,
      rippleDb = 0.5,
    } = options;

    const normalizedLow = lowCutoffFrequency / (sampleRate / 2);
    const normalizedHigh = highCutoffFrequency / (sampleRate / 2);

    if (
      normalizedLow <= 0 ||
      normalizedHigh >= 1 ||
      normalizedLow >= normalizedHigh
    ) {
      throw new Error("Invalid cutoff frequencies");
    }

    if (order < 1 || order > 8) {
      throw new Error("Order must be between 1 and 8");
    }

    const nativeFilter = DspAddon.IirFilter.createChebyshevBandPass(
      normalizedLow,
      normalizedHigh,
      order,
      rippleDb
    );
    return new IirFilter(nativeFilter);
  }

  /**
   * Create peaking EQ biquad filter
   * Useful for parametric EQ, boosting/cutting specific frequencies
   */
  static createPeakingEQ(options: {
    centerFrequency: number;
    sampleRate: number;
    Q: number;
    gainDb: number;
  }): IirFilter {
    const { centerFrequency, sampleRate, Q, gainDb } = options;

    const normalizedFreq = centerFrequency / (sampleRate / 2);

    if (normalizedFreq <= 0 || normalizedFreq >= 1) {
      throw new Error(
        `Center frequency must be between 0 and ${sampleRate / 2} Hz`
      );
    }

    if (Q <= 0) {
      throw new Error("Q must be positive");
    }

    const nativeFilter = DspAddon.IirFilter.createPeakingEQ(
      normalizedFreq,
      Q,
      gainDb
    );
    return new IirFilter(nativeFilter);
  }

  /**
   * Create low-shelf biquad filter
   * Boosts or cuts all frequencies below cutoff
   */
  static createLowShelf(options: {
    cutoffFrequency: number;
    sampleRate: number;
    gainDb: number;
    Q?: number;
  }): IirFilter {
    const { cutoffFrequency, sampleRate, gainDb, Q = 0.707 } = options;

    const normalizedCutoff = cutoffFrequency / (sampleRate / 2);

    if (normalizedCutoff <= 0 || normalizedCutoff >= 1) {
      throw new Error(
        `Cutoff frequency must be between 0 and ${sampleRate / 2} Hz`
      );
    }

    if (Q <= 0) {
      throw new Error("Q must be positive");
    }

    const nativeFilter = DspAddon.IirFilter.createLowShelf(
      normalizedCutoff,
      gainDb,
      Q
    );
    return new IirFilter(nativeFilter);
  }

  /**
   * Create high-shelf biquad filter
   * Boosts or cuts all frequencies above cutoff
   */
  static createHighShelf(options: {
    cutoffFrequency: number;
    sampleRate: number;
    gainDb: number;
    Q?: number;
  }): IirFilter {
    const { cutoffFrequency, sampleRate, gainDb, Q = 0.707 } = options;

    const normalizedCutoff = cutoffFrequency / (sampleRate / 2);

    if (normalizedCutoff <= 0 || normalizedCutoff >= 1) {
      throw new Error(
        `Cutoff frequency must be between 0 and ${sampleRate / 2} Hz`
      );
    }

    if (Q <= 0) {
      throw new Error("Q must be positive");
    }

    const nativeFilter = DspAddon.IirFilter.createHighShelf(
      normalizedCutoff,
      gainDb,
      Q
    );
    return new IirFilter(nativeFilter);
  }

  /**
   * Process single sample
   */
  async processSample(input: number): Promise<number> {
    return this.native.processSample(input);
  }

  /**
   * Process batch of samples
   */
  async process(input: Float32Array): Promise<Float32Array> {
    return this.native.process(input);
  }

  /**
   * Reset filter state
   */
  reset(): void {
    this.native.reset();
  }

  /**
   * Get feedforward (B) coefficients
   */
  getBCoefficients(): Float32Array {
    return this.native.getBCoefficients();
  }

  /**
   * Get feedback (A) coefficients
   */
  getACoefficients(): Float32Array {
    return this.native.getACoefficients();
  }

  /**
   * Get filter order
   */
  getOrder(): number {
    return this.native.getOrder();
  }

  /**
   * Check if filter is stable
   */
  isStable(): boolean {
    return this.native.isStable();
  }
}

// ============================================================
// Unified Filter Design API
// ============================================================

/**
 * Create a digital filter with unified API
 *
 * Automatically dispatches to the appropriate filter type based on options.
 * All filter design math is done in C++ for performance.
 *
 * @example
 * ```ts
 * // FIR low-pass filter
 * const fir = createFilter({
 *   type: "fir",
 *   mode: "lowpass",
 *   cutoffFrequency: 1000,
 *   sampleRate: 8000,
 *   order: 51,
 *   windowType: "hamming"
 * });
 *
 * // Butterworth high-pass filter
 * const butter = createFilter({
 *   type: "butterworth",
 *   mode: "highpass",
 *   cutoffFrequency: 500,
 *   sampleRate: 8000,
 *   order: 4
 * });
 *
 * // Band-pass filter
 * const bandpass = createFilter({
 *   type: "fir",
 *   mode: "bandpass",
 *   lowCutoffFrequency: 300,
 *   highCutoffFrequency: 3400,
 *   sampleRate: 8000,
 *   order: 101
 * });
 * ```
 * @internal - Not exposed to users. Use specific filter constructors instead.
 */
function createFilter(options: FilterOptions): FirFilter | IirFilter {
  const { type, mode } = options;

  // FIR Filters
  if (type === "fir") {
    const firOpts = options as FirFilterOptions;

    switch (mode) {
      case "lowpass":
        if (!firOpts.cutoffFrequency)
          throw new Error("cutoffFrequency required for lowpass");
        return FirFilter.createLowPass({
          cutoffFrequency: firOpts.cutoffFrequency,
          sampleRate: firOpts.sampleRate,
          order: firOpts.order,
          windowType: firOpts.windowType,
        });

      case "highpass":
        if (!firOpts.cutoffFrequency)
          throw new Error("cutoffFrequency required for highpass");
        return FirFilter.createHighPass({
          cutoffFrequency: firOpts.cutoffFrequency,
          sampleRate: firOpts.sampleRate,
          order: firOpts.order,
          windowType: firOpts.windowType,
        });

      case "bandpass":
        if (!firOpts.lowCutoffFrequency || !firOpts.highCutoffFrequency) {
          throw new Error(
            "lowCutoffFrequency and highCutoffFrequency required for bandpass"
          );
        }
        return FirFilter.createBandPass({
          lowCutoffFrequency: firOpts.lowCutoffFrequency,
          highCutoffFrequency: firOpts.highCutoffFrequency,
          sampleRate: firOpts.sampleRate,
          order: firOpts.order,
          windowType: firOpts.windowType,
        });

      case "bandstop":
      case "notch":
        if (!firOpts.lowCutoffFrequency || !firOpts.highCutoffFrequency) {
          throw new Error(
            "lowCutoffFrequency and highCutoffFrequency required for bandstop"
          );
        }
        return FirFilter.createBandStop({
          lowCutoffFrequency: firOpts.lowCutoffFrequency,
          highCutoffFrequency: firOpts.highCutoffFrequency,
          sampleRate: firOpts.sampleRate,
          order: firOpts.order,
          windowType: firOpts.windowType,
        });

      default:
        throw new Error(`Unsupported FIR mode: ${mode}`);
    }
  }

  // Butterworth Filters
  if (type === "butterworth") {
    const butterOpts = options as ButterworthFilterOptions;

    switch (mode) {
      case "lowpass":
        if (!butterOpts.cutoffFrequency)
          throw new Error("cutoffFrequency required");
        return IirFilter.createButterworthLowPass({
          cutoffFrequency: butterOpts.cutoffFrequency,
          sampleRate: butterOpts.sampleRate,
          order: butterOpts.order,
        });

      case "highpass":
        if (!butterOpts.cutoffFrequency)
          throw new Error("cutoffFrequency required");
        return IirFilter.createButterworthHighPass({
          cutoffFrequency: butterOpts.cutoffFrequency,
          sampleRate: butterOpts.sampleRate,
          order: butterOpts.order,
        });

      case "bandpass":
        if (!butterOpts.lowCutoffFrequency || !butterOpts.highCutoffFrequency) {
          throw new Error(
            "lowCutoffFrequency and highCutoffFrequency required"
          );
        }
        return IirFilter.createButterworthBandPass({
          lowCutoffFrequency: butterOpts.lowCutoffFrequency,
          highCutoffFrequency: butterOpts.highCutoffFrequency,
          sampleRate: butterOpts.sampleRate,
          order: butterOpts.order,
        });

      default:
        throw new Error(`Unsupported Butterworth mode: ${mode}`);
    }
  }

  // Chebyshev Filters
  if (type === "chebyshev") {
    const chebyOpts = options as ChebyshevFilterOptions;
    const rippleDb = chebyOpts.ripple ?? 0.5;

    switch (mode) {
      case "lowpass":
        if (!chebyOpts.cutoffFrequency)
          throw new Error("cutoffFrequency required");
        return IirFilter.createChebyshevLowPass({
          cutoffFrequency: chebyOpts.cutoffFrequency,
          sampleRate: chebyOpts.sampleRate,
          order: chebyOpts.order,
          rippleDb,
        });

      case "highpass":
        if (!chebyOpts.cutoffFrequency)
          throw new Error("cutoffFrequency required");
        return IirFilter.createChebyshevHighPass({
          cutoffFrequency: chebyOpts.cutoffFrequency,
          sampleRate: chebyOpts.sampleRate,
          order: chebyOpts.order,
          rippleDb,
        });

      case "bandpass":
        if (!chebyOpts.lowCutoffFrequency || !chebyOpts.highCutoffFrequency) {
          throw new Error(
            "lowCutoffFrequency and highCutoffFrequency required"
          );
        }
        return IirFilter.createChebyshevBandPass({
          lowCutoffFrequency: chebyOpts.lowCutoffFrequency,
          highCutoffFrequency: chebyOpts.highCutoffFrequency,
          sampleRate: chebyOpts.sampleRate,
          order: chebyOpts.order,
          rippleDb,
        });

      default:
        throw new Error(`Unsupported Chebyshev mode: ${mode}`);
    }
  }

  // Biquad Filters (EQ, Shelf)
  if (type === "biquad") {
    const biquadOpts = options as BiquadFilterOptions;
    const Q = biquadOpts.q ?? 0.707;
    const gainDb = biquadOpts.gain ?? 0;

    switch (mode) {
      case "lowpass":
        // Use Butterworth for biquad lowpass
        if (!biquadOpts.cutoffFrequency)
          throw new Error("cutoffFrequency required");
        return IirFilter.createButterworthLowPass({
          cutoffFrequency: biquadOpts.cutoffFrequency,
          sampleRate: biquadOpts.sampleRate,
          order: 2,
        });

      case "highpass":
        if (!biquadOpts.cutoffFrequency)
          throw new Error("cutoffFrequency required");
        return IirFilter.createButterworthHighPass({
          cutoffFrequency: biquadOpts.cutoffFrequency,
          sampleRate: biquadOpts.sampleRate,
          order: 2,
        });

      default:
        throw new Error(
          `Unsupported Biquad mode: ${mode}. Use IirFilter.createPeakingEQ/createLowShelf/createHighShelf for EQ/shelf filters.`
        );
    }
  }

  // Generic IIR (first-order for now)
  if (type === "iir") {
    const iirOpts = options as IirFilterOptions;

    if (iirOpts.order === 1) {
      switch (mode) {
        case "lowpass":
          if (!iirOpts.cutoffFrequency)
            throw new Error("cutoffFrequency required");
          return IirFilter.createFirstOrderLowPass({
            cutoffFrequency: iirOpts.cutoffFrequency,
            sampleRate: iirOpts.sampleRate,
          });

        case "highpass":
          if (!iirOpts.cutoffFrequency)
            throw new Error("cutoffFrequency required");
          return IirFilter.createFirstOrderHighPass({
            cutoffFrequency: iirOpts.cutoffFrequency,
            sampleRate: iirOpts.sampleRate,
          });

        default:
          throw new Error(`Unsupported IIR mode for order 1: ${mode}`);
      }
    }

    throw new Error(
      `Generic IIR filters with order > 1 not yet supported. Use 'butterworth' type.`
    );
  }

  throw new Error(`Unsupported filter type: ${type}`);
}

// ============================================================
// Exports
// ============================================================

export {
  // Classes
  FirFilter as Fir,
  IirFilter as Iir,
};
