#pragma once

#include "../utils/SlidingWindowFilter.h"
#include "Policies.h"
#include <cmath>   // For std::abs
#include <utility> // For std::pair
#include <vector>

namespace dsp::core
{
    template <typename T>
    class WampFilter
    {
    public:
        /**
         * @brief Constructs a new Wamp Filter.
         * @param window_size The number of samples to consider in the sliding window.
         * @param threshold The amplitude change threshold to detect.
         */
        explicit WampFilter(size_t window_size, T threshold)
            : m_filter(window_size), m_threshold(threshold), m_previous_sample(0.0), m_is_initialized(false) {}

        // Delete copy constructor and copy assignment
        WampFilter(const WampFilter &) = delete;
        WampFilter &operator=(const WampFilter &) = delete;

        // Enable move semantics
        WampFilter(WampFilter &&) noexcept = default;
        WampFilter &operator=(WampFilter &&) noexcept = default;

        /**
         * @brief Adds a new sample to the filter.
         * @param newValue The new sample value to add.
         * @return T The updated WAMP count over the window.
         */
        T addSample(T newValue)
        {
            bool did_exceed = false;
            if (m_is_initialized)
            {
                did_exceed = std::abs(newValue - m_previous_sample) > m_threshold;
            }

            m_previous_sample = newValue;
            m_is_initialized = true;

            // Add the boolean to the window, get the count back
            // Cast count (size_t) to T (float/double)
            return static_cast<T>(m_filter.addSample(did_exceed));
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
         * @return A pair containing the buffer contents and previous sample.
         */
        auto getState() const
        {
            return std::make_pair(m_filter.getState(), m_previous_sample);
        }

        /**
         * @brief Restores the complete filter state (buffer + previous sample).
         * @param buffer The buffer contents to restore.
         * @param count The count of 'true' entries in the buffer.
         * @param prevSample The previous sample value to restore.
         * @return void
         */
        void setState(const std::vector<bool> &buffer, size_t count, T prevSample)
        {
            m_filter.setState(buffer, count);
            m_previous_sample = prevSample;
            m_is_initialized = true;
        }

        /**
         * @brief Gets const access to the internal SlidingWindowFilter.
         * @return const SlidingWindowFilter<bool, CounterPolicy>& Reference to the internal filter
         */
        const dsp::utils::SlidingWindowFilter<bool, CounterPolicy> &getInternalFilter() const
        {
            return m_filter;
        }

    private:
        dsp::utils::SlidingWindowFilter<bool, CounterPolicy> m_filter;
        T m_threshold;
        T m_previous_sample;
        bool m_is_initialized;
    };

} // namespace dsp::core