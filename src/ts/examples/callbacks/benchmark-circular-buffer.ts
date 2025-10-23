/**
 * Benchmark: Circular Buffer vs Array for Log Pooling
 * Demonstrates memory and performance benefits of circular buffer
 */

import { CircularLogBuffer } from "../../CircularLogBuffer.js";
import type { LogEntry } from "../../types.js";

function benchmarkArray(iterations: number, logsPerIteration: number): number {
  const startTime = performance.now();

  for (let i = 0; i < iterations; i++) {
    const logPool: LogEntry[] = [];

    // Simulate log accumulation
    for (let j = 0; j < logsPerIteration; j++) {
      logPool.push({
        level: "info",
        message: `Log entry ${j}`,
        context: { iteration: i, index: j },
        timestamp: performance.now(),
      });
    }

    // Simulate flush
    const logs = [...logPool];
    // In real app: send logs to callback
    const _sum = logs.length;
  }

  return performance.now() - startTime;
}

function benchmarkCircularBuffer(
  iterations: number,
  logsPerIteration: number
): number {
  const buffer = new CircularLogBuffer(32);
  const startTime = performance.now();

  for (let i = 0; i < iterations; i++) {
    // Simulate log accumulation
    for (let j = 0; j < logsPerIteration; j++) {
      buffer.push({
        level: "info",
        message: `Log entry ${j}`,
        context: { iteration: i, index: j },
        timestamp: performance.now(),
      });
    }

    // Simulate flush
    const logs = buffer.flush();
    // In real app: send logs to callback
    const _sum = logs.length;
  }

  return performance.now() - startTime;
}

console.log("Benchmarking Log Pooling: Array vs Circular Buffer\n");

const testCases = [
  {
    iterations: 1000,
    logsPerIteration: 3,
    description: "1000 iterations × 3 logs (typical usage)",
  },
  {
    iterations: 10000,
    logsPerIteration: 5,
    description: "10000 iterations × 5 logs (high frequency)",
  },
  {
    iterations: 100000,
    logsPerIteration: 2,
    description: "100000 iterations × 2 logs (extreme load)",
  },
];

for (const testCase of testCases) {
  console.log(`Test: ${testCase.description}`);

  // Warm-up
  benchmarkArray(10, testCase.logsPerIteration);
  benchmarkCircularBuffer(10, testCase.logsPerIteration);

  // Run benchmarks
  const arrayTime = benchmarkArray(
    testCase.iterations,
    testCase.logsPerIteration
  );
  const circularTime = benchmarkCircularBuffer(
    testCase.iterations,
    testCase.logsPerIteration
  );

  console.log(`   Array approach:           ${arrayTime.toFixed(3)}ms`);
  console.log(`   Circular buffer approach: ${circularTime.toFixed(3)}ms`);
  console.log(`   Speedup: ${(arrayTime / circularTime).toFixed(2)}x faster`);
  console.log(`   Time saved: ${(arrayTime - circularTime).toFixed(3)}ms\n`);
}

console.log("Key Benefits of Circular Buffer:");
console.log("   - Fixed memory footprint (no array reallocations)");
console.log("   - No garbage collection pressure from temporary arrays");
console.log("   - Cache-friendly memory access pattern");
console.log("   - Predictable performance under load");
console.log("   - Handles burst logging gracefully (overwrites oldest)");
