/**
 * Advanced DSP Operations
 *
 * This module contains TypeScript implementations of advanced DSP operations:
 * - Hjorth Parameters (Activity, Mobility, Complexity)
 * - Spectral Features (Centroid, Rolloff, Flux)
 * - Entropy Measures (Shannon, Sample Entropy, Approximate Entropy)
 *
 * Note: Resampling operations (decimate, interpolate, resample) are being
 * implemented in C++ with polyphase FIR filtering for maximum efficiency.
 * Expected release: within next few days.
 */
import type { HjorthParameters, SpectralFeatures } from "./types.js";
/**
 * Calculate Hjorth parameters for signal complexity analysis
 *
 * Hjorth parameters describe three characteristics of a signal:
 * - Activity: Variance (spread) of the signal
 * - Mobility: How much the signal changes (based on first derivative)
 * - Complexity: How much the signal's change changes (based on second derivative)
 *
 * @param signal - Input signal samples
 * @returns Hjorth parameters object
 *
 * @example
 * const signal = new Float32Array([1, 2, 3, 4, 5, 4, 3, 2, 1]);
 * const hjorth = calculateHjorthParameters(signal);
 * console.log(`Activity: ${hjorth.activity}`);
 * console.log(`Mobility: ${hjorth.mobility}`);
 * console.log(`Complexity: ${hjorth.complexity}`);
 */
export declare function calculateHjorthParameters(signal: Float32Array): HjorthParameters;
/**
 * Calculate spectral centroid (center of mass of spectrum)
 *
 * @param magnitudeSpectrum - FFT magnitude spectrum
 * @param sampleRate - Sample rate in Hz
 * @returns Spectral centroid in Hz
 */
export declare function calculateSpectralCentroid(magnitudeSpectrum: Float32Array, sampleRate: number): number;
/**
 * Calculate spectral rolloff (frequency below which X% of energy is contained)
 *
 * @param magnitudeSpectrum - FFT magnitude spectrum
 * @param sampleRate - Sample rate in Hz
 * @param percentage - Rolloff percentage (0-100, default: 85)
 * @returns Rolloff frequency in Hz
 */
export declare function calculateSpectralRolloff(magnitudeSpectrum: Float32Array, sampleRate: number, percentage?: number): number;
/**
 * Calculate spectral flux (change in spectrum from previous frame)
 *
 * @param currentSpectrum - Current frame's magnitude spectrum
 * @param previousSpectrum - Previous frame's magnitude spectrum (or null for first frame)
 * @returns Spectral flux value
 */
export declare function calculateSpectralFlux(currentSpectrum: Float32Array, previousSpectrum: Float32Array | null): number;
/**
 * Calculate all spectral features from magnitude spectrum
 *
 * @param magnitudeSpectrum - FFT magnitude spectrum
 * @param sampleRate - Sample rate in Hz
 * @param previousSpectrum - Previous frame's spectrum for flux calculation
 * @param rolloffPercentage - Rolloff percentage (default: 85)
 * @returns Object containing all spectral features
 *
 * @example
 * const fft = performFFT(signal, 2048);
 * const features = calculateSpectralFeatures(fft.magnitude, 44100, null, 85);
 * console.log(`Centroid: ${features.centroid} Hz`);
 * console.log(`Rolloff: ${features.rolloff} Hz`);
 * console.log(`Flux: ${features.flux}`);
 */
export declare function calculateSpectralFeatures(magnitudeSpectrum: Float32Array, sampleRate: number, previousSpectrum?: Float32Array | null, rolloffPercentage?: number): SpectralFeatures;
/**
 * Calculate Shannon entropy of a signal
 * Measures the uncertainty/randomness in the signal's amplitude distribution
 *
 * @param signal - Input signal samples
 * @param numBins - Number of histogram bins (default: 256)
 * @returns Shannon entropy value
 *
 * @example
 * const signal = new Float32Array(1000);
 * // ... fill signal with data
 * const entropy = calculateShannonEntropy(signal, 256);
 * console.log(`Entropy: ${entropy} bits`);
 */
export declare function calculateShannonEntropy(signal: Float32Array, numBins?: number): number;
/**
 * Calculate Sample Entropy (SampEn)
 * Measures the likelihood that similar patterns remain similar on next increment
 *
 * @param signal - Input signal samples
 * @param m - Pattern length (default: 2)
 * @param r - Tolerance for matching (default: 0.2 * std deviation)
 * @returns Sample entropy value
 *
 * @example
 * const signal = new Float32Array(1000);
 * // ... fill signal with data
 * const sampEn = calculateSampleEntropy(signal, 2, 0.2);
 * console.log(`Sample Entropy: ${sampEn}`);
 */
export declare function calculateSampleEntropy(signal: Float32Array, m?: number, r?: number): number;
/**
 * Calculate Approximate Entropy (ApEn)
 * Similar to SampEn but includes self-matches
 *
 * @param signal - Input signal samples
 * @param m - Pattern length (default: 2)
 * @param r - Tolerance for matching (default: 0.2 * std deviation)
 * @returns Approximate entropy value
 *
 * @example
 * const signal = new Float32Array(1000);
 * // ... fill signal with data
 * const apEn = calculateApproximateEntropy(signal, 2, 0.2);
 * console.log(`Approximate Entropy: ${apEn}`);
 */
export declare function calculateApproximateEntropy(signal: Float32Array, m?: number, r?: number): number;
/**
 * Stateful class for tracking Hjorth parameters over a sliding window
 */
export declare class HjorthTracker {
    private windowSize;
    private buffer;
    private writeIndex;
    private isFull;
    constructor(windowSize: number);
    /**
     * Add a new sample and get updated Hjorth parameters
     */
    update(sample: number): HjorthParameters | null;
    reset(): void;
}
/**
 * Stateful class for tracking spectral features with previous frame memory
 */
export declare class SpectralFeaturesTracker {
    private previousSpectrum;
    /**
     * Calculate spectral features, maintaining state for flux calculation
     */
    calculate(magnitudeSpectrum: Float32Array, sampleRate: number, rolloffPercentage?: number): SpectralFeatures;
    reset(): void;
}
/**
 * Stateful class for tracking entropy over a sliding window
 */
export declare class EntropyTracker {
    private windowSize;
    private numBins;
    private buffer;
    private writeIndex;
    private isFull;
    constructor(windowSize: number, numBins?: number);
    /**
     * Add a new sample and get updated Shannon entropy
     */
    update(sample: number): number | null;
    reset(): void;
}
//# sourceMappingURL=advanced-dsp.d.ts.map