#include "MovingAverageFilter.h"

using namespace dsp::core;

// -----------------------------------------------------------------------------
// Constructor
// -----------------------------------------------------------------------------
template <typename T>
MovingAverageFilter<T>::MovingAverageFilter(size_t window_size)
    : buffer(window_size), // Initialize the circular buffer
      running_sum(0),
      window_size(window_size > 0 ? window_size : 1) // Ensure window_size is at least 1
{
    // buffer(window_size) will internally call new T[window_size],
    // assuming CircularBufferArray handles a size of 0 or 1 correctly.
    // Your implementation seems to handle size=0 by defaulting to 1, which is good.
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

// Explicit template instantiation for common types
template class MovingAverageFilter<int>;
template class MovingAverageFilter<float>;
template class MovingAverageFilter<double>;
