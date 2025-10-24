/**
 * @file SscFilter.cc
 * @brief Implementation file for SscFilter (now header-only with policy-based design)
 * This file now only contains explicit template instantiations.
 * The actual implementation is in the header file SscFilter.h,
 * which delegates to SlidingWindowFilter<T, CounterPolicy>.
 */

#include "SscFilter.h"

// Explicit template instantiation for common types
namespace dsp::core
{
    template class SscFilter<float>;
    template class SscFilter<double>;
} // namespace dsp::core