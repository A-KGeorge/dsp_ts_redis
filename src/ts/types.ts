/**
 * Options for processing data
 *
 * Two modes supported:
 * 1. Sample-based (legacy): Provide sampleRate, assumes fixed intervals
 * 2. Time-based (new): Omit sampleRate, timestamps are explicit or auto-generated
 */
export interface ProcessOptions {
  /**
   * Sample rate in Hz (legacy mode)
   * If provided, assumes fixed time intervals between samples
   * If omitted, uses explicit timestamps (time-based mode)
   */
  sampleRate?: number;

  /**
   * Number of channels in the signal (default: 1)
   */
  channels?: number;
}

/**
 * Redis configuration for state persistence
 */
export interface RedisConfig {
  redisHost?: string;
  redisPort?: number;
  stateKey?: string;
}

/**
 * Parameters for adding a moving average stage
 *
 * Two windowing modes supported:
 * 1. Sample-based (legacy): windowSize in samples (requires sampleRate in process())
 * 2. Time-based (new): windowDuration in milliseconds (works with any sample rate)
 */
export interface MovingAverageParams {
  mode: "batch" | "moving";

  /**
   * Window size in samples (legacy, sample-based mode)
   * Required for "moving" mode when using sampleRate-based processing
   */
  windowSize?: number;

  /**
   * Window duration in milliseconds (time-based mode)
   * Required for "moving" mode when using time-based processing
   * Takes precedence over windowSize if both provided
   */
  windowDuration?: number;
}

/**
 * Parameters for adding a RMS stage
 *
 * Two windowing modes supported:
 * 1. Sample-based (legacy): windowSize in samples (requires sampleRate in process())
 * 2. Time-based (new): windowDuration in milliseconds (works with any sample rate)
 */
export interface RmsParams {
  mode: "batch" | "moving";

  /**
   * Window size in samples (legacy, sample-based mode)
   * Required for "moving" mode when using sampleRate-based processing
   */
  windowSize?: number;

  /**
   * Window duration in milliseconds (time-based mode)
   * Required for "moving" mode when using time-based processing
   * Takes precedence over windowSize if both provided
   */
  windowDuration?: number;
}

/**
 * Parameters for adding a rectify stage
 */
export interface RectifyParams {
  mode?: "full" | "half"; // Default: "full"
}

/**
 * Parameters for adding a variance stage
 *
 * Two windowing modes supported:
 * 1. Sample-based (legacy): windowSize in samples (requires sampleRate in process())
 * 2. Time-based (new): windowDuration in milliseconds (works with any sample rate)
 */
export interface VarianceParams {
  mode: "batch" | "moving";

  /**
   * Window size in samples (legacy, sample-based mode)
   * Required for "moving" mode when using sampleRate-based processing
   */
  windowSize?: number;

  /**
   * Window duration in milliseconds (time-based mode)
   * Required for "moving" mode when using time-based processing
   * Takes precedence over windowSize if both provided
   */
  windowDuration?: number;
}

/**
 * Parameters for adding a Z-Score Normalization stage
 *
 * Two windowing modes supported:
 * 1. Sample-based (legacy): windowSize in samples (requires sampleRate in process())
 * 2. Time-based (new): windowDuration in milliseconds (works with any sample rate)
 */
export interface ZScoreNormalizeParams {
  mode: "batch" | "moving";

  /**
   * Window size in samples (legacy, sample-based mode)
   * Required for "moving" mode when using sampleRate-based processing
   */
  windowSize?: number;

  /**
   * Window duration in milliseconds (time-based mode)
   * Required for "moving" mode when using time-based processing
   * Takes precedence over windowSize if both provided
   */
  windowDuration?: number;

  /**
   * Small value to prevent division by zero when standard deviation is 0.
   * @default 1e-6
   */
  epsilon?: number;
}

/**
 * Parameters for adding a Mean Absolute Value (MAV) stage
 *
 * Two windowing modes supported:
 * 1. Sample-based (legacy): windowSize in samples (requires sampleRate in process())
 * 2. Time-based (new): windowDuration in milliseconds (works with any sample rate)
 */
export interface MeanAbsoluteValueParams {
  mode: "batch" | "moving";

  /**
   * Window size in samples (legacy, sample-based mode)
   * Required for "moving" mode when using sampleRate-based processing
   */
  windowSize?: number;

  /**
   * Window duration in milliseconds (time-based mode)
   * Required for "moving" mode when using time-based processing
   * Takes precedence over windowSize if both provided
   */
  windowDuration?: number;
}

/**
 * Tap callback function for inspecting samples at any point in the pipeline
 * @param samples - Float32Array view of the current samples
 * @param stageName - Name of the pipeline stage
 */
export type TapCallback = (samples: Float32Array, stageName: string) => void;

/**
 * Log levels for pipeline callbacks
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Log topics following Kafka-style hierarchical structure
 * Examples:
 * - pipeline.stage.moving-average.samples
 * - pipeline.stage.rms.performance
 * - pipeline.stage.rectify.error
 * - pipeline.debug
 * - pipeline.error
 */
export type LogTopic = string;

/**
 * Log priority levels (1-10)
 * Lower numbers = lower priority, higher numbers = higher priority
 *
 * Priority Guidelines:
 * - 1-3: Low priority (debug, verbose info)
 * - 4-6: Normal priority (standard info, warnings)
 * - 7-8: High priority (errors, important events)
 * - 9-10: Critical priority (alerts, system failures)
 */
