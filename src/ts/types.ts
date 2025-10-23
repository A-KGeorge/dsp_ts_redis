/**
 * Options for processing audio data
 */
export interface ProcessOptions {
  sampleRate: number;
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
 */
export interface MovingAverageParams {
  windowSize: number;
}

/**
 * Parameters for adding a RMS stage
 */
export interface RmsParams {
  windowSize: number;
}

/**
 * Parameters for adding a rectify stage
 */
export interface RectifyParams {
  mode?: "full" | "half"; // Default: "full"
}

/**
 * Log levels for pipeline callbacks
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Context information passed to logging callbacks
 */
export interface LogContext {
  stage?: string;
  timestamp?: number;
  [key: string]: any;
}

/**
 * A single log entry with timestamp
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: LogContext;
  timestamp: number;
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
 */
export interface PipelineCallbacks {
  /**
   * Called for each sample after processing (use sparingly for performance)
   * WARNING: This loops through every sample, which can be millions of calls
   * Consider using onBatch instead for better performance
   * @param value - The processed sample value
   * @param index - Sample index in the buffer
   * @param stage - Name of the current stage
   */
  onSample?: (value: number, index: number, stage: string) => void;

  /**
   * Called with batches of processed samples (more efficient than onSample)
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
   * Consider using onLogBatch for better performance with frequent logging
   * @param level - Log severity level
   * @param message - Log message
   * @param context - Additional context information
   */
  onLog?: (level: LogLevel, message: string, context?: LogContext) => void;

  /**
   * Called with batched log messages (more efficient than onLog)
   * Logs are pooled during processing and flushed at the end
   * @param logs - Array of log entries with timestamps
   */
  onLogBatch?: (logs: LogEntry[]) => void;
}
