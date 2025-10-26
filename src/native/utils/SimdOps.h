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

    /**
     * @brief QUICK WIN: Apply window function to signal (element-wise multiply)
     * @param input Input signal buffer
     * @param window Window coefficients
     * @param output Output windowed signal
     * @param size Number of elements
     */
    inline void apply_window(const float *input, const float *window, float *output, size_t size)
    {
#if defined(SIMD_AVX2)
        const size_t simd_width = 8;
        const size_t simd_count = size / simd_width;
        const size_t simd_end = simd_count * simd_width;

        for (size_t i = 0; i < simd_end; i += simd_width)
        {
            __m256 in = _mm256_loadu_ps(&input[i]);
            __m256 win = _mm256_loadu_ps(&window[i]);
            __m256 result = _mm256_mul_ps(in, win);
            _mm256_storeu_ps(&output[i], result);
        }

        // Handle remainder
        for (size_t i = simd_end; i < size; ++i)
        {
            output[i] = input[i] * window[i];
        }

#elif defined(SIMD_SSE2)
        const size_t simd_width = 4;
        const size_t simd_count = size / simd_width;
        const size_t simd_end = simd_count * simd_width;

        for (size_t i = 0; i < simd_end; i += simd_width)
        {
            __m128 in = _mm_loadu_ps(&input[i]);
            __m128 win = _mm_loadu_ps(&window[i]);
            __m128 result = _mm_mul_ps(in, win);
            _mm_storeu_ps(&output[i], result);
        }

        for (size_t i = simd_end; i < size; ++i)
        {
            output[i] = input[i] * window[i];
        }

#elif defined(SIMD_NEON)
        const size_t simd_width = 4;
        const size_t simd_count = size / simd_width;
        const size_t simd_end = simd_count * simd_width;

        for (size_t i = 0; i < simd_end; i += simd_width)
        {
            float32x4_t in = vld1q_f32(&input[i]);
            float32x4_t win = vld1q_f32(&window[i]);
            float32x4_t result = vmulq_f32(in, win);
            vst1q_f32(&output[i], result);
        }

        for (size_t i = simd_end; i < size; ++i)
        {
            output[i] = input[i] * window[i];
        }

#else
        for (size_t i = 0; i < size; ++i)
        {
            output[i] = input[i] * window[i];
        }
#endif
    }

    /**
     * @brief MEDIUM WIN: Compute magnitude spectrum from complex values
     * magnitude[i] = sqrt(real[i]² + imag[i]²)
     * @param real Real components
     * @param imag Imaginary components
     * @param magnitude Output magnitudes
     * @param size Number of complex values
     */
    inline void complex_magnitude(const float *real, const float *imag, float *magnitude, size_t size)
    {
#if defined(SIMD_AVX2)
        const size_t simd_width = 8;
        const size_t simd_count = size / simd_width;
        const size_t simd_end = simd_count * simd_width;

        for (size_t i = 0; i < simd_end; i += simd_width)
        {
            __m256 re = _mm256_loadu_ps(&real[i]);
            __m256 im = _mm256_loadu_ps(&imag[i]);

            // mag² = re² + im²
            __m256 re_sq = _mm256_mul_ps(re, re);
            __m256 im_sq = _mm256_mul_ps(im, im);
            __m256 mag_sq = _mm256_add_ps(re_sq, im_sq);

            // mag = sqrt(mag²)
            __m256 mag = _mm256_sqrt_ps(mag_sq);

            _mm256_storeu_ps(&magnitude[i], mag);
        }

        for (size_t i = simd_end; i < size; ++i)
        {
            magnitude[i] = std::sqrt(real[i] * real[i] + imag[i] * imag[i]);
        }

#elif defined(SIMD_SSE2)
        const size_t simd_width = 4;
        const size_t simd_count = size / simd_width;
        const size_t simd_end = simd_count * simd_width;

        for (size_t i = 0; i < simd_end; i += simd_width)
        {
            __m128 re = _mm_loadu_ps(&real[i]);
            __m128 im = _mm_loadu_ps(&imag[i]);

            __m128 re_sq = _mm_mul_ps(re, re);
            __m128 im_sq = _mm_mul_ps(im, im);
            __m128 mag_sq = _mm_add_ps(re_sq, im_sq);
            __m128 mag = _mm_sqrt_ps(mag_sq);

            _mm_storeu_ps(&magnitude[i], mag);
        }

        for (size_t i = simd_end; i < size; ++i)
        {
            magnitude[i] = std::sqrt(real[i] * real[i] + imag[i] * imag[i]);
        }

#elif defined(SIMD_NEON)
        const size_t simd_width = 4;
        const size_t simd_count = size / simd_width;
        const size_t simd_end = simd_count * simd_width;

        for (size_t i = 0; i < simd_end; i += simd_width)
        {
            float32x4_t re = vld1q_f32(&real[i]);
            float32x4_t im = vld1q_f32(&imag[i]);

            float32x4_t re_sq = vmulq_f32(re, re);
            float32x4_t im_sq = vmulq_f32(im, im);
            float32x4_t mag_sq = vaddq_f32(re_sq, im_sq);

            // ARM NEON sqrt (reciprocal square root + Newton-Raphson)
            float32x4_t mag = vsqrtq_f32(mag_sq);

            vst1q_f32(&magnitude[i], mag);
        }

        for (size_t i = simd_end; i < size; ++i)
        {
            magnitude[i] = std::sqrt(real[i] * real[i] + imag[i] * imag[i]);
        }

#else
        for (size_t i = 0; i < size; ++i)
        {
            magnitude[i] = std::sqrt(real[i] * real[i] + imag[i] * imag[i]);
        }
#endif
    }

    /**
     * @brief MEDIUM WIN: Compute power spectrum from complex values
     * power[i] = real[i]² + imag[i]²
     * @param real Real components
     * @param imag Imaginary components
     * @param power Output power values
     * @param size Number of complex values
     */
    inline void complex_power(const float *real, const float *imag, float *power, size_t size)
    {
#if defined(SIMD_AVX2)
        const size_t simd_width = 8;
        const size_t simd_count = size / simd_width;
        const size_t simd_end = simd_count * simd_width;

        for (size_t i = 0; i < simd_end; i += simd_width)
        {
            __m256 re = _mm256_loadu_ps(&real[i]);
            __m256 im = _mm256_loadu_ps(&imag[i]);

            __m256 re_sq = _mm256_mul_ps(re, re);
            __m256 im_sq = _mm256_mul_ps(im, im);
            __m256 pwr = _mm256_add_ps(re_sq, im_sq);

            _mm256_storeu_ps(&power[i], pwr);
        }

        for (size_t i = simd_end; i < size; ++i)
        {
            power[i] = real[i] * real[i] + imag[i] * imag[i];
        }

#elif defined(SIMD_SSE2)
        const size_t simd_width = 4;
        const size_t simd_count = size / simd_width;
        const size_t simd_end = simd_count * simd_width;

        for (size_t i = 0; i < simd_end; i += simd_width)
        {
            __m128 re = _mm_loadu_ps(&real[i]);
            __m128 im = _mm_loadu_ps(&imag[i]);

            __m128 re_sq = _mm_mul_ps(re, re);
            __m128 im_sq = _mm_mul_ps(im, im);
            __m128 pwr = _mm_add_ps(re_sq, im_sq);

            _mm_storeu_ps(&power[i], pwr);
        }

        for (size_t i = simd_end; i < size; ++i)
        {
            power[i] = real[i] * real[i] + imag[i] * imag[i];
        }

#elif defined(SIMD_NEON)
        const size_t simd_width = 4;
        const size_t simd_count = size / simd_width;
        const size_t simd_end = simd_count * simd_width;

        for (size_t i = 0; i < simd_end; i += simd_width)
        {
            float32x4_t re = vld1q_f32(&real[i]);
            float32x4_t im = vld1q_f32(&imag[i]);

            float32x4_t re_sq = vmulq_f32(re, re);
            float32x4_t im_sq = vmulq_f32(im, im);
            float32x4_t pwr = vaddq_f32(re_sq, im_sq);

            vst1q_f32(&power[i], pwr);
        }

        for (size_t i = simd_end; i < size; ++i)
        {
            power[i] = real[i] * real[i] + imag[i] * imag[i];
        }

#else
        for (size_t i = 0; i < size; ++i)
        {
            power[i] = real[i] * real[i] + imag[i] * imag[i];
        }
#endif
    }

    /**
     * @brief SIMD-optimized dot product for FIR convolution
     * result = sum(a[i] * b[i]) for i in [0, size)
     * @param a First array
     * @param b Second array
     * @param size Number of elements
     * @return Dot product
     */
    inline float dot_product(const float *a, const float *b, size_t size)
    {
#if defined(SIMD_AVX2)
        const size_t simd_width = 8;
        const size_t simd_count = size / simd_width;
        const size_t simd_end = simd_count * simd_width;

        __m256 acc = _mm256_setzero_ps();

        for (size_t i = 0; i < simd_end; i += simd_width)
        {
            __m256 va = _mm256_loadu_ps(&a[i]);
            __m256 vb = _mm256_loadu_ps(&b[i]);
            __m256 prod = _mm256_mul_ps(va, vb);
            acc = _mm256_add_ps(acc, prod);
        }

        // Horizontal sum of the accumulator
        __m128 hi = _mm256_extractf128_ps(acc, 1);
        __m128 lo = _mm256_castps256_ps128(acc);
        __m128 sum128 = _mm_add_ps(lo, hi);

        // Reduce 4 floats to 1
        sum128 = _mm_hadd_ps(sum128, sum128);
        sum128 = _mm_hadd_ps(sum128, sum128);

        float result = _mm_cvtss_f32(sum128);

        // Handle remainder
        for (size_t i = simd_end; i < size; ++i)
        {
            result += a[i] * b[i];
        }

        return result;

#elif defined(SIMD_SSE2)
        const size_t simd_width = 4;
        const size_t simd_count = size / simd_width;
        const size_t simd_end = simd_count * simd_width;

        __m128 acc = _mm_setzero_ps();

        for (size_t i = 0; i < simd_end; i += simd_width)
        {
            __m128 va = _mm_loadu_ps(&a[i]);
            __m128 vb = _mm_loadu_ps(&b[i]);
            __m128 prod = _mm_mul_ps(va, vb);
            acc = _mm_add_ps(acc, prod);
        }

        // Horizontal sum
        __m128 shuf = _mm_shuffle_ps(acc, acc, _MM_SHUFFLE(2, 3, 0, 1));
        __m128 sums = _mm_add_ps(acc, shuf);
        shuf = _mm_movehl_ps(shuf, sums);
        sums = _mm_add_ss(sums, shuf);

        float result = _mm_cvtss_f32(sums);

        for (size_t i = simd_end; i < size; ++i)
        {
            result += a[i] * b[i];
        }

        return result;

#elif defined(SIMD_NEON)
        const size_t simd_width = 4;
        const size_t simd_count = size / simd_width;
        const size_t simd_end = simd_count * simd_width;

        float32x4_t acc = vdupq_n_f32(0.0f);

        for (size_t i = 0; i < simd_end; i += simd_width)
        {
            float32x4_t va = vld1q_f32(&a[i]);
            float32x4_t vb = vld1q_f32(&b[i]);
            acc = vmlaq_f32(acc, va, vb); // Fused multiply-add
        }

        // Horizontal sum
        float32x2_t sum2 = vadd_f32(vget_low_f32(acc), vget_high_f32(acc));
        float result = vget_lane_f32(vpadd_f32(sum2, sum2), 0);

        for (size_t i = simd_end; i < size; ++i)
        {
            result += a[i] * b[i];
        }

        return result;

#else
        float result = 0.0f;
        for (size_t i = 0; i < size; ++i)
        {
            result += a[i] * b[i];
        }
        return result;
#endif
    }

    /**
     * @brief MAJOR WIN: Complex multiplication for FFT butterflies
     * result = a * b (complex multiplication)
     * @param a_real Real part of a
     * @param a_imag Imaginary part of a
     * @param b_real Real part of b
     * @param b_imag Imaginary part of b
     * @param out_real Output real part
     * @param out_imag Output imaginary part
     * @param size Number of complex multiplications
     */
    inline void complex_multiply(
        const float *a_real, const float *a_imag,
        const float *b_real, const float *b_imag,
        float *out_real, float *out_imag,
        size_t size)
    {
#if defined(SIMD_AVX2)
        const size_t simd_width = 8;
        const size_t simd_count = size / simd_width;
        const size_t simd_end = simd_count * simd_width;

        for (size_t i = 0; i < simd_end; i += simd_width)
        {
            __m256 ar = _mm256_loadu_ps(&a_real[i]);
            __m256 ai = _mm256_loadu_ps(&a_imag[i]);
            __m256 br = _mm256_loadu_ps(&b_real[i]);
            __m256 bi = _mm256_loadu_ps(&b_imag[i]);

            // (a + bi) * (c + di) = (ac - bd) + (ad + bc)i
            __m256 ac = _mm256_mul_ps(ar, br);
            __m256 bd = _mm256_mul_ps(ai, bi);
            __m256 ad = _mm256_mul_ps(ar, bi);
            __m256 bc = _mm256_mul_ps(ai, br);

            __m256 real = _mm256_sub_ps(ac, bd);
            __m256 imag = _mm256_add_ps(ad, bc);

            _mm256_storeu_ps(&out_real[i], real);
            _mm256_storeu_ps(&out_imag[i], imag);
        }

        for (size_t i = simd_end; i < size; ++i)
        {
            float ar = a_real[i], ai = a_imag[i];
            float br = b_real[i], bi = b_imag[i];
            out_real[i] = ar * br - ai * bi;
            out_imag[i] = ar * bi + ai * br;
        }

#elif defined(SIMD_SSE2)
        const size_t simd_width = 4;
        const size_t simd_count = size / simd_width;
        const size_t simd_end = simd_count * simd_width;

        for (size_t i = 0; i < simd_end; i += simd_width)
        {
            __m128 ar = _mm_loadu_ps(&a_real[i]);
            __m128 ai = _mm_loadu_ps(&a_imag[i]);
            __m128 br = _mm_loadu_ps(&b_real[i]);
            __m128 bi = _mm_loadu_ps(&b_imag[i]);

            __m128 ac = _mm_mul_ps(ar, br);
            __m128 bd = _mm_mul_ps(ai, bi);
            __m128 ad = _mm_mul_ps(ar, bi);
            __m128 bc = _mm_mul_ps(ai, br);

            __m128 real = _mm_sub_ps(ac, bd);
            __m128 imag = _mm_add_ps(ad, bc);

            _mm_storeu_ps(&out_real[i], real);
            _mm_storeu_ps(&out_imag[i], imag);
        }

        for (size_t i = simd_end; i < size; ++i)
        {
            float ar = a_real[i], ai = a_imag[i];
            float br = b_real[i], bi = b_imag[i];
            out_real[i] = ar * br - ai * bi;
            out_imag[i] = ar * bi + ai * br;
        }

#elif defined(SIMD_NEON)
        const size_t simd_width = 4;
        const size_t simd_count = size / simd_width;
        const size_t simd_end = simd_count * simd_width;

        for (size_t i = 0; i < simd_end; i += simd_width)
        {
            float32x4_t ar = vld1q_f32(&a_real[i]);
            float32x4_t ai = vld1q_f32(&a_imag[i]);
            float32x4_t br = vld1q_f32(&b_real[i]);
            float32x4_t bi = vld1q_f32(&b_imag[i]);

            float32x4_t ac = vmulq_f32(ar, br);
            float32x4_t bd = vmulq_f32(ai, bi);
            float32x4_t ad = vmulq_f32(ar, bi);
            float32x4_t bc = vmulq_f32(ai, br);

            float32x4_t real = vsubq_f32(ac, bd);
            float32x4_t imag = vaddq_f32(ad, bc);

            vst1q_f32(&out_real[i], real);
            vst1q_f32(&out_imag[i], imag);
        }

        for (size_t i = simd_end; i < size; ++i)
        {
            float ar = a_real[i], ai = a_imag[i];
            float br = b_real[i], bi = b_imag[i];
            out_real[i] = ar * br - ai * bi;
            out_imag[i] = ar * bi + ai * br;
        }

#else
        for (size_t i = 0; i < size; ++i)
        {
            float ar = a_real[i], ai = a_imag[i];
            float br = b_real[i], bi = b_imag[i];
            out_real[i] = ar * br - ai * bi;
            out_imag[i] = ar * bi + ai * br;
        }
#endif
    }

} // namespace dsp::simd
