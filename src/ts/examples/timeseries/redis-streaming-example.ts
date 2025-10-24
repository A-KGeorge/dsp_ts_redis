/**
 * Redis-Backed Streaming Data Processing
 *
 * This example shows how to process streaming sensor data with Redis state
 * persistence, handling data chunks with timestamps.
 */

import { createDspPipeline } from "../../bindings";
import { createClient } from "redis";

interface DataChunk {
  deviceId: string;
  samples: Float32Array;
  timestamps: Float32Array;
}

/**
 * Streaming processor with Redis state persistence
 */
class StreamingProcessor {
  private pipeline;
  private redis;
  private stateKey: string;

  constructor(deviceId: string) {
    this.pipeline = createDspPipeline();

    // Multi-stage pipeline for sensor data
    this.pipeline
      .MovingAverage({
        mode: "moving",
        windowDuration: 10000, // 10 second smoothing
      })
      .Rms({
        mode: "moving",
        windowDuration: 5000, // 5 second RMS
      })
      .ZScoreNormalize({
        mode: "moving",
        windowDuration: 60000, // 1 minute normalization window
        epsilon: 1e-6,
      });

    this.redis = createClient();
    this.stateKey = `dsp:streaming:${deviceId}`;
  }

  async initialize() {
    await this.redis.connect();
    console.log(`Connected to Redis for device state persistence`);

    // Try to restore previous state
    const savedState = await this.redis.get(this.stateKey);
    if (savedState) {
      await this.pipeline.loadState(savedState);
      console.log(`Restored previous state for ${this.stateKey}`);
    } else {
      console.log(`No previous state found, starting fresh`);
    }
  }

  /**
   * Process a chunk of streaming data
   */
  async processChunk(chunk: DataChunk): Promise<Float32Array> {
    console.log(
      `\nProcessing chunk: ${chunk.samples.length} samples from ${chunk.deviceId}`
    );
    console.log(
      `  Time range: ${chunk.timestamps[0]} - ${
        chunk.timestamps[chunk.timestamps.length - 1]
      }`
    );

    // Process data
    const result = await this.pipeline.process(
      chunk.samples,
      chunk.timestamps,
      { channels: 1 }
    );

    // Save state to Redis
    const newState = await this.pipeline.saveState();
    await this.redis.set(this.stateKey, newState, {
      EX: 3600, // 1 hour TTL
    });
    console.log(`  Saved state to Redis (${newState.length} bytes)`);

    return result;
  }

  async close() {
    await this.redis.quit();
  }
}

/**
 * Simulate streaming sensor data chunks
 */
function generateDataChunk(
  chunkIndex: number,
  samplesPerChunk: number,
  startTime: number
): DataChunk {
  const samples = new Float32Array(samplesPerChunk);
  const timestamps = new Float32Array(samplesPerChunk);

  for (let i = 0; i < samplesPerChunk; i++) {
    const globalIndex = chunkIndex * samplesPerChunk + i;

    // Simulate sensor data: sine wave + noise + drift
    const baseSignal = Math.sin(globalIndex * 0.1) * 10;
    const noise = (Math.random() - 0.5) * 2;
    const drift = globalIndex * 0.01;

    samples[i] = baseSignal + noise + drift;

    // Irregular timestamps (realistic network jitter)
    const nominalInterval = 100; // ~100ms
    const jitter = (Math.random() - 0.5) * 20; // ±10ms jitter
    timestamps[i] = startTime + i * nominalInterval + jitter;
  }

  return {
    deviceId: "SENSOR-001",
    samples,
    timestamps,
  };
}

/**
 * Main streaming example
 */
async function runStreamingExample() {
  console.log("=== Redis-Backed Streaming Processing Example ===\n");

  const processor = new StreamingProcessor("SENSOR-001");
  await processor.initialize();

  // Simulate 5 chunks of streaming data
  const chunksCount = 5;
  const samplesPerChunk = 20;
  let startTime = Date.now();

  const allResults: number[] = [];

  for (let i = 0; i < chunksCount; i++) {
    console.log(`\n--- Chunk ${i + 1}/${chunksCount} ---`);

    const chunk = generateDataChunk(i, samplesPerChunk, startTime);
    const result = await processor.processChunk(chunk);

    // Show sample results
    console.log(`  Results (first 3):`);
    for (let j = 0; j < Math.min(3, result.length); j++) {
      console.log(
        `    [${j}] Input: ${chunk.samples[j].toFixed(2)} → Output: ${result[
          j
        ].toFixed(3)}`
      );
    }

    allResults.push(...Array.from(result));

    // Update start time for next chunk
    startTime = chunk.timestamps[chunk.timestamps.length - 1] + 100;

    // Simulate real-time delay between chunks
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log(
    `\n\nProcessed ${allResults.length} total samples across ${chunksCount} chunks`
  );
  console.log(
    `Final output range: [${Math.min(...allResults).toFixed(3)}, ${Math.max(
      ...allResults
    ).toFixed(3)}]`
  );

  await processor.close();
  console.log("\nClosed Redis connection");
}

/**
 * Example: Recovery from interruption
 */
async function demonstrateRecovery() {
  console.log("\n\n=== Demonstrating Recovery After Interruption ===\n");

  // Process first chunk
  const processor1 = new StreamingProcessor("SENSOR-002");
  await processor1.initialize();

  const chunk1 = generateDataChunk(0, 20, Date.now());
  await processor1.processChunk(chunk1);
  console.log("Processed chunk 1, state saved");

  await processor1.close();
  console.log("Simulating process crash/restart...\n");

  // Simulate restart - new processor instance
  const processor2 = new StreamingProcessor("SENSOR-002");
  await processor2.initialize(); // Automatically restores state

  // Continue with next chunk
  const chunk2 = generateDataChunk(
    1,
    20,
    chunk1.timestamps[chunk1.timestamps.length - 1] + 100
  );
  const result2 = await processor2.processChunk(chunk2);

  console.log("Successfully continued processing after restart!");
  console.log(`  Processed ${result2.length} samples with restored context`);

  await processor2.close();
}

// Run examples
async function main() {
  try {
    await runStreamingExample();
    await demonstrateRecovery();
  } catch (error) {
    console.error("Error:", error);
    if (error instanceof Error && error.message.includes("ECONNREFUSED")) {
      console.error("\n⚠️  Make sure Redis is running: redis-server");
    }
  }
}

main().catch(console.error);
