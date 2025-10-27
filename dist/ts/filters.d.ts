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
/**
 * Filter type (topology/algorithm)
 */
export type FilterType = "fir" | "iir" | "butterworth" | "chebyshev" | "bessel" | "biquad";
/**
 * Filter mode (frequency response)
 */
export type FilterMode = "lowpass" | "highpass" | "bandpass" | "bandstop" | "notch";
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
export type FilterOptions = FirFilterOptions | IirFilterOptions | ButterworthFilterOptions | ChebyshevFilterOptions | BiquadFilterOptions;
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
export declare class FirFilter {
    private native;
    private constructor();
    /**
     * Create low-pass FIR filter
     */
    static createLowPass(options: {
        cutoffFrequency: number;
        sampleRate: number;
        order: number;
        windowType?: WindowType;
    }): FirFilter;
    /**
     * Create high-pass FIR filter
     */
    static createHighPass(options: {
        cutoffFrequency: number;
        sampleRate: number;
        order: number;
        windowType?: WindowType;
    }): FirFilter;
    /**
     * Create band-pass FIR filter
     */
    static createBandPass(options: {
        lowCutoffFrequency: number;
        highCutoffFrequency: number;
        sampleRate: number;
        order: number;
        windowType?: WindowType;
    }): FirFilter;
    /**
     * Create band-stop (notch) FIR filter
     */
    static createBandStop(options: {
        lowCutoffFrequency: number;
        highCutoffFrequency: number;
        sampleRate: number;
        order: number;
        windowType?: WindowType;
    }): FirFilter;
    /**
     * Process single sample
     */
    processSample(input: number): Promise<number>;
    /**
     * Process batch of samples
     */
    process(input: Float32Array): Promise<Float32Array>;
    /**
     * Reset filter state
     */
    reset(): void;
    /**
     * Get filter coefficients
     */
    getCoefficients(): Float32Array;
    /**
     * Get filter order
     */
    getOrder(): number;
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
export declare class IirFilter {
    private native;
    private constructor();
    /**
     * Create Butterworth low-pass filter (maximally flat passband)
     */
    static createButterworthLowPass(options: {
        cutoffFrequency: number;
        sampleRate: number;
        order: number;
    }): IirFilter;
    /**
     * Create Butterworth high-pass filter
     */
    static createButterworthHighPass(options: {
        cutoffFrequency: number;
        sampleRate: number;
        order: number;
    }): IirFilter;
    /**
     * Create Butterworth band-pass filter
     */
    static createButterworthBandPass(options: {
        lowCutoffFrequency: number;
        highCutoffFrequency: number;
        sampleRate: number;
        order: number;
    }): IirFilter;
    /**
     * Create first-order low-pass filter (simple RC filter)
     */
    static createFirstOrderLowPass(options: {
        cutoffFrequency: number;
        sampleRate: number;
    }): IirFilter;
    /**
     * Create first-order high-pass filter
     */
    static createFirstOrderHighPass(options: {
        cutoffFrequency: number;
        sampleRate: number;
    }): IirFilter;
    /**
     * Create Chebyshev Type I low-pass filter (passband ripple)
     */
    static createChebyshevLowPass(options: {
        cutoffFrequency: number;
        sampleRate: number;
        order: number;
        rippleDb?: number;
    }): IirFilter;
    /**
     * Create Chebyshev Type I high-pass filter (passband ripple)
     */
    static createChebyshevHighPass(options: {
        cutoffFrequency: number;
        sampleRate: number;
        order: number;
        rippleDb?: number;
    }): IirFilter;
    /**
     * Create Chebyshev Type I band-pass filter (passband ripple)
     */
    static createChebyshevBandPass(options: {
        lowCutoffFrequency: number;
        highCutoffFrequency: number;
        sampleRate: number;
        order: number;
        rippleDb?: number;
    }): IirFilter;
    /**
     * Create peaking EQ biquad filter
     * Useful for parametric EQ, boosting/cutting specific frequencies
     */
    static createPeakingEQ(options: {
        centerFrequency: number;
        sampleRate: number;
        Q: number;
        gainDb: number;
    }): IirFilter;
    /**
     * Create low-shelf biquad filter
     * Boosts or cuts all frequencies below cutoff
     */
    static createLowShelf(options: {
        cutoffFrequency: number;
        sampleRate: number;
        gainDb: number;
        Q?: number;
    }): IirFilter;
    /**
     * Create high-shelf biquad filter
     * Boosts or cuts all frequencies above cutoff
     */
    static createHighShelf(options: {
        cutoffFrequency: number;
        sampleRate: number;
        gainDb: number;
        Q?: number;
    }): IirFilter;
    /**
     * Process single sample
     */
    processSample(input: number): Promise<number>;
    /**
     * Process batch of samples
     */
    process(input: Float32Array): Promise<Float32Array>;
    /**
     * Reset filter state
     */
    reset(): void;
    /**
     * Get feedforward (B) coefficients
     */
    getBCoefficients(): Float32Array;
    /**
     * Get feedback (A) coefficients
     */
    getACoefficients(): Float32Array;
    /**
     * Get filter order
     */
    getOrder(): number;
    /**
     * Check if filter is stable
     */
    isStable(): boolean;
}
export { FirFilter as Fir, IirFilter as Iir, };
//# sourceMappingURL=filters.d.ts.map