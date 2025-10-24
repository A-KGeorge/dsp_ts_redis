#include "TimeSeriesBuffer.h"

namespace dsp::utils
{
    // -----------------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------------
    template <typename T>
    TimeSeriesBuffer<T>::TimeSeriesBuffer(size_t max_samples, uint64_t window_duration_ms)
        : m_max_samples(max_samples), m_window_duration_ms(window_duration_ms)
    {
    }

    // -----------------------------------------------------------------------------
    // push - Adds a new timestamped sample
    // Automatically enforces window constraints after insertion
    // -----------------------------------------------------------------------------
    template <typename T>
    void TimeSeriesBuffer<T>::push(TimestampType timestamp, T value)
    {
        m_samples.emplace_back(timestamp, value);
        enforceWindowConstraints();
    }

    // -----------------------------------------------------------------------------
    // removeOlderThan - Removes samples older than cutoff timestamp
    // -----------------------------------------------------------------------------
    template <typename T>
    size_t TimeSeriesBuffer<T>::removeOlderThan(TimestampType cutoff_timestamp)
    {
        size_t removed = 0;
        while (!m_samples.empty() && m_samples.front().first < cutoff_timestamp)
        {
            m_samples.pop_front();
            ++removed;
        }
        return removed;
    }

    // -----------------------------------------------------------------------------
    // front - Gets the oldest sample (does not remove)
    // -----------------------------------------------------------------------------
    template <typename T>
    const typename TimeSeriesBuffer<T>::Sample &TimeSeriesBuffer<T>::front() const
    {
        if (m_samples.empty())
        {
            throw std::out_of_range("TimeSeriesBuffer::front() called on empty buffer");
        }
        return m_samples.front();
    }

    // -----------------------------------------------------------------------------
    // back - Gets the newest sample (does not remove)
    // -----------------------------------------------------------------------------
    template <typename T>
    const typename TimeSeriesBuffer<T>::Sample &TimeSeriesBuffer<T>::back() const
    {
        if (m_samples.empty())
        {
            throw std::out_of_range("TimeSeriesBuffer::back() called on empty buffer");
        }
        return m_samples.back();
    }

    // -----------------------------------------------------------------------------
    // popFront - Removes the oldest sample
    // -----------------------------------------------------------------------------
    template <typename T>
    void TimeSeriesBuffer<T>::popFront()
    {
        if (m_samples.empty())
        {
            throw std::out_of_range("TimeSeriesBuffer::popFront() called on empty buffer");
        }
        m_samples.pop_front();
    }

    // -----------------------------------------------------------------------------
    // size - Returns the current number of samples
    // -----------------------------------------------------------------------------
    template <typename T>
    size_t TimeSeriesBuffer<T>::size() const noexcept
    {
        return m_samples.size();
    }

    // -----------------------------------------------------------------------------
    // empty - Checks if buffer is empty
    // -----------------------------------------------------------------------------
    template <typename T>
    bool TimeSeriesBuffer<T>::empty() const noexcept
    {
        return m_samples.empty();
    }

    // -----------------------------------------------------------------------------
    // clear - Removes all samples
    // -----------------------------------------------------------------------------
    template <typename T>
    void TimeSeriesBuffer<T>::clear() noexcept
    {
        m_samples.clear();
    }

    // -----------------------------------------------------------------------------
    // toVector - Exports all samples as a vector
    // -----------------------------------------------------------------------------
    template <typename T>
    std::vector<typename TimeSeriesBuffer<T>::Sample> TimeSeriesBuffer<T>::toVector() const
    {
        return std::vector<Sample>(m_samples.begin(), m_samples.end());
    }

    // -----------------------------------------------------------------------------
    // fromVector - Restores buffer from vector
    // -----------------------------------------------------------------------------
    template <typename T>
    void TimeSeriesBuffer<T>::fromVector(const std::vector<Sample> &samples)
    {
        m_samples.clear();
        for (const auto &sample : samples)
        {
            m_samples.push_back(sample);
        }
    }

    // -----------------------------------------------------------------------------
    // getTimeSpan - Returns time difference between newest and oldest sample
    // -----------------------------------------------------------------------------
    template <typename T>
    uint64_t TimeSeriesBuffer<T>::getTimeSpan() const noexcept
    {
        if (m_samples.size() < 2)
        {
            return 0;
        }
        return m_samples.back().first - m_samples.front().first;
    }

    // -----------------------------------------------------------------------------
    // begin/end - Iterator access
    // -----------------------------------------------------------------------------
    template <typename T>
    typename std::deque<typename TimeSeriesBuffer<T>::Sample>::const_iterator
    TimeSeriesBuffer<T>::begin() const noexcept
    {
        return m_samples.begin();
    }

    template <typename T>
    typename std::deque<typename TimeSeriesBuffer<T>::Sample>::const_iterator
    TimeSeriesBuffer<T>::end() const noexcept
    {
        return m_samples.end();
    }

    // -----------------------------------------------------------------------------
    // getMaxSamples - Returns the max sample count constraint
    // -----------------------------------------------------------------------------
    template <typename T>
    size_t TimeSeriesBuffer<T>::getMaxSamples() const noexcept
    {
        return m_max_samples;
    }

    // -----------------------------------------------------------------------------
    // getWindowDuration - Returns the time window constraint
    // -----------------------------------------------------------------------------
    template <typename T>
    uint64_t TimeSeriesBuffer<T>::getWindowDuration() const noexcept
    {
        return m_window_duration_ms;
    }

    // -----------------------------------------------------------------------------
    // enforceWindowConstraints - Private helper to maintain window limits
    // Called automatically after each push()
    // -----------------------------------------------------------------------------
    template <typename T>
    void TimeSeriesBuffer<T>::enforceWindowConstraints()
    {
        // Enforce time-based window (if enabled)
        if (m_window_duration_ms > 0 && m_samples.size() > 1)
        {
            TimestampType newest_timestamp = m_samples.back().first;
            TimestampType cutoff = newest_timestamp - m_window_duration_ms;
            removeOlderThan(cutoff);
        }

        // Enforce sample-count window (if enabled)
        while (m_max_samples > 0 && m_samples.size() > m_max_samples)
        {
            m_samples.pop_front();
        }
    }

    // -----------------------------------------------------------------------------
    // Explicit template instantiations
    // -----------------------------------------------------------------------------
    template class TimeSeriesBuffer<int>;
    template class TimeSeriesBuffer<float>;
    template class TimeSeriesBuffer<double>;

} // namespace dsp::utils
