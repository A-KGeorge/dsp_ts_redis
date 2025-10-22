import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type {
  ProcessOptions,
  RedisConfig,
  MovingAverageParams,
  RmsParams,
  RectifyParams,
  PipelineCallbacks,
} from "./types.js";

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

  constructor(private nativeInstance: any) {}

  /**
   * Add a moving average filter stage to the pipeline
   * @param params - Configuration for the moving average filter
   * @returns this instance for method chaining
   */
  MovingAverage(params: MovingAverageParams): this {
    if (params.windowSize <= 0 || !Number.isInteger(params.windowSize)) {
      throw new TypeError(
        `MovingAverage: windowSize must be a positive integer, got ${params.windowSize}`
      );
    }
    this.nativeInstance.addStage("movingAverage", params);
    this.stages.push("movingAverage");
    return this;
  }

  /**
   * Add a RMS (root mean square) stage to the pipeline
   * @param params - Configuration for the RMS filter
   * @returns this instance for method chaining
   */

  Rms(params: RmsParams): this {
    this.nativeInstance.addStage("rms", params);
    this.stages.push("rms");
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

  // /**
  //  * Add a notch filter stage to the pipeline
  //  * @param freqHz - The frequency to notch out in Hz
  //  * @returns this instance for method chaining
  //  */
  // addNotchFilter(freqHz: number): this {
  //   this.nativeInstance.addStage("notchFilter", { freqHz });
  //   return this;
  // }

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
   *   .MovingAverage({ windowSize: 10 })
   *   .Rectify();
   */
  pipeline(callbacks: PipelineCallbacks): this {
    this.callbacks = callbacks;
    return this;
  }

  /**
   * Process audio data through the DSP pipeline
   * The native process method uses Napi::AsyncWorker and runs on a background thread
   * to avoid blocking the Node.js event loop
   *
   * IMPORTANT: This method modifies the input buffer in-place for performance.
   * If you need to preserve the original input, pass a copy instead.
   *
   * @param input - Float32Array containing interleaved audio samples (will be modified in-place)
   * @param options - Processing options including sample rate and channel count
   * @returns Promise that resolves to the processed Float32Array (same reference as input)
   */
  async process(
    input: Float32Array,
    options: ProcessOptions
  ): Promise<Float32Array> {
    const opts = { channels: 1, ...options };
    const startTime = performance.now();

    try {
      // Log processing start
      if (this.callbacks?.onLog) {
        this.callbacks.onLog("debug", "Starting pipeline processing", {
          sampleCount: input.length,
          channels: opts.channels,
          stages: this.stages.length,
        });
      }

      // The native process method now uses Napi::AsyncWorker
      // and returns a Promise, so await it here
      // Note: The input buffer is modified in-place for zero-copy performance
      const result = await this.nativeInstance.process(input, opts);

      // Execute onSample callbacks if provided
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

      // Log completion
      if (this.callbacks?.onLog) {
        const duration = performance.now() - startTime;
        this.callbacks.onLog("info", "Pipeline processing completed", {
          durationMs: duration,
          sampleCount: result.length,
        });
      }

      return result;
    } catch (error) {
      const err = error as Error;

      // Execute onError callback
      if (this.callbacks?.onError) {
        const pipelineName = this.stages.join(" → ") || "pipeline";
        this.callbacks.onError(pipelineName, err);
      }

      // Log error
      if (this.callbacks?.onLog) {
        this.callbacks.onLog("error", "Pipeline processing failed", {
          error: err.message,
          stack: err.stack,
        });
      }

      throw error;
    }
  }

  /**
   * Process a copy of the audio data through the DSP pipeline
   * This method creates a copy of the input, so the original is preserved
   *
   * @param input - Float32Array containing interleaved audio samples (original is preserved)
   * @param options - Processing options including sample rate and channel count
   * @returns Promise that resolves to a new Float32Array with the processed data
   */
  async processCopy(
    input: Float32Array,
    options: ProcessOptions
  ): Promise<Float32Array> {
    // Create a copy to preserve the original
    const copy = new Float32Array(input);
    return await this.process(copy, options);
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
