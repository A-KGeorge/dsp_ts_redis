/**
 * @file RmsFilter.cc
 * @brief Implementation file for RmsFilter (now header-only with policy-based design)
 *
 * This file now only contains explicit template instantiations.
 * The actual implementation is in the header file RmsFilter.h,
 * which delegates to SlidingWindowFilter<T, RmsPolicy<T>>.
 */

#include "RmsFilter.h"

// Explicit template instantiation for common types
template class dsp::core::RmsFilter<int>;
template class dsp::core::RmsFilter<float>;
template class dsp::core::RmsFilter<double>;