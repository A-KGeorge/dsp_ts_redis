import type { ProcessOptions, RedisConfig, MovingAverageParams, RmsParams, RectifyParams, VarianceParams, ZScoreNormalizeParams, MeanAbsoluteValueParams, WaveformLengthParams, SlopeSignChangeParams, WillisonAmplitudeParams, PipelineCallbacks, TapCallback, PipelineStateSummary } from "./types.js";
import { type FilterOptions } from "./filters.js";
/**
 * DSP Processor class that wraps the native C++ DspPipeline
 * Provides a fluent API for building and processing DSP pipelines
 */
declare class DspProcessor {
    private nativeInstance;
    private stages;
    private callbacks?;
    private logBuffer;
    private tapCallbacks;
    private driftDetector;
    constructor(nativeInstance: any);
    /**
     * Generate a Kafka-style topic for a log entry
     */
    private generateLogTopic;
    /**
     * Check if a topic matches the configured topic filter
     */
    private matchesTopicFilter;
    /**
     * Add a log entry to the circular buffer for batched processing
     */
    /**
     * Map log level to default priority
     * debug: 2, info: 5, warn: 7, error: 9
     */
    private getDefaultPriority;
    /**
     * Pool a log entry in the circular buffer for batch delivery
     */
    private poolLog;
    /**
     * Flush all pooled logs from circular buffer to the onLogBatch callback
     */
    private flushLogs;
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
    MovingAverage(params: MovingAverageParams): this;
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
    Rms(params: RmsParams): this;
    /**
     * Add a rectify stage to the pipeline
     * @param params - Configuration for the rectify filter (optional)
     * @returns this instance for method chaining
     */
    Rectify(params?: RectifyParams): this;
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
    Variance(params: VarianceParams): this;
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
    ZScoreNormalize(params: ZScoreNormalizeParams): this;
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
    MeanAbsoluteValue(params: MeanAbsoluteValueParams): this;
    /**
     * Add a Waveform Length stage to the pipeline
     * Computes the cumulative length of the signal path (sum of absolute differences between consecutive samples)
     * Useful for EMG activity detection and signal complexity analysis
     *
     * @param params - Configuration for the waveform length filter
     * @param params.windowSize - Number of samples in the sliding window
     * @returns this instance for method chaining
     *
     * @example
     * // Basic waveform length calculation
     * pipeline.WaveformLength({ windowSize: 100 });
     *
     * @example
     * // Multi-stage EMG pipeline
     * pipeline
     *   .Rectify({ mode: "full" })
     *   .WaveformLength({ windowSize: 50 })
     *   .tap((samples) => console.log('WL:', samples[0]));
     */
    WaveformLength(params: WaveformLengthParams): this;
    /**
     * Add a Slope Sign Change (SSC) stage to the pipeline
     * Counts the number of times the signal slope changes sign within a window
     * Useful for EMG frequency content analysis and muscle fatigue detection
     *
     * @param params - Configuration for the SSC filter
     * @param params.windowSize - Number of samples in the sliding window
     * @param params.threshold - Noise suppression threshold (default: 0.0)
     * @returns this instance for method chaining
     *
     * @example
     * // Basic SSC with no threshold
     * pipeline.SlopeSignChange({ windowSize: 100 });
     *
     * @example
     * // SSC with noise threshold
     * pipeline.SlopeSignChange({ windowSize: 100, threshold: 0.01 });
     *
     * @example
     * // EMG frequency analysis pipeline
     * pipeline
     *   .Rectify({ mode: "full" })
     *   .SlopeSignChange({ windowSize: 50, threshold: 0.005 })
     *   .tap((samples) => console.log('SSC count:', samples[0]));
     */
    SlopeSignChange(params: SlopeSignChangeParams): this;
    /**
     * Add a Willison Amplitude (WAMP) stage to the pipeline
     * Counts the number of times consecutive samples differ by more than a threshold
     * Useful for EMG burst detection and muscle activity classification
     *
     * @param params - Configuration for the WAMP filter
     * @param params.windowSize - Number of samples in the sliding window
     * @param params.threshold - Difference threshold for counting (default: 0.0)
     * @returns this instance for method chaining
     *
     * @example
     * // Basic WAMP with no threshold
     * pipeline.WillisonAmplitude({ windowSize: 100 });
     *
     * @example
     * // WAMP with threshold for burst detection
     * pipeline.WillisonAmplitude({ windowSize: 100, threshold: 0.05 });
     *
     * @example
     * // EMG burst detection pipeline
     * pipeline
     *   .Rectify({ mode: "full" })
     *   .WillisonAmplitude({ windowSize: 50, threshold: 0.02 })
     *   .tap((samples) => console.log('WAMP count:', samples[0]));
     */
    WillisonAmplitude(params: WillisonAmplitudeParams): this;
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
    tap(callback: TapCallback): this;
    /**
     * Add a filter stage to the pipeline
     * Supports FIR and IIR filters with various designs (Butterworth, Chebyshev, etc.)
     *
     * @param options - Filter configuration options
     * @returns this instance for method chaining
     *
     * @example
     * // FIR low-pass filter
     * pipeline.filter({
     *   type: "fir",
     *   mode: "lowpass",
     *   cutoffFrequency: 1000,
     *   sampleRate: 8000,
     *   order: 51
     * });
     *
     * @example
     * // Butterworth band-pass filter
     * pipeline.filter({
     *   type: "butterworth",
     *   mode: "bandpass",
     *   lowCutoffFrequency: 300,
     *   highCutoffFrequency: 3000,
     *   sampleRate: 8000,
     *   order: 4
     * });
     *
     * @example
     * // Chebyshev low-pass with ripple
     * pipeline.filter({
     *   type: "chebyshev",
     *   mode: "lowpass",
     *   cutoffFrequency: 1000,
     *   sampleRate: 8000,
     *   order: 2,
     *   ripple: 0.5
     * });
     *
     * @example
     * // Peaking EQ (biquad)
     * pipeline.filter({
     *   type: "biquad",
     *   mode: "peak",
     *   centerFrequency: 1000,
     *   sampleRate: 8000,
     *   q: 2.0,
     *   gain: 6.0
     * });
     */
    filter(options: FilterOptions): this;
    /**
     * Helper to create FIR filter from options
     */
    private createFirFilter;
    /**
     * Helper to create Butterworth filter from options
     */
    private createButterworthFilter;
    /**
     * Helper to create Chebyshev filter from options
     */
    private createChebyshevFilter;
    /**
     * Helper to create Biquad filter from options
     */
    private createBiquadFilter;
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
    pipeline(callbacks: PipelineCallbacks): this;
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
    process(input: Float32Array, timestampsOrOptions: Float32Array | ProcessOptions, optionsIfTimestamps?: ProcessOptions): Promise<Float32Array>;
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
    processCopy(input: Float32Array, timestampsOrOptions: Float32Array | ProcessOptions, optionsIfTimestamps?: ProcessOptions): Promise<Float32Array>;
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
    saveState(): Promise<string>;
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
    loadState(stateJson: string): Promise<boolean>;
    /**
     * Clear all pipeline state (reset all filters to initial state)
     * This resets filter buffers without removing the stages
     *
     * @example
     * pipeline.clearState(); // Reset all filters
     */
    clearState(): void;
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
    listState(): PipelineStateSummary;
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
export declare function createDspPipeline(config?: RedisConfig): DspProcessor;
export { DspProcessor };
//# sourceMappingURL=bindings.d.ts.map