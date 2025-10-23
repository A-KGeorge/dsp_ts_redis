#pragma once

#include "../utils/CircularBufferArray.h"
#include <utility>
#include <vector>
#include <cmath>
#include <stdexcept> // for noexcept
#include <algorithm> // for std::max

namespace dsp::core
{
    /**
     * @brief Implements an efficient Moving Variance filter.
     *
     * This class uses a circular buffer to store the last 'N' samples
     * and maintains a running sum AND a running sum-of-squares
     * for O(1) variance calculation using the formula:
     * Variance = (Mean of Squares) - (Mean)^2
     *
     * @tparam T The numeric type of the samples (e.g., float, double).
     */
    template <typename T>
    class MovingVarianceFilter
    {
    public:
        /**
         * @brief Constructs a new Moving Variance Filter.
         * @param window_size The number of samples to average over (N).
         */
        explicit MovingVarianceFilter(size_t window_size);

        // Delete copy constructor and copy assignment
        MovingVarianceFilter(const MovingVarianceFilter &) = delete;
        MovingVarianceFilter &operator=(const MovingVarianceFilter &) = delete;

        // Enable move semantics
        MovingVarianceFilter(MovingVarianceFilter &&) noexcept = default;
        MovingVarianceFilter &operator=(MovingVarianceFilter &&) noexcept = default;

        /**
         * @brief Adds a new sample to the filter.
         *
         * This updates the running sums and the internal circular buffer.
         * The new variance value is calculated and returned.
         *
         * @param newValue The new sample value to add.
         * @return T The new moving variance.
         */
        T addSample(T newValue);

        /**
         * @brief Gets the current moving variance.
         * @return T The variance of the samples currently in the buffer.
         */
        T getVariance() const;

        /**
         * @brief Clears all samples from the filter and resets the sums.
         */
        void clear();

        /**
         * @brief Checks if the filter's buffer is full (i.e., has N samples).
         * @return true if the buffer is full, false otherwise.
         */
        bool isFull() const noexcept;

        /**
         * @brief Exports the filter's internal state.
         * @return A pair containing:
         * 1. The buffer contents (std::vector<T>)
         * 2. A pair of sums (running_sum, running_sum_of_squares)
         */
        std::pair<std::vector<T>, std::pair<T, T>> getState() const;

        /**
         * @brief Restores the filter's internal state.
         * @param bufferData The buffer contents to restore.
         * @param sum The running sum to restore.
         * @param sumOfSquares The running sum of squares to restore.
         */
        void setState(const std::vector<T> &bufferData, T sum, T sumOfSquares);

    private:
        dsp::utils::CircularBufferArray<T> buffer;
        T running_sum;
        T running_sum_of_squares;
        size_t window_size;
    };
} // namespace dsp::core