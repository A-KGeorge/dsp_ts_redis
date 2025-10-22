#pragma once

#include "../IDspStage.h"
#include "../utils/CircularBufferArray.h" // Your existing files
#include "../core/MovingAverageFilter.h"  // Your existing files
#include <vector>
#include <stdexcept>

namespace dsp
{
    class MovingAverageStage : public IDspStage
    {
    public:
        // The constructor takes the parameter from TypeScript
        explicit MovingAverageStage(size_t window_size)
            : m_window_size(window_size) {}

        // This is the implementation of the interface method
        void process(float *buffer, size_t numSamples, int numChannels) override
        {
            // Lazily initialize our filters, one for each channel
            if (m_filters.size() != numChannels)
            {
                m_filters.clear();
                for (int i = 0; i < numChannels; ++i)
                {
                    // Create one MovingAverageFilter for each channel using emplace_back
                    m_filters.emplace_back(m_window_size);
                }
            }

            // Process the buffer sample by sample, de-interleaving
            for (size_t i = 0; i < numSamples; ++i)
            {
                int channel = i % numChannels;

                // Get sample from the correct filter, and write it back in-place
                buffer[i] = m_filters[channel].addSample(buffer[i]);
            }
        }

        // Serialize the stage's state to a Napi::Object
        Napi::Object serializeState(Napi::Env env) const override
        {
            Napi::Object state = Napi::Object::New(env);

            state.Set("windowSize", static_cast<uint32_t>(m_window_size));
            state.Set("numChannels", static_cast<uint32_t>(m_filters.size()));

            // Serialize each channel's filter state
            Napi::Array channelsArray = Napi::Array::New(env, m_filters.size());
            for (size_t i = 0; i < m_filters.size(); ++i)
            {
                Napi::Object channelState = Napi::Object::New(env);

                // Get the filter's internal state
                auto [bufferData, runningSum] = m_filters[i].getState();

                // Convert buffer data to JavaScript array
                Napi::Array bufferArray = Napi::Array::New(env, bufferData.size());
                for (size_t j = 0; j < bufferData.size(); ++j)
                {
                    bufferArray.Set(j, Napi::Number::New(env, bufferData[j]));
                }

                channelState.Set("buffer", bufferArray);
                channelState.Set("runningSum", Napi::Number::New(env, runningSum));

                channelsArray.Set(static_cast<uint32_t>(i), channelState);
            }

            state.Set("channels", channelsArray);

            return state;
        }

        // Deserialize and restore the stage's state
        void deserializeState(const Napi::Object &state) override
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

                // Get running sum
                float runningSum = channelState.Get("runningSum").As<Napi::Number>().FloatValue();

                // Restore the filter's state
                m_filters[i].setState(bufferData, runningSum);
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
        size_t m_window_size;
        // We need a separate filter instance for each channel's state
        std::vector<dsp::core::MovingAverageFilter<float>> m_filters;
    };

} // namespace dsp