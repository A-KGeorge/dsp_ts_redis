#pragma once

// CircularBufferVector.h
#include <vector>

template <typename T>

class CircularBufferVector
{
public:
    // constructors
    explicit CircularBufferVector(size_t size);
    CircularBufferVector(const CircularBufferVector &other) = delete;            // disable copy to avoid shallow copy
    CircularBufferVector &operator=(const CircularBufferVector &other) = delete; // disable copy assignment to avoid shallow copy

    // methods
    bool push(const T &item);
    bool pop(T &item);
    void clear();
    void pushOverwrite(const T &item);

    // getters
    size_t getCapacity() const noexcept;
    size_t getCount() const noexcept;
    bool isEmpty() const noexcept;
    bool isFull() const noexcept;
    T peek() const;

    // destructor not needed since vector manages its own memory
    ~CircularBufferVector() = default;

private:
    std::vector<T> buffer;
    size_t head;
    size_t tail;
    size_t capacity;
    size_t count;
};