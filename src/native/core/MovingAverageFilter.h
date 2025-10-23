#pragma once
#include "../utils/SlidingWindowFilter.h"
#include "Policies.h"
#include <utility>
#include <vector>

namespace dsp::core
{
    using dsp::utils::SlidingWindowFilter;
    /**
     * @brief Implements an efficient Simple Moving Average (SMA) filter.
     *
     * This class is now a thin wrapper around SlidingWindowFilter
     * using the MeanPolicy for statistical computation.
     *
     * The policy-based design provides:
     * - Zero-cost abstraction (inlined policy methods)
     * - Consistent interface across all sliding window filters
     * - Easy extensibility for new statistical measures
     *
     * @tparam T The numeric type of the samples (e.g., float, double, int).
     */
    template <typename T>
    class MovingAverageFilter
    {
    public:
        /**
         * @brief Constructs a new Moving Average Filter.
         * @param window_size The number of samples to average over (N).
         */
        explicit MovingAverageFilter(size_t window_size)
            : m_filter(window_size, MeanPolicy<T>{})
        {
            if (window_size == 0)
            {
                throw std::invalid_argument("Window size must be greater than 0");
            }
        }

        // Delete copy constructor and copy assignment
        MovingAverageFilter(const MovingAverageFilter &) = delete;
        MovingAverageFilter &operator=(const MovingAverageFilter &) = delete;

        // Enable move semantics
        MovingAverageFilter(MovingAverageFilter &&) noexcept = default;
        MovingAverageFilter &operator=(MovingAverageFilter &&) noexcept = default;

        /**
         * @brief Adds a new sample to the filter.
         * @param newValue The new sample value to add.
         * @return T The new moving average.
         */
        T addSample(T newValue) { return m_filter.addSample(newValue); }

        /**
         * @brief Gets the current moving average.
         * @return T The average of the samples currently in the buffer.
         */
        T getAverage() const { return m_filter.getPolicy().getResult(m_filter.getCount()); }

        /**
         * @brief Clears all samples from the filter and resets the sum.
         */
        void clear() { m_filter.clear(); }

        /**
         * @brief Checks if the filter's buffer is full (i.e., has N samples).
         * @return true if the buffer is full, false otherwise.
         */
        bool isFull() const noexcept { return m_filter.isFull(); }

        /**
         * @brief Exports the filter's internal state.
         *
         * Delegates to SlidingWindowFilter's generic state management.
         *
         * @return A pair containing the buffer contents and running sum.
         */
        std::pair<std::vector<T>, T> getState() const
        {
            return m_filter.getState();
        }

        /**
         * @brief Restores the filter's internal state.
         *
         * Delegates to SlidingWindowFilter's generic state management.
         *
         * @param bufferData The buffer contents to restore.
         * @param sum The running sum to restore.
         */
        void setState(const std::vector<T> &bufferData, T sum)
        {
            m_filter.setState(bufferData, sum);
        }

    private:
        SlidingWindowFilter<T, MeanPolicy<T>> m_filter;
    };
} // namespace dsp::core