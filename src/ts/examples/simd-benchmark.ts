/**
 * SIMD Performance Benchmark
 *
 * This benchmark demonstrates the performance of SIMD-accelerated operations.
 *
 * Run with: npm test (to see it passes), then check operation timings
 *
 * Note: For accurate benchmarks, build in Release mode and run multiple times
 * to account for V8 JIT compilation and CPU thermal throttling.
 */

import { DspProcessor } from "../bindings.js";

console.log("🚀 SIMD Performance Demonstration");
console.log("===================================\n");

async function demonstrateSIMD() {
  const BUFFER_SIZE = 100000; // 100k samples
  const ITERATIONS = 50;

  // Create test signal with mixed positive/negative values
  const signal = new Float32Array(BUFFER_SIZE);
  for (let i = 0; i < BUFFER_SIZE; i++) {
    signal[i] = Math.sin(i * 0.1) * 100 + Math.cos(i * 0.05) * 50;
  }

  console.log(`📊 Test Configuration:`);
  console.log(`  • Buffer size: ${BUFFER_SIZE.toLocaleString()} samples`);
  console.log(`  • Iterations: ${ITERATIONS}`);
  console.log(
    `  • Total samples: ${(BUFFER_SIZE * ITERATIONS).toLocaleString()}\n`
  );

  // Test 1: Rectify (SIMD-accelerated)
  console.log("🔧 Test 1: Rectify (Full-Wave) - SIMD Accelerated");
  const processor1 = new DspProcessor([
    { method: "rectify", params: { mode: "full" } },
  ]);

  const start1 = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    const buffer = signal.slice();
    await processor1.process(buffer, { channels: 1 });
  }
  const end1 = performance.now();
  const time1 = end1 - start1;
  const throughput1 = ((BUFFER_SIZE * ITERATIONS) / time1) * 1000;

  console.log(`  ✅ Time: ${time1.toFixed(2)} ms`);
  console.log(
    `  ✅ Throughput: ${(throughput1 / 1_000_000).toFixed(2)} M samples/sec\n`
  );

  // Test 2: Batch Average (SIMD-accelerated for single channel)
  console.log("🔧 Test 2: Batch Average - SIMD Accelerated");
  const processor2 = new DspProcessor([
    { method: "movingAverage", params: { mode: "batch" } },
  ]);

  const start2 = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    const buffer = signal.slice();
    await processor2.process(buffer, { channels: 1 });
  }
  const end2 = performance.now();
  const time2 = end2 - start2;
  const throughput2 = ((BUFFER_SIZE * ITERATIONS) / time2) * 1000;

  console.log(`  ✅ Time: ${time2.toFixed(2)} ms`);
  console.log(
    `  ✅ Throughput: ${(throughput2 / 1_000_000).toFixed(2)} M samples/sec\n`
  );

  // Test 3: Batch RMS (SIMD-accelerated for single channel)
  console.log("🔧 Test 3: Batch RMS - SIMD Accelerated");
  const processor3 = new DspProcessor([
    { method: "rms", params: { mode: "batch" } },
  ]);

  const start3 = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    const buffer = signal.slice();
    await processor3.process(buffer, { channels: 1 });
  }
  const end3 = performance.now();
  const time3 = end3 - start3;
  const throughput3 = ((BUFFER_SIZE * ITERATIONS) / time3) * 1000;

  console.log(`  ✅ Time: ${time3.toFixed(2)} ms`);
  console.log(
    `  ✅ Throughput: ${(throughput3 / 1_000_000).toFixed(2)} M samples/sec\n`
  );

  console.log("─".repeat(60));
  console.log("\n📈 SIMD Optimization Summary:\n");
  console.log("✨ What makes these operations fast:");
  console.log("  1. Compiler optimizations (-O3, /O2, -ffast-math)");
  console.log("  2. SIMD intrinsics (AVX2/SSE2/NEON)");
  console.log("  3. Zero-copy processing (in-place modification)");
  console.log("  4. C++ Native code (no JavaScript overhead)\n");

  console.log("🎯 Platform-specific SIMD support:");
  console.log("  • x86/x64 + AVX2:  8 floats/cycle  → 4-8x speedup");
  console.log("  • x86/x64 + SSE2:  4 floats/cycle  → 2-4x speedup");
  console.log("  • ARM + NEON:      4 floats/cycle  → 2-4x speedup");
  console.log(
    "  • Scalar fallback: 1 float/cycle   → compiler auto-vectorizes\n"
  );

  console.log("💡 Best performance tips:");
  console.log("  • Use single-channel data when possible (contiguous memory)");
  console.log("  • Prefer batch mode for one-time calculations");
  console.log("  • Use moving mode only when state continuity is needed");
  console.log("  • Process larger buffers to amortize overhead\n");

  console.log("� For more details, see:");
  console.log("  docs/SIMD_OPTIMIZATIONS.md\n");
}

// Run demonstration
demonstrateSIMD()
  .then(() => {
    console.log("✅ Demonstration complete\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Demonstration failed:", error);
    process.exit(1);
  });
