#pragma once

#include "../IDspStage.h"
#include "../core/RmsFilter.h"
#include <vector>
#include <stdexcept>
#include <cmath>
#include <string>
#include <algorithm>
#include <numeric> // For std::accumulate

namespace dsp::adapters
{
    enum class RmsMode
    {
        Batch,
        Moving
    };

    class RmsStage : public IDspStage
    {
    public:
        /**
         * @brief Constructs a new RMS Stage.
         * @param mode The RMS mode (Batch or Moving).
         * @param window_size The window size, required only for 'Moving' mode.
         */
        explicit RmsStage(RmsMode mode, size_t window_size = 0)
            : m_mode(mode), m_window_size(window_size)
        {
            if (m_mode == RmsMode::Moving && window_size == 0)
            {
                throw std::invalid_argument("RMS: window size must be greater than 0 for 'moving' mode");
            }
        }

        // Return the type identifier for this stage
        const char *getType() const override
        {
            return "rms";
        }

        // Implementation of the interface method
        void process(float *buffer, size_t numSamples, int numChannels, const float *timestamps = nullptr) override
        {
            if (m_mode == RmsMode::Batch)
            {
                processBatch(buffer, numSamples, numChannels);
            }
            else // RmsMode::Moving
            {
                processMoving(buffer, numSamples, numChannels, timestamps);
            }
        }

        // Serialize the stage's state
        Napi::Object serializeState(Napi::Env env) const override
        {
            Napi::Object state = Napi::Object::New(env);
            std::string modeStr = (m_mode == RmsMode::Moving) ? "moving" : "batch";
            state.Set("mode", modeStr);

            if (m_mode == RmsMode::Moving)
            {
                state.Set("windowSize", static_cast<uint32_t>(m_window_size));
                state.Set("numChannels", static_cast<uint32_t>(m_filters.size()));

                // Serialize each channel's filter state
                Napi::Array channelsArray = Napi::Array::New(env, m_filters.size());
                for (size_t i = 0; i < m_filters.size(); ++i)
                {
                    Napi::Object channelState = Napi::Object::New(env);

                    // Get the filter's internal state
                    auto [bufferData, runningSumOfSquares] = m_filters[i].getState();

                    // Convert buffer data to JavaScript array
                    Napi::Array bufferArray = Napi::Array::New(env, bufferData.size());
                    for (size_t j = 0; j < bufferData.size(); ++j)
                    {
                        bufferArray.Set(j, Napi::Number::New(env, bufferData[j]));
                    }

                    channelState.Set("buffer", bufferArray);
                    // Store the running sum of squares
                    channelState.Set("runningSumOfSquares", Napi::Number::New(env, runningSumOfSquares));

                    channelsArray.Set(static_cast<uint32_t>(i), channelState);
                }
                state.Set("channels", channelsArray);
            }

            return state;
        }

        // Deserialize and restore the stage's state
        void deserializeState(const Napi::Object &state) override
        {
            std::string modeStr = state.Get("mode").As<Napi::String>().Utf8Value();
            RmsMode newMode = (modeStr == "moving") ? RmsMode::Moving : RmsMode::Batch;

            if (newMode != m_mode)
            {
                throw std::runtime_error("RMS mode mismatch during deserialization");
            }

            if (m_mode == RmsMode::Moving)
            {
                // Get window size and validate
                size_t windowSize = state.Get("windowSize").As<Napi::Number>().Uint32Value();
                if (windowSize != m_window_size)
                {
                    throw std::runtime_error("Window size mismatch during deserialization");
                }

                // Get number of channels
                uint32_t numChannels = state.Get("channels").As<Napi::Array>().Length();

                // Recreate filters
                m_filters.clear();
                for (uint32_t i = 0; i < numChannels; ++i)
                {
                    m_filters.emplace_back(m_window_size);
                }

                // Restore each channel's state
                Napi::Array channelsArray = state.Get("channels").As<Napi::Array>();
                for (uint32_t i = 0; i < numChannels; ++i)
                {
                    Napi::Object channelState = channelsArray.Get(i).As<Napi::Object>();

                    // Get buffer data
                    Napi::Array bufferArray = channelState.Get("buffer").As<Napi::Array>();
                    std::vector<float> bufferData;
                    bufferData.reserve(bufferArray.Length());
                    for (uint32_t j = 0; j < bufferArray.Length(); ++j)
                    {
                        bufferData.push_back(bufferArray.Get(j).As<Napi::Number>().FloatValue());
                    }

                    // Get running sum of squares
                    float runningSumOfSquares = channelState.Get("runningSumOfSquares").As<Napi::Number>().FloatValue();

                    // Validate runningSumOfSquares matches buffer contents
                    float actualSumOfSquares = 0.0f;
                    for (const auto &val : bufferData)
                    {
                        actualSumOfSquares += val * val;
                    }
                    const float tolerance = 0.0001f * std::max(1.0f, std::abs(actualSumOfSquares));
                    if (std::abs(runningSumOfSquares - actualSumOfSquares) > tolerance)
                    {
                        throw std::runtime_error(
                            "Running sum of squares validation failed: expected " +
                            std::to_string(actualSumOfSquares) + " but got " +
                            std::to_string(runningSumOfSquares));
                    }

                    // Restore the filter's state
                    m_filters[i].setState(bufferData, runningSumOfSquares);
                }
            }
        }

        // Reset all filters to initial state
        void reset() override
        {
            for (auto &filter : m_filters)
            {
                filter.clear();
            }
        }

    private:
        /**
         * @brief Statelessly calculates the RMS for each channel
         * and overwrites all samples in that channel with the result.
         */
        void processBatch(float *buffer, size_t numSamples, int numChannels)
        {
            for (int c = 0; c < numChannels; ++c)
            {
                size_t numSamplesPerChannel = numSamples / numChannels;
                if (numSamplesPerChannel == 0)
                    continue;

                double sum_sq = 0.0;

                // First pass: Calculate sum of squares
                for (size_t i = c; i < numSamples; i += numChannels)
                {
                    double val = static_cast<double>(buffer[i]);
                    sum_sq += val * val;
                }

                // Calculate mean of squares
                double mean_sq = sum_sq / numSamplesPerChannel;

                // Calculate RMS
                float rms = static_cast<float>(std::sqrt(std::max(0.0, mean_sq)));

                // Second pass: Fill this channel's buffer with the single RMS value
                for (size_t i = c; i < numSamples; i += numChannels)
                {
                    buffer[i] = rms;
                }
            }
        }

        /**
         * @brief Statefully processes samples using the moving RMS filters.
         */
        void processMoving(float *buffer, size_t numSamples, int numChannels, const float * /*timestamps*/)
        {
            // Lazily initialize filters, one for each channel
            if (m_filters.size() != numChannels)
            {
                m_filters.clear();
                for (int i = 0; i < numChannels; ++i)
                {
                    // Create one RmsFilter for each channel
                    m_filters.emplace_back(m_window_size);
                }
            }

            // Process the buffer sample by sample, de-interleaving
            for (size_t i = 0; i < numSamples; ++i)
            {
                int channel = i % numChannels;

                // Get RMS value from the correct filter and write it back in-place
                buffer[i] = m_filters[channel].addSample(buffer[i]);
            }
        }

        RmsMode m_mode;
        size_t m_window_size;
        // A separate RMS filter instance for each channel
        std::vector<dsp::core::RmsFilter<float>> m_filters;
    };

} // namespace dsp::adapters