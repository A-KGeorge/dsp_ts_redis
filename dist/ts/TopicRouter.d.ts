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
export declare class TopicRouter {
    private routes;
    /**
     * Add a route with pattern matching
     * @param pattern - Regex or string pattern to match against log.topic
     * @param handler - Handler function to process matching logs
     * @param nameOrOptions - Optional name or route options
     */
    addRoute(pattern: RegExp | string, handler: RouteHandler, nameOrOptions?: string | RouteOptions): this;
    /**
     * Execute a handler with concurrency control and metrics tracking
     */
    private executeHandler;
    /**
     * Route a single log entry to matching handlers
     * @param log - Log entry to route
     */
    route(log: LogEntry): Promise<void>;
    /**
     * Route a batch of log entries in parallel
     * @param logs - Array of log entries to route
     */
    routeBatch(logs: LogEntry[]): Promise<void>;
    /**
     * Clear all routes
     */
    clearRoutes(): void;
    /**
     * Get all registered routes
     */
    getRoutes(): Route[];
    /**
     * Get metrics for all routes
     */
    getMetrics(): RouteMetrics[];
    /**
     * Reset all metrics
     */
    resetMetrics(): void;
}
/**
 * Convenience builder for common routing patterns
 */
export declare class TopicRouterBuilder {
    private router;
    /**
     * Route errors to alerting system (PagerDuty, Slack, etc.)
     * @param handler - Handler function
     * @param options - Route options (concurrency, metrics tracking)
     */
    errors(handler: RouteHandler, options?: RouteOptions): this;
    /**
     * Route performance metrics to monitoring system (Prometheus, Datadog, etc.)
     * @param handler - Handler function
     * @param options - Route options (concurrency, metrics tracking)
     */
    performance(handler: RouteHandler, options?: RouteOptions): this;
    /**
     * Route stage-specific logs
     * @param stageName - Name of the stage
     * @param handler - Handler function
     * @param options - Route options (concurrency, metrics tracking)
     */
    stage(stageName: string, handler: RouteHandler, options?: RouteOptions): this;
    /**
     * Route alerts (threshold crossings, anomalies)
     * @param handler - Handler function
     * @param options - Route options (concurrency, metrics tracking)
     */
    alerts(handler: RouteHandler, options?: RouteOptions): this;
    /**
     * Route debug logs to centralized logging (Loki, Elasticsearch, etc.)
     * @param handler - Handler function
     * @param options - Route options (concurrency, metrics tracking)
     */
    debug(handler: RouteHandler, options?: RouteOptions): this;
    /**
     * Catch-all route (should be added last)
     * @param handler - Handler function
     * @param options - Route options (concurrency, metrics tracking)
     */
    default(handler: RouteHandler, options?: RouteOptions): this;
    /**
     * Custom route with pattern
     * @param pattern - Regex or string pattern
     * @param handler - Handler function
     * @param nameOrOptions - Optional name or route options
     */
    custom(pattern: RegExp | string, handler: RouteHandler, nameOrOptions?: string | RouteOptions): this;
    /**
     * Build and return the configured router
     */
    build(): TopicRouter;
}
/**
 * Create a new topic router builder
 */
export declare function createTopicRouter(): TopicRouterBuilder;
//# sourceMappingURL=TopicRouter.d.ts.map