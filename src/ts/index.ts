// Export the main API
export { createDspPipeline, DspProcessor } from "./bindings.js";
export type {
  ProcessOptions,
  MovingAverageParams,
  RedisConfig,
  RmsParams,
  RectifyParams,
  PipelineCallbacks,
  LogLevel,
  LogContext,
} from "./types.js";
