/**
 * Moving/Batched FFT Filter
 *
 * Provides sliding-window and batched FFT processing:
 * - Moving FFT: Updates spectrum as new samples arrive
 * - Batched FFT: Processes complete frames with configurable overlap
 * - Zero-padding support
 * - Windowing functions (Hann, Hamming, Blackman)
 *
 * Uses CircularBufferArray for efficient sample buffering
 */

#ifndef DSP_CORE_MOVING_FFT_FILTER_H
#define DSP_CORE_MOVING_FFT_FILTER_H

#include "FftEngine.h"
#include "../utils/CircularBufferArray.h"
#include <vector>
#include <functional>

namespace dsp
{
    namespace core
    {

        /**
         * Window function types
         */
        enum class WindowType
        {
            None,     // Rectangular (no windowing)
            Hann,     // Hann window (cosine taper)
            Hamming,  // Hamming window
            Blackman, // Blackman window (better sidelobe rejection)
            Bartlett  // Triangular window
        };

        /**
         * FFT processing mode
         */
        enum class FftMode
        {
            Moving, // Sliding window, updates on every sample
            Batched // Process complete frames
        };

        template <typename T = float>
        class MovingFftFilter
        {
        public:
            using Complex = std::complex<T>;

            /**
             * Constructor
             *
             * @param fftSize FFT size (must be power of 2)
             * @param hopSize Hop size for batched mode (samples between frames)
             * @param mode Processing mode (Moving or Batched)
             * @param windowType Windowing function
             * @param realInput True for real-input transforms (RFFT/RDFT)
             */
            MovingFftFilter(
                size_t fftSize,
                size_t hopSize = 0,
                FftMode mode = FftMode::Batched,
                WindowType windowType = WindowType::Hann,
                bool realInput = true);

            ~MovingFftFilter() = default;

            /**
             * Add sample and optionally compute FFT
             *
             * @param sample Input sample
             * @param spectrum Output spectrum (nullptr if not ready)
             * @return True if spectrum was computed
             */
            bool addSample(T sample, Complex *spectrum);

            /**
             * Add batch of samples
             *
             * @param samples Input samples
             * @param count Number of samples
             * @param callback Called for each computed spectrum
             * @return Number of spectra computed
             */
            size_t addSamples(
                const T *samples,
                size_t count,
                std::function<void(const Complex *, size_t)> callback);

            /**
             * Compute FFT from current buffer (force computation)
             *
             * @param spectrum Output spectrum
             */
            void computeSpectrum(Complex *spectrum);

            /**
             * Reset filter state
             */
            void reset();

            /**
             * Get FFT size
             */
            size_t getFftSize() const { return m_fftSize; }

            /**
             * Get spectrum size (N for complex, N/2+1 for real)
             */
            size_t getSpectrumSize() const
            {
                return m_realInput ? m_fftEngine->getHalfSize() : m_fftSize;
            }

            /**
             * Get hop size
             */
            size_t getHopSize() const { return m_hopSize; }

            /**
             * Get current fill level
             */
            size_t getFillLevel() const { return m_buffer.getCount(); }

            /**
             * Check if ready to compute (buffer full)
             */
            bool isReady() const { return m_buffer.getCount() >= m_fftSize; }

            /**
             * Set window function
             */
            void setWindowType(WindowType type);

            /**
             * Get magnitude spectrum
             */
            void getMagnitudeSpectrum(T *magnitudes);

            /**
             * Get power spectrum
             */
            void getPowerSpectrum(T *power);

            /**
             * Get phase spectrum
             */
            void getPhaseSpectrum(T *phases);

            /**
             * Get frequency bins (Hz)
             *
             * @param sampleRate Sample rate in Hz
             * @param frequencies Output array (size = spectrum size)
             */
            void getFrequencyBins(T sampleRate, T *frequencies);

        private:
            size_t m_fftSize;
            size_t m_hopSize;
            FftMode m_mode;
            WindowType m_windowType;
            bool m_realInput;

            // FFT engine
            std::unique_ptr<FftEngine<T>> m_fftEngine;

            // Circular buffer for sample accumulation
            utils::CircularBufferArray<T> m_buffer;

            // Window coefficients
            std::vector<T> m_window;

            // Working buffers
            std::vector<T> m_windowedSamples;
            std::vector<Complex> m_spectrum;

            // Sample counter for hop detection
            size_t m_sampleCounter;

            /**
             * Initialize window function
             */
            void initWindow();

            /**
             * Apply window to samples
             */
            void applyWindow(const T *input, T *output);

            /**
             * Compute window function coefficient
             */
            T getWindowCoefficient(size_t n, WindowType type);
        };

    } // namespace core
} // namespace dsp

#endif // DSP_CORE_MOVING_FFT_FILTER_H
