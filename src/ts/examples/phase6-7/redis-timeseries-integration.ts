/**
 * Phase 6-7: RedisTimeSeries Integration Example
 *
 * Shows how to pipe DSP results directly to RedisTimeSeries for:
 * - Real-time Grafana dashboards
 * - Historical trend analysis
 * - Multi-sensor correlation
 *
 * REQUIREMENTS:
 * - Redis Stack (includes RedisTimeSeries module)
 * - npm install @redis/time-series
 *
 * Installation:
 * docker run -d -p 6379:6379 redis/redis-stack:latest
 */

import { createDspPipeline } from "../../index.js";
import { createClient } from "redis";

console.log("=== Phase 6-7: RedisTimeSeries Integration ===\n");

// Simulated EMG sensor data
function generateEMGSample(index: number): {
  value: number;
  timestamp: number;
} {
  const baseSignal = Math.sin(index * 0.05) * 100;
  const noise = (Math.random() - 0.5) * 20;
  const timestamp = Date.now() + index * 10; // 100 Hz
  return { value: baseSignal + noise, timestamp };
}

/**
 * Example 1: Basic RedisTimeSeries Integration
 */
async function example1_BasicIntegration() {
  console.log("\n--- Example 1: Basic RedisTimeSeries Integration ---\n");

  try {
    const redis = await createClient({ url: "redis://localhost:6379" })
      .on("error", (err) => console.log("Redis Client Error", err))
      .connect();

    console.log("✅ Connected to Redis\n");

    // Create DSP pipeline
    const pipeline = createDspPipeline();
    pipeline
      .Rectify({ mode: "full" })
      .MovingAverage({ mode: "moving", windowDuration: 100 }) // 100ms smoothing
      .Rms({ mode: "moving", windowDuration: 50 }); // 50ms RMS

    // Process 100 samples
    const count = 100;
    const samples = new Float32Array(count);
    const timestamps = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const { value, timestamp } = generateEMGSample(i);
      samples[i] = value;
      timestamps[i] = timestamp;
    }

    // Process through DSP pipeline
    const processed = await pipeline.process(samples, timestamps, {
      channels: 1,
    });

    // Write results to RedisTimeSeries
    const sensorId = "emg-sensor-001";
    const tsKey = `myovine:${sensorId}:rms`;

    console.log(`Writing ${count} samples to Redis key: ${tsKey}\n`);

    for (let i = 0; i < processed.length; i++) {
      // TS.ADD key timestamp value
      await redis.sendCommand([
        "TS.ADD",
        tsKey,
        Math.floor(timestamps[i]).toString(),
        processed[i].toString(),
        "ON_DUPLICATE",
        "LAST",
      ]);
    }

    // Query recent data
    const recentData: any = await redis.sendCommand([
      "TS.RANGE",
      tsKey,
      "-",
      "+",
      "COUNT",
      "10",
    ]);

    console.log("📊 Last 10 samples from RedisTimeSeries:");
    if (Array.isArray(recentData)) {
      recentData.slice(0, 10).forEach((sample: any, idx: number) => {
        const [ts, value] = sample;
        console.log(
          `   [${idx}] ${new Date(Number(ts)).toISOString()} → ${Number(
            value
          ).toFixed(3)}`
        );
      });
    }

    await redis.quit();
    console.log("\n✅ Example 1 complete\n");
  } catch (error: any) {
    if (error.message.includes("ECONNREFUSED")) {
      console.error("❌ Redis not running. Start Redis Stack:");
      console.error("   docker run -d -p 6379:6379 redis/redis-stack:latest\n");
    } else if (error.message.includes("unknown command")) {
      console.error("❌ RedisTimeSeries module not loaded. Use Redis Stack:");
      console.error("   docker run -d -p 6379:6379 redis/redis-stack:latest\n");
    } else {
      throw error;
    }
  }
}

/**
 * Example 2: Multi-Channel EMG Monitoring
 */