export type LogPriority = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/**
 * Context information passed to logging callbacks
 */
export interface LogContext {
  stage?: string;
  timestamp?: number;
  [key: string]: any;
}

/**
 * A single log entry with timestamp and topic
 */
export interface LogEntry {
  topic?: LogTopic; // Optional: generated automatically by logging system
  level: LogLevel;
  message: string;
  context?: LogContext;
  timestamp: number;
  priority?: LogPriority; // Optional: defaults to 1 (lowest priority)
}

/**
 * Batch of samples with metadata for efficient callback processing
 */
export interface SampleBatch {
  stage: string;
  samples: Float32Array;
  startIndex: number;
  count: number;
}

/**
 * Pipeline callback functions for monitoring and observability
 *
 * PRODUCTION ARCHITECTURE PHILOSOPHY:
 * - Individual callbacks (onSample, onLog): ~6-7M samples/sec raw speed
 *   WARNING: BLOCKS event loop with millions of synchronous calls - NOT production-safe
 *
 * - Pooled callbacks (onBatch, onLogBatch): ~3-5M samples/sec sustained
 *   RECOMMENDED: Non-blocking, batched processing - RECOMMENDED for production
 *
 * Trade-off: Pooled callbacks sacrifice raw speed for guaranteed non-blocking behavior.
 * This aligns with industry telemetry patterns (Kafka producers, Loki agents, OTLP exporters).
 */
export interface PipelineCallbacks {
  /**
   * Called for each sample after processing (use sparingly for performance)
   * WARNING: Blocks event loop with millions of synchronous calls per second
   * Raw performance: ~6-7M samples/sec, but NOT recommended for production servers
   * Consider using onBatch instead for non-blocking, production-safe processing
   * @param value - The processed sample value
   * @param index - Sample index in the buffer
   * @param stage - Name of the current stage
   */
  onSample?: (value: number, index: number, stage: string) => void;

  /**
   * Called with batches of processed samples (RECOMMENDED for production)
   * Production-safe: Non-blocking, batched processing (~3-5M samples/sec sustained)
   * Samples are provided as a view into the result buffer
   * @param batch - Contains stage name, sample data, start index, and count
   */
  onBatch?: (batch: SampleBatch) => void;

  /**
   * Called after each stage completes processing
   * @param stage - Name of the completed stage
   * @param durationMs - Processing time in milliseconds
   */
  onStageComplete?: (stage: string, durationMs: number) => void;

  /**
   * Called when an error occurs in a stage
   * @param stage - Name of the stage where error occurred
   * @param error - The error object
   */
  onError?: (stage: string, error: Error) => void;

  /**
   * Called for each logging event during pipeline execution
   * WARNING: Blocks event loop with frequent synchronous calls
   * Raw performance: ~6M samples/sec, but NOT recommended for production servers
   * Consider using onLogBatch for non-blocking, production-safe logging (~3M samples/sec)
   * @param topic - Kafka-style hierarchical topic (e.g., "pipeline.stage.rms.error")
   * @param level - Log severity level
   * @param message - Log message
   * @param context - Additional context information
   */
  onLog?: (
    topic: LogTopic,
    level: LogLevel,
    message: string,
    context?: LogContext
  ) => void;

  /**
   * Called with batched log messages (RECOMMENDED for production)
   * Production-safe: Non-blocking, batched logging with fixed-size circular buffer
   * Logs are pooled and flushed at the end of each process() call
   * Provides stable ~3M samples/sec throughput without blocking event loop
   *
   * Topic-based filtering examples:
   * - Filter by pattern: logs.filter(l => l.topic.startsWith('pipeline.stage.'))
   * - Subscribe to errors: logs.filter(l => l.topic.endsWith('.error'))
   * - Route by topic: Route errors to alerting, metrics to monitoring
   *
   * @param logs - Array of log entries with topics and timestamps
   */
  onLogBatch?: (logs: LogEntry[]) => void;

  /**
   * Topic filter for selective log subscription (optional)
   * If provided, only logs matching the topic pattern will be delivered
   * Supports wildcards: 'pipeline.stage.*', 'pipeline.*.error'
   * If omitted, all logs are delivered
   */
  topicFilter?: string | string[];
}

/**
 * Summary information for a single pipeline stage
 */
export interface StageSummary {
  /** Stage index in the pipeline */
  index: number;
  /** Stage type (e.g., 'movingAverage', 'rms', 'rectify') */
  type: string;
  /** Window size for stateful filters in samples (legacy, if applicable) */
  windowSize?: number;
  /** Window duration for stateful filters in milliseconds (time-based, if applicable) */
  windowDuration?: number;
  /** Number of channels (if applicable) */
  numChannels?: number;
  /** Rectification mode for rectify stage (if applicable) */
  mode?: "full" | "half";
  /** Buffer size for stateful filters (if applicable) */
  bufferSize?: number;
  /** Number of channels with state (if applicable) */
  channelCount?: number;
}

/**
 * Pipeline state summary (lightweight view without full buffer data)
 * Useful for debugging and monitoring pipeline structure
 */
export interface PipelineStateSummary {
  /** Total number of stages in the pipeline */
  stageCount: number;
  /** Timestamp when the summary was generated */
  timestamp: number;
  /** Array of stage summaries */
  stages: StageSummary[];
}
