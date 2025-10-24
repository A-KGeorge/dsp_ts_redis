# 🧭 DSP-TS-REDIS Roadmap

This roadmap outlines the planned evolution of **dsp-ts-redis** — a native **C++ + TypeScript DSP** framework featuring **Redis-based state persistence** and **low-overhead logging**.

---

## ✅ Current Progress

- [x] **Redis Integration (Serialization / Deserialization)**
- [x] **Advanced Logging (Circular Buffer, Topic Routing, Concurrency)**
- [x] **Core DSP Filters:** `movingAverage`, `rms`, `rectify`, `variance`, `zScoreNormalize`, `mav`, `waveformLength`, `willisonAmplitude`, `slopeSignChange`
- [x] **Utility:** `listState`, `clearState`, `getState`, `saveState`

---

## 🧩 1. Consolidated Feature Table

| **Category**                          | **Methods**                                                                                                                                                                                       | **Description / Use Case**                          | **Redis Usage**                  | **Implementation Difficulty** |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | -------------------------------- | ----------------------------- |
| 🧩 **Core Time-Domain Filters**       | ✅ `movingAverage`, ✅ `rms`, ✅ `rectify`, ✅ `variance`, ✅ `zScoreNormalize`, ✅ `mav`, ☐ `waveformLength`, ☐ `willisonAmplitude`, ☐ `slopeSignChange`                                         | Core smoothing and EMG amplitude estimation         | Buffer persistence (per channel) | 🟢 Easy                       |
| 🧠 **Statistical / Entropy Features** | ☐ `kurtosis`, `skewness`, `entropy`, `sampleEntropy`, `approximateEntropy`, `hjorthParameters`                                                                                                    | Shape and complexity features                       | Aggregates per window            | 🟡 Medium                     |
| 🔉 **Spectral / Transform Domain**    | ☐ `fft`, `dft`, `hilbertTransform`, `hilbertEnvelope`, `waveletTransform`, `stft`, `istft`, `cwt`, `spectrogram`, `melSpectrogram`, `chromagram`, `cepstrum`, `powerSpectralDensity`, `coherence` | Frequency and time-frequency analysis               | Optional (RedisJSON possible)    | 🔴 Hard                       |
| 🎛 **Filtering (Classic + Modern)**    | ☐ `firFilter`, `iirFilter`, `butterworthLowpass`, `notchFilter`, `bandstopFilter`, `savitzkyGolayFilter`, `chebyshevFilter`, `ellipticFilter`, `kalmanFilter`, `wienerFilter`                     | Filtering for sensor / audio data                   | Coefficients / state storage     | 🔴 Hard                       |
| ⏱ **Resampling / Rate Control**       | ☐ `polyphaseDecimate`, `interpolate`, `sincResample`, `resample`, `upsample`, `antiAliasFilter`                                                                                                   | Resampling and alias mitigation                     | Redis phase/delay tracking       | 🟡 Medium                     |
| 🔊 **Fundamental Frequency**          | ☐ `yin`, `cepstrumPitch`                                                                                                                                                                          | Pitch / F₀ estimation for audio or tremor detection | Difference function buffers      | 🔴 Hard                       |
| 🪞 **Feature Extraction (Spectral)**  | ☐ `spectralCentroid`, `spectralRolloff`, `spectralFlux`, `spectralFlatness`, `mfcc`                                                                                                               | Audio / signal features for ML                      | Aggregates + filterbank storage  | 🟡 Medium                     |
| 🧬 **Adaptive Filters**               | ☐ `lmsFilter`, `nlmsFilter`, `rls`, `wienerFilter`, `pca`, `ica`, `whiten`                                                                                                                        | Adaptive denoising + decorrelation                  | Redis holds coefficients         | 🔴 Hard                       |
| ⚡ **Signal Analysis Utilities**      | ☐ `autocorrelation`, `crossCorrelation`, `detrend`, `integrator`, `differentiator`, `snr`, `clipDetection`, `peakDetection`                                                                       | Pre/post-processing utilities                       | Minimal (buffer only)            | 🟢 Easy                       |
| 🧍‍♂️ **EMG / Biosignal Specific**       | ☐ `muscleActivationThreshold`, `fatigue`, `autoregression`, `arCoefficients`                                                                                                                      | Biomedical signal interpretation                    | Redis calibration + baseline     | 🟡 Medium                     |
| 📡 **Amplitude / Modulation**         | ☐ `amDemod`, `amMod`, `envelopeDetect`, `instantaneousPhase`                                                                                                                                      | Modulation and envelope features                    | Low-pass filter state            | 🟡 Medium                     |
| 🧠 **Multi-Channel Spatial Ops**      | ☐ `channelSelect`, `channelMerge`, `spatialFilter`, `beamformer`                                                                                                                                  | Multi-channel EEG/EMG processing                    | Multi-channel buffers            | 🔴 Hard                       |
| 🔧 **Utilities**                      | ✅ `clearState`, ✅ `getState`, ✅ `listState`                                                                                                                                                    | Redis state management + debugging                  | Full Redis integration           | 🟢 Easy                       |
| 🌀 **Wavelet Filters (Daubechies)**   | ☐ `haar`, ☐ `db2`–`db10`                                                                                                                                                                          | Multi-resolution analysis                           | Redis stores transform levels    | 🟡 Medium                     |

