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
     * @brief Implements an efficient Root Mean Square (RMS) filter.
     *
     * This class is now a thin wrapper around SlidingWindowFilter
     * using the RmsPolicy for statistical computation.
     *
     * @tparam T The numeric type of the samples (e.g., float, double).
     */
    template <typename T>
    class RmsFilter
    {
    public:
        /**
         * @brief Constructs a new RMS Filter.
         * @param window_size The number of samples to average over (N).
         */
        explicit RmsFilter(size_t window_size)
            : m_filter(window_size, RmsPolicy<T>{})
        {
            if (window_size == 0)
            {
                throw std::invalid_argument("Window size must be greater than 0");
            }
        }

        // Delete copy constructor and copy assignment
        RmsFilter(const RmsFilter &) = delete;
        RmsFilter &operator=(const RmsFilter &) = delete;

        // Enable move semantics
        RmsFilter(RmsFilter &&) noexcept = default;
        RmsFilter &operator=(RmsFilter &&) noexcept = default;

        /**
         * @brief Adds a new sample to the filter.
         * @param newValue The new sample value to add.
         * @return T The new RMS value.
         */
        T addSample(T newValue) { return m_filter.addSample(newValue); }

        /**
         * @brief Gets the current RMS value.
         * @return T The RMS of the samples currently in the buffer.
         */
        T getRms() const { return m_filter.getPolicy().getResult(m_filter.getCount()); }

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
         * @return A pair containing the buffer contents and running sum of squares.
         */
        std::pair<std::vector<T>, T> getState() const
        {
            return {m_filter.getBufferContents(), m_filter.getPolicy().getState()};
        }

        /**
         * @brief Restores the filter's internal state.
         * @param bufferData The buffer contents to restore.
         * @param sumOfSquares The running sum of squares to restore.
         */
        void setState(const std::vector<T> &bufferData, T sumOfSquares)
        {
            m_filter.setBufferContents(bufferData);
            m_filter.getPolicy().setState(sumOfSquares);
        }

    private:
        SlidingWindowFilter<T, RmsPolicy<T>> m_filter;
    };
} // namespace dsp::core