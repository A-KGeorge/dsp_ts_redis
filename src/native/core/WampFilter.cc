/**
 * @file WampFilter.cc
 * @brief Implementation file for WampFilter (now header-only with policy-based design)
 * This file now only contains explicit template instantiations.
 * The actual implementation is in the header file WampFilter.h,
 * which delegates to SlidingWindowFilter<T, CounterPolicy>.
 */

#include "WampFilter.h"

// Explicit template instantiation for common types
namespace dsp::core
{
    template class WampFilter<float>;
    template class WampFilter<double>;
}
