/**
 * @file MovingAbsoluteValueFilter.cc
 * @brief Implementation file for MovingAbsoluteValueFilter (now header-only with policy-based design)
 *
 * This file now only contains explicit template instantiations.
 * The actual implementation is in the header file MovingAbsoluteValueFilter.h,
 * which delegates to SlidingWindowFilter<T, MeanAbsoluteValuePolicy<T>>.
 */

#include "MovingAbsoluteValueFilter.h"

// Explicit template instantiation for common types
template class dsp::core::MovingAbsoluteValueFilter<float>;
template class dsp::core::MovingAbsoluteValueFilter<double>;