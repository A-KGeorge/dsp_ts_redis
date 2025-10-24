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
export class DriftDetector {
  private options: Required<DriftDetectorOptions>;
  private previousTimestamp: number | null = null;
  private sampleIndex: number = 0;

  // Metrics tracking
  private samplesProcessed: number = 0;
  private driftEventsCount: number = 0;
  private minDelta: number = Infinity;
  private maxDelta: number = -Infinity;
  private deltasSum: number = 0;
  private deltasSumSquared: number = 0;
  private maxDriftObserved: number = 0;

  constructor(options: DriftDetectorOptions = {}) {
    this.options = {
      expectedSampleRate: options.expectedSampleRate ?? 1000,
      driftThreshold: options.driftThreshold ?? 10,
      onDriftDetected: options.onDriftDetected ?? (() => {}),
      onTimingMeasured: options.onTimingMeasured ?? (() => {}),
    };
  }

  /**
   * Process a single timestamp and detect drift
   */
  processSample(timestamp: number): void {
    if (this.previousTimestamp !== null) {
      const deltaMs = timestamp - this.previousTimestamp;
      const expectedMs = 1000 / this.options.expectedSampleRate;
      const absoluteDrift = Math.abs(deltaMs - expectedMs);
      const relativeDrift = (absoluteDrift / expectedMs) * 100;

      const stats: DriftStatistics = {
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
  processBatch(timestamps: Float32Array): void {
    for (let i = 0; i < timestamps.length; i++) {
      this.processSample(timestamps[i]);
    }
  }

  /**
   * Get current timing metrics
   */
  getMetrics(): TimingMetrics {
    const avgDelta =
      this.samplesProcessed > 1
        ? this.deltasSum / (this.samplesProcessed - 1)
        : 0;

    const variance =
      this.samplesProcessed > 1
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
  reset(): void {
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
  getExpectedSampleRate(): number {
    return this.options.expectedSampleRate;
  }

  /**
   * Update internal metrics
   */
  private updateMetrics(deltaMs: number, absoluteDrift: number): void {
    this.minDelta = Math.min(this.minDelta, deltaMs);
    this.maxDelta = Math.max(this.maxDelta, deltaMs);
    this.deltasSum += deltaMs;
    this.deltasSumSquared += deltaMs * deltaMs;
    this.maxDriftObserved = Math.max(this.maxDriftObserved, absoluteDrift);
  }
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

export function detectGaps(
  timestamps: Float32Array,
  expectedSampleRate: number,
  gapThreshold: number = 2.0 // Multiplier of expected interval
): GapDetection[] {
  const gaps: GapDetection[] = [];
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

/**
 * Utility: Validate timestamp monotonicity
 */
export interface MonotonicityViolation {
  index: number;
  currentTimestamp: number;
  previousTimestamp: number;
  violation: "backwards" | "duplicate";
}

export function validateMonotonicity(
  timestamps: Float32Array
): MonotonicityViolation[] {
  const violations: MonotonicityViolation[] = [];

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
    } else if (current === previous) {
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

export function estimateSampleRate(
  timestamps: Float32Array
): SampleRateEstimate {
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
  let regularity: "excellent" | "good" | "fair" | "poor" | "irregular";
  if (cv < 0.01) regularity = "excellent"; // <1% variation
  else if (cv < 0.05) regularity = "good"; // <5% variation
  else if (cv < 0.15) regularity = "fair"; // <15% variation
  else if (cv < 0.3) regularity = "poor"; // <30% variation
  else regularity = "irregular"; // >30% variation

  return {
    estimatedRate: 1000 / avgInterval,
    averageInterval: avgInterval,
    stdDevInterval: stdDev,
    coefficientOfVariation: cv,
    regularity,
  };
}
