#include "CircularBufferArray.h"
#include <algorithm>

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

// Prevent accidental copies
template <typename T>
CircularBufferArray<T>::CircularBufferArray(const CircularBufferArray &) = delete;
template <typename T>
CircularBufferArray<T> &CircularBufferArray<T>::operator=(const CircularBufferArray &) = delete;

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
bool CircularBufferArray<T>::pop(T &item)
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
void CircularBufferArray<T>::clear()
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
size_t CircularBufferArray<T>::getCapacity() const
{
    return this->capacity;
}

// -----------------------------------------------------------------------------
// Getter: getCount
// @ param void
// @ return size_t - The number of elements in the circular buffer
// -----------------------------------------------------------------------------
template <typename T>
size_t CircularBufferArray<T>::getCount() const
{
    return this->count;
}

// -----------------------------------------------------------------------------
// Getter: isEmpty
// @ param void
// @ return bool - True if the buffer is empty, false otherwise
// -----------------------------------------------------------------------------
template <typename T>
bool CircularBufferArray<T>::isEmpty() const
{
    return this->count == 0;
}

// -----------------------------------------------------------------------------
// Getter: isFull
// @ param void
// @ return bool - True if the buffer is full, false otherwise
// -----------------------------------------------------------------------------
template <typename T>
bool CircularBufferArray<T>::isFull() const
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
// Destructor
// Cleans up the circular buffer
template <typename T>
CircularBufferArray<T>::~CircularBufferArray()
{
    delete[] this->buffer;
}

// Explicit template instantiation for common types
// template class CircularBufferArray<int>;
// template class CircularBufferArray<float>;
// template class CircularBufferArray<double>;
