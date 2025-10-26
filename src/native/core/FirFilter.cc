/**
 * FIR Filter Implementation with SIMD-Optimized Convolution
 * Now uses SlidingWindowFilter infrastructure for consistency
 */

#define _USE_MATH_DEFINES
#include "FirFilter.h"
#include "../utils/SimdOps.h"
#include <cmath>
#include <stdexcept>
#include <algorithm>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

namespace dsp
{
    namespace core
    {

        template <typename T>
        FirFilter<T>::FirFilter(const std::vector<T> &coefficients, bool stateful)
            : m_coefficients(coefficients), m_stateIndex(0), m_stateful(stateful)
        {
            if (coefficients.empty())
            {
                throw std::invalid_argument("FIR filter requires at least one coefficient");
            }

            if (stateful)
            {
                // Allocate state buffer (need M previous samples)
                m_state.resize(coefficients.size(), T(0));
            }
        }

        template <typename T>
        T FirFilter<T>::processSample(T input)
        {
            if (!m_stateful)
            {
                throw std::runtime_error("processSample() requires stateful mode");
            }

            // Store input in circular buffer
            m_state[m_stateIndex] = input;

            // Compute output via SIMD-optimized convolution
            T output = T(0);

            if constexpr (std::is_same_v<T, float>)
            {
                // Build aligned buffer for SIMD (coefficients are in reverse order for convolution)
                std::vector<float> aligned_samples(m_coefficients.size());

                // Copy samples in correct order for dot product
                for (size_t i = 0; i < m_coefficients.size(); ++i)
                {
                    size_t stateIdx = (m_stateIndex + m_state.size() - i) % m_state.size();
                    aligned_samples[i] = m_state[stateIdx];
                }

                // SIMD dot product
                output = simd::dot_product(aligned_samples.data(), m_coefficients.data(),
                                           m_coefficients.size());
            }
            else
            {
                // Scalar convolution for double
                for (size_t i = 0; i < m_coefficients.size(); ++i)
                {
                    size_t stateIdx = (m_stateIndex + m_state.size() - i) % m_state.size();
                    output += m_coefficients[i] * m_state[stateIdx];
                }
            }

            // Advance circular buffer index
            m_stateIndex = (m_stateIndex + 1) % m_state.size();

            return output;
        }

        template <typename T>
        void FirFilter<T>::process(const T *input, T *output, size_t length, bool stateless)
        {
            if (stateless || !m_stateful)
            {
                // Stateless mode: each output depends only on current window
                for (size_t n = 0; n < length; ++n)
                {
                    T sum = T(0);

                    if constexpr (std::is_same_v<T, float>)
                    {
                        // Use SIMD for stateless convolution too
                        size_t available = std::min(m_coefficients.size(), n + 1);

                        if (available == m_coefficients.size())
                        {
                            // Full window available - direct SIMD dot product
                            sum = simd::dot_product(&input[n - available + 1],
                                                    m_coefficients.data(),
                                                    available);
                        }
                        else
                        {
                            // Partial window - scalar for simplicity
                            for (size_t i = 0; i < available; ++i)
                            {
                                sum += m_coefficients[i] * input[n - i];
                            }
                        }
                    }
                    else
                    {
                        // Scalar for double
                        for (size_t i = 0; i < m_coefficients.size() && i <= n; ++i)
                        {
                            sum += m_coefficients[i] * input[n - i];
                        }
                    }

                    output[n] = sum;
                }
            }
            else
            {
                // Stateful mode: use processSample for each input
                for (size_t i = 0; i < length; ++i)
                {
                    output[i] = processSample(input[i]);
                }
            }
        }

        template <typename T>
        void FirFilter<T>::reset()
        {
            if (m_stateful)
            {
                std::fill(m_state.begin(), m_state.end(), T(0));
                m_stateIndex = 0;
            }
        }

        template <typename T>
        void FirFilter<T>::setCoefficients(const std::vector<T> &coefficients)
        {
            if (coefficients.empty())
            {
                throw std::invalid_argument("Coefficients cannot be empty");
            }

            m_coefficients = coefficients;

            if (m_stateful)
            {
                m_state.resize(coefficients.size(), T(0));
                m_stateIndex = 0;
            }
        }

        // ========== Filter Design Methods ==========

        template <typename T>
        std::vector<T> FirFilter<T>::generateSincLowPass(T cutoffFreq, size_t numTaps)
        {
            if (numTaps % 2 == 0)
            {
                ++numTaps; // Ensure odd for symmetric impulse response
            }

            std::vector<T> impulse(numTaps);
            int M = static_cast<int>(numTaps - 1);
            int M_half = M / 2;

            for (int n = 0; n < static_cast<int>(numTaps); ++n)
            {
                int n_shifted = n - M_half;

                if (n_shifted == 0)
                {
                    // sinc(0) = 1
                    impulse[n] = T(2) * cutoffFreq;
                }
                else
                {
                    // sinc(x) = sin(πx) / (πx)
                    T x = T(2) * static_cast<T>(M_PI) * cutoffFreq * static_cast<T>(n_shifted);
                    impulse[n] = std::sin(x) / (static_cast<T>(M_PI) * static_cast<T>(n_shifted));
                }
            }

            return impulse;
        }

