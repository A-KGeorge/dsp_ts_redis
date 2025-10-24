#include "CircularBufferArray.h"
#include <algorithm>
#include <stdexcept>

using namespace dsp::utils;

// -----------------------------------------------------------------------------
// Constructor
// Initializes the circular buffer with a specified size
// @ param size - The size of the circular buffer
// @ return void
// -----------------------------------------------------------------------------
template <typename T>
CircularBufferArray<T>::CircularBufferArray(size_t size)
    : head(0), tail(0), capacity(std::max(size, static_cast<size_t>(1))), count(0)
{
    this->buffer = new T[this->capacity]();
}

// -----------------------------------------------------------------------------
// Move Constructor
// Transfers ownership of resources from another CircularBufferArray
// @ param other - The CircularBufferArray to move from
// -----------------------------------------------------------------------------
template <typename T>
CircularBufferArray<T>::CircularBufferArray(CircularBufferArray &&other) noexcept
    : buffer(other.buffer),
      head(other.head),
      tail(other.tail),
      capacity(other.capacity),
      count(other.count)
{
    // Reset the other object to a valid but empty state
    other.buffer = nullptr;
    other.head = 0;
    other.tail = 0;
    other.capacity = 0;
    other.count = 0;
}

// -----------------------------------------------------------------------------
// Move Assignment Operator
// Transfers ownership of resources from another CircularBufferArray
// @ param other - The CircularBufferArray to move from
// @ return CircularBufferArray& - Reference to this object
// -----------------------------------------------------------------------------
template <typename T>
CircularBufferArray<T> &CircularBufferArray<T>::operator=(CircularBufferArray &&other) noexcept
{
    if (this != &other)
    {
        // Clean up existing resources
        delete[] buffer;

        // Transfer ownership
        buffer = other.buffer;
        head = other.head;
        tail = other.tail;
        capacity = other.capacity;
        count = other.count;

        // Reset the other object to a valid but empty state
        other.buffer = nullptr;
        other.head = 0;
        other.tail = 0;
        other.capacity = 0;
        other.count = 0;
    }
    return *this;
}

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

// -----------------------------------------------------------------------------
// Destructor
// Cleans up the circular buffer
template <typename T>
CircularBufferArray<T>::~CircularBufferArray()
{
    delete[] this->buffer;
}

// Explicit template instantiation for common types
namespace dsp::utils
{
    template class CircularBufferArray<int>;
    template class CircularBufferArray<float>;
    template class CircularBufferArray<double>;
    template class CircularBufferArray<bool>;
}
