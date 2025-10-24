import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type {
  ProcessOptions,
  RedisConfig,
  MovingAverageParams,
  RmsParams,
  RectifyParams,
  VarianceParams,
  ZScoreNormalizeParams,
  MeanAbsoluteValueParams,
  PipelineCallbacks,
  LogEntry,
  SampleBatch,
  TapCallback,
  PipelineStateSummary,
} from "./types.js";
import { CircularLogBuffer } from "./CircularLogBuffer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// Try multiple paths to find the native module
let DspAddon: any;
const possiblePaths = [
  join(__dirname, "../build/dsp-js-native.node"),
  join(__dirname, "../../build/Release/dsp-js-native.node"),
  join(process.cwd(), "build/Release/dsp-js-native.node"),
  join(process.cwd(), "src/build/dsp-js-native.node"),
];

const errors: Array<{ path: string; error: string }> = [];

for (const path of possiblePaths) {
  try {
    DspAddon = require(path);
    break;
  } catch (err: any) {
    errors.push({ path, error: err.message });
    // Try next path
  }
}

if (!DspAddon) {
  console.error("❌ Failed to load native module. Tried paths:");
  errors.forEach(({ path, error }) => {
    console.error(`  - ${path}`);
    console.error(`    Error: ${error}`);
  });
  throw new Error(
    `Could not load native module. Tried ${possiblePaths.length} paths.`
  );
}

/**
 * DSP Processor class that wraps the native C++ DspPipeline
 * Provides a fluent API for building and processing DSP pipelines
 */
class DspProcessor {
  private stages: string[] = [];
  private callbacks?: PipelineCallbacks;
  private logBuffer: CircularLogBuffer;
  private tapCallbacks: Array<{ stageName: string; callback: TapCallback }> =
    [];

  constructor(private nativeInstance: any) {
    // Initialize circular buffer with capacity for typical log volume
    // (2-3 logs per process call, supports bursts up to 32)
    this.logBuffer = new CircularLogBuffer(32);
  }

  /**
   * Generate a Kafka-style topic for a log entry
   */
  private generateLogTopic(
    level: "debug" | "info" | "warn" | "error",
    context?: any
  ): string {
    const stage = context?.stage;
    const category = context?.category || level;

    if (stage) {
      // Stage-specific topic: pipeline.stage.<stageName>.<category>
      return `pipeline.stage.${stage}.${category}`;
    } else {
      // General topic: pipeline.<level>
      return `pipeline.${level}`;
    }
  }

