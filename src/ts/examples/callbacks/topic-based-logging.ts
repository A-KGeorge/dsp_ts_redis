/**
 * Topic-Based Logging Example
 *
 * Demonstrates Kafka-style topic-based log filtering and routing.
 * Topics follow hierarchical structure: pipeline.stage.<name>.<category>
 */

import { createDspPipeline } from "../../bindings.js";
import type { LogEntry } from "../../types.js";

console.log("Topic-Based Logging Example\n");

// Example 1: Subscribe to all logs (no filter)
console.log("1. All Logs (no filter):");
{
  const processor = createDspPipeline();
  processor.pipeline({
    onLogBatch: (logs: LogEntry[]) => {
      logs.forEach((log: LogEntry) => {
        console.log(
          `   [${log.topic}] ${log.level.toUpperCase()}: ${log.message}`
        );
      });
    },
  });

  processor.MovingAverage({ mode: "moving", windowSize: 3 }).Rms({ mode: "moving", windowSize: 5 });

  const samples = new Float32Array([1, -2, 3, -4, 5]);
  await processor.process(samples, { sampleRate: 1000 });
}

console.log("\n2. Filter by Stage (pipeline.stage.rms.*):");
{
  const processor = createDspPipeline();
  processor.pipeline({
    onLogBatch: (logs: LogEntry[]) => {
      console.log(`   Received ${logs.length} logs from RMS stage:`);
      logs.forEach((log: LogEntry) => {
        console.log(`   [${log.topic}] ${log.message}`);
      });
    },
    topicFilter: "pipeline.stage.rms.*", // Only RMS logs
  });

  processor.MovingAverage({ mode: "moving", windowSize: 3 }).Rms({ mode: "moving", windowSize: 5 });

  const samples = new Float32Array([1, -2, 3, -4, 5]);
  await processor.process(samples, { sampleRate: 1000 });
}

console.log("\n3. Filter by Category (Errors Only - *.error):");
{
  const processor = createDspPipeline();
  processor.pipeline({
    onLogBatch: (logs: LogEntry[]) => {
      if (logs.length > 0) {
        console.log(`   🚨 Received ${logs.length} error logs:`);
        logs.forEach((log: LogEntry) => {
          console.log(`   [${log.topic}] ${log.message}`);
        });
      } else {
        console.log("   No errors detected");
      }
    },
    topicFilter: "pipeline.*.error", // Only errors from any stage
  });

  processor.MovingAverage({ mode: "moving", windowSize: 3 });
  const samples = new Float32Array([1, 2, 3, 4, 5]);
  await processor.process(samples, { sampleRate: 1000 });
}

console.log("\n4. Multiple Topic Filters (Errors + Performance):");
{
  const processor = createDspPipeline();
  processor.pipeline({
    onLogBatch: (logs: LogEntry[]) => {
      console.log(`   Received ${logs.length} logs:`);
      logs.forEach((log: LogEntry) => {
        const icon = log.topic?.includes("error") ? "🚨" : "⏱️";
        console.log(`   ${icon} [${log.topic}] ${log.message}`);
      });
    },
    topicFilter: [
      "pipeline.*.error", // All errors
      "pipeline.*.performance", // All performance metrics
    ],
  });

  processor.MovingAverage({ mode: "moving", windowSize: 3 }).Rms({ mode: "moving", windowSize: 5 });

  const samples = new Float32Array([1, -2, 3, -4, 5]);
  await processor.process(samples, { sampleRate: 1000 });
}

console.log("\n5. Topic-Based Routing (Production Pattern):");
{
  // Simulate different backends for different topics
  const errorAlerts: any[] = [];
  const metrics: any[] = [];
  const debugLogs: any[] = [];

  const processor = createDspPipeline();
  processor.pipeline({
    onLogBatch: (logs: LogEntry[]) => {
      // Route logs to different backends based on topic
      logs.forEach((log: LogEntry) => {
        if (log.topic?.includes("error")) {
          errorAlerts.push(log);
        } else if (
          log.topic?.includes("performance") ||
          log.topic?.includes("samples")
        ) {
          metrics.push(log);
        } else {
          debugLogs.push(log);
        }
      });

      console.log(`   Routed logs:`);
      console.log(`      → Error alerts: ${errorAlerts.length}`);
      console.log(`      → Metrics: ${metrics.length}`);
      console.log(`      → Debug logs: ${debugLogs.length}`);
    },
  });

  processor.MovingAverage({ mode: "moving", windowSize: 3 }).Rms({ mode: "moving", windowSize: 5 });

  const samples = new Float32Array([1, -2, 3, -4, 5]);
  await processor.process(samples, { sampleRate: 1000 });
}

console.log("\n6. Topic Structure Examples:");
console.log("   Topic Hierarchy:");
console.log("   ├── pipeline.debug               (General debug logs)");
console.log("   ├── pipeline.info                (General info logs)");
console.log("   ├── pipeline.warn                (General warnings)");
console.log("   ├── pipeline.error               (General errors)");
console.log("   └── pipeline.stage.<name>.*      (Stage-specific logs)");
console.log("       ├── samples                  (Sample-level data)");
console.log("       ├── performance              (Timing/metrics)");
console.log("       └── error                    (Stage errors)");

console.log("\n   Topic Filter Patterns:");
console.log("   • 'pipeline.stage.*'             → All stage logs");
console.log("   • 'pipeline.stage.rms.*'         → Only RMS stage logs");
console.log("   • 'pipeline.*.error'             → All errors (any stage)");
console.log("   • 'pipeline.*.performance'       → All performance metrics");
console.log(
  "   • ['pipeline.error', 'pipeline.stage.*.error'] → Multiple patterns"
);

console.log("\nTopic-based logging complete!");
console.log("\nProduction Benefits:");
console.log("   • Selective subscription reduces processing overhead");
console.log(
  "   • Route different topics to different backends (Kafka, Loki, etc.)"
);
console.log("   • Filter at source instead of post-processing");
console.log("   • Aligns with industry telemetry standards");
