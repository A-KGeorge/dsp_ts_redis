#pragma once
#include "../utils/SlidingWindowFilter.h"
#include "Policies.h"
#include <utility>
#include <vector>
#include <stdexcept>

namespace dsp::core
{
    using dsp::utils::SlidingWindowFilter;
    /**
     * @brief Implements an efficient Mean Absolute Value (MAV) filter.
     *
     * This class is now a thin wrapper around SlidingWindowFilter
     * using the MeanAbsoluteValuePolicy for statistical computation.
     *
     * The policy automatically handles the absolute value calculation,
     * demonstrating the power of policy-based design for complex transformations.
     *
     * @tparam T The numeric type of the samples (e.g., float, double, int).
     */
    template <typename T>
    class MovingAbsoluteValueFilter
    {
    public:
        /**
         * @brief Constructs a new MAV Filter.
         * @param window_size The number of samples to average over (N).
         */
        explicit MovingAbsoluteValueFilter(size_t window_size)
            : m_filter(window_size, MeanAbsoluteValuePolicy<T>{})
        {
            if (window_size == 0)
            {
                throw std::invalid_argument("Window size must be greater than 0");
            }
        }

        // Delete copy constructor and copy assignment
        MovingAbsoluteValueFilter(const MovingAbsoluteValueFilter &) = delete;
        MovingAbsoluteValueFilter &operator=(const MovingAbsoluteValueFilter &) = delete;

        // Enable move semantics
        MovingAbsoluteValueFilter(MovingAbsoluteValueFilter &&) noexcept = default;
        MovingAbsoluteValueFilter &operator=(MovingAbsoluteValueFilter &&) noexcept = default;

        /**
         * @brief Adds a new sample to the filter.
         * @param newValue The new sample value to add (can be negative).
         * @return T The new mean absolute value.
         */
        T addSample(T newValue) { return m_filter.addSample(newValue); }

        /**
         * @brief Gets the current mean absolute value.
         * @return T The MAV of the samples currently in the buffer.
         */
        T getMav() const { return m_filter.getPolicy().getResult(m_filter.getCount()); }

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
         * @return A pair containing the buffer contents (original values)
         * and the running sum of absolute values.
         */
        std::pair<std::vector<T>, T> getState() const
        {
            return {m_filter.getBufferContents(), m_filter.getPolicy().getState()};
        }

        /**
         * @brief Restores the filter's internal state.
         * @param bufferData The buffer contents (original values) to restore.
         * @param sumOfAbs The running sum of absolute values to restore.
         */
        void setState(const std::vector<T> &bufferData, T sumOfAbs)
        {
            m_filter.setBufferContents(bufferData);
            m_filter.getPolicy().setState(sumOfAbs);
        }

    private:
        SlidingWindowFilter<T, MeanAbsoluteValuePolicy<T>> m_filter;
    };
} // namespace dsp::core