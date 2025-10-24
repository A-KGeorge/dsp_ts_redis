#pragma once

#include "../utils/SlidingWindowFilter.h"
#include "Policies.h"
#include <cmath>   // For std::abs
#include <utility> // For std::pair
#include <vector>

namespace dsp::core
{
    template <typename T>
    class WaveformLengthFilter
    {
    public:
        /**
         * @brief Constructs a new Waveform Length Filter.
         * @param window_size The number of samples to consider in the sliding window.
         */
        explicit WaveformLengthFilter(size_t window_size)
            : m_filter(window_size), m_previous_sample(0.0f), m_is_initialized(false) {}

        // Delete copy constructor and copy assignment
        WaveformLengthFilter(const WaveformLengthFilter &) = delete;
        WaveformLengthFilter &operator=(const WaveformLengthFilter &) = delete;

        // Enable move semantics
        WaveformLengthFilter(WaveformLengthFilter &&) noexcept = default;
        WaveformLengthFilter &operator=(WaveformLengthFilter &&) noexcept = default;

        /**
         * @brief Adds a new sample to the filter.
         * @param newValue The new sample value to add.
         * @return T The updated waveform length over the window.
         */
        T addSample(float newValue)
        {
            T diff = 0.0;
            if (m_is_initialized)
            {
                diff = std::abs(newValue - m_previous_sample);
            }

            m_previous_sample = newValue;
            m_is_initialized = true;

            // Add the difference to the window, get the sum of diffs back
            return m_filter.addSample(diff);
        }

        /**
         * @brief Clears all samples from the filter and resets state.
         */
        void clear()
        {
            m_filter.clear();
            m_previous_sample = 0.0;
            m_is_initialized = false;
        }

        /**
         * @brief Exports the complete filter state (buffer + previous sample).
         * @return A pair containing the buffer contents, running sum, and previous sample.
         */
        std::pair<std::pair<std::vector<T>, double>, T> getState() const
        {
            // Returns: { {buffer_of_diffs, running_sum}, previous_sample }
            return std::make_pair(m_filter.getState(), m_previous_sample);
        }

        /**
         * @brief Restores the complete filter state (buffer + previous sample).
         * @param buffer The buffer of differences to restore.
         * @param runningSum The running sum of differences to restore.
         * @param prevSample The previous sample value to restore.
         * @return void
         */
        void setState(const std::vector<T> &buffer, double runningSum, T prevSample)
        {
            m_filter.setState(buffer, runningSum);
            m_previous_sample = prevSample;
            m_is_initialized = true; // Assume if state is set, we are init'd
        }

        /**
         * @brief Gets const access to the internal SlidingWindowFilter.
         * @return const SlidingWindowFilter<float, SumPolicy<float>>& Reference to the internal filter
         */
        const dsp::utils::SlidingWindowFilter<T, SumPolicy<T>> &getInternalFilter() const
        {
            return m_filter;
        }

    private:
        dsp::utils::SlidingWindowFilter<T, SumPolicy<T>> m_filter;
        T m_previous_sample;
        bool m_is_initialized;
    };
}
