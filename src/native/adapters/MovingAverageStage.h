#pragma once

#include "../IDspStage.h"
#include "../utils/CircularBufferArray.h" // Your existing files
#include "../core/MovingAverageFilter.h"  // Your existing files
#include <vector>

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

    private:
        size_t m_window_size;
        // We need a separate filter instance for each channel's state
        std::vector<dsp::core::MovingAverageFilter<float>> m_filters;
    };

} // namespace dsp