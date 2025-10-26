// Export the main API
export { createDspPipeline, DspProcessor } from "./bindings";
export {
  TopicRouter,
  TopicRouterBuilder,
  createTopicRouter,
} from "./TopicRouter";
export {
  createPagerDutyHandler,
  createPrometheusHandler,
  createLokiHandler,
  createCloudWatchHandler,
  createDatadogHandler,
  createConsoleHandler,
  createMockHandler,
  Logger,
  JSONFormatter,
  TextFormatter,
  SEVERITY_MAPPINGS,
  tracingContext,
  getTracingContext,
  withTracingContext,
  generateTraceparent,
  type Formatter,
  type SeverityMapping,
  type HandlerWithFlush,
  type LoggerMetrics,
  type SamplingConfig,
  type LoggerOptions,
} from "./backends";
export {
  DriftDetector,
  detectGaps,
  validateMonotonicity,
  estimateSampleRate,
} from "./DriftDetector";
export {
  FftProcessor,
  MovingFftProcessor,
  FftUtils,
  type ComplexArray,
  type WindowType,
  type FftMode,
} from "./fft";
export {
  FirFilter,
  IirFilter,
  createFilter,
  type FilterType,
  type FilterMode,
  type FilterOptions,
  type FirFilterOptions,
  type IirFilterOptions,
  type ButterworthFilterOptions,
  type ChebyshevFilterOptions,
  type BiquadFilterOptions,
} from "./filters";
export { egg } from "./easter-egg";
export type {
  DriftStatistics,
  DriftDetectorOptions,
  TimingMetrics,
  GapDetection,
  MonotonicityViolation,
  SampleRateEstimate,
} from "./DriftDetector";
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
} from "./types";
export type {
  RouteHandler,
  Route,
  RouteOptions,
  RouteMetrics,
  PatternMatcher,
} from "./TopicRouter";
export type { BackendConfig } from "./backends";
