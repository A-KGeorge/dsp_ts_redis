#include "CircularBufferArray.h"
#include <algorithm>
#include <stdexcept>
#include <memory>

using namespace dsp::utils;

// -----------------------------------------------------------------------------
// Constructor
// Initializes the circular buffer with a specified size using std::make_unique
// @ param size - The size of the circular buffer
// @ return void
// -----------------------------------------------------------------------------
template <typename T>
CircularBufferArray<T>::CircularBufferArray(size_t size)
    : buffer(std::make_unique<T[]>(std::max(size, static_cast<size_t>(1)))),
      head(0),
      tail(0),
      capacity(std::max(size, static_cast<size_t>(1))),
      count(0)
{
    // Buffer is automatically initialized by make_unique
}

// Note: Move constructor and move assignment operator are now defaulted in the header
// std::unique_ptr handles move semantics correctly by default

// -----------------------------------------------------------------------------
// Method: push
// Adds an item to the circular buffer
// @ param item - The item to add
// @ return bool - True if the item was added, false if the buffer is full
// -----------------------------------------------------------------------------
template <typename T>
bool CircularBufferArray<T>::push(const T &item)
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
// -----------------------------------------------------------------------------
template <typename T>
bool CircularBufferArray<T>::pop(T &item) noexcept
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
// -----------------------------------------------------------------------------
template <typename T>
void CircularBufferArray<T>::clear() noexcept
{
    this->head = 0;
    this->tail = 0;
    this->count = 0;
}

// -----------------------------------------------------------------------------
// Method: pushOverwrite
// Adds an item to the circular buffer, overwriting the oldest item if full
// @ param item - The item to add
// @ return bool - Always returns true
template <typename T>
void CircularBufferArray<T>::pushOverwrite(const T &item)
{
    if (isFull())
        this->tail = (this->tail + 1) % this->capacity;
    this->buffer[this->head] = item;
    this->head = (this->head + 1) % this->capacity;
    if (this->count < this->capacity)
        ++this->count;
}

// -----------------------------------------------------------------------------
// Getter: getCapacity
// @ param void
// @ return size_t - The capacity of the circular buffer
// -----------------------------------------------------------------------------
template <typename T>
size_t CircularBufferArray<T>::getCapacity() const noexcept
{
    return this->capacity;
}

// -----------------------------------------------------------------------------
// Getter: getCount
// @ param void
// @ return size_t - The number of elements in the circular buffer
// -----------------------------------------------------------------------------
template <typename T>
size_t CircularBufferArray<T>::getCount() const noexcept
{
    return this->count;
}

// -----------------------------------------------------------------------------
// Getter: isEmpty
// @ param void
// @ return bool - True if the buffer is empty, false otherwise
// -----------------------------------------------------------------------------
template <typename T>
bool CircularBufferArray<T>::isEmpty() const noexcept
{
    return this->count == 0;
}

// -----------------------------------------------------------------------------
// Getter: isFull
// @ param void
// @ return bool - True if the buffer is full, false otherwise
// -----------------------------------------------------------------------------
template <typename T>
bool CircularBufferArray<T>::isFull() const noexcept
{
    return this->count == this->capacity;
}

// -----------------------------------------------------------------------------
// Method: peek
// Returns the item at the head of the circular buffer without removing it
// @ param void
// @ return T - The item at the head of the buffer
template <typename T>
T CircularBufferArray<T>::peek() const
{
    if (isEmpty())
    {
        throw std::runtime_error("Buffer is empty");
    }

    return this->buffer[this->tail];
}

// -----------------------------------------------------------------------------
// Method: toVector
// Exports the buffer contents in order (oldest to newest) as a vector
// @ return std::vector<T> - The buffer contents in order
// -----------------------------------------------------------------------------
template <typename T>
std::vector<T> CircularBufferArray<T>::toVector() const
{
    std::vector<T> result;
    result.reserve(this->count);

    for (size_t i = 0; i < this->count; ++i)
    {
        size_t index = (this->tail + i) % this->capacity;
        result.push_back(this->buffer[index]);
    }

    return result;
}

// -----------------------------------------------------------------------------
// Method: fromVector
// Imports buffer contents from a vector, maintaining order
// @ param data - The vector containing the data to import
// -----------------------------------------------------------------------------
template <typename T>
void CircularBufferArray<T>::fromVector(const std::vector<T> &data)
{
    clear();

    for (const auto &item : data)
    {
        pushOverwrite(item);
    }
}

// Note: Destructor is now defaulted in the header
// std::unique_ptr automatically cleans up the buffer

// Explicit template instantiation for common types
namespace dsp::utils
{
    template class CircularBufferArray<int>;
    template class CircularBufferArray<float>;
    template class CircularBufferArray<double>;
    template class CircularBufferArray<bool>;
}
