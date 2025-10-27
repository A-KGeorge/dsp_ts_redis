/**
 * Drift Detection for Time-Series Processing
 *
 * Monitors sample timing and detects drift/irregularities in real-time data streams.
 * Useful for debugging hardware issues, network problems, and ensuring data quality.
 */
export interface DriftStatistics {
    /** Current time delta between samples (ms) */
    deltaMs: number;
    /** Expected time delta based on sample rate (ms) */
    expectedMs: number;
    /** Absolute drift from expected (ms) */
    absoluteDrift: number;
    /** Relative drift as percentage (%) */
    relativeDrift: number;
    /** Sample index where drift was detected */
    sampleIndex: number;
    /** Timestamp of current sample */
    currentTimestamp: number;
    /** Timestamp of previous sample */
    previousTimestamp: number;
}
export interface DriftDetectorOptions {
    /** Expected sample rate in Hz (e.g., 1000 for 1kHz) */
    expectedSampleRate?: number;
    /** Drift threshold percentage (0-100, default: 10%) */
    driftThreshold?: number;
    /** Callback when drift is detected */
    onDriftDetected?: (stats: DriftStatistics) => void;
    /** Callback for all timing measurements (high volume!) */
    onTimingMeasured?: (stats: DriftStatistics) => void;
}
export interface TimingMetrics {
    /** Total samples processed */
    samplesProcessed: number;
    /** Number of drift events detected */
    driftEventsCount: number;
    /** Minimum delta observed (ms) */
    minDelta: number;
    /** Maximum delta observed (ms) */
    maxDelta: number;
    /** Average delta (ms) */
    averageDelta: number;
    /** Standard deviation of deltas (ms) */
    stdDevDelta: number;
    /** Largest drift detected (ms) */
    maxDriftObserved: number;
}
/**
 * DriftDetector monitors timing between samples and detects anomalies
 */
export declare class DriftDetector {
    private options;
    private previousTimestamp;
    private sampleIndex;
    private samplesProcessed;
    private driftEventsCount;
    private minDelta;
    private maxDelta;
    private deltasSum;
    private deltasSumSquared;
    private maxDriftObserved;
    constructor(options?: DriftDetectorOptions);
    /**
     * Process a single timestamp and detect drift
     */
    processSample(timestamp: number): void;
    /**
     * Process a batch of timestamps
     */
    processBatch(timestamps: Float32Array): void;
    /**
     * Get current timing metrics
     */
    getMetrics(): TimingMetrics;
    /**
     * Reset all metrics and state
     */
    reset(): void;
    /**
     * Get the expected sample rate configured for this detector
     */
    getExpectedSampleRate(): number;
    /**
     * Update internal metrics
     */
    private updateMetrics;
}
/**
 * Utility: Detect gaps in timestamps (missing samples)
 */
export interface GapDetection {
    /** Index where gap starts */
    startIndex: number;
    /** Index where gap ends */
    endIndex: number;
    /** Gap duration in ms */
    durationMs: number;
    /** Expected number of samples in gap */
    expectedSamples: number;
    /** Timestamp before gap */
    timestampBefore: number;
    /** Timestamp after gap */
    timestampAfter: number;
}
export declare function detectGaps(timestamps: Float32Array, expectedSampleRate: number, gapThreshold?: number): GapDetection[];
/**
 * Utility: Validate timestamp monotonicity
 */
export interface MonotonicityViolation {
    index: number;
    currentTimestamp: number;
    previousTimestamp: number;
    violation: "backwards" | "duplicate";
}
export declare function validateMonotonicity(timestamps: Float32Array): MonotonicityViolation[];
/**
 * Utility: Calculate sample rate from timestamps
 */
export interface SampleRateEstimate {
    /** Estimated sample rate in Hz */
    estimatedRate: number;
    /** Average interval in ms */
    averageInterval: number;
    /** Standard deviation of intervals */
    stdDevInterval: number;
    /** Coefficient of variation (stdDev / mean) */
    coefficientOfVariation: number;
    /** Regularity assessment */
    regularity: "excellent" | "good" | "fair" | "poor" | "irregular";
}
export declare function estimateSampleRate(timestamps: Float32Array): SampleRateEstimate;
//# sourceMappingURL=DriftDetector.d.ts.map