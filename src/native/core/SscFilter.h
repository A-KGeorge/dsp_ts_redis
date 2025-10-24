#pragma once

#include "../utils/SlidingWindowFilter.h"
#include "Policies.h"
#include <cmath>   // For std::abs
#include <utility> // For std::pair
#include <vector>

namespace dsp::core
{
    template <typename T>
    class SscFilter
    {
    public:
        /**
         * @brief Constructs a new Ssc Filter.
         * @param window_size The number of samples to consider in the sliding window.
         * @param threshold The amplitude change threshold to detect.
         */
        explicit SscFilter(size_t window_size, T threshold)
            : m_filter(window_size),
              m_threshold(threshold),
              m_sample_minus_1(0.0),
              m_sample_minus_2(0.0),
              m_init_count(0) {}

        // Delete copy constructor and copy assignment
        SscFilter(const SscFilter &) = delete;
        SscFilter &operator=(const SscFilter &) = delete;

        // Enable move semantics
        SscFilter(SscFilter &&) noexcept = default;
        SscFilter &operator=(SscFilter &&) noexcept = default;

        /**
         * @brief Adds a new sample to the filter.
         * @param sample_n The new sample value to add.
         * @return T The updated SSC count over the window.
         */
        T addSample(T sample_n) // sample_n is x_{i+1}
        {
            bool did_change = false;

            if (m_init_count >= 2)
            {
                // We have x_{i-1} (m_sample_minus_2), x_i (m_sample_minus_1), and x_{i+1} (sample_n)
                T diff1 = m_sample_minus_1 - m_sample_minus_2; // (x_i - x_{i-1})
                T diff2 = m_sample_minus_1 - sample_n;         // (x_i - x_{i+1})

                did_change = (diff1 * diff2) > m_threshold;
            }
            else
            {
                if (m_init_count == 0)
                    m_sample_minus_2 = sample_n; // First sample
                if (m_init_count == 1)
                    m_sample_minus_1 = sample_n; // Second sample
                m_init_count++;
            }

            // Update state for the *next* iteration
            m_sample_minus_2 = m_sample_minus_1;
            m_sample_minus_1 = sample_n;

            // Add the boolean to the window, get the count back
            // Cast count (size_t) to T (float/double)
            return static_cast<T>(m_filter.addSample(did_change));
        }

        /**
         * @brief Clears all samples from the filter and resets state.
         */
        void clear()
        {
            m_filter.clear();
            m_sample_minus_1 = 0.0;
            m_sample_minus_2 = 0.0;
            m_init_count = 0;
        }

        // --- State Management ---
        using SscState = std::pair<std::vector<bool>, size_t>;

        struct SscFilterState
        {
            T sample_minus_1;
            T sample_minus_2;
            int init_count;
        };

        /**
         * @brief Exports the complete filter state (buffer + previous samples).
         * @return A pair containing the buffer contents, running count, and previous samples.
         */

        auto getState() const -> std::pair<SscState, SscFilterState>
        {
            // Returns: { {buffer_of_bools, running_count}, {s_m1, s_m2, init_count} }
            return {
                m_filter.getState(),
                {m_sample_minus_1, m_sample_minus_2, m_init_count}};
        }

        /**
         * @brief Restores the complete filter state (buffer + previous samples).
         * @param buffer The buffer contents to restore.
         * @param count The count of 'true' entries in the buffer.
         * @param filterState The previous samples and init count to restore.
         * @return void
         */

        void setState(const std::vector<bool> &buffer, size_t count, const SscFilterState &filterState)
        {
            m_filter.setState(buffer, count);
            m_sample_minus_1 = filterState.sample_minus_1;
            m_sample_minus_2 = filterState.sample_minus_2;
            m_init_count = filterState.init_count;
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
        T m_sample_minus_1; // x_i
        T m_sample_minus_2; // x_{i-1}
        int m_init_count;   // Needs 2 samples to be fully initialized
    };

} // namespace dsp::core