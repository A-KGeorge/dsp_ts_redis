#include "NapiUtils.h"

template <typename T>
std::vector<T> dsp::utils::NapiArrayToVector(const Napi::Array &arr)
{
    std::vector<T> vec;
    vec.reserve(arr.Length());
    for (uint32_t j = 0; j < arr.Length(); ++j)
    {
        if (std::is_same<T, bool>::value)
        {
            vec.push_back(arr.Get(j).As<Napi::Boolean>().Value());
        }
        else
        {
            vec.push_back(static_cast<T>(arr.Get(j).As<Napi::Number>().FloatValue()));
        }
    }
    return vec;
}

template <typename T>
Napi::Array dsp::utils::VectorToNapiArray(Napi::Env env, const std::vector<T> &vec)
{
    Napi::Array arr = Napi::Array::New(env, vec.size());
    for (size_t j = 0; j < vec.size(); ++j)
    {
        if (std::is_same<T, bool>::value)
        {
            arr.Set(j, Napi::Boolean::New(env, static_cast<bool>(vec[j])));
        }
        else
        {
            arr.Set(j, Napi::Number::New(env, static_cast<double>(vec[j])));
        }
    }
    return arr;
}

// Explicit template instantiations
template std::vector<float> dsp::utils::NapiArrayToVector<float>(const Napi::Array &);
template std::vector<double> dsp::utils::NapiArrayToVector<double>(const Napi::Array &);
template std::vector<bool> dsp::utils::NapiArrayToVector<bool>(const Napi::Array &);

template Napi::Array dsp::utils::VectorToNapiArray<float>(Napi::Env, const std::vector<float> &);
template Napi::Array dsp::utils::VectorToNapiArray<double>(Napi::Env, const std::vector<double> &);
template Napi::Array dsp::utils::VectorToNapiArray<bool>(Napi::Env, const std::vector<bool> &);