async function example2_MultiChannelMonitoring() {
  console.log("\n--- Example 2: Multi-Channel EMG Monitoring ---\n");

  try {
    const redis = await createClient({ url: "redis://localhost:6379" })
      .on("error", (err) => console.log("Redis Client Error", err))
      .connect();

    const pipeline = createDspPipeline();
    pipeline
      .Rectify({ mode: "full" })
      .MovingAverage({ mode: "moving", windowDuration: 100 })
      .Rms({ mode: "moving", windowDuration: 50 });

    const channels = 4; // 4-channel EMG
    const samplesPerChannel = 50;
    const totalSamples = samplesPerChannel * channels;

    const samples = new Float32Array(totalSamples);
    const timestamps = new Float32Array(samplesPerChannel);

    // Generate interleaved multi-channel data
    for (let i = 0; i < samplesPerChannel; i++) {
      timestamps[i] = Date.now() + i * 10;
      for (let ch = 0; ch < channels; ch++) {
        const { value } = generateEMGSample(i + ch * 100); // Different phases
        samples[i * channels + ch] = value;
      }
    }

    // Process all channels
    const processed = await pipeline.process(samples, timestamps, { channels });

    // Write each channel to separate RedisTimeSeries key
    console.log("Writing multi-channel data to RedisTimeSeries:\n");

    for (let ch = 0; ch < channels; ch++) {
      const tsKey = `myovine:emg-array:ch${ch}:rms`;

      for (let i = 0; i < samplesPerChannel; i++) {
        const value = processed[i * channels + ch];
        await redis.sendCommand([
          "TS.ADD",
          tsKey,
          Math.floor(timestamps[i]).toString(),
          value.toString(),
          "ON_DUPLICATE",
          "LAST",
        ]);
      }

      console.log(
        `   ✅ Channel ${ch}: ${samplesPerChannel} samples → ${tsKey}`
      );
    }

    // Create aggregation rules for downsampling
    console.log("\n📊 Creating aggregation rules (1-second averages):");

    for (let ch = 0; ch < channels; ch++) {
      const sourceKey = `myovine:emg-array:ch${ch}:rms`;
      const aggKey = `${sourceKey}:avg:1s`;

      try {
        // TS.CREATERULE source dest AGGREGATION avg 1000
        await redis.sendCommand([
          "TS.CREATERULE",
          sourceKey,
          aggKey,
          "AGGREGATION",
          "AVG",
          "1000", // 1 second bucket
        ]);
        console.log(`   ✅ Channel ${ch}: ${aggKey}`);
      } catch (err: any) {
        if (!err.message.includes("already exists")) {
          throw err;
        }
      }
    }

    await redis.quit();
    console.log("\n✅ Example 2 complete");
    console.log("\n💡 Query with Grafana:");
    console.log("   - Data source: Redis");
    console.log("   - Query: TS.RANGE myovine:emg-array:ch0:rms - +\n");
  } catch (error: any) {
    if (error.message.includes("ECONNREFUSED")) {
      console.error("❌ Redis not running. Start Redis Stack:\n");
      console.error("   docker run -d -p 6379:6379 redis/redis-stack:latest\n");
    } else {
      throw error;
    }
  }
}

/**
 * Example 3: Streaming with Tap + RedisTimeSeries
 */
async function example3_StreamingWithTap() {
  console.log("\n--- Example 3: Streaming with Tap + RedisTimeSeries ---\n");

  try {
    const redis = await createClient({ url: "redis://localhost:6379" })
      .on("error", (err) => console.log("Redis Client Error", err))
      .connect();

    const pipeline = createDspPipeline();

    // Use .tap() to intercept intermediate results
    pipeline
      .MovingAverage({ mode: "moving", windowDuration: 100 })
      .tap((result, stage) => {
        // This runs after MovingAverage, before RMS
        console.log(`   🔍 Tap at "${stage}": ${result[0].toFixed(3)}`);
      })
      .Rms({ mode: "moving", windowDuration: 50 });

    const count = 10;
    const samples = new Float32Array(count);
    const timestamps = new Float32Array(count);

    console.log("Processing samples with .tap() interception:\n");

    for (let i = 0; i < count; i++) {
      const { value, timestamp } = generateEMGSample(i);
      samples[i] = value;
      timestamps[i] = timestamp;
    }

    const processed = await pipeline.process(samples, timestamps, {
      channels: 1,
    });

    console.log("\n💾 Writing final RMS values to RedisTimeSeries...");

    for (let i = 0; i < processed.length; i++) {
      await redis.sendCommand([
        "TS.ADD",
        "myovine:emg:rms:streaming",
        Math.floor(timestamps[i]).toString(),
        processed[i].toString(),
        "ON_DUPLICATE",
        "LAST",
      ]);
    }

    await redis.quit();
    console.log("✅ Example 3 complete\n");
  } catch (error: any) {
    if (error.message.includes("ECONNREFUSED")) {
      console.error("❌ Redis not running.\n");
    } else {
      throw error;
    }
  }
}

