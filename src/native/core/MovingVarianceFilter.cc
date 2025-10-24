#include "MovingVarianceFilter.h"

using namespace dsp::core;

// -----------------------------------------------------------------------------
// Constructor
// -----------------------------------------------------------------------------
template <typename T>
MovingVarianceFilter<T>::MovingVarianceFilter(size_t window_size)
    : buffer(window_size), // Initialize the circular buffer
      running_sum(0),
      running_sum_of_squares(0),
      window_size(window_size)
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
T MovingVarianceFilter<T>::addSample(T newValue)
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

    // Return the new variance
    return getVariance();
}

// -----------------------------------------------------------------------------
// Method: getVariance
// -----------------------------------------------------------------------------
template <typename T>
T MovingVarianceFilter<T>::getVariance() const
{
    size_t count = buffer.getCount();
    if (count == 0)
    {
        return 0; // Avoid division by zero
    }

    T countT = static_cast<T>(count);

    // Calculate mean
    T mean = running_sum / countT;

    // Calculate mean of squares
    T mean_of_squares = running_sum_of_squares / countT;

    // Variance = E[X^2] - (E[X])^2
    // Use std::max to prevent negative values from floating point inaccuracies
    T variance = std::max(static_cast<T>(0), mean_of_squares - (mean * mean));

    return variance;
}

// -----------------------------------------------------------------------------
// Method: clear
// -----------------------------------------------------------------------------
template <typename T>
void MovingVarianceFilter<T>::clear()
{
    buffer.clear();
    running_sum = 0;
    running_sum_of_squares = 0;
}

// -----------------------------------------------------------------------------
// Method: isFull
// -----------------------------------------------------------------------------
template <typename T>
bool MovingVarianceFilter<T>::isFull() const noexcept
{
    return buffer.isFull();
}

// -----------------------------------------------------------------------------
// Method: getState
// -----------------------------------------------------------------------------
template <typename T>
std::pair<std::vector<T>, std::pair<T, T>> MovingVarianceFilter<T>::getState() const
{
    return {buffer.toVector(), {running_sum, running_sum_of_squares}};
}

// -----------------------------------------------------------------------------
// Method: setState
// -----------------------------------------------------------------------------
template <typename T>
void MovingVarianceFilter<T>::setState(const std::vector<T> &bufferData, T sum, T sumOfSquares)
{
    buffer.fromVector(bufferData);
    running_sum = sum;
    running_sum_of_squares = sumOfSquares;
}

// Explicit template instantiation for common types
namespace dsp::core
{
    template class MovingVarianceFilter<int>;
    template class MovingVarianceFilter<float>;
    template class MovingVarianceFilter<double>;
}