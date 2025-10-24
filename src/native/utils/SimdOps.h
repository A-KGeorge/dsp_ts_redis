#pragma once

/**
 * @file SimdOps.h
 * @brief Cross-platform SIMD operations for DSP processing
 *
 * This header provides SIMD-optimized operations with automatic fallback
 * to scalar implementations when SIMD is not available.
 *
 * Supports:
 * - x86/x64: SSE2 (baseline), AVX2 (when available)
 * - ARM: NEON (when available)
 * - Fallback: Scalar operations with compiler auto-vectorization
 */

#include <cstddef>
#include <cmath>
#include <algorithm>

// Platform detection
#if defined(__x86_64__) || defined(_M_X64) || defined(__i386__) || defined(_M_IX86)
#define SIMD_X86
#if defined(__AVX2__)
#define SIMD_AVX2
#include <immintrin.h>
#elif defined(__SSE2__) || defined(_M_X64) || (defined(_M_IX86_FP) && _M_IX86_FP >= 2)
#define SIMD_SSE2
#include <emmintrin.h>
#endif
#elif defined(__ARM_NEON) || defined(__aarch64__)
#define SIMD_NEON
#include <arm_neon.h>
#endif

namespace dsp::simd
{
    /**
     * @brief Apply absolute value to array of floats (full-wave rectification)
     * @param buffer Input/output buffer (modified in-place)
     * @param size Number of elements
     */
    inline void abs_inplace(float *buffer, size_t size)
    {
#if defined(SIMD_AVX2)
        // AVX2: Process 8 floats at a time
        const size_t simd_width = 8;
        const size_t simd_count = size / simd_width;
        const size_t simd_end = simd_count * simd_width;

        // Sign bit mask (0x7FFFFFFF for each float)
        const __m256 sign_mask = _mm256_castsi256_ps(_mm256_set1_epi32(0x7FFFFFFF));

        for (size_t i = 0; i < simd_end; i += simd_width)
        {
            __m256 values = _mm256_loadu_ps(&buffer[i]);
            values = _mm256_and_ps(values, sign_mask); // Clear sign bit
            _mm256_storeu_ps(&buffer[i], values);
        }

        // Handle remainder
        for (size_t i = simd_end; i < size; ++i)
        {
            buffer[i] = std::fabs(buffer[i]);
        }

#elif defined(SIMD_SSE2)
        // SSE2: Process 4 floats at a time
        const size_t simd_width = 4;
        const size_t simd_count = size / simd_width;
        const size_t simd_end = simd_count * simd_width;

        const __m128 sign_mask = _mm_castsi128_ps(_mm_set1_epi32(0x7FFFFFFF));

        for (size_t i = 0; i < simd_end; i += simd_width)
        {
            __m128 values = _mm_loadu_ps(&buffer[i]);
            values = _mm_and_ps(values, sign_mask);
            _mm_storeu_ps(&buffer[i], values);
        }

        for (size_t i = simd_end; i < size; ++i)
        {
            buffer[i] = std::fabs(buffer[i]);
        }

#elif defined(SIMD_NEON)
        // ARM NEON: Process 4 floats at a time
        const size_t simd_width = 4;
        const size_t simd_count = size / simd_width;
        const size_t simd_end = simd_count * simd_width;

        for (size_t i = 0; i < simd_end; i += simd_width)
        {
            float32x4_t values = vld1q_f32(&buffer[i]);
            values = vabsq_f32(values);
            vst1q_f32(&buffer[i], values);
        }

        for (size_t i = simd_end; i < size; ++i)
        {
            buffer[i] = std::fabs(buffer[i]);
        }

#else
        // Scalar fallback (compiler may auto-vectorize)
        for (size_t i = 0; i < size; ++i)
        {
            buffer[i] = std::fabs(buffer[i]);
        }
#endif
    }