  /**
   * Check if a topic matches the configured topic filter
   */
  private matchesTopicFilter(topic: string): boolean {
    const filter = this.callbacks?.topicFilter;
    if (!filter) {
      return true; // No filter, accept all
    }

    const filters = Array.isArray(filter) ? filter : [filter];

    for (const pattern of filters) {
      // Convert wildcard pattern to regex
      // pipeline.stage.* -> ^pipeline\.stage\.[^.]+$
      // pipeline.*.error -> ^pipeline\.[^.]+\.error$
      const regexPattern = pattern
        .replace(/\./g, "\\.")
        .replace(/\*/g, "[^.]+");
      const regex = new RegExp(`^${regexPattern}$`);

      if (regex.test(topic)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Add a log entry to the circular buffer for batched processing
   */
  /**
   * Map log level to default priority
   * debug: 2, info: 5, warn: 7, error: 9
   */
  private getDefaultPriority(
    level: "debug" | "info" | "warn" | "error"
  ): 2 | 5 | 7 | 9 {
    switch (level) {
      case "debug":
        return 2;
      case "info":
        return 5;
      case "warn":
        return 7;
      case "error":
        return 9;
    }
  }

  /**
   * Pool a log entry in the circular buffer for batch delivery
   */
  private poolLog(
    level: "debug" | "info" | "warn" | "error",
    message: string,
    context?: any
  ): void {
    const topic = this.generateLogTopic(level, context);

    // If onLogBatch is configured, pool the log in circular buffer (with topic filtering)
    if (this.callbacks?.onLogBatch && this.matchesTopicFilter(topic)) {
      this.logBuffer.push({
        topic,
        level,
        message,
        context,
        timestamp: performance.now(),
        priority: this.getDefaultPriority(level),
      });
    }

    // If onLog is also configured, call it immediately (backwards compatible, with topic filtering)
    if (this.callbacks?.onLog && this.matchesTopicFilter(topic)) {
      this.callbacks.onLog(topic, level, message, context);
    }
  }

  /**
   * Flush all pooled logs from circular buffer to the onLogBatch callback
   */
  private flushLogs(): void {
    if (this.callbacks?.onLogBatch && this.logBuffer.hasEntries()) {
      const logs = this.logBuffer.flush();
      this.callbacks.onLogBatch(logs);
    }
  }

  /**
   * Add a moving average filter stage to the pipeline
   * @param params - Configuration for the moving average filter
   * @param params.mode - "batch" for stateless averaging (all samples → single average), "moving" for windowed averaging
   * @param params.windowSize - Required for "moving" mode when using sample-based processing
   * @param params.windowDuration - Required for "moving" mode when using time-based processing (milliseconds)
   * @returns this instance for method chaining
   *
   * @example
   * // Batch mode (stateless)
   * pipeline.MovingAverage({ mode: "batch" });
   *
   * @example
   * // Moving mode with sample window (legacy)
   * pipeline.MovingAverage({ mode: "moving", windowSize: 10 });
   *
   * @example
   * // Moving mode with time window (recommended)
   * pipeline.MovingAverage({ mode: "moving", windowDuration: 5000 }); // 5 seconds
   */
  MovingAverage(params: MovingAverageParams): this {
    if (params.mode === "moving") {
      if (
        params.windowSize === undefined &&
        params.windowDuration === undefined
      ) {
        throw new TypeError(
          `MovingAverage: either windowSize or windowDuration must be specified for "moving" mode`
        );
      }
      if (
        params.windowSize !== undefined &&
        (params.windowSize <= 0 || !Number.isInteger(params.windowSize))
      ) {
        throw new TypeError(
          `MovingAverage: windowSize must be a positive integer for "moving" mode, got ${params.windowSize}`
        );
      }
      if (params.windowDuration !== undefined && params.windowDuration <= 0) {
        throw new TypeError(
          `MovingAverage: windowDuration must be positive, got ${params.windowDuration}`
        );
      }
    }
    this.nativeInstance.addStage("movingAverage", params);
    this.stages.push(`movingAverage:${params.mode}`);
    return this;
  }

  /**
   * Add a RMS (root mean square) stage to the pipeline
   * @param params - Configuration for the RMS filter
   * @param params.mode - "batch" for stateless RMS (all samples → single RMS), "moving" for windowed RMS
   * @param params.windowSize - Required for "moving" mode when using sample-based processing
   * @param params.windowDuration - Required for "moving" mode when using time-based processing (milliseconds)
   * @returns this instance for method chaining
   *
   * @example
   * // Batch mode (stateless)
   * pipeline.Rms({ mode: "batch" });
   *
   * @example
   * // Moving mode with sample window (legacy)
   * pipeline.Rms({ mode: "moving", windowSize: 50 });
   *
   * @example
   * // Moving mode with time window (recommended)
   * pipeline.Rms({ mode: "moving", windowDuration: 10000 }); // 10 seconds
   */
  Rms(params: RmsParams): this {
    if (params.mode === "moving") {
      if (
        params.windowSize === undefined &&
        params.windowDuration === undefined
      ) {
        throw new TypeError(
          `RMS: either windowSize or windowDuration must be specified for "moving" mode`
        );
      }
      if (
        params.windowSize !== undefined &&
        (params.windowSize <= 0 || !Number.isInteger(params.windowSize))
      ) {
        throw new TypeError(
          `RMS: windowSize must be a positive integer for "moving" mode, got ${params.windowSize}`
        );
      }
      if (params.windowDuration !== undefined && params.windowDuration <= 0) {
        throw new TypeError(
          `RMS: windowDuration must be positive, got ${params.windowDuration}`
        );
      }
    }
    this.nativeInstance.addStage("rms", params);
    this.stages.push(`rms:${params.mode}`);
    return this;
  }

  /**
   * Add a rectify stage to the pipeline
   * @param params - Configuration for the rectify filter (optional)
   * @returns this instance for method chaining
   */
  Rectify(params?: RectifyParams): this {
    this.nativeInstance.addStage("rectify", params || { mode: "full" });
    this.stages.push(`rectify:${params?.mode || "full"}`);
    return this;
  }

  /**
   * Add a variance stage to the pipeline
   * Variance measures the spread of data around the mean
   *
   * @param params - Configuration for the variance filter
   * @param params.mode - "batch" for stateless variance (all samples → single value), "moving" for windowed variance
   * @param params.windowSize - Required for "moving" mode when using sample-based processing
   * @param params.windowDuration - Required for "moving" mode when using time-based processing (milliseconds)
   * @returns this instance for method chaining
   *
   * @example
   * // Batch variance (stateless)
   * pipeline.Variance({ mode: "batch" });
   *
   * @example
   * // Moving variance with sample window (legacy)
   * pipeline.Variance({ mode: "moving", windowSize: 100 });
   *
   * @example
   * // Moving variance with time window (recommended)
   * pipeline.Variance({ mode: "moving", windowDuration: 60000 }); // 1 minute
   */
  Variance(params: VarianceParams): this {
    if (params.mode === "moving") {
      if (
        params.windowSize === undefined &&
        params.windowDuration === undefined
      ) {
        throw new TypeError(
          `Variance: either windowSize or windowDuration must be specified for "moving" mode`
        );
      }
      if (
        params.windowSize !== undefined &&
        (params.windowSize <= 0 || !Number.isInteger(params.windowSize))
      ) {
        throw new TypeError(
          `Variance: windowSize must be a positive integer for "moving" mode, got ${params.windowSize}`
        );
      }
      if (params.windowDuration !== undefined && params.windowDuration <= 0) {
        throw new TypeError(
          `Variance: windowDuration must be positive, got ${params.windowDuration}`
        );
      }
    }
    this.nativeInstance.addStage("variance", params);
    this.stages.push(`variance:${params.mode}`);
    return this;
  }

  /**
   * Add a Z-Score Normalization stage to the pipeline
   * Z-Score Normalization standardizes data to have mean 0 and standard deviation 1
   * @param params - Configuration for the Z-Score Normalization filter
   * @param params.mode - "batch" for stateless normalization, "moving" for windowed normalization
   * @param params.windowSize - Required for "moving" mode when using sample-based processing
   * @param params.windowDuration - Required for "moving" mode when using time-based processing (milliseconds)
   * @return this instance for method chaining
   * @example
   * // Batch Z-Score Normalization (stateless)
   * pipeline.ZScoreNormalize({ mode: "batch" });
   * @example
   * // Moving Z-Score Normalization with sample window (legacy)
   * pipeline.ZScoreNormalize({ mode: "moving", windowSize: 100 });
   * @example
   * // Moving Z-Score Normalization with time window (recommended)
   * pipeline.ZScoreNormalize({ mode: "moving", windowDuration: 30000 }); // 30 seconds
   */
  ZScoreNormalize(params: ZScoreNormalizeParams): this {
    if (params.mode === "moving") {
      if (
        params.windowSize === undefined &&
        params.windowDuration === undefined
      ) {
        throw new TypeError(
          `Z-Score Normalize: either windowSize or windowDuration must be specified for "moving" mode`
        );
      }
      if (
        params.windowSize !== undefined &&
        (params.windowSize <= 0 || !Number.isInteger(params.windowSize))
      ) {
        throw new TypeError(
          `Z-Score Normalize: windowSize must be a positive integer for "moving" mode, got ${params.windowSize}`
        );
      }
      if (params.windowDuration !== undefined && params.windowDuration <= 0) {
        throw new TypeError(
          `Z-Score Normalize: windowDuration must be positive, got ${params.windowDuration}`
        );
      }
    }
    this.nativeInstance.addStage("zScoreNormalize", params);
    this.stages.push(`zScoreNormalize:${params.mode}`);
    return this;
  }

  /**
   * Add a Mean Absolute Value (MAV) stage to the pipeline
   * Mean Absolute Value computes the average of the absolute values of the samples
   * @param params - Configuration for the MAV filter
   * @param params.mode - "batch" for stateless MAV (all samples → single value), "moving" for windowed MAV
   * @param params.windowSize - Required for "moving" mode when using sample-based processing
   * @param params.windowDuration - Required for "moving" mode when using time-based processing (milliseconds)
   * @return this instance for method chaining
   * @example
   * // Batch MAV (stateless)
   * pipeline.MeanAbsoluteValue({ mode: "batch" });
   * @example
   * // Moving MAV with sample window (legacy)
   * pipeline.MeanAbsoluteValue({ mode: "moving", windowSize: 50 });
   * @example
   * // Moving MAV with time window (recommended)
   * pipeline.MeanAbsoluteValue({ mode: "moving", windowDuration: 2000 }); // 2 seconds
   */
  MeanAbsoluteValue(params: MeanAbsoluteValueParams): this {
    if (params.mode === "moving") {
      if (
        params.windowSize === undefined &&
        params.windowDuration === undefined
      ) {
        throw new TypeError(
          `Mean Absolute Value: either windowSize or windowDuration must be specified for "moving" mode`
        );
      }
      if (
        params.windowSize !== undefined &&
        (params.windowSize <= 0 || !Number.isInteger(params.windowSize))
      ) {
        throw new TypeError(
          `Mean Absolute Value: windowSize must be a positive integer for "moving" mode, got ${params.windowSize}`
        );
      }
      if (params.windowDuration !== undefined && params.windowDuration <= 0) {
        throw new TypeError(
          `Mean Absolute Value: windowDuration must be positive, got ${params.windowDuration}`
        );
      }
    }
    this.nativeInstance.addStage("meanAbsoluteValue", params);
    this.stages.push(`meanAbsoluteValue:${params.mode}`);
    return this;
  }

  // addNotchFilter(freqHz: number): this {
  //   this.nativeInstance.addStage("notchFilter", { freqHz });
  //   return this;
  // }

  /**
   * Tap into the pipeline for debugging and inspection
   * The callback is executed synchronously after processing, allowing you to inspect
   * intermediate results without modifying the data flow
   *
   * @param callback - Function to inspect samples (receives Float32Array view and stage name)
   * @returns this instance for method chaining
   *
   * @example
   * pipeline
   *   .MovingAverage({ mode: "moving", windowSize: 10 })
   *   .tap((samples, stage) => console.log(`After ${stage}:`, samples.slice(0, 5)))
   *   .Rectify()
   *   .tap((samples) => logger.debug('After rectify:', samples.slice(0, 5)))
   *   .Rms({ mode: "moving", windowSize: 5 });
   *
   * @example
   * // Conditional logging
   * pipeline
   *   .MovingAverage({ mode: "moving", windowSize: 100 })
   *   .tap((samples, stage) => {
   *     const max = Math.max(...samples);
   *     if (max > THRESHOLD) {
   *       console.warn(`High amplitude detected at ${stage}: ${max}`);
   *     }
   *   });
   */
  tap(callback: TapCallback): this {
    const currentStageName = this.stages.join(" → ") || "start";
    this.tapCallbacks.push({ stageName: currentStageName, callback });
    return this;
  }

  /**
   * Configure pipeline callbacks for monitoring and observability
   * @param callbacks - Object containing callback functions
   * @returns this instance for method chaining
   *
   * @example
   * pipeline
   *   .pipeline({
   *     onSample: (value, i, stage) => {
   *       if (value > THRESHOLD) triggerAlert(i, stage);
   *     },
   *     onStageComplete: (stage, durationMs) => {
   *       metrics.record(`dsp.${stage}.duration`, durationMs);
   *     },
   *     onError: (stage, err) => {
   *       logger.error(`Stage ${stage} failed`, err);
   *     },
   *     onLog: (level, msg, ctx) => {
   *       if (level === "debug") return;
   *       console.log(`[${level}] ${msg}`, ctx);
   *     },
   *   })
   *   .MovingAverage({ mode: "moving", windowSize: 10 })
   *   .Rectify();
   */
  pipeline(callbacks: PipelineCallbacks): this {
    this.callbacks = callbacks;
    return this;
  }

  /**
   * Process data through the DSP pipeline
   * The native process method uses Napi::AsyncWorker and runs on a background thread
   * to avoid blocking the Node.js event loop
   *
   * Supports three modes:
   * 1. Legacy sample-based: process(samples, { sampleRate: 100, channels: 1 })
   * 2. Time-based with timestamps: process(samples, timestamps, { channels: 1 })
   * 3. Auto-generated timestamps: process(samples, { channels: 1 }) - generates [0, 1, 2, ...]
   *
   * IMPORTANT: This method modifies the input buffer in-place for performance.
   * If you need to preserve the original input, pass a copy instead.
   *
   * @param input - Float32Array containing interleaved samples (will be modified in-place)
   * @param timestampsOrOptions - Either timestamps (Float32Array) or ProcessOptions
   * @param optionsIfTimestamps - ProcessOptions if second argument is timestamps
   * @returns Promise that resolves to the processed Float32Array (same reference as input)
   */
  async process(
    input: Float32Array,
    timestampsOrOptions: Float32Array | ProcessOptions,
    optionsIfTimestamps?: ProcessOptions
  ): Promise<Float32Array> {
    let timestamps: Float32Array | undefined;
    let options: ProcessOptions;

    // Detect which overload was called
    if (timestampsOrOptions instanceof Float32Array) {
      // Time-based mode: process(samples, timestamps, options)
      timestamps = timestampsOrOptions;
      options = { channels: 1, ...optionsIfTimestamps };

      if (timestamps.length !== input.length) {
        throw new Error(
          `Timestamps length (${timestamps.length}) must match samples length (${input.length})`
        );
      }
    } else {
      // Sample-based mode or auto-timestamps: process(samples, options)
      options = { channels: 1, ...timestampsOrOptions };

      if (options.sampleRate) {
        // Legacy sample-based mode: auto-generate timestamps from sampleRate
        const dt = 1000 / options.sampleRate; // milliseconds per sample
        timestamps = new Float32Array(input.length);
        for (let i = 0; i < input.length; i++) {
          timestamps[i] = i * dt;
        }
      } else {
        // Auto-generate sequential timestamps [0, 1, 2, ...]
        timestamps = new Float32Array(input.length);
        for (let i = 0; i < input.length; i++) {
          timestamps[i] = i;
        }
      }
    }

    const startTime = performance.now();

    try {
      // Pool the start log
      this.poolLog("debug", "Starting pipeline processing", {
        sampleCount: input.length,
        channels: options.channels,
        stages: this.stages.length,
        mode: options.sampleRate ? "sample-based" : "time-based",
      });

      // Call native process with timestamps
      // Note: The input buffer is modified in-place for zero-copy performance
      const result = await this.nativeInstance.process(
        input,
        timestamps,
        options
      );

      // Execute tap callbacks for debugging/inspection
      if (this.tapCallbacks.length > 0) {
        for (const { stageName, callback } of this.tapCallbacks) {
          try {
            callback(result, stageName);
          } catch (tapError) {
            // Don't let tap errors break the pipeline
            console.error(`Tap callback error at ${stageName}:`, tapError);
          }
        }
      }

      // Execute onBatch callback (efficient - one call per process)
      if (this.callbacks?.onBatch) {
        const stageName = this.stages.join(" → ") || "pipeline";
        const batch: SampleBatch = {
          stage: stageName,
          samples: result,
          startIndex: 0,
          count: result.length,
        };
        this.callbacks.onBatch(batch);
      }

      // Execute onSample callbacks if provided (LEGACY - expensive)
      // WARNING: This can be expensive for large buffers
      if (this.callbacks?.onSample) {
        const stageName = this.stages.join(" → ") || "pipeline";
        for (let i = 0; i < result.length; i++) {
          this.callbacks.onSample(result[i], i, stageName);
        }
      }

      // Execute onStageComplete callback
      if (this.callbacks?.onStageComplete) {
        const duration = performance.now() - startTime;
        const pipelineName = this.stages.join(" → ") || "pipeline";
        this.callbacks.onStageComplete(pipelineName, duration);
      }

      // Pool the completion log
      const duration = performance.now() - startTime;
      this.poolLog("info", "Pipeline processing completed", {
        durationMs: duration,
        sampleCount: result.length,
      });

      // Flush all pooled logs at the end
      this.flushLogs();

      return result;
    } catch (error) {
      const err = error as Error;

      // Execute onError callback
      if (this.callbacks?.onError) {
        const pipelineName = this.stages.join(" → ") || "pipeline";
        this.callbacks.onError(pipelineName, err);
      }

      // Pool the error log
      this.poolLog("error", "Pipeline processing failed", {
        error: err.message,
        stack: err.stack,
      });

      // Flush logs even on error
      this.flushLogs();

      throw error;
    }
  }

  /**
   * Process a copy of the audio data through the DSP pipeline
   * This method creates a copy of the input, so the original is preserved
   *
   * @param input - Float32Array containing interleaved audio samples (original is preserved)
   * @param timestampsOrOptions - Either timestamps array or processing options (sample rate and channel count)
   * @param optionsIfTimestamps - Processing options if timestamps were provided in second parameter
   * @returns Promise that resolves to a new Float32Array with the processed data
   *
   * @example
   * // Legacy sample-based (original preserved)
   * const output = await pipeline.processCopy(samples, { sampleRate: 100, channels: 1 });
   *
   * @example
   * // Time-based with explicit timestamps (original preserved)
   * const output = await pipeline.processCopy(samples, timestamps, { channels: 1 });
   */
  async processCopy(
    input: Float32Array,
    timestampsOrOptions: Float32Array | ProcessOptions,
    optionsIfTimestamps?: ProcessOptions
  ): Promise<Float32Array> {
    // Create a copy to preserve the original
    const copy = new Float32Array(input);

    // Handle both overloaded signatures by delegating to process()
    if (timestampsOrOptions instanceof Float32Array) {
      // Time-based mode: process(samples, timestamps, options)
      const timestampsCopy = new Float32Array(timestampsOrOptions);
      return await this.process(copy, timestampsCopy, optionsIfTimestamps!);
    } else {
      // Legacy mode: process(samples, options)
      return await this.process(copy, timestampsOrOptions);
    }
  }

  /**
   * Save the current pipeline state as a JSON string
   * TypeScript can then store this in Redis or other persistent storage
   *
   * @returns JSON string containing the pipeline state
   *
   * @example
   * const stateJson = await pipeline.saveState();
   * await redis.set('dsp:state', stateJson);
   */
  async saveState(): Promise<string> {
    return this.nativeInstance.saveState();
  }

  /**
   * Load pipeline state from a JSON string
   * TypeScript retrieves this from Redis and passes it to restore state
   *
   * @param stateJson - JSON string containing the pipeline state
   * @returns Promise that resolves to true if successful
   *
   * @example
   * const stateJson = await redis.get('dsp:state');
   * if (stateJson) {
   *   await pipeline.loadState(stateJson);
   * }
   */
  async loadState(stateJson: string): Promise<boolean> {
    return this.nativeInstance.loadState(stateJson);
  }

  /**
   * Clear all pipeline state (reset all filters to initial state)
   * This resets filter buffers without removing the stages
   *
   * @example
   * pipeline.clearState(); // Reset all filters
   */
  clearState(): void {
    this.nativeInstance.clearState();
  }

  /**
   * List current pipeline state summary
   * Returns a lightweight view of the pipeline configuration without full state data.
   * Useful for debugging, monitoring, and inspecting pipeline structure.
   *
   * @returns Object containing pipeline summary with stage info
   *
   * @example
   * const pipeline = createDspPipeline()
   *   .MovingAverage({ mode: "moving", windowSize: 100 })
   *   .Rectify({ mode: 'full' })
   *   .Rms({ mode: "moving", windowSize: 50 });
   *
   * const summary = pipeline.listState();
   * console.log(summary);
   * // {
   * //   stageCount: 3,
   * //   timestamp: 1761234567,
   * //   stages: [
   * //     { index: 0, type: 'movingAverage', windowSize: 100, numChannels: 1, bufferSize: 100, channelCount: 1 },
   * //     { index: 1, type: 'rectify', mode: 'full', numChannels: 1 },
   * //     { index: 2, type: 'rms', windowSize: 50, numChannels: 1, bufferSize: 50, channelCount: 1 }
   * //   ]
   * // }
   */
  listState(): PipelineStateSummary {
    return this.nativeInstance.listState();
  }
}

/**
 * Create a new DSP pipeline builder
 * @param config - Optional Redis configuration for state persistence
 * @returns A new DspProcessor instance
 *
 * @example
 * // Create pipeline with Redis state persistence
 * const pipeline = createDspPipeline({
 *   redisHost: 'localhost',
 *   redisPort: 6379,
 *   stateKey: 'dsp:channel1'
 * });
 *
 * @example
 * // Create pipeline without Redis (state is not persisted)
 * const pipeline = createDspPipeline();
 */
export function createDspPipeline(config?: RedisConfig): DspProcessor {
  const nativeInstance = new DspAddon.DspPipeline(config);
  return new DspProcessor(nativeInstance);
}

export { DspProcessor };