---

## 🧱 2. Implementation Phases

### 🟩 **Stage 1 — MVP / Easy**

| Priority | Category                                                 | Status | Notes                                 |
| -------- | -------------------------------------------------------- | ------ | ------------------------------------- |
| 1️⃣       | `movingAverage`, `rms`, `rectify`, `variance`            | [X]    | Baseline DSP primitives (C++ + N-API) |
| 2️⃣       | `waveformLength`, `willisonAmplitude`, `slopeSignChange` | [ ]    | Next EMG feature set                  |
| 3️⃣       | `clearState`, `getState`, `listState`, `saveState`       | [X]    | Complete Redis debug utilities        |

---

### 🟨 **Stage 2 — Intermediate (Math + Buffer Dependent)**

| Priority | Category                                              | Status        | Notes                                |
| -------- | ----------------------------------------------------- | ------------- | ------------------------------------ |
| 4️⃣       | `zScoreNormalize`, `mav`, `hjorthParameters`          | [X] (partial) | Window math & standard deviation ops |
| 5️⃣       | `polyphaseDecimate`, `interpolate`, `resample`        | [ ]           | Leverage circular buffers            |
| 6️⃣       | `spectralCentroid`, `spectralRolloff`, `spectralFlux` | [ ]           | Derived FFT metrics                  |
| 7️⃣       | `entropy`, `sampleEntropy`, `approximateEntropy`      | [ ]           | Complexity metrics per window        |

---

### 🔴 **Stage 3 — Advanced DSP / FFT / Wavelets**

| Priority | Category                                                     | Status | Notes                          |
| -------- | ------------------------------------------------------------ | ------ | ------------------------------ |
| 8️⃣       | `fft`, `hilbertTransform`, `hilbertEnvelope`                 | [ ]    | Transform foundation           |
| 9️⃣       | `firFilter`, `butterworthFilter`, `notchFilter`, `iirFilter` | [ ]    | Real-world filter validation   |
| 🔟       | `waveletTransform`, `haar`, `db2–db10`                       | [ ]    | Decomposition + reconstruction |

---

### 🧠 **Stage 4 — Adaptive / Statistical / Multichannel**

| Category                         | Status | Notes                               |
| -------------------------------- | ------ | ----------------------------------- |
| `lmsFilter`, `nlmsFilter`, `rls` | [ ]    | Adaptive learning filters           |
| `pca`, `ica`, `whiten`           | [ ]    | Statistical transformations         |
| `beamformer`, `spatialFilter`    | [ ]    | Vectorized multi-channel processing |

---

## 📁 3. Suggested Project Structure

```
dsp-ts-redis/
├── src/
│   ├── native/
│   │   ├── core/
│   │   │   ├── MovingAverage.cc
│   │   │   ├── RMS.cc
│   │   │   ├── Variance.cc
│   │   │   └── Rectify.cc
│   │   ├── filters/
│   │   │   ├── FIRFilter.cc
│   │   │   ├── Butterworth.cc
│   │   │   └── NotchFilter.cc
│   │   ├── transforms/
│   │   │   ├── FFT.cc
│   │   │   ├── Hilbert.cc
│   │   │   └── Wavelet.cc
│   │   ├── features/
│   │   │   ├── MAV.cc
│   │   │   ├── Hjorth.cc
│   │   │   └── Entropy.cc
│   │   ├── emg/
│   │   │   ├── Willison.cc
│   │   │   ├── SlopeSignChange.cc
│   │   │   └── WaveformLength.cc
│   │   ├── utils/
│   │   │   ├── DSPMath.h
│   │   │   └── CircularBuffer.h
│   │   ├── DSPSystem.cc
│   │   └── DSPSystem.h
│   ├── ts/
│   │   ├── index.ts
│   │   ├── pipeline/
│   │   │   ├── Pipeline.ts
│   │   │   ├── Stage.ts
│   │   │   └── Store.ts
│   │   └── bindings.ts
│   └── build/
├── CMakeLists.txt
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🚀 **Next Goals**

- [ ] Add time-domain EMG features (`waveformLength`, `willisonAmplitude`, `slopeSignChange`)
- [ ] Introduce FFT and Hilbert transform pipeline
- [ ] Begin filter design (Butterworth + Notch)
- [ ] Benchmark native C++ vs pure JS performance
- [ ] Expand unit tests for new stages and Redis states
