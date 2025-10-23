#include "SlidingWindowFilter.h"
#include "../core/Policies.h"

using namespace dsp::utils;

// -----------------------------------------------------------------------------
// Constructor
// Constructs a new sliding window filter with the specified window size
// @ param window_size - The number of samples in the sliding window
// @ param policy - An instance of the policy (default-constructed if not provided)
// @ return void
// -----------------------------------------------------------------------------
template <typename T, typename Policy>
SlidingWindowFilter<T, Policy>::SlidingWindowFilter(size_t window_size, Policy policy)
    : m_buffer(window_size), m_policy(std::move(policy))
{
}

// -----------------------------------------------------------------------------
// addSample
// Adds a new sample to the sliding window
// If buffer is full, removes oldest sample (delegates to policy.onRemove)
// Then adds new sample (delegates to policy.onAdd)
// @ param newValue - The new sample to add
// @ return T - The computed result from the policy
// -----------------------------------------------------------------------------
template <typename T, typename Policy>
T SlidingWindowFilter<T, Policy>::addSample(T newValue)
{
    if (m_buffer.isFull())
    {
        T oldestValue = m_buffer.peek();
        m_policy.onRemove(oldestValue);
    }

    m_buffer.pushOverwrite(newValue);
    m_policy.onAdd(newValue);

    return m_policy.getResult(m_buffer.getCount());
}

// -----------------------------------------------------------------------------
// clear
// Clears all samples from the filter
// Resets both the circular buffer and the policy state
// @ return void
// -----------------------------------------------------------------------------
template <typename T, typename Policy>
void SlidingWindowFilter<T, Policy>::clear()
{
    m_buffer.clear();
    m_policy.clear();
}

// -----------------------------------------------------------------------------
// isFull
// Checks if the buffer is full
// @ return bool - true if buffer contains window_size samples
// -----------------------------------------------------------------------------
template <typename T, typename Policy>
bool SlidingWindowFilter<T, Policy>::isFull() const noexcept
{
    return m_buffer.isFull();
}

// -----------------------------------------------------------------------------
// getCount
// Gets the current number of samples in the buffer
// @ return size_t - The number of samples
// -----------------------------------------------------------------------------
template <typename T, typename Policy>
size_t SlidingWindowFilter<T, Policy>::getCount() const noexcept
{
    return m_buffer.getCount();
}

// -----------------------------------------------------------------------------
// getWindowSize
// Gets the window size
// @ return size_t - The maximum number of samples in the window
// -----------------------------------------------------------------------------
template <typename T, typename Policy>
size_t SlidingWindowFilter<T, Policy>::getWindowSize() const noexcept
{
    return m_buffer.getCapacity();
}

// -----------------------------------------------------------------------------
// getBufferContents
// Exports the buffer contents
// @ return std::vector<T> - A vector containing all samples in the buffer
// -----------------------------------------------------------------------------
template <typename T, typename Policy>
std::vector<T> SlidingWindowFilter<T, Policy>::getBufferContents() const
{
    return m_buffer.toVector();
}

// -----------------------------------------------------------------------------
// setBufferContents
// Restores the buffer contents
// @ param bufferData - The samples to restore to the buffer
// @ return void
// -----------------------------------------------------------------------------
template <typename T, typename Policy>
void SlidingWindowFilter<T, Policy>::setBufferContents(const std::vector<T> &bufferData)
{
    m_buffer.fromVector(bufferData);
}

// -----------------------------------------------------------------------------
// getPolicy
// Access to the policy for state serialization
// @ return Policy& - Reference to the internal policy object
// -----------------------------------------------------------------------------
template <typename T, typename Policy>
Policy &SlidingWindowFilter<T, Policy>::getPolicy()
{
    return m_policy;
}

// -----------------------------------------------------------------------------
// getPolicy (const)
// Const access to the policy
// @ return const Policy& - Const reference to the internal policy object
// -----------------------------------------------------------------------------
template <typename T, typename Policy>
const Policy &SlidingWindowFilter<T, Policy>::getPolicy() const
{
    return m_policy;
}

// -----------------------------------------------------------------------------
// Explicit template instantiations
// Instantiate all Policy combinations we use
// -----------------------------------------------------------------------------
namespace dsp::utils
{
    using namespace dsp::core;

    // MeanPolicy instantiations
    template class SlidingWindowFilter<int, MeanPolicy<int>>;
    template class SlidingWindowFilter<float, MeanPolicy<float>>;
    template class SlidingWindowFilter<double, MeanPolicy<double>>;

    // RmsPolicy instantiations
    template class SlidingWindowFilter<int, RmsPolicy<int>>;
    template class SlidingWindowFilter<float, RmsPolicy<float>>;
    template class SlidingWindowFilter<double, RmsPolicy<double>>;

    // MeanAbsoluteValuePolicy instantiations
    template class SlidingWindowFilter<float, MeanAbsoluteValuePolicy<float>>;
    template class SlidingWindowFilter<double, MeanAbsoluteValuePolicy<double>>;

    // VariancePolicy instantiations
    template class SlidingWindowFilter<int, VariancePolicy<int>>;
    template class SlidingWindowFilter<float, VariancePolicy<float>>;
    template class SlidingWindowFilter<double, VariancePolicy<double>>;

    // Note: ZScorePolicy is NOT instantiated here because it has a different interface
    // (getResult takes 2 parameters: currentValue and count, not just count)
    // MovingZScoreFilter doesn't use SlidingWindowFilter template
}
