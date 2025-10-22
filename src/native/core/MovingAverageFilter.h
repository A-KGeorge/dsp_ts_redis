#pragma once
#include "../utils/CircularBufferArray.h"

namespace dsp::core
{
    /**
     * @brief Implements an efficient Simple Moving Average (SMA) filter.
     *
     * This class uses a circular buffer to store the last 'N' samples
     * and maintains a running sum for O(1) average calculation.
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
        explicit MovingAverageFilter(size_t window_size);

        // Delete copy constructor and copy assignment to prevent accidental copies
        MovingAverageFilter(const MovingAverageFilter &) = delete;
        MovingAverageFilter &operator=(const MovingAverageFilter &) = delete;

        // Enable move semantics
        MovingAverageFilter(MovingAverageFilter &&) noexcept = default;
        MovingAverageFilter &operator=(MovingAverageFilter &&) noexcept = default;

        /**
         * @brief Adds a new sample to the filter.
         *
         * This updates the running sum and the internal circular buffer.
         * The new average is calculated and returned.
         *
         * @param newValue The new sample value to add.
         * @return T The new moving average.
         */
        T addSample(T newValue);

        /**
         * @brief Gets the current moving average.
         * @return T The average of the samples currently in the buffer.
         */
        T getAverage() const;

        /**
         * @brief Clears all samples from the filter and resets the sum.
         */
        void clear();

        /**
         * @brief Checks if the filter's buffer is full (i.e., has N samples).
         * @return true if the buffer is full, false otherwise.
         */
        bool isFull() const noexcept;

    private:
        CircularBufferArray<T> buffer;
        T running_sum;
        size_t window_size;
    };
}