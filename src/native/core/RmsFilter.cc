#include "RmsFilter.h"
#include <cmath>
#include <algorithm> // for std::max

using namespace dsp::core;

// -----------------------------------------------------------------------------
// Constructor
// -----------------------------------------------------------------------------
template <typename T>
RmsFilter<T>::RmsFilter(size_t window_size)
    : buffer(window_size), // Initialize the circular buffer
      running_sum_of_squares(0),
      window_size(window_size > 0 ? window_size : 1) // Ensure window_size is at least 1
{
}

// -----------------------------------------------------------------------------
// Method: addSample
// -----------------------------------------------------------------------------
template <typename T>
T RmsFilter<T>::addSample(T newValue)
{
    T oldestValue = 0;

    // If the buffer is full, get the oldest value
    if (buffer.isFull())
    {
        oldestValue = buffer.peek();
    }

    // Add the new value to the buffer
    buffer.pushOverwrite(newValue);

    // Update the running sum of squares
    T oldestValueSquared = oldestValue * oldestValue;
    T newValueSquared = newValue * newValue;

    running_sum_of_squares = running_sum_of_squares - oldestValueSquared + newValueSquared;

    // Return the new RMS
    return getRms();
}

// -----------------------------------------------------------------------------
// Method: getRms
// -----------------------------------------------------------------------------
template <typename T>
T RmsFilter<T>::getRms() const
{
    size_t count = buffer.getCount();
    if (count == 0)
    {
        return 0; // Avoid division by zero
    }

    // Calculate mean of squares
    // Use std::max to prevent negative values from floating point inaccuracies
    T mean_of_squares = std::max(static_cast<T>(0), running_sum_of_squares / static_cast<T>(count));

    // Return the square root of the mean of squares
    return std::sqrt(mean_of_squares);
}

// -----------------------------------------------------------------------------
// Method: clear
// -----------------------------------------------------------------------------
template <typename T>
void RmsFilter<T>::clear()
{
    buffer.clear();
    running_sum_of_squares = 0;
}

// -----------------------------------------------------------------------------
// Method: isFull
// -----------------------------------------------------------------------------
template <typename T>
bool RmsFilter<T>::isFull() const noexcept
{
    return buffer.isFull();
}

// -----------------------------------------------------------------------------
// Method: getState
// -----------------------------------------------------------------------------
template <typename T>
std::pair<std::vector<T>, T> RmsFilter<T>::getState() const
{
    return {buffer.toVector(), running_sum_of_squares};
}

// -----------------------------------------------------------------------------
// Method: setState
// -----------------------------------------------------------------------------
template <typename T>
void RmsFilter<T>::setState(const std::vector<T> &bufferData, T sumOfSquares)
{
    buffer.fromVector(bufferData);
    running_sum_of_squares = sumOfSquares;
}

// Explicit template instantiation for common types
// Note: RMS on integers is less common, but included for consistency if needed.
template class dsp::core::RmsFilter<int>;
template class dsp::core::RmsFilter<float>;
template class dsp::core::RmsFilter<double>;