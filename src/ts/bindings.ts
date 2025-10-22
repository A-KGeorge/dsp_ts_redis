import { createRequire } from "node:module";
import type {
  ProcessOptions,
  RedisConfig,
  MovingAverageParams,
} from "./types.js";
const require = createRequire(import.meta.url);
const DspAddon = require("../build/dsp-js-native.node");

/**
 * DSP Processor class that wraps the native C++ DspPipeline
 * Provides a fluent API for building and processing DSP pipelines
 */
class DspProcessor {
  constructor(private nativeInstance: any) {}

  /**
   * Add a moving average filter stage to the pipeline
   * @param params - Configuration for the moving average filter
   * @returns this instance for method chaining
   */
  MovingAverage(params: MovingAverageParams): this {
    this.nativeInstance.addStage("movingAverage", params);
    return this;
  }

  // /**
  //  * Add a rectify stage to the pipeline (absolute value)
  //  * @returns this instance for method chaining
  //  */
  // addRectify(): this {
  //   this.nativeInstance.addStage("rectify", {});
  //   return this;
  // }

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

    // The native process method now uses Napi::AsyncWorker
    // and returns a Promise, so await it here
    // Note: The input buffer is modified in-place for zero-copy performance
    return await this.nativeInstance.process(input, opts);
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
