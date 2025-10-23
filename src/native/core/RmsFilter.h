#pragma once
#include "../utils/CircularBufferArray.h"
#include <utility>
#include <vector>
#include <cmath>
#include <algorithm> // for std::max

namespace dsp::core
{
    /**
     * @brief Implements an efficient Root Mean Square (RMS) filter.
     *
     * This class uses a circular buffer to store the last 'N' samples
     * and maintains a running sum of the squares of these samples
     * for O(1) RMS calculation.
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
        explicit RmsFilter(size_t window_size);

        // Delete copy constructor and copy assignment
        RmsFilter(const RmsFilter &) = delete;
        RmsFilter &operator=(const RmsFilter &) = delete;

        // Enable move semantics
        RmsFilter(RmsFilter &&) noexcept = default;
        RmsFilter &operator=(RmsFilter &&) noexcept = default;

        /**
         * @brief Adds a new sample to the filter.
         *
         * This updates the running sum of squares and the internal circular buffer.
         * The new RMS value is calculated and returned.
         *
         * @param newValue The new sample value to add.
         * @return T The new RMS value.
         */
        T addSample(T newValue);

        /**
         * @brief Gets the current RMS value.
         * @return T The RMS of the samples currently in the buffer.
         */
        T getRms() const;

        /**
         * @brief Clears all samples from the filter and resets the sum.
         */
        void clear();

        /**
         * @brief Checks if the filter's buffer is full (i.e., has N samples).
         * @return true if the buffer is full, false otherwise.
         */
        bool isFull() const noexcept;

        /**
         * @brief Exports the filter's internal state.
         * @return A pair containing the buffer contents and running sum of squares.
         */
        std::pair<std::vector<T>, T> getState() const;

        /**
         * @brief Restores the filter's internal state.
         * @param bufferData The buffer contents to restore.
         * @param sumOfSquares The running sum of squares to restore.
         */
        void setState(const std::vector<T> &bufferData, T sumOfSquares);

    private:
        dsp::utils::CircularBufferArray<T> buffer;
        T running_sum_of_squares;
        size_t window_size;
    };
}