/**
 * Drift Detection for Time-Series Processing
 *
 * Monitors sample timing and detects drift/irregularities in real-time data streams.
 * Useful for debugging hardware issues, network problems, and ensuring data quality.
 */
/**
 * DriftDetector monitors timing between samples and detects anomalies
 */
export class DriftDetector {
    constructor(options = {}) {
        this.previousTimestamp = null;
        this.sampleIndex = 0;
        // Metrics tracking
        this.samplesProcessed = 0;
        this.driftEventsCount = 0;
        this.minDelta = Infinity;
        this.maxDelta = -Infinity;
        this.deltasSum = 0;
        this.deltasSumSquared = 0;
        this.maxDriftObserved = 0;
        this.options = {
            expectedSampleRate: options.expectedSampleRate ?? 1000,
            driftThreshold: options.driftThreshold ?? 10,
            onDriftDetected: options.onDriftDetected ?? (() => { }),
            onTimingMeasured: options.onTimingMeasured ?? (() => { }),
        };
    }
    /**
     * Process a single timestamp and detect drift
     */
    processSample(timestamp) {
        if (this.previousTimestamp !== null) {
            const deltaMs = timestamp - this.previousTimestamp;
            const expectedMs = 1000 / this.options.expectedSampleRate;
            const absoluteDrift = Math.abs(deltaMs - expectedMs);
            const relativeDrift = (absoluteDrift / expectedMs) * 100;
            const stats = {
                deltaMs,
                expectedMs,
                absoluteDrift,
                relativeDrift,
                sampleIndex: this.sampleIndex,
                currentTimestamp: timestamp,
                previousTimestamp: this.previousTimestamp,
            };
            // Update metrics
            this.updateMetrics(deltaMs, absoluteDrift);
            // Call timing callback (every sample)
            this.options.onTimingMeasured(stats);
            // Detect drift
            if (relativeDrift > this.options.driftThreshold) {
                this.driftEventsCount++;
                this.options.onDriftDetected(stats);
            }
        }
        this.previousTimestamp = timestamp;
        this.sampleIndex++;
        this.samplesProcessed++;
    }
    /**
     * Process a batch of timestamps
     */
    processBatch(timestamps) {
        for (let i = 0; i < timestamps.length; i++) {
            this.processSample(timestamps[i]);
        }
    }
    /**
     * Get current timing metrics
     */
    getMetrics() {
        const avgDelta = this.samplesProcessed > 1
            ? this.deltasSum / (this.samplesProcessed - 1)
            : 0;
        const variance = this.samplesProcessed > 1
            ? this.deltasSumSquared / (this.samplesProcessed - 1) -
                avgDelta * avgDelta
            : 0;
        const stdDev = Math.sqrt(Math.max(0, variance));
        return {
            samplesProcessed: this.samplesProcessed,
            driftEventsCount: this.driftEventsCount,
            minDelta: this.minDelta === Infinity ? 0 : this.minDelta,
            maxDelta: this.maxDelta === -Infinity ? 0 : this.maxDelta,
            averageDelta: avgDelta,
            stdDevDelta: stdDev,
            maxDriftObserved: this.maxDriftObserved,
        };
    }
    /**
     * Reset all metrics and state
     */
    reset() {
        this.previousTimestamp = null;
        this.sampleIndex = 0;
        this.samplesProcessed = 0;
        this.driftEventsCount = 0;
        this.minDelta = Infinity;
        this.maxDelta = -Infinity;
        this.deltasSum = 0;
        this.deltasSumSquared = 0;
        this.maxDriftObserved = 0;
    }
    /**
     * Get the expected sample rate configured for this detector
     */
    getExpectedSampleRate() {
        return this.options.expectedSampleRate;
    }
    /**
     * Update internal metrics
     */
    updateMetrics(deltaMs, absoluteDrift) {
        this.minDelta = Math.min(this.minDelta, deltaMs);
        this.maxDelta = Math.max(this.maxDelta, deltaMs);
        this.deltasSum += deltaMs;
        this.deltasSumSquared += deltaMs * deltaMs;
        this.maxDriftObserved = Math.max(this.maxDriftObserved, absoluteDrift);
    }
}
export function detectGaps(timestamps, expectedSampleRate, gapThreshold = 2.0 // Multiplier of expected interval
) {
    const gaps = [];
    const expectedInterval = 1000 / expectedSampleRate;
    const gapMinDuration = expectedInterval * gapThreshold;
    for (let i = 1; i < timestamps.length; i++) {
        const delta = timestamps[i] - timestamps[i - 1];
        if (delta > gapMinDuration) {
            const expectedSamples = Math.floor(delta / expectedInterval) - 1;
            gaps.push({
                startIndex: i - 1,
                endIndex: i,
                durationMs: delta,
                expectedSamples,
                timestampBefore: timestamps[i - 1],
                timestampAfter: timestamps[i],
            });
        }
    }
    return gaps;
}
export function validateMonotonicity(timestamps) {
    const violations = [];
    for (let i = 1; i < timestamps.length; i++) {
        const current = timestamps[i];
        const previous = timestamps[i - 1];
        if (current < previous) {
            violations.push({
                index: i,
                currentTimestamp: current,
                previousTimestamp: previous,
                violation: "backwards",
            });
        }
        else if (current === previous) {
            violations.push({
                index: i,
                currentTimestamp: current,
                previousTimestamp: previous,
                violation: "duplicate",
            });
        }
    }
    return violations;
}
export function estimateSampleRate(timestamps) {
    if (timestamps.length < 2) {
        return {
            estimatedRate: 0,
            averageInterval: 0,
            stdDevInterval: 0,
            coefficientOfVariation: 0,
            regularity: "irregular",
        };
    }
    // Calculate intervals
    let sumIntervals = 0;
    let sumSquaredIntervals = 0;
    for (let i = 1; i < timestamps.length; i++) {
        const interval = timestamps[i] - timestamps[i - 1];
        sumIntervals += interval;
        sumSquaredIntervals += interval * interval;
    }
    const n = timestamps.length - 1;
    const avgInterval = sumIntervals / n;
    const variance = sumSquaredIntervals / n - avgInterval * avgInterval;
    const stdDev = Math.sqrt(Math.max(0, variance));
    const cv = avgInterval > 0 ? stdDev / avgInterval : Infinity;
    // Assess regularity
    let regularity;
    if (cv < 0.01)
        regularity = "excellent"; // <1% variation
    else if (cv < 0.05)
        regularity = "good"; // <5% variation
    else if (cv < 0.15)
        regularity = "fair"; // <15% variation
    else if (cv < 0.3)
        regularity = "poor"; // <30% variation
    else
        regularity = "irregular"; // >30% variation
    return {
        estimatedRate: 1000 / avgInterval,
        averageInterval: avgInterval,
        stdDevInterval: stdDev,
        coefficientOfVariation: cv,
        regularity,
    };
}
//# sourceMappingURL=DriftDetector.js.map