    /**
     * @brief Apply half-wave rectification (max(0, x))
     * @param buffer Input/output buffer (modified in-place)
     * @param size Number of elements
     */
    inline void max_zero_inplace(float *buffer, size_t size)
    {
#if defined(SIMD_AVX2)
        const size_t simd_width = 8;
        const size_t simd_count = size / simd_width;
        const size_t simd_end = simd_count * simd_width;

        const __m256 zero = _mm256_setzero_ps();

        for (size_t i = 0; i < simd_end; i += simd_width)
        {
            __m256 values = _mm256_loadu_ps(&buffer[i]);
            values = _mm256_max_ps(values, zero);
            _mm256_storeu_ps(&buffer[i], values);
        }

        for (size_t i = simd_end; i < size; ++i)
        {
            buffer[i] = std::max(0.0f, buffer[i]);
        }

#elif defined(SIMD_SSE2)
        const size_t simd_width = 4;
        const size_t simd_count = size / simd_width;
        const size_t simd_end = simd_count * simd_width;

        const __m128 zero = _mm_setzero_ps();

        for (size_t i = 0; i < simd_end; i += simd_width)
        {
            __m128 values = _mm_loadu_ps(&buffer[i]);
            values = _mm_max_ps(values, zero);
            _mm_storeu_ps(&buffer[i], values);
        }

        for (size_t i = simd_end; i < size; ++i)
        {
            buffer[i] = std::max(0.0f, buffer[i]);
        }

#elif defined(SIMD_NEON)
        const size_t simd_width = 4;
        const size_t simd_count = size / simd_width;
        const size_t simd_end = simd_count * simd_width;

        const float32x4_t zero = vdupq_n_f32(0.0f);

        for (size_t i = 0; i < simd_end; i += simd_width)
        {
            float32x4_t values = vld1q_f32(&buffer[i]);
            values = vmaxq_f32(values, zero);
            vst1q_f32(&buffer[i], values);
        }

        for (size_t i = simd_end; i < size; ++i)
        {
            buffer[i] = std::max(0.0f, buffer[i]);
        }

#else
        for (size_t i = 0; i < size; ++i)
        {
            buffer[i] = std::max(0.0f, buffer[i]);
        }
#endif
    }

    /**
     * @brief Compute sum of array (optimized for batch mode operations)
     * @param buffer Input buffer
     * @param size Number of elements
     * @return Sum of all elements
     */
    inline double sum(const float *buffer, size_t size)
    {
#if defined(SIMD_AVX2)
        const size_t simd_width = 8;
        const size_t simd_count = size / simd_width;
        const size_t simd_end = simd_count * simd_width;

        __m256d acc1 = _mm256_setzero_pd();
        __m256d acc2 = _mm256_setzero_pd();

        for (size_t i = 0; i < simd_end; i += simd_width)
        {
            // Load 8 floats
            __m256 values = _mm256_loadu_ps(&buffer[i]);

            // Convert to two groups of 4 doubles for precision
            __m128 lo = _mm256_castps256_ps128(values);
            __m128 hi = _mm256_extractf128_ps(values, 1);

            __m256d dbl_lo = _mm256_cvtps_pd(lo);
            __m256d dbl_hi = _mm256_cvtps_pd(hi);

            acc1 = _mm256_add_pd(acc1, dbl_lo);
            acc2 = _mm256_add_pd(acc2, dbl_hi);
        }

        // Horizontal sum
        acc1 = _mm256_add_pd(acc1, acc2);
        __m128d sum_high = _mm256_extractf128_pd(acc1, 1);
        __m128d sum_low = _mm256_castpd256_pd128(acc1);
        __m128d sum128 = _mm_add_pd(sum_low, sum_high);

        double result[2];
        _mm_storeu_pd(result, sum128);
        double total = result[0] + result[1];

        // Handle remainder
        for (size_t i = simd_end; i < size; ++i)
        {
            total += static_cast<double>(buffer[i]);
        }

        return total;

#elif defined(SIMD_SSE2)
        const size_t simd_width = 4;
        const size_t simd_count = size / simd_width;
        const size_t simd_end = simd_count * simd_width;

        __m128d acc1 = _mm_setzero_pd();
        __m128d acc2 = _mm_setzero_pd();

        for (size_t i = 0; i < simd_end; i += simd_width)
        {
            __m128 values = _mm_loadu_ps(&buffer[i]);

            // Convert to doubles for precision
            __m128d dbl_lo = _mm_cvtps_pd(values);
            __m128d dbl_hi = _mm_cvtps_pd(_mm_movehl_ps(values, values));

            acc1 = _mm_add_pd(acc1, dbl_lo);
            acc2 = _mm_add_pd(acc2, dbl_hi);
        }

        acc1 = _mm_add_pd(acc1, acc2);
        double result[2];
        _mm_storeu_pd(result, acc1);
        double total = result[0] + result[1];

        for (size_t i = simd_end; i < size; ++i)
        {
            total += static_cast<double>(buffer[i]);
        }

        return total;

#else
        // Scalar with Kahan summation for precision
        double sum = 0.0;
        double c = 0.0; // Compensation for lost low-order bits

        for (size_t i = 0; i < size; ++i)
        {
            double y = static_cast<double>(buffer[i]) - c;
            double t = sum + y;
            c = (t - sum) - y;
            sum = t;
        }

        return sum;
#endif
    }

