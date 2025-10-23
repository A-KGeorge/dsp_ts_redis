/**
 * Topic-based log router for fan-out to multiple observability backends
 *
 * Implements production-grade routing pattern used by:
 * - Grafana Loki
 * - OpenTelemetry Collector
 * - FluentBit
 * - Vector.dev
 */

import type { LogEntry, LogPriority } from "./types.js";

/**
 * Route handler function for processing log entries
 */
export type RouteHandler = (log: LogEntry) => Promise<void> | void;

/**
 * Custom pattern matcher function
 */
export type PatternMatcher = (topic: string) => boolean;

/**
 * Route configuration options
 */
export interface RouteOptions {
  /** Maximum number of concurrent executions for this route (default: unlimited) */
  concurrency?: number;
  /** Enable latency tracking for this route (default: false) */
  trackMetrics?: boolean;
  /** Minimum priority level for logs to be routed (1-10, default: 1 = all logs) */
  minPriority?: LogPriority;
  /** Maximum priority level for logs to be routed (1-10, default: 10 = all logs) */
  maxPriority?: LogPriority;
}

/**
 * Route metrics for observability
 */
export interface RouteMetrics {
  name: string;
  pattern: string;
  executionCount: number;
  totalDuration: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  errorCount: number;
  lastExecuted?: number;
}

/**
 * Route definition with pattern matching
 */
export interface Route {
  pattern: RegExp;
  handler: RouteHandler;
  name?: string;
  options: RouteOptions;
  metrics: {
    count: number;
    totalDuration: number;
    minDuration: number;
    maxDuration: number;
    errorCount: number;
    lastExecuted?: number;
  };
  semaphore?: {
    running: number;
    queue: Array<() => void>;
  };
}

/**
 * TopicRouter - Fan-out logs to multiple backends based on topic patterns
 *
 * @example
 * ```ts
 * const router = new TopicRouter();
 *
 * // Add routes
 * router.addRoute(/^pipeline\.error/, async (log) => {
 *   await pagerDuty.alert(log);
 * });
 *
 * router.addRoute(/^pipeline\.performance/, async (log) => {
 *   await prometheus.record(log.topic, log.context);
 * });
 *
 * router.addRoute(/./, async (log) => {
 *   await loki.send(log);
 * });
 *
 * // Use with pipeline
 * pipeline.pipeline({
 *   onLogBatch: (logs) => router.routeBatch(logs)
 * });
 * ```
 */
export class TopicRouter {
  private routes: Route[] = [];

  /**
   * Add a route with pattern matching
   * @param pattern - Regex or string pattern to match against log.topic
   * @param handler - Handler function to process matching logs
   * @param nameOrOptions - Optional name or route options
   */
  addRoute(
    pattern: RegExp | string,
    handler: RouteHandler,
    nameOrOptions?: string | RouteOptions
  ): this {
    const name = typeof nameOrOptions === "string" ? nameOrOptions : undefined;
    const options: RouteOptions =
      typeof nameOrOptions === "object" ? nameOrOptions : {};

    this.routes.push({
      pattern: typeof pattern === "string" ? new RegExp(pattern) : pattern,
      handler,
      name,
      options,
      metrics: {
        count: 0,
        totalDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        errorCount: 0,
      },
      semaphore: options.concurrency ? { running: 0, queue: [] } : undefined,
    });
    return this;
  }

  /**
   * Execute a handler with concurrency control and metrics tracking
   */
  private async executeHandler(route: Route, log: LogEntry): Promise<void> {
    // Concurrency control via semaphore
    if (route.semaphore && route.options.concurrency) {
      if (route.semaphore.running >= route.options.concurrency) {
        // Wait for slot to become available
        await new Promise<void>((resolve) => {
          route.semaphore!.queue.push(resolve);
        });
      }
      route.semaphore.running++;
    }

    const startTime = route.options.trackMetrics ? performance.now() : 0;

    try {
      const result = route.handler(log);
      if (result instanceof Promise) {
        await result;
      }

      // Update metrics on success
      if (route.options.trackMetrics) {
        const duration = performance.now() - startTime;
        route.metrics.count++;
        route.metrics.totalDuration += duration;
        route.metrics.minDuration = Math.min(
          route.metrics.minDuration,
          duration
        );
        route.metrics.maxDuration = Math.max(
          route.metrics.maxDuration,
          duration
        );
        route.metrics.lastExecuted = Date.now();
      }
    } catch (error) {
      // Track execution even on error
      if (route.options.trackMetrics) {
        const duration = performance.now() - startTime;
        route.metrics.count++;
        route.metrics.totalDuration += duration;
        route.metrics.minDuration = Math.min(
          route.metrics.minDuration,
          duration
        );
        route.metrics.maxDuration = Math.max(
          route.metrics.maxDuration,
          duration
        );
        route.metrics.lastExecuted = Date.now();
      }

      // Update error count
      route.metrics.errorCount++;

      console.error(
        `Topic router error in route ${route.name || route.pattern}:`,
        error
      );
    } finally {
      // Release semaphore slot
      if (route.semaphore) {
        route.semaphore.running--;
        const nextInQueue = route.semaphore.queue.shift();
        if (nextInQueue) {
          nextInQueue();
        }
      }
    }
  }

