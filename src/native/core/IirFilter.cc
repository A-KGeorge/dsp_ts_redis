/**
 * IIR Filter Implementation
 */

#define _USE_MATH_DEFINES
#include "IirFilter.h"
#include <cmath>
#include <stdexcept>
#include <algorithm>
#include <complex>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

namespace dsp
{
    namespace core
    {

        template <typename T>
        IirFilter<T>::IirFilter(const std::vector<T> &b_coeffs, const std::vector<T> &a_coeffs, bool stateful)
            : m_b_coeffs(b_coeffs), m_a_coeffs(a_coeffs), m_stateful(stateful)
        {
            if (b_coeffs.empty())
            {
                throw std::invalid_argument("IIR filter requires at least one feedforward coefficient");
            }

            if (stateful)
            {
                // Allocate state buffers
                m_x_state.resize(b_coeffs.size(), T(0));
                m_y_state.resize(a_coeffs.size(), T(0));
            }
        }

        template <typename T>
        T IirFilter<T>::processSample(T input)
        {
            if (!m_stateful)
            {
                throw std::runtime_error("processSample() requires stateful mode");
            }

            // Direct Form II implementation
            // Compute feedforward (numerator)
            T output = m_b_coeffs[0] * input;

            for (size_t i = 1; i < m_b_coeffs.size(); ++i)
            {
                if (i - 1 < m_x_state.size())
                {
                    output += m_b_coeffs[i] * m_x_state[i - 1];
                }
            }

            // Compute feedback (denominator)
            for (size_t i = 0; i < m_a_coeffs.size(); ++i)
            {
                if (i < m_y_state.size())
                {
                    output -= m_a_coeffs[i] * m_y_state[i];
                }
            }

            // Update state buffers (shift history)
            // Input history: x[n-1] <- x[n-2] <- ... <- x[n-M] <- input
            for (size_t i = m_x_state.size() - 1; i > 0; --i)
            {
                m_x_state[i] = m_x_state[i - 1];
            }
            if (!m_x_state.empty())
            {
                m_x_state[0] = input;
            }

            // Output history: y[n-1] <- y[n-2] <- ... <- y[n-N] <- output
            for (size_t i = m_y_state.size() - 1; i > 0; --i)
            {
                m_y_state[i] = m_y_state[i - 1];
            }
            if (!m_y_state.empty())
            {
                m_y_state[0] = output;
            }

            return output;
        }

        template <typename T>
        void IirFilter<T>::process(const T *input, T *output, size_t length, bool stateless)
        {
            if (stateless || !m_stateful)
            {
                // Stateless mode: use temporary state for batch
                std::vector<T> x_temp(m_b_coeffs.size(), T(0));
                std::vector<T> y_temp(m_a_coeffs.size(), T(0));

                for (size_t n = 0; n < length; ++n)
                {
                    // Feedforward
                    T y = m_b_coeffs[0] * input[n];
                    for (size_t i = 1; i < m_b_coeffs.size(); ++i)
                    {
                        if (i - 1 < x_temp.size())
                        {
                            y += m_b_coeffs[i] * x_temp[i - 1];
                        }
                    }

                    // Feedback
                    for (size_t i = 0; i < m_a_coeffs.size(); ++i)
                    {
                        if (i < y_temp.size())
                        {
                            y -= m_a_coeffs[i] * y_temp[i];
                        }
                    }

                    output[n] = y;

                    // Update temporary state
                    for (size_t i = x_temp.size() - 1; i > 0; --i)
                    {
                        x_temp[i] = x_temp[i - 1];
                    }
                    if (!x_temp.empty())
                    {
                        x_temp[0] = input[n];
                    }

                    for (size_t i = y_temp.size() - 1; i > 0; --i)
                    {
                        y_temp[i] = y_temp[i - 1];
                    }
                    if (!y_temp.empty())
                    {
                        y_temp[0] = y;
                    }
                }
            }
            else
            {
                // Stateful mode: use processSample
                for (size_t i = 0; i < length; ++i)
                {
                    output[i] = processSample(input[i]);
                }
            }
        }

        template <typename T>
        void IirFilter<T>::reset()
        {
            if (m_stateful)
            {
                std::fill(m_x_state.begin(), m_x_state.end(), T(0));
                std::fill(m_y_state.begin(), m_y_state.end(), T(0));
            }
        }

        template <typename T>
        void IirFilter<T>::setCoefficients(const std::vector<T> &b_coeffs, const std::vector<T> &a_coeffs)
        {
            if (b_coeffs.empty())
            {
                throw std::invalid_argument("B coefficients cannot be empty");
            }

            m_b_coeffs = b_coeffs;
            m_a_coeffs = a_coeffs;

            if (m_stateful)
            {
                m_x_state.resize(b_coeffs.size(), T(0));
                m_y_state.resize(a_coeffs.size(), T(0));
            }
        }

        template <typename T>
        bool IirFilter<T>::isStable() const
        {
            // Basic stability check: sum of absolute feedback coefficients < 1
            // This is a necessary but not sufficient condition
            T sum = T(0);
            for (const auto &a : m_a_coeffs)
            {
                sum += std::abs(a);
            }
            return sum < T(1);
        }

        // ========== Filter Design Methods ==========

