#pragma once
#include <deque>
#include <utility>
#include <vector>
#include <cstdint>
#include <stdexcept>

namespace dsp::utils
{
    /**
     * @brief A time-series buffer that stores timestamped samples.
     *
     * This buffer replaces CircularBuffer for time-aware processing.
     * It stores pairs of (timestamp, value) and supports both:
     * - Sample-based windows (fixed number of samples)
     * - Time-based windows (fixed duration in milliseconds)
     *
     * Uses std::deque for efficient front/back operations.
     *
     * @tparam T The numeric type (e.g., float, double).
     */
    template <typename T>
    class TimeSeriesBuffer
    {
    public:
        using TimestampType = uint64_t;
        using Sample = std::pair<TimestampType, T>;

        /**
         * @brief Constructs a time-series buffer.
         * @param max_samples Maximum number of samples (for sample-based mode, 0 = unlimited)
         * @param window_duration_ms Maximum time window in milliseconds (for time-based mode, 0 = disabled)
         */
        explicit TimeSeriesBuffer(size_t max_samples = 0, uint64_t window_duration_ms = 0);

        /**
         * @brief Adds a new timestamped sample.
         *
         * Automatically removes old samples based on window constraints:
         * - If max_samples > 0: removes oldest samples beyond the limit
         * - If window_duration_ms > 0: removes samples older than (newest_timestamp - window_duration_ms)
         *
         * @param timestamp The timestamp in milliseconds (or sample index)
         * @param value The sample value
         */
        void push(TimestampType timestamp, T value);

        /**
         * @brief Removes samples older than the specified timestamp.
         * @param cutoff_timestamp Samples with timestamp < cutoff_timestamp will be removed
         * @return size_t Number of samples removed
         */
        size_t removeOlderThan(TimestampType cutoff_timestamp);

        /**
         * @brief Gets the oldest sample without removing it.
         * @return const Sample& Reference to the oldest (front) sample
         * @throws std::out_of_range if buffer is empty
         */
        const Sample &front() const;

        /**
         * @brief Gets the newest sample without removing it.
         * @return const Sample& Reference to the newest (back) sample
         * @throws std::out_of_range if buffer is empty
         */
        const Sample &back() const;

        /**
         * @brief Removes the oldest sample.
         * @throws std::out_of_range if buffer is empty
         */
        void popFront();

        /**
         * @brief Gets the current number of samples in the buffer.
         * @return size_t The number of samples
         */
        size_t size() const noexcept;

        /**
         * @brief Checks if the buffer is empty.
         * @return bool True if empty
         */
        bool empty() const noexcept;

        /**
         * @brief Clears all samples from the buffer.
         */
        void clear() noexcept;

        /**
         * @brief Exports all samples as a vector.
         * @return std::vector<Sample> All timestamp-value pairs
         */
        std::vector<Sample> toVector() const;

        /**
         * @brief Restores buffer from a vector of samples.
         * @param samples Vector of timestamp-value pairs to restore
         */
        void fromVector(const std::vector<Sample> &samples);

        /**
         * @brief Gets the time span of the buffer (newest - oldest timestamp).
         * @return uint64_t Time span in milliseconds (0 if empty or single sample)
         */
        uint64_t getTimeSpan() const noexcept;

        /**
         * @brief Provides iterator access to samples (const).
         */
        typename std::deque<Sample>::const_iterator begin() const noexcept;
        typename std::deque<Sample>::const_iterator end() const noexcept;

        /**
         * @brief Gets the maximum sample count constraint.
         * @return size_t Maximum samples (0 = unlimited)
         */
        size_t getMaxSamples() const noexcept;

        /**
         * @brief Gets the time window duration constraint.
         * @return uint64_t Window duration in milliseconds (0 = disabled)
         */
        uint64_t getWindowDuration() const noexcept;

    private:
        std::deque<Sample> m_samples;
        size_t m_max_samples;
        uint64_t m_window_duration_ms;

        /**
         * @brief Enforces window constraints by removing old samples.
         * Called automatically after push().
         */
        void enforceWindowConstraints();
    };

} // namespace dsp::utils
