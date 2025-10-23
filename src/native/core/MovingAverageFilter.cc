/**
 * @file MovingAverageFilter.cc
 * @brief Implementation file for MovingAverageFilter (now header-only with policy-based design)
 *
 * This file now only contains explicit template instantiations.
 * The actual implementation is in the header file MovingAverageFilter.h,
 * which delegates to SlidingWindowFilter<T, MeanPolicy<T>>.
 */

#include "MovingAverageFilter.h"

// Explicit template instantiation for common types
template class dsp::core::MovingAverageFilter<int>;
template class dsp::core::MovingAverageFilter<float>;
template class dsp::core::MovingAverageFilter<double>;
