#pragma once

#include <vector>
#include <stdexcept>
#include <memory>

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

        // move semantics (defaulted - compiler generated is now safe with unique_ptr)
        CircularBufferArray(CircularBufferArray &&other) noexcept = default;
        CircularBufferArray &operator=(CircularBufferArray &&other) noexcept = default;

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

        // destructor (defaulted - unique_ptr handles cleanup automatically)
        ~CircularBufferArray() = default;

    private:
        std::unique_ptr<T[]> buffer;
        size_t head;
        size_t tail;
        size_t capacity;
        size_t count;
    };
} // namespace dsp::utils