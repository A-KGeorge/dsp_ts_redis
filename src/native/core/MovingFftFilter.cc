/**
 * Moving/Batched FFT Filter Implementation with SIMD Optimizations
 */

#define _USE_MATH_DEFINES
#include "MovingFftFilter.h"
#include "../utils/SimdOps.h"
#include <cmath>
#include <stdexcept>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

namespace dsp
{
    namespace core
    {

        template <typename T>
        MovingFftFilter<T>::MovingFftFilter(
            size_t fftSize,
            size_t hopSize,
            FftMode mode,
            WindowType windowType,
            bool realInput)
            : m_fftSize(fftSize), m_hopSize(hopSize == 0 ? fftSize : hopSize), m_mode(mode), m_windowType(windowType), m_realInput(realInput), m_fftEngine(std::make_unique<FftEngine<T>>(fftSize)), m_buffer(fftSize * 2) // Buffer size = 2x FFT size for overlap
              ,
              m_sampleCounter(0)
        {
            if (fftSize == 0)
            {
                throw std::invalid_argument("FFT size must be > 0");
            }

            if (m_hopSize > fftSize)
            {
                throw std::invalid_argument("Hop size cannot exceed FFT size");
            }

            // Allocate working buffers
            m_windowedSamples.resize(fftSize);

            size_t spectrumSize = realInput ? m_fftEngine->getHalfSize() : fftSize;
            m_spectrum.resize(spectrumSize);

            // Initialize window
            initWindow();
        }

        template <typename T>
        bool MovingFftFilter<T>::addSample(T sample, Complex *spectrum)
        {
            m_buffer.push(sample);

            bool computed = false;

            if (m_mode == FftMode::Moving)
            {
                // Moving mode: compute on every sample when buffer is full
                if (m_buffer.getCount() >= m_fftSize)
                {
                    computeSpectrum(m_spectrum.data());

                    if (spectrum)
                    {
                        size_t specSize = getSpectrumSize();
                        std::copy(m_spectrum.begin(), m_spectrum.begin() + specSize, spectrum);
                    }

                    computed = true;
                }
            }
            else
            {
                // Batched mode: compute every hop samples
                ++m_sampleCounter;

                if (m_buffer.getCount() >= m_fftSize && m_sampleCounter >= m_hopSize)
                {
                    computeSpectrum(m_spectrum.data());

                    if (spectrum)
                    {
                        size_t specSize = getSpectrumSize();
                        std::copy(m_spectrum.begin(), m_spectrum.begin() + specSize, spectrum);
                    }

                    m_sampleCounter = 0;
                    computed = true;
                }
            }

            return computed;
        }

        template <typename T>
        size_t MovingFftFilter<T>::addSamples(
            const T *samples,
            size_t count,
            std::function<void(const Complex *, size_t)> callback)
        {
            size_t numSpectra = 0;

            for (size_t i = 0; i < count; ++i)
            {
                if (addSample(samples[i], m_spectrum.data()))
                {
                    if (callback)
                    {
                        callback(m_spectrum.data(), getSpectrumSize());
                    }
                    ++numSpectra;
                }
            }

            return numSpectra;
        }

        template <typename T>
        void MovingFftFilter<T>::computeSpectrum(Complex *spectrum)
        {
            if (m_buffer.getCount() < m_fftSize)
            {
                throw std::runtime_error("Insufficient samples for FFT");
            }

            // Get latest samples from buffer
            std::vector<T> allSamples = m_buffer.toVector();
            std::vector<T> samples(m_fftSize);

            // Extract the last fftSize samples
            size_t startIdx = allSamples.size() - m_fftSize;
            for (size_t i = 0; i < m_fftSize; ++i)
            {
                samples[i] = allSamples[startIdx + i];
            }

            // Apply window
            applyWindow(samples.data(), m_windowedSamples.data());

            // Compute FFT
            if (m_realInput)
            {
                if (m_fftEngine->isPowerOfTwo())
                {
                    m_fftEngine->rfft(m_windowedSamples.data(), spectrum);
                }
                else
                {
                    m_fftEngine->rdft(m_windowedSamples.data(), spectrum);
                }
            }
            else
            {
                // Pack real samples as complex
                std::vector<Complex> complexInput(m_fftSize);
                for (size_t i = 0; i < m_fftSize; ++i)
                {
                    complexInput[i] = Complex(m_windowedSamples[i], 0);
                }

                if (m_fftEngine->isPowerOfTwo())
                {
                    m_fftEngine->fft(complexInput.data(), spectrum);
                }
                else
                {
                    m_fftEngine->dft(complexInput.data(), spectrum);
                }
            }
        }

