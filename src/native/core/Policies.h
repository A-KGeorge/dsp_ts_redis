#pragma once
#include <cmath>
#include <algorithm>

namespace dsp::core
{
    /**
     * @brief Policy for calculating a running mean (for Moving Average).
     *
     * Maintains a running sum and computes the mean on demand.
     */
    template <typename T>
    struct MeanPolicy
    {
        T m_sum = 0;

        void onAdd(T val) { m_sum += val; }
        void onRemove(T val) { m_sum -= val; }
        void clear() { m_sum = 0; }

        T getResult(size_t count) const
        {
            if (count == 0)
                return 0;
            return m_sum / static_cast<T>(count);
        }

        // For state serialization
        T getState() const { return m_sum; }
        void setState(T sum) { m_sum = sum; }
    };

    /**
     * @brief Policy for calculating RMS (Root Mean Square).
     *
     * Maintains a running sum of squares and computes RMS on demand.
     */
    template <typename T>
    struct RmsPolicy
    {
        T m_sum_sq = 0;

        void onAdd(T val) { m_sum_sq += (val * val); }
        void onRemove(T val) { m_sum_sq -= (val * val); }
        void clear() { m_sum_sq = 0; }

        T getResult(size_t count) const
        {
            if (count == 0)
                return 0;
            // Clamp to avoid negative values due to floating-point errors
            T mean_sq = std::max(static_cast<T>(0), m_sum_sq / static_cast<T>(count));
            return std::sqrt(mean_sq);
        }

        // For state serialization
        T getState() const { return m_sum_sq; }
        void setState(T sumSq) { m_sum_sq = sumSq; }
    };

    /**
     * @brief Policy for calculating Mean Absolute Value (MAV).
     *
     * Maintains a running sum of absolute values.
     */
    template <typename T>
    struct MeanAbsoluteValuePolicy
    {
        T m_sum_abs = 0;

        void onAdd(T val) { m_sum_abs += std::abs(val); }
        void onRemove(T val) { m_sum_abs -= std::abs(val); }
        void clear() { m_sum_abs = 0; }

        T getResult(size_t count) const
        {
            if (count == 0)
                return 0;
            return m_sum_abs / static_cast<T>(count);
        }

        // For state serialization
        T getState() const { return m_sum_abs; }
        void setState(T sumAbs) { m_sum_abs = sumAbs; }
    };

    /**
     * @brief Policy for calculating Variance.
     *
     * Maintains both sum and sum of squares for variance calculation.
     * Uses the computational formula: Var(X) = E[X²] - (E[X])²
     */
    template <typename T>
    struct VariancePolicy
    {
        T m_sum = 0;
        T m_sum_sq = 0;

        void onAdd(T val)
        {
            m_sum += val;
            m_sum_sq += (val * val);
        }

        void onRemove(T val)
        {
            m_sum -= val;
            m_sum_sq -= (val * val);
        }

        void clear()
        {
            m_sum = 0;
            m_sum_sq = 0;
        }

        T getResult(size_t count) const
        {
            if (count == 0)
                return 0;

            T mean = m_sum / static_cast<T>(count);
            T mean_sq = m_sum_sq / static_cast<T>(count);

            // Clamp to avoid negative variance due to floating-point errors
            return std::max(static_cast<T>(0), mean_sq - (mean * mean));
        }

        // For state serialization - returns both values as a pair
        std::pair<T, T> getState() const { return {m_sum, m_sum_sq}; }
        void setState(T sum, T sumSq)
        {
            m_sum = sum;
            m_sum_sq = sumSq;
        }
    };

    /**
     * @brief Policy for calculating Z-Score normalization.
     *
     * Maintains sum and sum of squares to compute mean and stddev,
     * then normalizes values to Z-scores.
     */
    template <typename T>
    struct ZScorePolicy
    {
        T m_sum = 0;
        T m_sum_sq = 0;
        T m_epsilon;

        explicit ZScorePolicy(T epsilon = static_cast<T>(1e-8))
            : m_epsilon(epsilon) {}

        void onAdd(T val)
        {
            m_sum += val;
            m_sum_sq += (val * val);
        }

        void onRemove(T val)
        {
            m_sum -= val;
            m_sum_sq -= (val * val);
        }

        void clear()
        {
            m_sum = 0;
            m_sum_sq = 0;
        }

        // Z-Score needs the current value to normalize
        T getResult(T currentValue, size_t count) const
        {
            if (count == 0)
                return 0;

            T mean = m_sum / static_cast<T>(count);
            T mean_sq = m_sum_sq / static_cast<T>(count);
            T variance = std::max(static_cast<T>(0), mean_sq - (mean * mean));
            T stddev = std::sqrt(variance);

            // Avoid division by zero
            if (stddev < m_epsilon)
            {
                return 0;
            }

            return (currentValue - mean) / stddev;
        }

        // For state serialization
        std::pair<T, T> getState() const { return {m_sum, m_sum_sq}; }
        void setState(T sum, T sumSq)
        {
            m_sum = sum;
            m_sum_sq = sumSq;
        }

        T getEpsilon() const { return m_epsilon; }
    };

} // namespace dsp::core
