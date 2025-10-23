#include "MovingZScoreFilter.h"

using namespace dsp::core;

// -----------------------------------------------------------------------------
// Constructor
// -----------------------------------------------------------------------------
template <typename T>
MovingZScoreFilter<T>::MovingZScoreFilter(size_t window_size, T epsilon)
    : buffer(window_size), // Initialize the circular buffer
      running_sum(0),
      running_sum_of_squares(0),
      window_size(window_size),
      m_epsilon(epsilon)
{
    if (window_size == 0)
    {
        throw std::invalid_argument("Window size must be greater than 0");
    }
}

// -----------------------------------------------------------------------------
// Method: addSample
// -----------------------------------------------------------------------------
template <typename T>
T MovingZScoreFilter<T>::addSample(T newValue)
{
    T oldestValue = 0;

    // If the buffer is full, get the oldest value
    if (buffer.isFull())
    {
        oldestValue = buffer.peek();
    }

    // Add the new value to the buffer
    buffer.pushOverwrite(newValue);

    // Update running sums
    T oldestValueSquared = oldestValue * oldestValue;
    T newValueSquared = newValue * newValue;

    running_sum = running_sum - oldestValue + newValue;
    running_sum_of_squares = running_sum_of_squares - oldestValueSquared + newValueSquared;

    // --- Calculate new stats ---
    size_t count = buffer.getCount();
    T countT = static_cast<T>(count);

    // Calculate mean
    T mean = running_sum / countT;

    // Calculate mean of squares
    T mean_of_squares = running_sum_of_squares / countT;

    // Variance = E[X^2] - (E[X])^2
    T variance = std::max(static_cast<T>(0), mean_of_squares - (mean * mean));

    // Standard Deviation
    T stddev = std::sqrt(variance);

    // --- Calculate Z-Score ---
    // Use epsilon to prevent division by zero
    if (stddev < m_epsilon)
    {
        return 0; // If stddev is ~0, all values are the mean, so z-score is 0
    }
    else
    {
        return (newValue - mean) / stddev;
    }
}

// -----------------------------------------------------------------------------
// Method: clear
// -----------------------------------------------------------------------------
template <typename T>
void MovingZScoreFilter<T>::clear()
{
    buffer.clear();
    running_sum = 0;
    running_sum_of_squares = 0;
}

// -----------------------------------------------------------------------------
// Method: isFull
// -----------------------------------------------------------------------------
template <typename T>
bool MovingZScoreFilter<T>::isFull() const noexcept
{
    return buffer.isFull();
}

// -----------------------------------------------------------------------------
// Method: getState
// -----------------------------------------------------------------------------
template <typename T>
std::pair<std::vector<T>, std::pair<T, T>> MovingZScoreFilter<T>::getState() const
{
    return {buffer.toVector(), {running_sum, running_sum_of_squares}};
}

// -----------------------------------------------------------------------------
// Method: setState
// -----------------------------------------------------------------------------
template <typename T>
void MovingZScoreFilter<T>::setState(const std::vector<T> &bufferData, T sum, T sumOfSquares)
{
    buffer.fromVector(bufferData);
    running_sum = sum;
    running_sum_of_squares = sumOfSquares;
}

// Explicit template instantiation for common types
namespace dsp::core
{
    template class MovingZScoreFilter<float>;
    template class MovingZScoreFilter<double>;
}