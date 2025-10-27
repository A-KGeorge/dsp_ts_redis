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
export class JSONFormatter implements Formatter {
  format(log: LogEntry): any {
    return log;
  }
}

/**
 * Text formatter for human-readable output
 */
export class TextFormatter implements Formatter {
  format(log: LogEntry): string {
    const timestamp = new Date(log.timestamp).toISOString();
    const level = log.level.toUpperCase().padEnd(5);
    const topic = log.topic || "default";
    const traceInfo = log.traceId ? ` [trace:${log.traceId.slice(0, 8)}]` : "";

    let output = `[${timestamp}] ${level} [${topic}]${traceInfo} ${log.message}`;

    if (log.context && Object.keys(log.context).length > 0) {
      try {
        output += `\n  Context: ${JSON.stringify(log.context)}`;
      } catch (error) {
        // Handle circular references or non-serializable values
        output += `\n  Context: [Unable to stringify: ${
          error instanceof Error ? error.message : "unknown error"
        }]`;
      }
    }

    return output;
  }
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
export const SEVERITY_MAPPINGS = {
  pagerduty: {
    trace: "info",
    debug: "info",
    info: "info",
    warn: "warning",
    error: "error",
    fatal: "critical",
  },
  datadog: {
    trace: "debug",
    debug: "debug",
    info: "info",
    warn: "warn",
    error: "error",
    fatal: "emergency",
  },
  syslog: {
    trace: "7", // Debug
    debug: "7", // Debug
    info: "6", // Informational
    warn: "4", // Warning
    error: "3", // Error
    fatal: "0", // Emergency
  },
};

/**
 * Async context for distributed tracing
 */
export const tracingContext = new AsyncLocalStorage<{
  traceId?: string;
  spanId?: string;
  correlationId?: string;
}>();

/**
 * Helper to get current tracing context
 */
export function getTracingContext() {
  return tracingContext.getStore() || {};
}

/**
 * Helper to run code with tracing context
 */
export function withTracingContext<T>(
  context: { traceId?: string; spanId?: string; correlationId?: string },
  fn: () => T
): T {
  return tracingContext.run(context, fn);
}

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
 * Schema version for log payloads
 */
const SCHEMA_VERSION = "dspx/log/v1";

/**
 * Normalize timestamps for different observability systems
 * @param timestamp Unix timestamp (milliseconds or seconds)
 * @param format Target format: 'ms' | 's' | 'ns'
 * @returns Normalized timestamp
 */
function normalizeTimestamp(
  timestamp: number,
  format: "ms" | "s" | "ns"
): number {
  // Assume input is milliseconds if > 1e12, otherwise seconds
  const ms = timestamp > 1e12 ? timestamp : timestamp * 1000;

  switch (format) {
    case "s":
      return Math.floor(ms / 1000);
    case "ms":
      return Math.floor(ms);
    case "ns":
      return Math.floor(ms * 1000000);
  }
}

/**
 * Sleep utility for retry backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an async operation with exponential backoff
 * @param fn Function to retry
 * @param maxAttempts Maximum number of attempts (default: 3)
 * @param onRetry Optional callback on each retry
 * @returns Result of successful attempt
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  onRetry?: () => void
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxAttempts - 1) {
        // Call retry callback if provided
        if (onRetry) {
          onRetry();
        }

        // Exponential backoff with jitter: 100ms, 400ms, 1600ms
        const delay = Math.pow(2, attempt) * 100 + Math.random() * 50;
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error("Retry failed");
}

/**
 * Generate W3C traceparent header from trace/span IDs
 * Format: 00-{trace_id}-{span_id}-01
 */
export function generateTraceparent(
  traceId?: string,
  spanId?: string
): string | undefined {
  if (!traceId || !spanId) return undefined;
  return `00-${traceId}-${spanId}-01`;
}

/**
 * Shared HTTP transport utility
 * @param url Request URL
 * @param body Request body (will be JSON stringified)
 * @param headers Optional headers
 * @param method HTTP method (default: POST)
 * @returns Response
 */
/**
 * Shared HTTP transport utility
 * @param url Request URL
 * @param body Request body (will be JSON stringified)
 * @param headers Optional headers
 * @param method HTTP method (default: POST)
 * @param log Optional log entry for trace context
 * @returns Response
 */
async function postJSON(
  url: string,
  body: any,
  headers?: Record<string, string>,
  method: string = "POST",
  log?: LogEntry
): Promise<Response> {
  const finalHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  // Add W3C traceparent header if trace context available
  if (log?.traceId && log?.spanId) {
    const traceparent = generateTraceparent(log.traceId, log.spanId);
    if (traceparent) {
      finalHeaders["traceparent"] = traceparent;
    }
  }

  const response = await fetch(url, {
    method,
    headers: finalHeaders,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} - ${response.statusText}`);
  }

  return response;
}

/**
 * Concurrency limiter using p-limit pattern
 */
class ConcurrencyLimiter {
  private queue: Array<() => void> = [];
  private active = 0;

  constructor(private limit: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    while (this.active >= this.limit) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }

    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

/**
 * Global concurrency limiter (max 5 concurrent network requests)
 */
const concurrencyLimiter = new ConcurrencyLimiter(5);

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
export function createPagerDutyHandler(config: BackendConfig) {
  const { endpoint, apiKey } = config;
  const severityMap = SEVERITY_MAPPINGS.pagerduty;

  if (!endpoint || !apiKey) {
    console.warn(
      "PagerDuty handler: endpoint or apiKey (routing_key) not configured. Logs will be dropped."
    );
  }

  return async (log: LogEntry): Promise<void> => {
    if (!endpoint || !apiKey) {
      return;
    }

    await concurrencyLimiter.run(async () => {
      await retryWithBackoff(
        async () => {
          const payload = {
            schema: SCHEMA_VERSION,
            routing_key: apiKey,
            event_action: "trigger",
            payload: {
              summary: log.message,
              severity: severityMap[log.level] || "warning",
              source: log.topic || "dsp-pipeline",
              timestamp: new Date(
                normalizeTimestamp(log.timestamp, "ms")
              ).toISOString(),
              custom_details: {
                ...log.context,
                traceId: log.traceId,
                spanId: log.spanId,
                correlationId: log.correlationId,
              },
            },
          };

          try {
            await postJSON(endpoint, payload, config.headers, "POST", log);
          } catch (error) {
            if (error instanceof Error && error.message.includes("401")) {
              throw new Error(
                `PagerDuty authentication failed: Invalid routing_key. Check your Integration Key.`
              );
            }
            throw error;
          }
        },
        3,
        // Retry callback (unused here, but could increment logger metrics)
        undefined
      );
    });
  };
}

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
export function createPrometheusHandler(config: BackendConfig) {
  const { endpoint } = config;

  if (!endpoint) {
    console.warn(
      "Prometheus handler: endpoint not configured. Metrics will be dropped."
    );
  }

  return async (log: LogEntry): Promise<void> => {
    if (!endpoint) {
      return;
    }

    await concurrencyLimiter.run(async () => {
      await retryWithBackoff(async () => {
        // Convert log to Prometheus metrics format
        const metricName = log.topic?.replace(/\./g, "_") || "pipeline_metric";
        const labels = Object.entries(log.context || {})
          .map(([key, value]) => `${key}="${value}"`)
          .join(",");

        const timestamp = normalizeTimestamp(log.timestamp, "ms");
        const metric = `${metricName}{${labels},schema="${SCHEMA_VERSION}"} ${
          log.context?.value || 1
        } ${timestamp}`;

        try {
          const response = await fetch(`${endpoint}/metrics/job/dsp_pipeline`, {
            method: "POST",
            headers: {
              "Content-Type": "text/plain",
              ...config.headers,
            },
            body: metric,
          });

          if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
              throw new Error(
                `Prometheus authentication failed (${response.status}). Check config.headers for HTTP Basic Auth credentials.`
              );
            }
            throw new Error(`HTTP ${response.status} - ${response.statusText}`);
          }
        } catch (error) {
          if (
            error instanceof Error &&
            error.message.includes("ECONNREFUSED")
          ) {
            throw new Error(
              `Prometheus Pushgateway unreachable at ${endpoint}. Check network and endpoint.`
            );
          }
          throw error;
        }
      });
    });
  };
}

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
export function createLokiHandler(config: BackendConfig): HandlerWithFlush {
  const { endpoint, apiKey } = config;
  const buffer: LogEntry[] = [];
  let flushTimer: NodeJS.Timeout | null = null;

  if (!endpoint) {
    console.warn(
      "Loki handler: endpoint not configured. Logs will be buffered but never sent."
    );
  }

  const flush = async (): Promise<void> => {
    if (buffer.length === 0) return;

    const logs = buffer.splice(0, buffer.length);

    try {
      await retryWithBackoff(async () => {
        const streams = logs.map((log) => ({
          stream: {
            job: "dsp-pipeline",
            level: log.level,
            topic: log.topic || "unknown",
            schema: SCHEMA_VERSION,
            ...log.context,
          },
          values: [
            [String(normalizeTimestamp(log.timestamp, "ns")), log.message],
          ],
        }));

        const payload = { streams };

        const headers: Record<string, string> = {
          ...config.headers,
        };

        if (apiKey) {
          headers["Authorization"] = `Bearer ${apiKey}`;
        }

        try {
          await postJSON(`${endpoint}/loki/api/v1/push`, payload, headers);
        } catch (error) {
          if (error instanceof Error) {
            if (
              error.message.includes("401") ||
              error.message.includes("403")
            ) {
              throw new Error(
                `Loki authentication failed. Check apiKey (Bearer token) or config.headers for Basic Auth / X-Scope-OrgID.`
              );
            }
          }
          throw error;
        }
      });
    } catch (error) {
      // Requeue failed logs for next flush attempt
      buffer.unshift(...logs);
      console.error("Loki handler error (logs requeued):", error);
    }
  };

  const handler: HandlerWithFlush = async (log: LogEntry): Promise<void> => {
    if (!endpoint) {
      return;
    }

    buffer.push(log);

    // Auto-flush when batch size reached
    if (buffer.length >= (config.batchSize || 100)) {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      await flush();
      return;
    }

    // Schedule flush
    if (!flushTimer) {
      flushTimer = setTimeout(() => {
        flushTimer = null;
        flush().catch(console.error);
      }, config.flushInterval || 5000);
    }
  };

  // Attach flush method for graceful shutdown
  handler.flush = flush;

  return handler;
}

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
export function createCloudWatchHandler(config: BackendConfig) {
  const { endpoint, apiKey } = config;

  if (!endpoint || !apiKey) {
    console.warn(
      "CloudWatch handler: endpoint or apiKey not configured. " +
        "Note: AWS authentication is complex - consider using @aws-sdk/client-cloudwatch-logs " +
        "for automatic credential discovery. Logs will be dropped."
    );
  }

  return async (log: LogEntry): Promise<void> => {
    if (!endpoint) {
      return;
    }

    await concurrencyLimiter.run(async () => {
      await retryWithBackoff(async () => {
        const payload = {
          schema: SCHEMA_VERSION,
          logGroupName: "/dsp-pipeline/logs",
          logStreamName: log.topic || "default",
          logEvents: [
            {
              message: JSON.stringify({
                level: log.level,
                message: log.message,
                ...log.context,
              }),
              timestamp: normalizeTimestamp(log.timestamp, "ms"),
            },
          ],
        };

        try {
          await postJSON(endpoint, payload, {
            "Content-Type": "application/x-amz-json-1.1",
            "X-Amz-Target": "Logs_20140328.PutLogEvents",
            Authorization: apiKey || "",
            ...config.headers,
          });
        } catch (error) {
          if (error instanceof Error) {
            if (
              error.message.includes("403") ||
              error.message.includes("UnauthorizedOperation") ||
              error.message.includes("InvalidClientTokenId")
            ) {
              throw new Error(
                `CloudWatch authentication failed. AWS requires proper IAM credentials and request signing. ` +
                  `Consider using @aws-sdk/client-cloudwatch-logs instead of manual fetch. Error: ${error.message}`
              );
            }
          }
          throw error;
        }
      });
    });
  };
}

/**
 * Datadog log handler
 * Sends logs to Datadog for unified observability
 *
 * Authentication: API key embedded in URL path
 * Regional endpoints: US (default), EU requires custom endpoint
 *
 * @throws Error if API key is invalid or endpoint is incorrect
 */
export function createDatadogHandler(config: BackendConfig) {
  const { endpoint = "https://http-intake.logs.datadoghq.com", apiKey } =
    config;
  const severityMap = SEVERITY_MAPPINGS.datadog;

  if (!apiKey) {
    console.warn(
      "Datadog handler: apiKey not configured. Logs will be dropped."
    );
  }

  return async (log: LogEntry): Promise<void> => {
    if (!apiKey) {
      return;
    }

    await concurrencyLimiter.run(async () => {
      await retryWithBackoff(async () => {
        const payload = {
          schema: SCHEMA_VERSION,
          ddsource: "dsp-pipeline",
          ddtags: `topic:${log.topic},level:${log.level}`,
          hostname: "localhost",
          message: log.message,
          service: "dsp-pipeline",
          status: severityMap[log.level] || "info",
          timestamp: normalizeTimestamp(log.timestamp, "ms"),
          dd: {
            trace_id: log.traceId,
            span_id: log.spanId,
          },
          ...log.context,
        };

        try {
          await postJSON(
            `${endpoint}/v1/input/${apiKey}`,
            payload,
            config.headers
          );
        } catch (error) {
          if (error instanceof Error) {
            if (
              error.message.includes("403") ||
              error.message.includes("401")
            ) {
              throw new Error(
                `Datadog authentication failed. Check apiKey validity and regional endpoint (US vs EU). Error: ${error.message}`
              );
            }
          }
          throw error;
        }
      });
    });
  };
}

/**
 * Console handler (for development/debugging)
 * Pretty-prints logs to console with colors
 */
export function createConsoleHandler(config: Partial<BackendConfig> = {}) {
  const colors = {
    trace: "\x1b[90m", // Gray
    debug: "\x1b[36m", // Cyan
    info: "\x1b[32m", // Green
    warn: "\x1b[33m", // Yellow
    error: "\x1b[31m", // Red
    fatal: "\x1b[35;1m", // Bright Magenta
    reset: "\x1b[0m",
  };

  return (log: LogEntry): void => {
    const color = colors[log.level] || colors.reset;
    const timestamp = new Date(log.timestamp).toISOString();
    const traceInfo = log.traceId ? ` [trace:${log.traceId.slice(0, 8)}]` : "";

    console.log(
      `${color}[${timestamp}] [${log.level.toUpperCase()}] [${
        log.topic || "unknown"
      }]${traceInfo}${colors.reset} ${log.message}`
    );

    if (log.context && Object.keys(log.context).length > 0) {
      console.log(`${color}  Context:${colors.reset}`, log.context);
    }
  };
}

/**
 * Create a mock handler for testing
 */
export function createMockHandler(onLog?: (log: LogEntry) => void) {
  const logs: LogEntry[] = [];

  const handler = (log: LogEntry): void => {
    logs.push(log);
    if (onLog) {
      onLog(log);
    }
  };

  return {
    handler,
    getLogs: () => [...logs],
    clear: () => logs.splice(0, logs.length),
  };
}

/**
 * Sampling configuration for high-volume logs
 */
export interface SamplingConfig {
  trace?: number; // Sampling rate 0-1 (e.g., 0.01 = 1%)
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
  minLevel?: LogLevel; // Minimum level to log (dynamic control)
  autoShutdown?: boolean; // Auto-register SIGTERM/SIGINT handlers
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
export class Logger {
  private fallbackHandler: (log: LogEntry) => void;
  private severityMapping?: SeverityMapping;
  private enableMetrics: boolean;
  private formatter: Formatter;
  private sampling?: SamplingConfig;
  private minLevel: LogLevel;
  private readonly levelOrder: Record<LogLevel, number> = {
    trace: 0,
    debug: 1,
    info: 2,
    warn: 3,
    error: 4,
    fatal: 5,
  };

  // Internal metrics
  private metrics: LoggerMetrics = {
    logsProcessed: 0,
    logsFailed: 0,
    totalRetries: 0,
    flushCount: 0,
    averageFlushTimeMs: 0,
    queueSize: 0,
    handlerErrors: new Map(),
  };

  constructor(
    private handlers: Array<HandlerWithFlush>,
    options?: LoggerOptions
  ) {
    this.fallbackHandler = options?.fallbackHandler || createConsoleHandler();
    this.severityMapping = options?.severityMapping;
    this.enableMetrics = options?.enableMetrics ?? false;
    this.formatter = options?.formatter || new JSONFormatter();
    this.sampling = options?.sampling;
    this.minLevel = options?.minLevel || "trace";

    // Auto-register shutdown handlers if requested
    if (options?.autoShutdown) {
      ["SIGINT", "SIGTERM"].forEach((sig) => {
        process.on(sig, async () => {
          await this.flushAll();
          process.exit(0);
        });
      });
    }
  }

  /**
   * Set minimum log level dynamically
   */
  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Get current minimum log level
   */
  getMinLevel(): LogLevel {
    return this.minLevel;
  }

  /**
   * Check if a log should be sampled (returns true to log, false to skip)
   */
  private shouldSample(level: LogLevel): boolean {
    if (!this.sampling) return true;

    const rate = this.sampling[level];
    if (rate === undefined) return true;

    return Math.random() < rate;
  }

  /**
   * Check if a log level meets the minimum threshold
   */
  private meetsMinLevel(level: LogLevel): boolean {
    return this.levelOrder[level] >= this.levelOrder[this.minLevel];
  }

  /**
   * Increment retry counter (called by handlers)
   */
  incrementRetries(): void {
    if (this.enableMetrics) {
      this.metrics.totalRetries++;
    }
  }

  /**
   * Log a message at the specified level
   */
  async log(
    level: LogLevel,
    message: string,
    topic?: string,
    context?: any
  ): Promise<void> {
    // Check minimum level threshold
    if (!this.meetsMinLevel(level)) {
      return;
    }

    // Apply sampling
    if (!this.shouldSample(level)) {
      return;
    }

    // Auto-inject tracing context if available
    const tracingCtx = getTracingContext();

    const entry: LogEntry = {
      level,
      message,
      topic: topic || "default",
      context,
      timestamp: Date.now(),
      traceId: tracingCtx.traceId,
      spanId: tracingCtx.spanId,
      correlationId: tracingCtx.correlationId,
    };

    if (this.enableMetrics) {
      this.metrics.logsProcessed++;
    }

    // Apply formatter
    const formattedEntry = this.formatter.format(entry);

    // Dispatch to all handlers in parallel, isolating errors
    await Promise.all(
      this.handlers.map(async (handler) => {
        try {
          await handler(formattedEntry);
        } catch (error) {
          if (this.enableMetrics) {
            this.metrics.logsFailed++;
            const handlerName = handler.name || "anonymous";
            this.metrics.handlerErrors.set(
              handlerName,
              (this.metrics.handlerErrors.get(handlerName) || 0) + 1
            );
          }

          // Emit handler errors as structured LogEntry to fallback
          const errorEntry: LogEntry = {
            level: "error",
            message: `Handler error: ${
              error instanceof Error ? error.message : String(error)
            }`,
            topic: "logger.handler.error",
            context: {
              originalLog: entry,
              error:
                error instanceof Error
                  ? {
                      name: error.name,
                      message: error.message,
                      stack: error.stack,
                    }
                  : String(error),
            },
            timestamp: Date.now(),
          };

          try {
            this.fallbackHandler(errorEntry);
          } catch (fallbackError) {
            console.error("Fallback handler failed:", fallbackError);
          }
        }
      })
    );
  }

  /**
   * Log trace message (most verbose)
   */
  async trace(message: string, topic?: string, context?: any): Promise<void> {
    await this.log("trace", message, topic, context);
  }

  /**
   * Log debug message
   */
  async debug(message: string, topic?: string, context?: any): Promise<void> {
    await this.log("debug", message, topic, context);
  }

  /**
   * Log info message
   */
  async info(message: string, topic?: string, context?: any): Promise<void> {
    await this.log("info", message, topic, context);
  }

  /**
   * Log warning message
   */
  async warn(message: string, topic?: string, context?: any): Promise<void> {
    await this.log("warn", message, topic, context);
  }

  /**
   * Log error message
   */
  async error(message: string, topic?: string, context?: any): Promise<void> {
    await this.log("error", message, topic, context);
  }

  /**
   * Log fatal message (most critical)
   */
  async fatal(message: string, topic?: string, context?: any): Promise<void> {
    await this.log("fatal", message, topic, context);
  }

  /**
   * Flush all handlers (for graceful shutdown)
   */
  async flushAll(): Promise<void> {
    const startTime = Date.now();

    await Promise.all(
      this.handlers.map(async (handler) => {
        if (handler.flush) {
          try {
            await handler.flush();
          } catch (error) {
            console.error("Handler flush error:", error);
          }
        }
      })
    );

    if (this.enableMetrics) {
      this.metrics.flushCount++;
      const flushTime = Date.now() - startTime;
      this.metrics.averageFlushTimeMs =
        (this.metrics.averageFlushTimeMs * (this.metrics.flushCount - 1) +
          flushTime) /
        this.metrics.flushCount;
    }
  }

  /**
   * Get internal performance metrics
   */
  getMetrics(): LoggerMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset internal metrics
   */
  resetMetrics(): void {
    this.metrics = {
      logsProcessed: 0,
      logsFailed: 0,
      totalRetries: 0,
      flushCount: 0,
      averageFlushTimeMs: 0,
      queueSize: 0,
      handlerErrors: new Map(),
    };
  }

  /**
   * Get severity mapping for current logger
   */
  getSeverityMapping(): SeverityMapping | undefined {
    return this.severityMapping;
  }

  /**
   * Create a child logger with a default topic prefix
   */
  child(topicPrefix: string): Logger {
    // Create a new logger that shares handlers but prefixes topics
    const childLogger = new Logger(this.handlers, {
      fallbackHandler: this.fallbackHandler,
      severityMapping: this.severityMapping,
      enableMetrics: false, // Don't double-count metrics
      formatter: this.formatter,
      sampling: this.sampling,
      minLevel: this.minLevel,
      autoShutdown: false, // Don't re-register shutdown handlers
    });

    // Override the log method to prefix topics
    const originalLog = childLogger.log.bind(childLogger);
    childLogger.log = async (level, message, topic, context) => {
      const prefixedTopic = topic
        ? `${topicPrefix}.${topic}`
        : `${topicPrefix}.default`;
      return originalLog(level, message, prefixedTopic, context);
    };

    return childLogger;
  }
}
