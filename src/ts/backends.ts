/**
 * Pluggable backend handlers for common observability systems
 *
 * Production-ready integrations for:
 * - PagerDuty (alerting)
 * - Prometheus (metrics)
 * - Loki (centralized logging)
 * - CloudWatch (AWS)
 * - Datadog (observability platform)
 */

import type { LogEntry } from "./types.js";

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
 */
export function createPagerDutyHandler(config: BackendConfig) {
  const { endpoint, apiKey } = config;

  return async (log: LogEntry): Promise<void> => {
    if (!endpoint || !apiKey) {
      console.warn("PagerDuty handler: endpoint or apiKey not configured");
      return;
    }

    try {
      const payload = {
        routing_key: apiKey,
        event_action: "trigger",
        payload: {
          summary: log.message,
          severity: log.level === "error" ? "critical" : "warning",
          source: log.topic || "dsp-pipeline",
          timestamp: new Date(log.timestamp).toISOString(),
          custom_details: log.context,
        },
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...config.headers,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`PagerDuty API error: ${response.statusText}`);
      }
    } catch (error) {
      console.error("PagerDuty handler error:", error);
      throw error;
    }
  };
}

/**
 * Prometheus metrics handler
 * Exports metrics to Prometheus Pushgateway
 */
export function createPrometheusHandler(config: BackendConfig) {
  const { endpoint } = config;

  return async (log: LogEntry): Promise<void> => {
    if (!endpoint) {
      console.warn("Prometheus handler: endpoint not configured");
      return;
    }

    try {
      // Convert log to Prometheus metrics format
      const metricName = log.topic?.replace(/\./g, "_") || "pipeline_metric";
      const labels = Object.entries(log.context || {})
        .map(([key, value]) => `${key}="${value}"`)
        .join(",");

      const metric = `${metricName}{${labels}} ${log.context?.value || 1} ${
        log.timestamp
      }`;

      const response = await fetch(`${endpoint}/metrics/job/dsp_pipeline`, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          ...config.headers,
        },
        body: metric,
      });

      if (!response.ok) {
        throw new Error(`Prometheus API error: ${response.statusText}`);
      }
    } catch (error) {
      console.error("Prometheus handler error:", error);
      throw error;
    }
  };
}

/**
 * Grafana Loki log handler
 * Sends logs to Loki for centralized logging
 */
export function createLokiHandler(config: BackendConfig) {
  const { endpoint, apiKey } = config;
  const buffer: LogEntry[] = [];
  let flushTimer: NodeJS.Timeout | null = null;

  const flush = async (): Promise<void> => {
    if (buffer.length === 0) return;

    const logs = buffer.splice(0, buffer.length);

    try {
      const streams = logs.map((log) => ({
        stream: {
          job: "dsp-pipeline",
          level: log.level,
          topic: log.topic || "unknown",
          ...log.context,
        },
        values: [[String(log.timestamp * 1000000), log.message]],
      }));

      const payload = { streams };

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...config.headers,
      };

      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      const response = await fetch(`${endpoint}/loki/api/v1/push`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Loki API error: ${response.statusText}`);
      }
    } catch (error) {
      console.error("Loki handler error:", error);
      throw error;
    }
  };

  return async (log: LogEntry): Promise<void> => {
    if (!endpoint) {
      console.warn("Loki handler: endpoint not configured");
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
}

/**
 * AWS CloudWatch Logs handler
 * Sends logs to CloudWatch for AWS-native logging
 */
export function createCloudWatchHandler(config: BackendConfig) {
  const { endpoint, apiKey } = config;

  return async (log: LogEntry): Promise<void> => {
    if (!endpoint) {
      console.warn("CloudWatch handler: endpoint not configured");
      return;
    }

    try {
      const payload = {
        logGroupName: "/dsp-pipeline/logs",
        logStreamName: log.topic || "default",
        logEvents: [
          {
            message: JSON.stringify({
              level: log.level,
              message: log.message,
              ...log.context,
            }),
            timestamp: log.timestamp,
          },
        ],
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-amz-json-1.1",
          "X-Amz-Target": "Logs_20140328.PutLogEvents",
          Authorization: apiKey || "",
          ...config.headers,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`CloudWatch API error: ${response.statusText}`);
      }
    } catch (error) {
      console.error("CloudWatch handler error:", error);
      throw error;
    }
  };
}

/**
 * Datadog log handler
 * Sends logs to Datadog for unified observability
 */
export function createDatadogHandler(config: BackendConfig) {
  const { endpoint = "https://http-intake.logs.datadoghq.com", apiKey } =
    config;

  return async (log: LogEntry): Promise<void> => {
    if (!apiKey) {
      console.warn("Datadog handler: apiKey not configured");
      return;
    }

    try {
      const payload = {
        ddsource: "dsp-pipeline",
        ddtags: `topic:${log.topic},level:${log.level}`,
        hostname: "localhost",
        message: log.message,
        service: "dsp-pipeline",
        timestamp: log.timestamp,
        ...log.context,
      };

      const response = await fetch(`${endpoint}/v1/input/${apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...config.headers,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Datadog API error: ${response.statusText}`);
      }
    } catch (error) {
      console.error("Datadog handler error:", error);
      throw error;
    }
  };
}

/**
 * Console handler (for development/debugging)
 * Pretty-prints logs to console with colors
 */
export function createConsoleHandler(config: Partial<BackendConfig> = {}) {
  const colors = {
    debug: "\x1b[36m", // Cyan
    info: "\x1b[32m", // Green
    warn: "\x1b[33m", // Yellow
    error: "\x1b[31m", // Red
    reset: "\x1b[0m",
  };

  return (log: LogEntry): void => {
    const color = colors[log.level] || colors.reset;
    const timestamp = new Date(log.timestamp).toISOString();

    console.log(
      `${color}[${timestamp}] [${log.level.toUpperCase()}] [${
        log.topic || "unknown"
      }]${colors.reset} ${log.message}`
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
