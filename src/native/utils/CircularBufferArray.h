#pragma once

#include <vector>

namespace dsp::utils
{

    template <typename T>

    class CircularBufferArray
    {
    public:
        // constructors
        explicit CircularBufferArray(size_t size);
        CircularBufferArray(const CircularBufferArray &other) = delete;            // disable copy to avoid shallow copy
        CircularBufferArray &operator=(const CircularBufferArray &other) = delete; // disable copy assignment to avoid shallow copy

        // move semantics
        CircularBufferArray(CircularBufferArray &&other) noexcept;
        CircularBufferArray &operator=(CircularBufferArray &&other) noexcept;

        // methods
        bool push(const T &item);
        bool pop(T &item) noexcept;
        void clear() noexcept;
        void pushOverwrite(const T &item);

        // getters
        size_t getCapacity() const noexcept;
        size_t getCount() const noexcept;
        bool isEmpty() const noexcept;
        bool isFull() const noexcept;
        T peek() const;

        // state management
        std::vector<T> toVector() const;
        void fromVector(const std::vector<T> &data);

        // destructor
        ~CircularBufferArray();

    private:
        T *buffer;
        size_t head;
        size_t tail;
        size_t capacity;
        size_t count;
    };
} // namespace dsp::utils