        template <typename T>
        void FirFilter<T>::applyWindow(std::vector<T> &impulse, const std::string &windowType)
        {
            const size_t N = impulse.size();
            const T pi = static_cast<T>(M_PI);

            for (size_t n = 0; n < N; ++n)
            {
                T window = T(1);
                const T nf = static_cast<T>(n);
                const T Nf = static_cast<T>(N);

                if (windowType == "hamming")
                {
                    window = T(0.54) - T(0.46) * std::cos(T(2) * pi * nf / (Nf - T(1)));
                }
                else if (windowType == "hann")
                {
                    window = T(0.5) * (T(1) - std::cos(T(2) * pi * nf / (Nf - T(1))));
                }
                else if (windowType == "blackman")
                {
                    window = T(0.42) - T(0.5) * std::cos(T(2) * pi * nf / (Nf - T(1))) + T(0.08) * std::cos(T(4) * pi * nf / (Nf - T(1)));
                }
                else if (windowType == "bartlett")
                {
                    window = T(1) - std::abs(T(2) * nf / (Nf - T(1)) - T(1));
                }

                impulse[n] *= window;
            }
        }

        template <typename T>
        FirFilter<T> FirFilter<T>::createLowPass(T cutoffFreq, size_t numTaps, const std::string &windowType)
        {
            if (cutoffFreq <= 0 || cutoffFreq >= T(0.5))
            {
                throw std::invalid_argument("Cutoff frequency must be between 0 and 0.5 (normalized)");
            }

            auto impulse = generateSincLowPass(cutoffFreq, numTaps);
            applyWindow(impulse, windowType);

            // Normalize to unit gain at DC
            T sum = T(0);
            for (const auto &val : impulse)
            {
                sum += val;
            }

            for (auto &val : impulse)
            {
                val /= sum;
            }

            return FirFilter<T>(impulse, true);
        }

        template <typename T>
        FirFilter<T> FirFilter<T>::createHighPass(T cutoffFreq, size_t numTaps, const std::string &windowType)
        {
            // High-pass = delta - low-pass (spectral inversion)
            auto lowPass = createLowPass(cutoffFreq, numTaps, windowType);
            auto coeffs = lowPass.getCoefficients();

            // Spectral inversion
            for (size_t i = 0; i < coeffs.size(); ++i)
            {
                coeffs[i] = -coeffs[i];
            }

            // Add impulse at center
            coeffs[coeffs.size() / 2] += T(1);

            return FirFilter<T>(coeffs, true);
        }

        template <typename T>
        FirFilter<T> FirFilter<T>::createBandPass(T lowCutoff, T highCutoff, size_t numTaps, const std::string &windowType)
        {
            if (lowCutoff >= highCutoff)
            {
                throw std::invalid_argument("Low cutoff must be less than high cutoff");
            }

            // Band-pass = low-pass(high) - low-pass(low)
            auto lpHigh = createLowPass(highCutoff, numTaps, windowType);
            auto lpLow = createLowPass(lowCutoff, numTaps, windowType);

            auto coeffsHigh = lpHigh.getCoefficients();
            auto coeffsLow = lpLow.getCoefficients();

            std::vector<T> bandPass(coeffsHigh.size());
            for (size_t i = 0; i < coeffsHigh.size(); ++i)
            {
                bandPass[i] = coeffsHigh[i] - coeffsLow[i];
            }

            return FirFilter<T>(bandPass, true);
        }

        template <typename T>
        FirFilter<T> FirFilter<T>::createBandStop(T lowCutoff, T highCutoff, size_t numTaps, const std::string &windowType)
        {
            // Band-stop = low-pass(low) + high-pass(high)
            auto lpLow = createLowPass(lowCutoff, numTaps, windowType);
            auto hpHigh = createHighPass(highCutoff, numTaps, windowType);

            auto coeffsLow = lpLow.getCoefficients();
            auto coeffsHigh = hpHigh.getCoefficients();

            std::vector<T> bandStop(coeffsLow.size());
            for (size_t i = 0; i < coeffsLow.size(); ++i)
            {
                bandStop[i] = coeffsLow[i] + coeffsHigh[i];
            }

            return FirFilter<T>(bandStop, true);
        }

        // Explicit template instantiations
        template class FirFilter<float>;
        template class FirFilter<double>;

    } // namespace core
} // namespace dsp
