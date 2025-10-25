#pragma once

#include "../utils/CircularBufferArray.h"
#include <utility>
#include <vector>
#include <cmath>
#include <stdexcept>
#include <algorithm> // for std::max

namespace dsp::core
{
    /**
     * @brief Implements an efficient Moving Z-Score normalization filter.
     *
     * This class uses a circular buffer to store the last 'N' samples
     * and maintains a running sum AND a running sum-of-squares
     * for O(1) mean and standard deviation calculation.
     *
     * Z-Score = (Value - Mean) / StandardDeviation
     *
     * @tparam T The numeric type of the samples (e.g., float, double).
     */
    template <typename T>
    class MovingZScoreFilter
    {
    public:
        /**
         * @brief Constructs a new Moving Z-Score Filter.
         * @param window_size The number of samples to average over (N).
         * @param epsilon A small value to prevent division by zero (default 1e-6).
         */
        explicit MovingZScoreFilter(size_t window_size, T epsilon = 1e-6);

        /**
         * @brief Constructs a new time-aware Moving Z-Score Filter.
         * @param window_size The buffer capacity in samples.
         * @param window_duration_ms The time window duration in milliseconds.
         * @param epsilon A small value to prevent division by zero (default 1e-6).
         */
        explicit MovingZScoreFilter(size_t window_size, double window_duration_ms, T epsilon = 1e-6);

        // Delete copy constructor and copy assignment
        MovingZScoreFilter(const MovingZScoreFilter &) = delete;
        MovingZScoreFilter &operator=(const MovingZScoreFilter &) = delete;

        // Enable move semantics
        MovingZScoreFilter(MovingZScoreFilter &&) noexcept = default;
        MovingZScoreFilter &operator=(MovingZScoreFilter &&) noexcept = default;

        /**
         * @brief Adds a new sample to the filter and returns its Z-Score.
         *
         * This updates the running sums and the internal circular buffer.
         * The Z-Score of the new sample is calculated based on the
         * *new* window statistics (including the sample just added).
         *
         * @param newValue The new sample value to add.
         * @return T The Z-Score of the new sample.
         */
        T addSample(T newValue);

        /**
         * @brief Adds a new sample with timestamp and returns its Z-Score.
         *
         * Expires old samples, rebuilds statistics, then adds new sample.
         *
         * @param newValue The new sample value to add.
         * @param timestamp The timestamp in milliseconds.
         * @return T The Z-Score of the new sample.
         */
        T addSampleWithTimestamp(T newValue, double timestamp);

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
         * @brief Checks if the filter is in time-aware mode.
         * @return true if time-aware, false otherwise.
         */
        bool isTimeAware() const noexcept;

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
        T m_epsilon;
    };
} // namespace dsp::core