#include "CircularBufferVector.h"
#include <algorithm>
#include <stdexcept>

using namespace dsp::utils;

// -----------------------------------------------------------------------------
// Constructor
// Initializes the circular buffer with a specified size
// @ param size - The size of the circular buffer
// @ return void
template <typename T>
CircularBufferVector<T>::CircularBufferVector(size_t size)
    : head(0), tail(0), capacity(std::max(size, static_cast<size_t>(1))), count(0)
{
    this->buffer.resize(this->capacity);
}

// -----------------------------------------------------------------------------
// Method: push
// Adds an item to the circular buffer
// @ param item - The item to add
// @ return bool - True if the item was added, false if the buffer is full
template <typename T>
bool CircularBufferVector<T>::push(const T &item)
{
    if (isFull())
    {
        return false; // Buffer is full
    }

    this->buffer[this->head] = item;
    this->head = (this->head + 1) % this->capacity;
    this->count++;
    return true;
}

// -----------------------------------------------------------------------------
// Method: pop
// Removes an item from the circular buffer
// @ param item - The item to remove
// @ return bool - True if the item was removed, false if the buffer is empty
template <typename T>
bool CircularBufferVector<T>::pop(T &item) noexcept
{
    if (isEmpty())
    {
        return false; // Buffer is empty
    }

    item = this->buffer[this->tail];
    this->tail = (this->tail + 1) % this->capacity;
    this->count--;
    return true;
}

// -----------------------------------------------------------------------------
// Method: clear
// Clears the circular buffer
// @ param void
// @ return void
template <typename T>
void CircularBufferVector<T>::clear() noexcept
{
    this->head = 0;
    this->tail = 0;
    this->count = 0;
}

// -----------------------------------------------------------------------------
// Method: pushOverwrite
// Adds an item to the circular buffer, overwriting the oldest item if full
// @ param item - The item to add
// @ return void
template <typename T>
void CircularBufferVector<T>::pushOverwrite(const T &item)
{
    this->buffer[this->head] = item;
    this->head = (this->head + 1) % this->capacity;

    this->count < this->capacity ? ++this->count : this->tail = (this->tail + 1) % this->capacity;
}

// -----------------------------------------------------------------------------
// Getter: getCapacity
// @ param void
// @ return size_t - The capacity of the circular buffer
template <typename T>
size_t CircularBufferVector<T>::getCapacity() const noexcept
{
    return this->capacity;
}

// -----------------------------------------------------------------------------
// Getter: getCount
// @ param void
// @ return size_t - The number of elements in the circular buffer
template <typename T>
size_t CircularBufferVector<T>::getCount() const noexcept
{
    return this->count;
}

// -----------------------------------------------------------------------------
// Getter: isEmpty
// @ param void
// @ return bool - True if the buffer is empty, false otherwise
template <typename T>
bool CircularBufferVector<T>::isEmpty() const noexcept
{
    return this->count == 0;
}

// -----------------------------------------------------------------------------
// Getter: isFull
// @ param void
// @ return bool - True if the buffer is full, false otherwise
template <typename T>
bool CircularBufferVector<T>::isFull() const noexcept
{
    return this->count == this->capacity;
}

// -----------------------------------------------------------------------------
// Getter: peek
// @ param void
// @ return T - The item at the head of the buffer
template <typename T>
T CircularBufferVector<T>::peek() const
{
    if (isEmpty())
    {
        throw std::runtime_error("Buffer is empty");
    }

    return this->buffer[this->tail];
}

// Explicit template instantiation for common types
namespace dsp::utils
{
    template class CircularBufferVector<int>;
    template class CircularBufferVector<float>;
    template class CircularBufferVector<double>;
}