  /**
   * Route a single log entry to matching handlers
   * @param log - Log entry to route
   */
  async route(log: LogEntry): Promise<void> {
    if (!log.topic) {
      // Skip logs without topics (backwards compatibility)
      return;
    }

    // Default priority to 1 if not specified
    const logPriority = log.priority ?? 1;

    const promises: Promise<void>[] = [];

    for (const route of this.routes) {
      // Check topic pattern match
      if (!route.pattern.test(log.topic)) {
        continue;
      }

      // Check priority range if specified
      const minPriority = route.options.minPriority ?? 1;
      const maxPriority = route.options.maxPriority ?? 10;

      if (logPriority < minPriority || logPriority > maxPriority) {
        continue; // Skip this route - priority out of range
      }

      promises.push(this.executeHandler(route, log));
    }

    // Wait for all handlers to complete
    if (promises.length > 0) {
      await Promise.all(promises);
    }
  }

  /**
   * Route a batch of log entries in parallel
   * @param logs - Array of log entries to route
   */
  async routeBatch(logs: LogEntry[]): Promise<void> {
    await Promise.all(logs.map((log) => this.route(log)));
  }

  /**
   * Clear all routes
   */
  clearRoutes(): void {
    this.routes = [];
  }

  /**
   * Get all registered routes
   */
  getRoutes(): Route[] {
    return [...this.routes];
  }

  /**
   * Get metrics for all routes
   */
  getMetrics(): RouteMetrics[] {
    return this.routes
      .filter((route) => route.options.trackMetrics)
      .map((route) => ({
        name: route.name || "unnamed",
        pattern: route.pattern.source,
        executionCount: route.metrics.count,
        totalDuration: route.metrics.totalDuration,
        averageDuration:
          route.metrics.count > 0
            ? route.metrics.totalDuration / route.metrics.count
            : 0,
        minDuration:
          route.metrics.minDuration === Infinity
            ? 0
            : route.metrics.minDuration,
        maxDuration: route.metrics.maxDuration,
        errorCount: route.metrics.errorCount,
        lastExecuted: route.metrics.lastExecuted,
      }));
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    for (const route of this.routes) {
      route.metrics.count = 0;
      route.metrics.totalDuration = 0;
      route.metrics.minDuration = Infinity;
      route.metrics.maxDuration = 0;
      route.metrics.errorCount = 0;
      route.metrics.lastExecuted = undefined;
    }
  }
}

/**
 * Convenience builder for common routing patterns
 */
export class TopicRouterBuilder {
  private router = new TopicRouter();

  /**
   * Route errors to alerting system (PagerDuty, Slack, etc.)
   * @param handler - Handler function
   * @param options - Route options (concurrency, metrics tracking)
   */
  errors(handler: RouteHandler, options?: RouteOptions): this {
    this.router.addRoute(
      /^pipeline\..*\.error$|^pipeline\.error$/,
      handler,
      options ? { ...options } : "errors"
    );
    return this;
  }

  /**
   * Route performance metrics to monitoring system (Prometheus, Datadog, etc.)
   * @param handler - Handler function
   * @param options - Route options (concurrency, metrics tracking)
   */
  performance(handler: RouteHandler, options?: RouteOptions): this {
    this.router.addRoute(
      /^pipeline\..*\.performance$/,
      handler,
      options ? { ...options } : "performance"
    );
    return this;
  }

  /**
   * Route stage-specific logs
   * @param stageName - Name of the stage
   * @param handler - Handler function
   * @param options - Route options (concurrency, metrics tracking)
   */
  stage(
    stageName: string,
    handler: RouteHandler,
    options?: RouteOptions
  ): this {
    this.router.addRoute(
      new RegExp("^pipeline\\.stage\\." + stageName + "\\."),
      handler,
      options ? { ...options } : `stage-${stageName}`
    );
    return this;
  }

  /**
   * Route alerts (threshold crossings, anomalies)
   * @param handler - Handler function
   * @param options - Route options (concurrency, metrics tracking)
   */
  alerts(handler: RouteHandler, options?: RouteOptions): this {
    this.router.addRoute(
      /^pipeline\.alert/,
      handler,
      options ? { ...options } : "alerts"
    );
    return this;
  }

  /**
   * Route debug logs to centralized logging (Loki, Elasticsearch, etc.)
   * @param handler - Handler function
   * @param options - Route options (concurrency, metrics tracking)
   */
  debug(handler: RouteHandler, options?: RouteOptions): this {
    this.router.addRoute(
      /^pipeline\.debug/,
      handler,
      options ? { ...options } : "debug"
    );
    return this;
  }

  /**
   * Catch-all route (should be added last)
   * @param handler - Handler function
   * @param options - Route options (concurrency, metrics tracking)
   */
  default(handler: RouteHandler, options?: RouteOptions): this {
    this.router.addRoute(/.*/, handler, options ? { ...options } : "default");
    return this;
  }

  /**
   * Custom route with pattern
   * @param pattern - Regex or string pattern
   * @param handler - Handler function
   * @param nameOrOptions - Optional name or route options
   */
  custom(
    pattern: RegExp | string,
    handler: RouteHandler,
    nameOrOptions?: string | RouteOptions
  ): this {
    this.router.addRoute(pattern, handler, nameOrOptions);
    return this;
  }

  /**
   * Build and return the configured router
   */
  build(): TopicRouter {
    return this.router;
  }
}

/**
 * Create a new topic router builder
 */
export function createTopicRouter(): TopicRouterBuilder {
  return new TopicRouterBuilder();
}
