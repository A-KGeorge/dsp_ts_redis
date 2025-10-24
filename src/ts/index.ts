// Export the main API
export { createDspPipeline, DspProcessor } from "./bindings.js";
export {
  TopicRouter,
  TopicRouterBuilder,
  createTopicRouter,
} from "./TopicRouter.js";
export {
  createPagerDutyHandler,
  createPrometheusHandler,
  createLokiHandler,
  createCloudWatchHandler,
  createDatadogHandler,
  createConsoleHandler,
  createMockHandler,
} from "./backends.js";
export {
  DriftDetector,
  detectGaps,
  validateMonotonicity,
  estimateSampleRate,
} from "./DriftDetector.js";
export type {
  DriftStatistics,
  DriftDetectorOptions,
  TimingMetrics,
  GapDetection,
  MonotonicityViolation,
  SampleRateEstimate,
} from "./DriftDetector.js";
export type {
  ProcessOptions,
  MovingAverageParams,
  RedisConfig,
  RmsParams,
  RectifyParams,
  VarianceParams,
  ZScoreNormalizeParams,
  MeanAbsoluteValueParams,

  // logging and monitoring interfaces
  PipelineCallbacks,
  LogLevel,
  LogContext,
  LogEntry,
  LogTopic,
  LogPriority,
  SampleBatch,
  TapCallback,
  PipelineStateSummary,
  StageSummary,
} from "./types.js";
export type {
  RouteHandler,
  Route,
  RouteOptions,
  RouteMetrics,
  PatternMatcher,
} from "./TopicRouter.js";
export type { BackendConfig } from "./backends.js";
