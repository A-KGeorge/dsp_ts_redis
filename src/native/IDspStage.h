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

        /**
         * @brief Serializes the stage's internal state to a Napi::Object.
         *
         * @param env The N-API environment for creating JavaScript objects.
         * @return Napi::Object containing the serialized state.
         */
        virtual Napi::Object serializeState(Napi::Env env) const = 0;

        /**
         * @brief Deserializes and restores the stage's internal state.
         *
         * @param state The Napi::Object containing the serialized state.
         */
        virtual void deserializeState(const Napi::Object &state) = 0;

        /**
         * @brief Resets the stage's internal state to initial values.
         */
        virtual void reset() = 0;
    };

} // namespace dsp