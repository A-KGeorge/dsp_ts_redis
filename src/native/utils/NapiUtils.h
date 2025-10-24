#pragma once

#include <napi.h>
#include <vector>
#include <type_traits> // For std::is_same

namespace dsp::utils
{
    /**
     * @brief Helper to convert Napi::Array to std::vector
     */
    template <typename T>
    std::vector<T> NapiArrayToVector(const Napi::Array &arr);

    /**
     * @brief Helper to convert std::vector to Napi::Array
     */
    template <typename T>
    Napi::Array VectorToNapiArray(Napi::Env env, const std::vector<T> &vec);

} // namespace dsp::utils