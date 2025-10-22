#pragma once

// CircularBufferArray.h
template <typename T>

class CircularBufferArray
{
public:
    // constructors
    explicit CircularBufferArray(size_t size);
    CircularBufferArray(const CircularBufferArray &other) = delete;            // disable copy to avoid shallow copy
    CircularBufferArray &operator=(const CircularBufferArray &other) = delete; // disable copy assignment to avoid shallow copy

    // methods
    bool push(const T &item);
    bool pop(T &item);
    void clear();
    void pushOverwrite(const T &item);

    // getters
    size_t getCapacity() const;
    size_t getCount() const;
    bool isEmpty() const;
    bool isFull() const;
    T peek() const;

    // destructor
    ~CircularBufferArray();

private:
    T *buffer;
    size_t head;
    size_t tail;
    size_t capacity;
    size_t count;
};