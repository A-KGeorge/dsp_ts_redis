#pragma once
#include <napi.h>

namespace dsp
{
    // This abstract class is the key.
    // Every filter you add will implement this.
    class IDspStage
    {
    public:
        virtual ~IDspStage() = default;

        /**
         * @brief Processes a chunk of audio data in-place.
         *
         * @param buffer The interleaved audio buffer.
         * @param numSamples The total number of samples (e.g., 1024).
         * @param numChannels The number of channels (e.g., 1, 2, 4).
         */
        virtual void process(float *buffer, size_t numSamples, int numChannels) = 0;
    };

} // namespace dsp