        template <typename T>
        void MovingFftFilter<T>::reset()
        {
            m_buffer.clear();
            m_sampleCounter = 0;
        }

        template <typename T>
        void MovingFftFilter<T>::setWindowType(WindowType type)
        {
            m_windowType = type;
            initWindow();
        }

        template <typename T>
        void MovingFftFilter<T>::getMagnitudeSpectrum(T *magnitudes)
        {
            // MEDIUM WIN: Use SIMD-optimized magnitude calculation from FftEngine
            m_fftEngine->getMagnitude(m_spectrum.data(), magnitudes, getSpectrumSize());
        }

        template <typename T>
        void MovingFftFilter<T>::getPowerSpectrum(T *power)
        {
            // MEDIUM WIN: Use SIMD-optimized power calculation from FftEngine
            m_fftEngine->getPower(m_spectrum.data(), power, getSpectrumSize());
        }

        template <typename T>
        void MovingFftFilter<T>::getPhaseSpectrum(T *phases)
        {
            m_fftEngine->getPhase(m_spectrum.data(), phases, getSpectrumSize());
        }

        template <typename T>
        void MovingFftFilter<T>::getFrequencyBins(T sampleRate, T *frequencies)
        {
            size_t specSize = getSpectrumSize();
            T binWidth = sampleRate / static_cast<T>(m_fftSize);

            for (size_t i = 0; i < specSize; ++i)
            {
                frequencies[i] = static_cast<T>(i) * binWidth;
            }
        }

        // ========== Private Methods ==========

        template <typename T>
        void MovingFftFilter<T>::initWindow()
        {
            m_window.resize(m_fftSize);

            for (size_t i = 0; i < m_fftSize; ++i)
            {
                m_window[i] = getWindowCoefficient(i, m_windowType);
            }
        }

        template <typename T>
        void MovingFftFilter<T>::applyWindow(const T *input, T *output)
        {
            // QUICK WIN: SIMD-optimized window application
            if constexpr (std::is_same_v<T, float>)
            {
                dsp::simd::apply_window(input, m_window.data(), output, m_fftSize);
            }
            else
            {
                // Fallback for double precision
                for (size_t i = 0; i < m_fftSize; ++i)
                {
                    output[i] = input[i] * m_window[i];
                }
            }
        }

        template <typename T>
        T MovingFftFilter<T>::getWindowCoefficient(size_t n, WindowType type)
        {
            if (type == WindowType::None)
            {
                return T(1);
            }

            const T pi = static_cast<T>(M_PI);
            const T N = static_cast<T>(m_fftSize);
            const T nf = static_cast<T>(n);

            switch (type)
            {
            case WindowType::Hann:
                // w[n] = 0.5 * (1 - cos(2πn/(N-1)))
                return T(0.5) * (T(1) - std::cos(T(2) * pi * nf / (N - T(1))));

            case WindowType::Hamming:
                // w[n] = 0.54 - 0.46 * cos(2πn/(N-1))
                return T(0.54) - T(0.46) * std::cos(T(2) * pi * nf / (N - T(1)));

            case WindowType::Blackman:
                // w[n] = 0.42 - 0.5*cos(2πn/(N-1)) + 0.08*cos(4πn/(N-1))
                return T(0.42) - T(0.5) * std::cos(T(2) * pi * nf / (N - T(1))) + T(0.08) * std::cos(T(4) * pi * nf / (N - T(1)));

            case WindowType::Bartlett:
                // w[n] = 1 - |2n/(N-1) - 1|
                return T(1) - std::abs(T(2) * nf / (N - T(1)) - T(1));

            default:
                return T(1);
            }
        }

        // Explicit template instantiations
        template class MovingFftFilter<float>;
        template class MovingFftFilter<double>;

    } // namespace core
} // namespace dsp