    /**
     * @brief Compute sum of squares (optimized for RMS calculations)
     * @param buffer Input buffer
     * @param size Number of elements
     * @return Sum of squared elements
     */
    inline double sum_of_squares(const float *buffer, size_t size)
    {
#if defined(SIMD_AVX2)
        const size_t simd_width = 8;
        const size_t simd_count = size / simd_width;
        const size_t simd_end = simd_count * simd_width;

        __m256d acc1 = _mm256_setzero_pd();
        __m256d acc2 = _mm256_setzero_pd();

        for (size_t i = 0; i < simd_end; i += simd_width)
        {
            __m256 values = _mm256_loadu_ps(&buffer[i]);

            // Square the values
            __m256 squares = _mm256_mul_ps(values, values);

            // Convert to doubles for precision accumulation
            __m128 lo = _mm256_castps256_ps128(squares);
            __m128 hi = _mm256_extractf128_ps(squares, 1);

            __m256d dbl_lo = _mm256_cvtps_pd(lo);
            __m256d dbl_hi = _mm256_cvtps_pd(hi);

            acc1 = _mm256_add_pd(acc1, dbl_lo);
            acc2 = _mm256_add_pd(acc2, dbl_hi);
        }

        // Horizontal sum
        acc1 = _mm256_add_pd(acc1, acc2);
        __m128d sum_high = _mm256_extractf128_pd(acc1, 1);
        __m128d sum_low = _mm256_castpd256_pd128(acc1);
        __m128d sum128 = _mm_add_pd(sum_low, sum_high);

        double result[2];
        _mm_storeu_pd(result, sum128);
        double total = result[0] + result[1];

        // Handle remainder
        for (size_t i = simd_end; i < size; ++i)
        {
            double val = static_cast<double>(buffer[i]);
            total += val * val;
        }

        return total;

#elif defined(SIMD_SSE2)
        const size_t simd_width = 4;
        const size_t simd_count = size / simd_width;
        const size_t simd_end = simd_count * simd_width;

        __m128d acc1 = _mm_setzero_pd();
        __m128d acc2 = _mm_setzero_pd();

        for (size_t i = 0; i < simd_end; i += simd_width)
        {
            __m128 values = _mm_loadu_ps(&buffer[i]);
            __m128 squares = _mm_mul_ps(values, values);

            __m128d dbl_lo = _mm_cvtps_pd(squares);
            __m128d dbl_hi = _mm_cvtps_pd(_mm_movehl_ps(squares, squares));

            acc1 = _mm_add_pd(acc1, dbl_lo);
            acc2 = _mm_add_pd(acc2, dbl_hi);
        }

        acc1 = _mm_add_pd(acc1, acc2);
        double result[2];
        _mm_storeu_pd(result, acc1);
        double total = result[0] + result[1];

        for (size_t i = simd_end; i < size; ++i)
        {
            double val = static_cast<double>(buffer[i]);
            total += val * val;
        }

        return total;

#else
        // Scalar with Kahan summation
        double sum = 0.0;
        double c = 0.0;

        for (size_t i = 0; i < size; ++i)
        {
            double val = static_cast<double>(buffer[i]);
            double y = (val * val) - c;
            double t = sum + y;
            c = (t - sum) - y;
            sum = t;
        }

        return sum;
#endif
    }

} // namespace dsp::simd
