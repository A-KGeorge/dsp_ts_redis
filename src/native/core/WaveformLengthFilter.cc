/**
 * @file WaveformLengthFilter.cc
 * @brief Implementation file for WaveformLengthFilter (now header-only with policy-based design)
 * This file now only contains explicit template instantiations.
 * The actual implementation is in the header file WaveformLengthFilter.h,
 * which delegates to SlidingWindowFilter<T, SumPolicy<T>>.
 */

#include "WaveformLengthFilter.h"

// Explicit template instantiation for float type
namespace dsp::core
{
    template class WaveformLengthFilter<float>;
    template class WaveformLengthFilter<double>;

}