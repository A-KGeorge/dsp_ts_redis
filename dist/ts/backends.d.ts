/**
 * Pluggable backend handlers for common observability systems
 *
 * Production-ready integrations for:
 * - PagerDuty (alerting)
 * - Prometheus (metrics)
 * - Loki (centralized logging)
 * - CloudWatch (AWS)
 * - Datadog (observability platform)
 *
 * Features:
 * - Pluggable formatters (JSON, text, custom)
 * - Distributed tracing support (trace/span/correlation IDs)
 * - Graceful shutdown with flush hooks
 * - Extended log levels (trace -> fatal)
 * - Internal performance metrics
 */
import type { LogEntry, LogLevel } from "./types.js";
import { AsyncLocalStorage } from "node:async_hooks";
/**
 * Formatter interface for encoding log entries
 */
export interface Formatter {
    format(log: LogEntry): any;
}
/**
 * JSON formatter (default)
 */
export declare class JSONFormatter implements Formatter {
    format(log: LogEntry): any;
}
/**
 * Text formatter for human-readable output
 */
export declare class TextFormatter implements Formatter {
    format(log: LogEntry): string;
}
/**
 * Severity mapping for different observability systems
 */
export interface SeverityMapping {
    trace?: string;
    debug?: string;
    info?: string;
    warn?: string;
    error?: string;
    fatal?: string;
}
/**
 * Default severity mappings for common systems
 */
export declare const SEVERITY_MAPPINGS: {
    pagerduty: {
        trace: string;
        debug: string;
        info: string;
        warn: string;
        error: string;
        fatal: string;
    };
    datadog: {
        trace: string;
        debug: string;
        info: string;
        warn: string;
        error: string;
        fatal: string;
    };
    syslog: {
        trace: string;
        debug: string;
        info: string;
        warn: string;
        error: string;
        fatal: string;
    };
};
/**
 * Async context for distributed tracing
 */
export declare const tracingContext: AsyncLocalStorage<{
    traceId?: string;
    spanId?: string;
    correlationId?: string;
}>;
/**
 * Helper to get current tracing context
 */
export declare function getTracingContext(): {
    traceId?: string;
    spanId?: string;
    correlationId?: string;
};
/**
 * Helper to run code with tracing context
 */
export declare function withTracingContext<T>(context: {
    traceId?: string;
    spanId?: string;
    correlationId?: string;
}, fn: () => T): T;
/**
 * Performance metrics for internal instrumentation
 */
export interface LoggerMetrics {
    logsProcessed: number;
    logsFailed: number;
    totalRetries: number;
    flushCount: number;
    averageFlushTimeMs: number;
    queueSize: number;
    handlerErrors: Map<string, number>;
}
/**
 * Handler with optional flush capability
 */
export interface HandlerWithFlush {
    (log: LogEntry): Promise<void> | void;
    flush?: () => Promise<void>;
    metrics?: () => LoggerMetrics;
}
/**
 * Generate W3C traceparent header from trace/span IDs
 * Format: 00-{trace_id}-{span_id}-01
 */
export declare function generateTraceparent(traceId?: string, spanId?: string): string | undefined;
/**
 * Backend handler configuration
 */
export interface BackendConfig {
    /** Endpoint URL */
    endpoint?: string;
    /** API key or token */
    apiKey?: string;
    /** Additional headers */
    headers?: Record<string, string>;
    /** Batch size for buffering */
    batchSize?: number;
    /** Flush interval in milliseconds */
    flushInterval?: number;
}
/**
 * PagerDuty alert handler
 * Sends critical errors to PagerDuty for incident management
 *
 * Authentication: Requires a routing_key (Integration Key) from PagerDuty
 * Regional endpoints: US (default), EU requires custom endpoint
 *
 * @throws Error if routing_key is invalid or endpoint is unreachable
 */
export declare function createPagerDutyHandler(config: BackendConfig): (log: LogEntry) => Promise<void>;
/**
 * Prometheus metrics handler
 * Exports metrics to Prometheus Pushgateway
 *
 * Authentication: Varies by setup
 * - May require HTTP Basic Auth (pass via config.headers)
 * - Or rely on network-level controls (VPN, firewall)
 *
 * @throws Error if authentication fails or endpoint is unreachable
 */
export declare function createPrometheusHandler(config: BackendConfig): (log: LogEntry) => Promise<void>;
/**
 * Grafana Loki log handler
 * Sends logs to Loki for centralized logging
 *
 * Authentication: Varies by setup
 * - Bearer token (most common, passed as apiKey)
 * - HTTP Basic Auth (pass via config.headers)
 * - Multi-tenant ID in X-Scope-OrgID header (pass via config.headers)
 *
 * @throws Error if authentication fails or endpoint is unreachable
 */
