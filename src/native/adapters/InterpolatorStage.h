/**
 * InterpolatorStage.h
 *
 * Polyphase FIR interpolator for efficient upsampling by integer factor L.
 * Inserts (L-1) zero samples between each input sample and applies anti-imaging
 * low-pass filter to smooth the result.
 *
 * Algorithm:
 * 1. Insert L-1 zeros between input samples (zero-stuffing)
 * 2. Design anti-imaging FIR filter with cutoff at π/L
 * 3. Use polyphase decomposition for efficiency (avoids computing on zeros)
 * 4. Maintain state across process() calls for streaming
 *
 * Efficiency: Polyphase structure avoids multiplying by zeros, reducing
 * computation significantly.
 */

#pragma once

#include "../IDspStage.h"
#include "../core/FirFilter.h"
#include <algorithm>
#include <cmath>
#include <stdexcept>
#include <vector>

namespace dsp
{

    /**
     * Interpolator stage: Upsample signal by integer factor L
     * Includes anti-imaging FIR low-pass filter
     */
    class InterpolatorStage : public IDspStage
    {
    public:
        /**
         * Construct interpolator
         * @param factor Interpolation factor L (output rate = input rate * L)
         * @param order FIR filter order (must be odd)
         * @param sampleRate Input sample rate in Hz
         */
        InterpolatorStage(int factor, int order, double sampleRate)
            : interpolationFactor_(factor), filterOrder_(order), sampleRate_(sampleRate), phaseIndex_(0)
        {
            if (factor < 2)
            {
                throw std::invalid_argument("Interpolation factor must be >= 2");
            }
            if (order < 3 || order % 2 == 0)
            {
                throw std::invalid_argument("Filter order must be odd and >= 3");
            }

            // Design anti-imaging filter: cutoff at Fs/(2*L) to prevent imaging
            double outputSampleRate = sampleRate * factor;
            double cutoffFreq = sampleRate / 2.0; // Nyquist of input rate

            // Create FIR low-pass filter (operates at output rate)
            filter_ = std::make_unique<FirFilter>(order, outputSampleRate);
            designLowPassFilter(cutoffFreq, outputSampleRate);

            // State buffer for polyphase filtering
            stateBuffer_.resize(filterOrder_, 0.0f);
            stateIndex_ = 0;
        }

        /**
         * Process input samples and produce interpolated output
         * Output size will be input size * L
         */
        void process(const float *input, size_t inputSize,
                     float *output, size_t &outputSize) override
        {
            outputSize = 0;

            if (inputSize == 0)
            {
                return;
            }

            // Process each input sample, producing L output samples
            for (size_t i = 0; i < inputSize; ++i)
            {
                // Add input sample to state buffer
                stateBuffer_[stateIndex_] = input[i];
                stateIndex_ = (stateIndex_ + 1) % filterOrder_;

                // Generate L output samples using polyphase filter
                for (int phase = 0; phase < interpolationFactor_; ++phase)
                {
                    float sum = 0.0f;

                    // Apply polyphase filter coefficients
                    // Each phase uses every L-th coefficient
                    for (int tap = 0; tap < filterOrder_; ++tap)
                    {
                        int bufferIdx = (stateIndex_ - 1 - tap + filterOrder_) % filterOrder_;
                        int coeffIdx = phase + tap * interpolationFactor_;

                        if (coeffIdx < filterOrder_ * interpolationFactor_)
                        {
                            sum += stateBuffer_[bufferIdx] * polyphaseCoeffs_[coeffIdx];
                        }
                    }

                    output[outputSize++] = sum * interpolationFactor_; // Gain correction
                }
            }
        }

        void reset() override
        {
            std::fill(stateBuffer_.begin(), stateBuffer_.end(), 0.0f);
            stateIndex_ = 0;
            phaseIndex_ = 0;
        }

        std::string getName() const override
        {
            return "Interpolator(L=" + std::to_string(interpolationFactor_) + ")";
        }

        /**
         * Get interpolation factor
         */
        int getFactor() const
        {
            return interpolationFactor_;
        }

        /**
         * Get filter order
         */
        int getOrder() const
        {
            return filterOrder_;
        }

    private:
        /**
         * Design anti-imaging low-pass filter using windowed sinc method
         * Creates polyphase decomposition of filter
         */
        void designLowPassFilter(double cutoffFreq, double outputSampleRate)
        {
            const int M = filterOrder_;
            const int L = interpolationFactor_;
            const int totalTaps = M * L;

            polyphaseCoeffs_.resize(totalTaps);

            const int center = totalTaps / 2;
            const double fc = cutoffFreq / outputSampleRate;
            const double omega_c = 2.0 * M_PI * fc;

            // Design prototype filter at output rate
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

        int interpolationFactor_;
        int filterOrder_;
        double sampleRate_;

        std::unique_ptr<FirFilter> filter_;
        std::vector<float> stateBuffer_;
        std::vector<float> polyphaseCoeffs_;
        size_t stateIndex_;
        int phaseIndex_;
    };

} // namespace dsp
