/**
 * ResamplerStage.h
 *
 * Rational resampling by factor L/M for arbitrary sample rate conversion.
 * Combines interpolation (upsample by L) and decimation (downsample by M)
 * using efficient polyphase FIR filtering.
 *
 * Algorithm:
 * 1. Upsample by L (insert zeros)
 * 2. Apply single combined anti-aliasing/anti-imaging filter
 * 3. Downsample by M (keep every M-th sample)
 *
 * The filter cutoff is min(π/L, π/M) to satisfy both requirements.
 *
 * Example: Resample from 44.1 kHz to 48 kHz
 * - L/M = 48000/44100 = 160/147 (after GCD reduction)
 * - Upsample by 160, downsample by 147
 */

#pragma once

#include "../IDspStage.h"
#include "../core/FirFilter.h"
#include <algorithm>
#include <cmath>
#include <numeric>
#include <stdexcept>
#include <vector>

namespace dsp
{

    /**
     * Resampler stage: Change sample rate by rational factor L/M
     * Output rate = Input rate * (L/M)
     */
    class ResamplerStage : public IDspStage
    {
    public:
        /**
         * Construct resampler
         * @param upFactor Interpolation factor L
         * @param downFactor Decimation factor M
         * @param order FIR filter order (must be odd)
         * @param sampleRate Input sample rate in Hz
         */
        ResamplerStage(int upFactor, int downFactor, int order, double sampleRate)
            : L_(upFactor), M_(downFactor), filterOrder_(order), inputSampleRate_(sampleRate), phaseAccumulator_(0)
        {
            if (upFactor < 1)
            {
                throw std::invalid_argument("Interpolation factor L must be >= 1");
            }
            if (downFactor < 1)
            {
                throw std::invalid_argument("Decimation factor M must be >= 1");
            }
            if (order < 3 || order % 2 == 0)
            {
                throw std::invalid_argument("Filter order must be odd and >= 3");
            }

            // Reduce L/M to simplest form
            int gcd = std::gcd(L_, M_);
            L_ /= gcd;
            M_ /= gcd;

            // Calculate intermediate and output sample rates
            intermediateSampleRate_ = inputSampleRate_ * L_;
            outputSampleRate_ = inputSampleRate_ * L_ / M_;

            // Design combined anti-aliasing/anti-imaging filter
            // Cutoff at min(Fs_in/2, Fs_out/2) to prevent both aliasing and imaging
            double cutoffFreq = std::min(inputSampleRate_ / 2.0, outputSampleRate_ / 2.0);

            // Create polyphase filter bank
            designPolyphaseFilter(cutoffFreq);

            // State buffer for filtering
            stateBuffer_.resize(filterOrder_, 0.0f);
            stateIndex_ = 0;
        }

        /**
         * Process input samples and produce resampled output
         * Output size ≈ input size * (L/M)
         */
        void process(const float *input, size_t inputSize,
                     float *output, size_t &outputSize) override
        {
            outputSize = 0;

            if (inputSize == 0)
            {
                return;
            }

            // Process each input sample
            for (size_t i = 0; i < inputSize; ++i)
            {
                // Add input sample to state buffer
                stateBuffer_[stateIndex_] = input[i];
                stateIndex_ = (stateIndex_ + 1) % filterOrder_;

                // Advance phase accumulator
                phaseAccumulator_ += L_;

                // Generate output samples when phase crosses M boundaries
                while (phaseAccumulator_ >= M_)
                {
                    // Calculate which polyphase filter to use
                    int phase = (phaseAccumulator_ - M_) % L_;

                    // Apply polyphase filter
                    float sum = 0.0f;
                    for (int tap = 0; tap < filterOrder_; ++tap)
                    {
                        int bufferIdx = (stateIndex_ - 1 - tap + filterOrder_) % filterOrder_;
                        int coeffIdx = phase + tap * L_;

                        if (coeffIdx < static_cast<int>(polyphaseCoeffs_.size()))
                        {
                            sum += stateBuffer_[bufferIdx] * polyphaseCoeffs_[coeffIdx];
                        }
                    }

                    output[outputSize++] = sum * L_; // Gain correction for interpolation
                    phaseAccumulator_ -= M_;
                }
            }
        }

        void reset() override
        {
            std::fill(stateBuffer_.begin(), stateBuffer_.end(), 0.0f);
            stateIndex_ = 0;
            phaseAccumulator_ = 0;
        }

        std::string getName() const override
        {
            return "Resampler(L=" + std::to_string(L_) + ",M=" + std::to_string(M_) + ")";
        }

        /**
         * Get interpolation factor (reduced)
         */
        int getUpFactor() const
        {
            return L_;
        }

        /**
         * Get decimation factor (reduced)
         */
        int getDownFactor() const
        {
            return M_;
        }

        /**
         * Get output sample rate
         */
        double getOutputSampleRate() const
        {
            return outputSampleRate_;
        }

        /**
         * Get conversion ratio L/M
         */
        double getRatio() const
        {
            return static_cast<double>(L_) / static_cast<double>(M_);
        }

    private:
        /**
         * Design polyphase filter bank for combined resampling
         */
        void designPolyphaseFilter(double cutoffFreq)
        {
            const int M = filterOrder_;
            const int totalTaps = M * L_;

            polyphaseCoeffs_.resize(totalTaps);

            const int center = totalTaps / 2;
            const double fc = cutoffFreq / intermediateSampleRate_;
            const double omega_c = 2.0 * M_PI * fc;

            // Design prototype filter at intermediate rate
            for (int n = 0; n < totalTaps; ++n)
            {
                // Sinc function
                double t = n - center;
                double sinc_val;
                if (std::abs(t) < 1e-10)
                {
                    sinc_val = omega_c / M_PI;
                }
                else
                {
                    sinc_val = std::sin(omega_c * t) / (M_PI * t);
                }

                // Hamming window
                double window = 0.54 - 0.46 * std::cos(2.0 * M_PI * n / (totalTaps - 1));

                polyphaseCoeffs_[n] = static_cast<float>(sinc_val * window);
            }

            // Normalize coefficients
            float sum = 0.0f;
            for (float c : polyphaseCoeffs_)
            {
                sum += c;
            }
            for (float &c : polyphaseCoeffs_)
            {
                c /= sum;
            }
        }

        int L_; // Interpolation factor (reduced)
        int M_; // Decimation factor (reduced)
        int filterOrder_;
        double inputSampleRate_;
        double intermediateSampleRate_;
        double outputSampleRate_;

        std::vector<float> stateBuffer_;
        std::vector<float> polyphaseCoeffs_;
        size_t stateIndex_;
        int phaseAccumulator_; // Tracks position in resampling cycle
    };

} // namespace dsp