export declare function createLokiHandler(config: BackendConfig): HandlerWithFlush;
/**
 * AWS CloudWatch Logs handler
 * Sends logs to CloudWatch for AWS-native logging
 *
 * ⚠️ WARNING: Manual AWS authentication is error-prone!
 * This implementation uses simple API key passing, which may not work
 * in many AWS environments (IAM roles, instance profiles, temporary credentials).
 *
 * RECOMMENDED: Use @aws-sdk/client-cloudwatch-logs for automatic credential
 * discovery and request signing instead of this manual approach.
 *
 * Authentication requirements:
 * - AWS Access Key ID and Secret Access Key
 * - Proper IAM permissions (logs:PutLogEvents, logs:CreateLogStream, etc.)
 * - Regional endpoint configuration
 *
 * @deprecated Consider using AWS SDK instead for production use
 * @throws Error if credentials are invalid or permissions are insufficient
 */
export declare function createCloudWatchHandler(config: BackendConfig): (log: LogEntry) => Promise<void>;
/**
 * Datadog log handler
 * Sends logs to Datadog for unified observability
 *
 * Authentication: API key embedded in URL path
 * Regional endpoints: US (default), EU requires custom endpoint
 *
 * @throws Error if API key is invalid or endpoint is incorrect
 */
export declare function createDatadogHandler(config: BackendConfig): (log: LogEntry) => Promise<void>;
/**
 * Console handler (for development/debugging)
 * Pretty-prints logs to console with colors
 */
export declare function createConsoleHandler(config?: Partial<BackendConfig>): (log: LogEntry) => void;
/**
 * Create a mock handler for testing
 */
export declare function createMockHandler(onLog?: (log: LogEntry) => void): {
    handler: (log: LogEntry) => void;
    getLogs: () => LogEntry[];
    clear: () => LogEntry[];
};
/**
 * Sampling configuration for high-volume logs
 */
export interface SamplingConfig {
    trace?: number;
    debug?: number;
    info?: number;
    warn?: number;
    error?: number;
    fatal?: number;
}
/**
 * Logger options
 */
export interface LoggerOptions {
    fallbackHandler?: (log: LogEntry) => void;
    severityMapping?: SeverityMapping;
    enableMetrics?: boolean;
    formatter?: Formatter;
    sampling?: SamplingConfig;
    minLevel?: LogLevel;
    autoShutdown?: boolean;
}
/**
 * Unified Logger class - orchestrates multiple backend handlers
 *
 * Features:
 * - Multiple handler dispatch with Promise.all
 * - Error isolation (one handler failure doesn't affect others)
 * - Structured error logging to fallback console handler
 * - Extended log levels (trace -> fatal)
 * - Distributed tracing support (auto-inject trace/span IDs)
 * - Graceful shutdown with flushAll()
 * - Internal performance metrics
 * - Custom severity mappings
 *
 * @example
 * ```ts
 * const logger = new Logger([
 *   createConsoleHandler(),
 *   createLokiHandler({ endpoint: "...", apiKey: "..." }),
 * ], {
 *   severityMapping: SEVERITY_MAPPINGS.datadog,
 *   enableMetrics: true,
 * });
 *
 * await logger.info("Pipeline initialized");
 * await logger.error("Connection failed", "redis.connection", { host: "localhost" });
 *
 * // Graceful shutdown
 * process.on("SIGTERM", async () => {
 *   await logger.flushAll();
 *   process.exit(0);
 * });
 * ```
 */
export declare class Logger {
    private handlers;
    private fallbackHandler;
    private severityMapping?;
    private enableMetrics;
    private formatter;
    private sampling?;
    private minLevel;
    private readonly levelOrder;
    private metrics;
    constructor(handlers: Array<HandlerWithFlush>, options?: LoggerOptions);
    /**
     * Set minimum log level dynamically
     */
    setMinLevel(level: LogLevel): void;
    /**
     * Get current minimum log level
     */
    getMinLevel(): LogLevel;
    /**
     * Check if a log should be sampled (returns true to log, false to skip)
     */
    private shouldSample;
    /**
     * Check if a log level meets the minimum threshold
     */
    private meetsMinLevel;
    /**
     * Increment retry counter (called by handlers)
     */
    incrementRetries(): void;
    /**
     * Log a message at the specified level
     */
    log(level: LogLevel, message: string, topic?: string, context?: any): Promise<void>;
    /**
     * Log trace message (most verbose)
     */
    trace(message: string, topic?: string, context?: any): Promise<void>;
    /**
     * Log debug message
     */
    debug(message: string, topic?: string, context?: any): Promise<void>;
    /**
     * Log info message
     */
    info(message: string, topic?: string, context?: any): Promise<void>;
    /**
     * Log warning message
     */
    warn(message: string, topic?: string, context?: any): Promise<void>;
    /**
     * Log error message
     */
    error(message: string, topic?: string, context?: any): Promise<void>;
    /**
     * Log fatal message (most critical)
     */
    fatal(message: string, topic?: string, context?: any): Promise<void>;
    /**
     * Flush all handlers (for graceful shutdown)
     */
    flushAll(): Promise<void>;
    /**
     * Get internal performance metrics
     */
    getMetrics(): LoggerMetrics;
    /**
     * Reset internal metrics
     */
    resetMetrics(): void;
    /**
     * Get severity mapping for current logger
     */
    getSeverityMapping(): SeverityMapping | undefined;
    /**
     * Create a child logger with a default topic prefix
     */
    child(topicPrefix: string): Logger;
}
//# sourceMappingURL=backends.d.ts.map