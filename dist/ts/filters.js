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
let DspAddon;
const possiblePaths = [
    join(__dirname, "../build/dspx.node"),
    join(__dirname, "../../build/Release/dspx.node"),
    join(__dirname, "../../prebuilds/win32-x64/dsp-js-native.node"),
];
for (const path of possiblePaths) {
    try {
        DspAddon = require(path);
        break;
    }
    catch (err) {
        // Continue to next path
    }
}
if (!DspAddon) {
    throw new Error("Could not load native module. Tried paths:\n" + possiblePaths.join("\n"));
}
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
    constructor(nativeFilter) {
        this.native = nativeFilter;
    }
    /**
     * Create low-pass FIR filter
     */
    static createLowPass(options) {
        const { cutoffFrequency, sampleRate, order, windowType = "hamming", } = options;
        // Normalize cutoff frequency: fc / (fs/2)
        const normalizedCutoff = cutoffFrequency / (sampleRate / 2);
        if (normalizedCutoff <= 0 || normalizedCutoff >= 1) {
            throw new Error(`Cutoff frequency must be between 0 and ${sampleRate / 2} Hz (Nyquist frequency)`);
        }
        const nativeFilter = DspAddon.FirFilter.createLowPass(normalizedCutoff, order, windowType);
        return new FirFilter(nativeFilter);
    }
    /**
     * Create high-pass FIR filter
     */
    static createHighPass(options) {
        const { cutoffFrequency, sampleRate, order, windowType = "hamming", } = options;
        const normalizedCutoff = cutoffFrequency / (sampleRate / 2);
        if (normalizedCutoff <= 0 || normalizedCutoff >= 1) {
            throw new Error(`Cutoff frequency must be between 0 and ${sampleRate / 2} Hz`);
        }
        const nativeFilter = DspAddon.FirFilter.createHighPass(normalizedCutoff, order, windowType);
        return new FirFilter(nativeFilter);
    }
    /**
     * Create band-pass FIR filter
     */
    static createBandPass(options) {
        const { lowCutoffFrequency, highCutoffFrequency, sampleRate, order, windowType = "hamming", } = options;
        const normalizedLow = lowCutoffFrequency / (sampleRate / 2);
        const normalizedHigh = highCutoffFrequency / (sampleRate / 2);
        if (normalizedLow <= 0 ||
            normalizedHigh >= 1 ||
            normalizedLow >= normalizedHigh) {
            throw new Error(`Invalid band: low=${lowCutoffFrequency} Hz, high=${highCutoffFrequency} Hz (Nyquist=${sampleRate / 2} Hz)`);
        }
        const nativeFilter = DspAddon.FirFilter.createBandPass(normalizedLow, normalizedHigh, order, windowType);
        return new FirFilter(nativeFilter);
    }
    /**
     * Create band-stop (notch) FIR filter
     */
    static createBandStop(options) {
        const { lowCutoffFrequency, highCutoffFrequency, sampleRate, order, windowType = "hamming", } = options;
        const normalizedLow = lowCutoffFrequency / (sampleRate / 2);
        const normalizedHigh = highCutoffFrequency / (sampleRate / 2);
        if (normalizedLow <= 0 ||
            normalizedHigh >= 1 ||
            normalizedLow >= normalizedHigh) {
            throw new Error(`Invalid band: low=${lowCutoffFrequency} Hz, high=${highCutoffFrequency} Hz`);
        }
        const nativeFilter = DspAddon.FirFilter.createBandStop(normalizedLow, normalizedHigh, order, windowType);
        return new FirFilter(nativeFilter);
    }
    /**
     * Process single sample
     */
    async processSample(input) {
        return this.native.processSample(input);
    }
    /**
     * Process batch of samples
     */
    async process(input) {
        return this.native.process(input);
    }
    /**
     * Reset filter state
     */
    reset() {
        this.native.reset();
    }
    /**
     * Get filter coefficients
     */
    getCoefficients() {
        return this.native.getCoefficients();
    }
    /**
     * Get filter order
     */
    getOrder() {
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
    constructor(nativeFilter) {
        this.native = nativeFilter;
    }
    /**
     * Create Butterworth low-pass filter (maximally flat passband)
     */
    static createButterworthLowPass(options) {
        const { cutoffFrequency, sampleRate, order } = options;
        const normalizedCutoff = cutoffFrequency / (sampleRate / 2);
        if (normalizedCutoff <= 0 || normalizedCutoff >= 1) {
            throw new Error(`Cutoff frequency must be between 0 and ${sampleRate / 2} Hz`);
        }
        if (order < 1 || order > 8) {
            throw new Error("Order must be between 1 and 8");
        }
        const nativeFilter = DspAddon.IirFilter.createButterworthLowPass(normalizedCutoff, order);
        return new IirFilter(nativeFilter);
    }
    /**
     * Create Butterworth high-pass filter
     */
    static createButterworthHighPass(options) {
        const { cutoffFrequency, sampleRate, order } = options;
        const normalizedCutoff = cutoffFrequency / (sampleRate / 2);
        if (normalizedCutoff <= 0 || normalizedCutoff >= 1) {
            throw new Error(`Cutoff frequency must be between 0 and ${sampleRate / 2} Hz`);
        }
        if (order < 1 || order > 8) {
            throw new Error("Order must be between 1 and 8");
        }
        const nativeFilter = DspAddon.IirFilter.createButterworthHighPass(normalizedCutoff, order);
        return new IirFilter(nativeFilter);
    }
    /**
     * Create Butterworth band-pass filter
     */
    static createButterworthBandPass(options) {
        const { lowCutoffFrequency, highCutoffFrequency, sampleRate, order } = options;
        const normalizedLow = lowCutoffFrequency / (sampleRate / 2);
        const normalizedHigh = highCutoffFrequency / (sampleRate / 2);
        if (normalizedLow <= 0 ||
            normalizedHigh >= 1 ||
            normalizedLow >= normalizedHigh) {
            throw new Error(`Invalid band: low=${lowCutoffFrequency} Hz, high=${highCutoffFrequency} Hz`);
        }
        if (order < 1 || order > 8) {
            throw new Error("Order must be between 1 and 8");
        }
        const nativeFilter = DspAddon.IirFilter.createButterworthBandPass(normalizedLow, normalizedHigh, order);
        return new IirFilter(nativeFilter);
    }
    /**
     * Create first-order low-pass filter (simple RC filter)
     */
    static createFirstOrderLowPass(options) {
        const { cutoffFrequency, sampleRate } = options;
        const normalizedCutoff = cutoffFrequency / (sampleRate / 2);
        if (normalizedCutoff <= 0 || normalizedCutoff >= 1) {
            throw new Error(`Cutoff frequency must be between 0 and ${sampleRate / 2} Hz`);
        }
        const nativeFilter = DspAddon.IirFilter.createFirstOrderLowPass(normalizedCutoff);
        return new IirFilter(nativeFilter);
    }
    /**
     * Create first-order high-pass filter
     */
    static createFirstOrderHighPass(options) {
        const { cutoffFrequency, sampleRate } = options;
        const normalizedCutoff = cutoffFrequency / (sampleRate / 2);
        if (normalizedCutoff <= 0 || normalizedCutoff >= 1) {
            throw new Error(`Cutoff frequency must be between 0 and ${sampleRate / 2} Hz`);
        }
        const nativeFilter = DspAddon.IirFilter.createFirstOrderHighPass(normalizedCutoff);
        return new IirFilter(nativeFilter);
    }
    /**
     * Create Chebyshev Type I low-pass filter (passband ripple)
     */
    static createChebyshevLowPass(options) {
        const { cutoffFrequency, sampleRate, order, rippleDb = 0.5 } = options;
        const normalizedCutoff = cutoffFrequency / (sampleRate / 2);
        if (normalizedCutoff <= 0 || normalizedCutoff >= 1) {
            throw new Error(`Cutoff frequency must be between 0 and ${sampleRate / 2} Hz`);
        }
        if (order < 1 || order > 8) {
            throw new Error("Order must be between 1 and 8");
        }
        if (rippleDb <= 0 || rippleDb > 3) {
            throw new Error("Ripple must be between 0 and 3 dB");
        }
        const nativeFilter = DspAddon.IirFilter.createChebyshevLowPass(normalizedCutoff, order, rippleDb);
        return new IirFilter(nativeFilter);
    }
    /**
     * Create Chebyshev Type I high-pass filter (passband ripple)
     */
    static createChebyshevHighPass(options) {
        const { cutoffFrequency, sampleRate, order, rippleDb = 0.5 } = options;
        const normalizedCutoff = cutoffFrequency / (sampleRate / 2);
        if (normalizedCutoff <= 0 || normalizedCutoff >= 1) {
            throw new Error(`Cutoff frequency must be between 0 and ${sampleRate / 2} Hz`);
        }
        if (order < 1 || order > 8) {
            throw new Error("Order must be between 1 and 8");
        }
        if (rippleDb <= 0 || rippleDb > 3) {
            throw new Error("Ripple must be between 0 and 3 dB");
        }
        const nativeFilter = DspAddon.IirFilter.createChebyshevHighPass(normalizedCutoff, order, rippleDb);
        return new IirFilter(nativeFilter);
    }
    /**
     * Create Chebyshev Type I band-pass filter (passband ripple)
     */
    static createChebyshevBandPass(options) {
        const { lowCutoffFrequency, highCutoffFrequency, sampleRate, order, rippleDb = 0.5, } = options;
        const normalizedLow = lowCutoffFrequency / (sampleRate / 2);
        const normalizedHigh = highCutoffFrequency / (sampleRate / 2);
        if (normalizedLow <= 0 ||
            normalizedHigh >= 1 ||
            normalizedLow >= normalizedHigh) {
            throw new Error("Invalid cutoff frequencies");
        }
        if (order < 1 || order > 8) {
            throw new Error("Order must be between 1 and 8");
        }
        const nativeFilter = DspAddon.IirFilter.createChebyshevBandPass(normalizedLow, normalizedHigh, order, rippleDb);
        return new IirFilter(nativeFilter);
    }
    /**
     * Create peaking EQ biquad filter
     * Useful for parametric EQ, boosting/cutting specific frequencies
     */
    static createPeakingEQ(options) {
        const { centerFrequency, sampleRate, Q, gainDb } = options;
        const normalizedFreq = centerFrequency / (sampleRate / 2);
        if (normalizedFreq <= 0 || normalizedFreq >= 1) {
            throw new Error(`Center frequency must be between 0 and ${sampleRate / 2} Hz`);
        }
        if (Q <= 0) {
            throw new Error("Q must be positive");
        }
        const nativeFilter = DspAddon.IirFilter.createPeakingEQ(normalizedFreq, Q, gainDb);
        return new IirFilter(nativeFilter);
    }
    /**
     * Create low-shelf biquad filter
     * Boosts or cuts all frequencies below cutoff
     */
    static createLowShelf(options) {
        const { cutoffFrequency, sampleRate, gainDb, Q = 0.707 } = options;
        const normalizedCutoff = cutoffFrequency / (sampleRate / 2);
        if (normalizedCutoff <= 0 || normalizedCutoff >= 1) {
            throw new Error(`Cutoff frequency must be between 0 and ${sampleRate / 2} Hz`);
        }
        if (Q <= 0) {
            throw new Error("Q must be positive");
        }
        const nativeFilter = DspAddon.IirFilter.createLowShelf(normalizedCutoff, gainDb, Q);
        return new IirFilter(nativeFilter);
    }
    /**
     * Create high-shelf biquad filter
     * Boosts or cuts all frequencies above cutoff
     */
    static createHighShelf(options) {
        const { cutoffFrequency, sampleRate, gainDb, Q = 0.707 } = options;
        const normalizedCutoff = cutoffFrequency / (sampleRate / 2);
        if (normalizedCutoff <= 0 || normalizedCutoff >= 1) {
            throw new Error(`Cutoff frequency must be between 0 and ${sampleRate / 2} Hz`);
        }
        if (Q <= 0) {
            throw new Error("Q must be positive");
        }
        const nativeFilter = DspAddon.IirFilter.createHighShelf(normalizedCutoff, gainDb, Q);
        return new IirFilter(nativeFilter);
    }
    /**
     * Process single sample
     */
    async processSample(input) {
        return this.native.processSample(input);
    }
    /**
     * Process batch of samples
     */
    async process(input) {
        return this.native.process(input);
    }
    /**
     * Reset filter state
     */
    reset() {
        this.native.reset();
    }
    /**
     * Get feedforward (B) coefficients
     */
    getBCoefficients() {
        return this.native.getBCoefficients();
    }
    /**
     * Get feedback (A) coefficients
     */
    getACoefficients() {
        return this.native.getACoefficients();
    }
    /**
     * Get filter order
     */
    getOrder() {
        return this.native.getOrder();
    }
    /**
     * Check if filter is stable
     */
    isStable() {
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
function createFilter(options) {
    const { type, mode } = options;
    // FIR Filters
    if (type === "fir") {
        const firOpts = options;
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
                    throw new Error("lowCutoffFrequency and highCutoffFrequency required for bandpass");
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
                    throw new Error("lowCutoffFrequency and highCutoffFrequency required for bandstop");
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
        const butterOpts = options;
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
                    throw new Error("lowCutoffFrequency and highCutoffFrequency required");
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
        const chebyOpts = options;
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
                    throw new Error("lowCutoffFrequency and highCutoffFrequency required");
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
        const biquadOpts = options;
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
                throw new Error(`Unsupported Biquad mode: ${mode}. Use IirFilter.createPeakingEQ/createLowShelf/createHighShelf for EQ/shelf filters.`);
        }
    }
    // Generic IIR (first-order for now)
    if (type === "iir") {
        const iirOpts = options;
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
        throw new Error(`Generic IIR filters with order > 1 not yet supported. Use 'butterworth' type.`);
    }
    throw new Error(`Unsupported filter type: ${type}`);
}
// ============================================================
// Exports
// ============================================================
export { 
// Classes
FirFilter as Fir, IirFilter as Iir, };
//# sourceMappingURL=filters.js.map