/**
 * Notch Filter Examples
 *
 * Demonstrates how to create and use notch filters for removing specific frequency bands.
 * Common use cases: 50/60 Hz power line noise removal, narrow-band interference rejection
 *
 * IMPORTANT: Notch filters are created using band-stop filters
 * API: FirFilter.createBandStop({ lowCutoffFrequency, highCutoffFrequency, sampleRate, order })
 */

import { FirFilter } from "../filters.js";

// Main async function to handle Promise-based filter processing
async function main() {
  console.log("=== Notch Filter Examples ===\n");

  // =============================================================================
  // Example 1: FIR Notch Filter for 60 Hz Power Line Noise
  // =============================================================================
  console.log("Example 1: FIR Notch Filter (60 Hz power line noise)");

  const firNotch60Hz = FirFilter.createBandStop({
    lowCutoffFrequency: 58, // Lower edge of notch
    highCutoffFrequency: 62, // Upper edge of notch
    sampleRate: 1000,
    order: 101, // Higher order = sharper notch
    windowType: "hamming",
  });

  // Test signal with 60 Hz interference
  const sampleRate = 1000;
  const duration = 1; // 1 second
  const numSamples = sampleRate * duration;
  const signal = new Float32Array(numSamples);

  // Create signal: 10 Hz sine wave + 60 Hz noise
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    signal[i] =
      Math.sin(2 * Math.PI * 10 * t) + // 10 Hz signal
      0.5 * Math.sin(2 * Math.PI * 60 * t); // 60 Hz noise
  }

  const filtered = await firNotch60Hz.process(signal);

  console.log(
    `  Input samples (first 10): ${Array.from(signal.slice(0, 10))
      .map((v: number) => v.toFixed(3))
      .join(", ")}`
  );
  console.log(
    `  Filtered samples (first 10): ${Array.from(filtered.slice(0, 10))
      .map((v: number) => v.toFixed(3))
      .join(", ")}`
  );
  console.log(`  60 Hz component should be significantly reduced\n`);

  // =============================================================================
  // Example 2: Cascaded Notch Filters (Remove Multiple Harmonics)
  // =============================================================================
  console.log("Example 2: Cascaded Notch Filters (60 Hz + harmonics)");

  // Remove 60 Hz fundamental and 2nd harmonic (120 Hz)
  const notch60 = FirFilter.createBandStop({
    lowCutoffFrequency: 58,
    highCutoffFrequency: 62,
    sampleRate: 1000,
    order: 51,
  });

  const notch120 = FirFilter.createBandStop({
    lowCutoffFrequency: 118,
    highCutoffFrequency: 122,
    sampleRate: 1000,
    order: 51,
  });

  // Signal with multiple harmonics
  const harmonicSignal = new Float32Array(1000);
  for (let i = 0; i < 1000; i++) {
    const t = i / 1000;
    harmonicSignal[i] =
      Math.sin(2 * Math.PI * 10 * t) + // Desired 10 Hz
      0.3 * Math.sin(2 * Math.PI * 60 * t) + // 60 Hz noise
      0.2 * Math.sin(2 * Math.PI * 120 * t); // 120 Hz harmonic
  }

  // Apply filters in series (must await each step)
  const step1 = await notch60.process(harmonicSignal);
  const step2 = await notch120.process(step1);

  console.log("  Original signal: 10 Hz + 60 Hz + 120 Hz interference");
  console.log("  After 60 Hz notch: Reduced 60 Hz component");
  console.log("  After 120 Hz notch: Reduced both harmonics");
  console.log(
    `  Final output (first 10): ${Array.from(step2.slice(0, 10))
      .map((v: number) => v.toFixed(3))
      .join(", ")}\n`
  );

  // =============================================================================
  // Example 3: Real-time Notch Filtering (Stateful Processing)
  // =============================================================================
  console.log("Example 3: Real-time Notch Filtering (Streaming)");

  const realtimeNotch = FirFilter.createBandStop({
    lowCutoffFrequency: 49,
    highCutoffFrequency: 51, // 50 Hz notch (EU power line)
    sampleRate: 1000,
    order: 51,
  });

  console.log("  Processing 5 frames of 100 samples each...");

  for (let frame = 0; frame < 5; frame++) {
    const frameData = new Float32Array(100);

    // Generate frame with 50 Hz noise
    for (let i = 0; i < 100; i++) {
      const sampleIndex = frame * 100 + i;
      const t = sampleIndex / 1000;
      frameData[i] =
        Math.sin(2 * Math.PI * 5 * t) + // 5 Hz signal
        0.4 * Math.sin(2 * Math.PI * 50 * t); // 50 Hz noise
    }

    const filteredFrame = await realtimeNotch.process(frameData);

    const inputPower =
      frameData.reduce((sum: number, x: number) => sum + x * x, 0) /
      frameData.length;
    const outputPower =
      filteredFrame.reduce((sum: number, x: number) => sum + x * x, 0) /
      filteredFrame.length;

    console.log(
      `  Frame ${frame + 1}: Input power=${inputPower.toFixed(
        4
      )}, Output power=${outputPower.toFixed(4)}`
    );
  }

  console.log("  Filters maintain state between process() calls by default\n");

  // =============================================================================
  // Example 4: Notch Filter Design Trade-offs
  // =============================================================================
  console.log("Example 4: Notch Filter Design Trade-offs");

  console.log("  Narrow Notch (1 Hz bandwidth, order 201):");
  console.log("    + Minimal passband distortion");
  console.log("    + Precise frequency rejection");
  console.log("    - Higher computational cost");
  console.log("    - Longer group delay");
  console.log();
  console.log("  Wide Notch (10 Hz bandwidth, order 51):");
  console.log("    + Lower computational cost");
  console.log("    + Shorter group delay");
  console.log("    - More passband distortion near notch");
  console.log("    - Less precise frequency rejection\n");

  // =============================================================================
  // Example 5: Verifying Notch Filter Performance
  // =============================================================================
  console.log("Example 5: Verifying Notch Filter Performance");

  const testNotch = FirFilter.createBandStop({
    lowCutoffFrequency: 95,
    highCutoffFrequency: 105, // 100 Hz notch
    sampleRate: 1000,
    order: 101,
  });

  // Test with pure 100 Hz tone (should be completely removed)
  const testSignal100Hz = new Float32Array(1000);
  for (let i = 0; i < 1000; i++) {
    testSignal100Hz[i] = Math.sin((2 * Math.PI * 100 * i) / 1000);
  }

  const filtered100Hz = await testNotch.process(testSignal100Hz);

  // Calculate attenuation
  const inputPower =
    testSignal100Hz.reduce((sum: number, x: number) => sum + x * x, 0) /
    testSignal100Hz.length;
  const outputPower =
    filtered100Hz.reduce((sum: number, x: number) => sum + x * x, 0) /
    filtered100Hz.length;
  const attenuationDb = 10 * Math.log10(outputPower / inputPower);

  console.log(`  Input: Pure 100 Hz sine wave`);
  console.log(`  Input RMS power: ${inputPower.toFixed(6)}`);
  console.log(`  Output RMS power: ${outputPower.toFixed(6)}`);
  console.log(`  Attenuation: ${attenuationDb.toFixed(2)} dB`);
  console.log(`  (More negative = better rejection)\n`);

  // =============================================================================
  // Important Notes
  // =============================================================================
  console.log("=== Important Notes ===");
  console.log();
  console.log("1. CORRECT API Usage:");
  console.log("   const notchFilter = FirFilter.createBandStop({");
  console.log("     lowCutoffFrequency: 58,");
  console.log("     highCutoffFrequency: 62,");
  console.log("     sampleRate: 1000,");
  console.log("     order: 51");
  console.log("   });");
  console.log();
  console.log("2. Notch filters are implemented as band-stop filters");
  console.log('   Mode: "bandstop" or "notch" are equivalent');
  console.log('   Note: "notch" is a MODE, not a TYPE');
  console.log();
  console.log("3. Filter Type Selection:");
  console.log("   - FIR: Linear phase, always stable, higher order needed");
  console.log(
    "   - IIR: Sharper rolloff, lower order, may have phase distortion"
  );
  console.log();
  console.log("4. Parameters:");
  console.log("   - lowCutoffFrequency: Lower edge of rejection band");
  console.log("   - highCutoffFrequency: Upper edge of rejection band");
  console.log("   - Bandwidth = highCutoff - lowCutoff");
  console.log();
  console.log("5. Design Guidelines:");
  console.log("   - Narrow notch: Bandwidth < 5 Hz (needs high order)");
  console.log("   - Wide notch: Bandwidth > 10 Hz (lower order acceptable)");
  console.log("   - Power line rejection: 2-4 Hz bandwidth typical");
  console.log();
  console.log("6. Common Applications:");
  console.log("   - 50/60 Hz power line noise removal");
  console.log("   - RF interference rejection");
  console.log("   - Mechanical vibration artifact removal");
  console.log("   - Narrow-band EMI filtering");
  console.log();
  console.log("7. Pipeline Integration:");
  console.log("   - Filter stages in DSP pipeline not yet implemented");
  console.log("   - Use standalone filters and manual chaining for now");
  console.log("   - See examples above for correct usage patterns");
}

// Run the examples
main().catch(console.error);