/**
 * Example 4: Production Pattern - Helper Class
 */
class RedisTimeSeriesWriter {
  private redis: any;
  private connected: boolean = false;

  constructor(private url: string = "redis://localhost:6379") {}

  async connect(): Promise<void> {
    this.redis = await createClient({ url: this.url })
      .on("error", (err) => console.log("Redis Client Error", err))
      .connect();
    this.connected = true;
  }

  async writeSamples(
    key: string,
    values: Float32Array,
    timestamps: Float32Array
  ): Promise<void> {
    if (!this.connected) {
      throw new Error("Not connected to Redis");
    }

    for (let i = 0; i < values.length; i++) {
      await this.redis.sendCommand([
        "TS.ADD",
        key,
        Math.floor(timestamps[i]).toString(),
        values[i].toString(),
        "ON_DUPLICATE",
        "LAST",
      ]);
    }
  }

  async createAggregation(
    sourceKey: string,
    aggType: "AVG" | "SUM" | "MIN" | "MAX",
    bucketMs: number
  ): Promise<string> {
    const destKey = `${sourceKey}:${aggType.toLowerCase()}:${bucketMs}ms`;

    try {
      await this.redis.sendCommand([
        "TS.CREATERULE",
        sourceKey,
        destKey,
        "AGGREGATION",
        aggType,
        bucketMs.toString(),
      ]);
    } catch (err: any) {
      if (!err.message.includes("already exists")) {
        throw err;
      }
    }

    return destKey;
  }

  async close(): Promise<void> {
    if (this.connected) {
      await this.redis.quit();
      this.connected = false;
    }
  }
}

async function example4_ProductionPattern() {
  console.log("\n--- Example 4: Production Pattern (Helper Class) ---\n");

  try {
    const writer = new RedisTimeSeriesWriter();
    await writer.connect();

    console.log("✅ Connected to Redis\n");

    // Set up DSP pipeline
    const pipeline = createDspPipeline();
    pipeline
      .Rectify({ mode: "full" })
      .MovingAverage({ mode: "moving", windowDuration: 100 })
      .Rms({ mode: "moving", windowDuration: 50 });

    // Process data
    const count = 50;
    const samples = new Float32Array(count);
    const timestamps = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const { value, timestamp } = generateEMGSample(i);
      samples[i] = value;
      timestamps[i] = timestamp;
    }

    const processed = await pipeline.process(samples, timestamps, {
      channels: 1,
    });

    // Write to RedisTimeSeries
    const key = "myovine:production:emg:rms";
    await writer.writeSamples(key, processed, timestamps);
    console.log(`📊 Wrote ${count} samples to ${key}`);

    // Create aggregation rules
    const avg1s = await writer.createAggregation(key, "AVG", 1000);
    const avg10s = await writer.createAggregation(key, "AVG", 10000);
    console.log(`\n✅ Created aggregations:`);
    console.log(`   - ${avg1s}`);
    console.log(`   - ${avg10s}`);

    await writer.close();
    console.log("\n✅ Example 4 complete\n");
  } catch (error: any) {
    if (error.message.includes("ECONNREFUSED")) {
      console.error("❌ Redis not running.\n");
    } else {
      throw error;
    }
  }
}

// Run all examples
async function main() {
  console.log(
    "📚 These examples show how to integrate DSP results with RedisTimeSeries\n"
  );
  console.log("Prerequisites:");
  console.log(
    "  1. Install Redis Stack: docker run -d -p 6379:6379 redis/redis-stack:latest"
  );
  console.log("  2. Install dependencies: npm install redis\n");
  console.log("Press Ctrl+C if Redis is not available.\n");

  await new Promise((resolve) => setTimeout(resolve, 2000));

  await example1_BasicIntegration();
  await example2_MultiChannelMonitoring();
  await example3_StreamingWithTap();
  await example4_ProductionPattern();

  console.log("=== Phase 6-7 Complete ===\n");
  console.log("✅ RedisTimeSeries integration enables:");
  console.log("   • Real-time Grafana dashboards");
  console.log("   • Historical trend analysis");
  console.log("   • Automatic downsampling (aggregation rules)");
  console.log("   • Multi-sensor correlation");
  console.log("   • Production-ready monitoring\n");

  console.log("💡 Next steps:");
  console.log("   1. Set up Grafana with Redis datasource");
  console.log("   2. Create dashboards for your EMG sensors");
  console.log("   3. Set up alerts for anomalies");
  console.log("   4. Use aggregation rules for long-term storage\n");
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