        template <typename T>
        IirFilter<T> IirFilter<T>::createFirstOrderLowPass(T cutoffFreq)
        {
            if (cutoffFreq <= 0 || cutoffFreq >= T(0.5))
            {
                throw std::invalid_argument("Cutoff frequency must be between 0 and 0.5");
            }

            // First-order low-pass: H(z) = (b0 + b1*z^-1) / (1 + a1*z^-1)
            // Using bilinear transform from analog RC filter
            T omega_c = T(2) * static_cast<T>(M_PI) * cutoffFreq;
            T K = std::tan(omega_c / T(2));

            T b0 = K / (T(1) + K);
            T b1 = K / (T(1) + K);
            T a1 = (K - T(1)) / (T(1) + K);

            return IirFilter<T>({b0, b1}, {a1}, true);
        }

        template <typename T>
        IirFilter<T> IirFilter<T>::createFirstOrderHighPass(T cutoffFreq)
        {
            if (cutoffFreq <= 0 || cutoffFreq >= T(0.5))
            {
                throw std::invalid_argument("Cutoff frequency must be between 0 and 0.5");
            }

            // First-order high-pass
            T omega_c = T(2) * static_cast<T>(M_PI) * cutoffFreq;
            T K = std::tan(omega_c / T(2));

            T b0 = T(1) / (T(1) + K);
            T b1 = -T(1) / (T(1) + K);
            T a1 = (K - T(1)) / (T(1) + K);

            return IirFilter<T>({b0, b1}, {a1}, true);
        }

        template <typename T>
        IirFilter<T> IirFilter<T>::createBiquad(T b0, T b1, T b2, T a1, T a2)
        {
            return IirFilter<T>({b0, b1, b2}, {a1, a2}, true);
        }

        template <typename T>
        IirFilter<T> IirFilter<T>::createButterworthLowPass(T cutoffFreq, int order)
        {
            if (cutoffFreq <= 0 || cutoffFreq >= T(0.5))
            {
                throw std::invalid_argument("Cutoff frequency must be between 0 and 0.5");
            }

            if (order < 1 || order > 8)
            {
                throw std::invalid_argument("Order must be between 1 and 8");
            }

            // For simplicity, implement 2nd-order Butterworth (biquad)
            if (order == 1)
            {
                return createFirstOrderLowPass(cutoffFreq);
            }

            // 2nd-order Butterworth low-pass
            T omega_c = T(2) * static_cast<T>(M_PI) * cutoffFreq;
            T K = std::tan(omega_c / T(2));
            T K2 = K * K;
            T sqrt2 = static_cast<T>(std::sqrt(2.0));

            T norm = T(1) / (T(1) + sqrt2 * K + K2);

            T b0 = K2 * norm;
            T b1 = T(2) * b0;
            T b2 = b0;

            T a1 = T(2) * (K2 - T(1)) * norm;
            T a2 = (T(1) - sqrt2 * K + K2) * norm;

            return IirFilter<T>({b0, b1, b2}, {a1, a2}, true);
        }

        template <typename T>
        IirFilter<T> IirFilter<T>::createButterworthHighPass(T cutoffFreq, int order)
        {
            if (cutoffFreq <= 0 || cutoffFreq >= T(0.5))
            {
                throw std::invalid_argument("Cutoff frequency must be between 0 and 0.5");
            }

            if (order < 1 || order > 8)
            {
                throw std::invalid_argument("Order must be between 1 and 8");
            }

            if (order == 1)
            {
                return createFirstOrderHighPass(cutoffFreq);
            }

            // 2nd-order Butterworth high-pass
            T omega_c = T(2) * static_cast<T>(M_PI) * cutoffFreq;
            T K = std::tan(omega_c / T(2));
            T K2 = K * K;
            T sqrt2 = static_cast<T>(std::sqrt(2.0));

            T norm = T(1) / (T(1) + sqrt2 * K + K2);

            T b0 = norm;
            T b1 = -T(2) * norm;
            T b2 = norm;

            T a1 = T(2) * (K2 - T(1)) * norm;
            T a2 = (T(1) - sqrt2 * K + K2) * norm;

            return IirFilter<T>({b0, b1, b2}, {a1, a2}, true);
        }

        template <typename T>
        IirFilter<T> IirFilter<T>::createButterworthBandPass(T lowCutoff, T highCutoff, int order)
        {
            if (lowCutoff >= highCutoff)
            {
                throw std::invalid_argument("Low cutoff must be less than high cutoff");
            }

            // Simplified: cascade low-pass and high-pass
            // (For true band-pass, would need proper transformation)
            auto hp = createButterworthHighPass(lowCutoff, order);
            auto lp = createButterworthLowPass(highCutoff, order);

            // Convolve coefficients (simplified - in practice need proper cascade)
            auto b_hp = hp.getBCoefficients();
            auto a_hp = hp.getACoefficients();
            auto b_lp = lp.getBCoefficients();
            auto a_lp = lp.getACoefficients();

            // For now, return the high-pass filter as placeholder
            // Full implementation would cascade the filters properly
            return hp;
        }

        // Explicit template instantiations
        template class IirFilter<float>;
        template class IirFilter<double>;

    } // namespace core
} // namespace dsp
