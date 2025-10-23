#pragma once
#include "CircularBufferArray.h"
#include <utility>
#include <vector>

namespace dsp::utils
{
    /**
     * @brief A generic, policy-based sliding window filter engine.
     *
     * This class implements the sliding window logic (circular buffer management)
     * while delegating the statistical computation to a Policy class.
     *
     * This is a zero-cost abstraction: the compiler inlines all policy methods,
     * resulting in performance identical to hand-written specialized filters.
     *
     * @tparam T The numeric type (e.g., float, double).
     * @tparam Policy The struct that defines the state and math operations.
     *               Must implement: onAdd(T), onRemove(T), clear(), getResult(size_t)
     */
    template <typename T, typename Policy>
    class SlidingWindowFilter
    {
    public:
        /**
         * @brief Constructs a new sliding window filter.
         * @param window_size The number of samples in the sliding window.
         * @param policy An instance of the policy (default-constructed if not provided).
         */
        explicit SlidingWindowFilter(size_t window_size, Policy policy = Policy());

        // Delete copy constructor and copy assignment
        SlidingWindowFilter(const SlidingWindowFilter &) = delete;
        SlidingWindowFilter &operator=(const SlidingWindowFilter &) = delete;

        // Enable move semantics
        SlidingWindowFilter(SlidingWindowFilter &&) noexcept = default;
        SlidingWindowFilter &operator=(SlidingWindowFilter &&) noexcept = default;

        /**
         * @brief Adds a new sample to the sliding window.
         *
         * If the buffer is full, removes the oldest sample (delegates to policy.onRemove),
         * then adds the new sample (delegates to policy.onAdd).
         *
         * @param newValue The new sample to add.
         * @return T The computed result from the policy.
         */
        T addSample(T newValue);

        /**
         * @brief Clears all samples from the filter.
         *
         * Resets both the circular buffer and the policy state.
         */
        void clear();

        /**
         * @brief Checks if the buffer is full.
         * @return true if the buffer contains window_size samples.
         */
        bool isFull() const noexcept;

        /**
         * @brief Gets the current number of samples in the buffer.
         * @return size_t The number of samples.
         */
        size_t getCount() const noexcept;

        /**
         * @brief Gets the window size.
         * @return size_t The maximum number of samples in the window.
         */
        size_t getWindowSize() const noexcept;

        /**
         * @brief Exports the buffer contents.
         * @return std::vector<T> A vector containing all samples in the buffer.
         */
        std::vector<T> getBufferContents() const;

        /**
         * @brief Restores the buffer contents.
         * @param bufferData The samples to restore to the buffer.
         */
        void setBufferContents(const std::vector<T> &bufferData);

        /**
         * @brief Access to the policy for state serialization.
         * @return Policy& Reference to the internal policy object.
         */
        Policy &getPolicy();

        /**
         * @brief Const access to the policy.
         * @return const Policy& Const reference to the internal policy object.
         */
        const Policy &getPolicy() const;

        /**
         * @brief Exports the complete filter state (buffer + policy state).
         *
         * This is a generic state serialization method that works with any policy
         * that implements getState(). Returns a pair of buffer contents and policy state.
         *
         * @return std::pair<std::vector<T>, PolicyState> Buffer contents and policy state.
         */
        auto getState() const -> std::pair<std::vector<T>, decltype(std::declval<Policy>().getState())>
        {
            return {m_buffer.toVector(), m_policy.getState()};
        }

        /**
         * @brief Restores the complete filter state (buffer + policy state).
         *
         * This is a generic state deserialization method that works with any policy
         * that implements setState(). Restores both buffer contents and policy state.
         *
         * @param bufferData The buffer contents to restore.
         * @param policyState The policy state to restore (type depends on policy).
         */
        template <typename PolicyState>
        void setState(const std::vector<T> &bufferData, const PolicyState &policyState)
        {
            m_buffer.fromVector(bufferData);
            m_policy.setState(policyState);
        }

    private:
        CircularBufferArray<T> m_buffer;
        Policy m_policy;
    };

} // namespace dsp::utils
