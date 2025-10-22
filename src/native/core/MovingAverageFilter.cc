#include "MovingAverageFilter.h"
#include <stdexcept>

using namespace dsp::core;

// -----------------------------------------------------------------------------
// Constructor
// -----------------------------------------------------------------------------
template <typename T>
MovingAverageFilter<T>::MovingAverageFilter(size_t window_size)
    : buffer(window_size), // Initialize the circular buffer
      running_sum(0),
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
T MovingAverageFilter<T>::addSample(T newValue)
{
    T oldestValue = 0;

    // If the buffer is full, we need to subtract the oldest value
    // that is about to be overwritten.
    if (buffer.isFull())
    {
        // peek() returns the item at the tail, which is the oldest.
        oldestValue = buffer.peek();
    }

    // Add the new value to the buffer, overwriting the oldest if full.
    buffer.pushOverwrite(newValue);

    // Update the running sum.
    running_sum = running_sum - oldestValue + newValue;

    // Return the new average.
    return getAverage();
}

// -----------------------------------------------------------------------------
// Method: getAverage
// -----------------------------------------------------------------------------
template <typename T>
T MovingAverageFilter<T>::getAverage() const
{
    size_t count = buffer.getCount();
    if (count == 0)
    {
        return 0; // Avoid division by zero
    }

    // Note: This will perform integer division if T is an integer type.
    // For DSP, T is often float or double.
    return running_sum / static_cast<T>(count);
}

// -----------------------------------------------------------------------------
// Method: clear
// -----------------------------------------------------------------------------
template <typename T>
void MovingAverageFilter<T>::clear()
{
    buffer.clear();
    running_sum = 0;
}

// -----------------------------------------------------------------------------
// Method: isFull
// -----------------------------------------------------------------------------
template <typename T>
bool MovingAverageFilter<T>::isFull() const noexcept
{
    return buffer.isFull();
}

// -----------------------------------------------------------------------------
// Method: getState
// Exports the filter's internal state for serialization
// -----------------------------------------------------------------------------
template <typename T>
std::pair<std::vector<T>, T> MovingAverageFilter<T>::getState() const
{
    return {buffer.toVector(), running_sum};
}

// -----------------------------------------------------------------------------
// Method: setState
// Restores the filter's internal state from serialized data
// -----------------------------------------------------------------------------
template <typename T>
void MovingAverageFilter<T>::setState(const std::vector<T> &bufferData, T sum)
{
    buffer.fromVector(bufferData);
    running_sum = sum;
}

// Explicit template instantiation for common types
template class dsp::core::MovingAverageFilter<int>;
template class dsp::core::MovingAverageFilter<float>;
template class dsp::core::MovingAverageFilter<double>;
