import { createDspPipeline } from "../index.js";

console.log("Pipeline State Listing Example\n");

// Example 1: Simple pipeline
console.log("1. Simple Pipeline");
{
  const pipeline = createDspPipeline()
    .MovingAverage({ windowSize: 100 })
    .Rectify({ mode: "full" })
    .Rms({ windowSize: 50 });

  const summary = pipeline.listState();
  console.log("  Pipeline summary:", JSON.stringify(summary, null, 2));
}

// Example 2: After processing (with state)
console.log("\n2. Pipeline After Processing (With State)");
{
  const pipeline = createDspPipeline()
    .MovingAverage({ windowSize: 10 })
    .Rms({ windowSize: 5 });

  // Process some data to populate state
  const input = new Float32Array(50).map((_, i) => Math.sin(i * 0.1));
  await pipeline.process(input, { sampleRate: 1000, channels: 1 });

  const summary = pipeline.listState();
  console.log("  Pipeline summary after processing:");
  console.log(`    Total stages: ${summary.stageCount}`);
  summary.stages.forEach((stage) => {
    console.log(`    Stage ${stage.index}: ${stage.type}`);
    if (stage.windowSize)
      console.log(`      - Window size: ${stage.windowSize}`);
    if (stage.numChannels)
      console.log(`      - Channels: ${stage.numChannels}`);
    if (stage.mode) console.log(`      - Mode: ${stage.mode}`);
    if (stage.bufferSize)
      console.log(`      - Buffer size: ${stage.bufferSize}`);
    if (stage.channelCount)
      console.log(`      - Channel count: ${stage.channelCount}`);
  });
}

// Example 3: Multi-channel pipeline
console.log("\n3. Multi-Channel Pipeline");
{
  const pipeline = createDspPipeline()
    .MovingAverage({ windowSize: 20 })
    .Rectify()
    .Rms({ windowSize: 10 });

  // Process 4-channel data
  const input = new Float32Array(400).map((_, i) => Math.sin(i * 0.1));
  await pipeline.process(input, { sampleRate: 2000, channels: 4 });

  const summary = pipeline.listState();
  console.log("  Multi-channel pipeline:");
  summary.stages.forEach((stage) => {
    console.log(`    ${stage.type}: ${stage.channelCount} channels`);
  });
}

// Example 4: Monitoring/Debugging
console.log("\n4. Pipeline Monitoring/Debugging");
{
  const pipeline = createDspPipeline()
    .MovingAverage({ windowSize: 100 })
    .Rectify({ mode: "half" })
    .Rms({ windowSize: 50 });

  // This could be used in a monitoring endpoint
  const summary = pipeline.listState();

  console.log("  Pipeline health check:");
  console.log(`    - Pipeline has ${summary.stageCount} stages`);
  console.log(
    `    - Configuration is valid: ${summary.stages.every((s) => s.type)}`
  );
  console.log(
    `    - Timestamp: ${new Date(summary.timestamp * 1000).toISOString()}`
  );

  // Check for expected configuration
  const hasMovingAverage = summary.stages.some(
    (s) => s.type === "movingAverage"
  );
  const hasRms = summary.stages.some((s) => s.type === "rms");
  console.log(`    - Has MovingAverage: ${hasMovingAverage}`);
  console.log(`    - Has RMS: ${hasRms}`);
}

// Example 5: Comparison with saveState()
console.log("\n5. listState() vs saveState() Comparison");
{
  const pipeline = createDspPipeline().MovingAverage({ windowSize: 5 });

  // Process some data
  const input = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  await pipeline.process(input, { sampleRate: 1000, channels: 1 });

  // Compare sizes
  const summary = pipeline.listState();
  const fullState = await pipeline.saveState();

  console.log("  Size comparison:");
  console.log(
    `    - listState() JSON: ${JSON.stringify(summary).length} bytes`
  );
  console.log(`    - saveState() JSON: ${fullState.length} bytes`);
  console.log(
    `    - Reduction: ${(
      (1 - JSON.stringify(summary).length / fullState.length) *
      100
    ).toFixed(1)}%`
  );

  console.log("\n  listState() returns:");
  console.log(`    ${JSON.stringify(summary, null, 2)}`);

  console.log("\n  saveState() includes:");
  console.log(`    - Full circular buffer contents (all samples)`);
  console.log(`    - Running sums/squares for each channel`);
  console.log(`    - Complete state for restoration`);
}

console.log("\nUse Cases:");
console.log("  - listState(): Monitoring dashboards, health checks, debugging");
console.log(
  "  - saveState(): Redis persistence, crash recovery, state migration"
);
