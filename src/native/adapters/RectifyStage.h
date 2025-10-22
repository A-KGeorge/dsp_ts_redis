#pragma once
#include "../IDspStage.h"
#include <cmath>
#include <stdexcept>

namespace dsp
{
    enum class RectifyMode
    {
        FullWave,
        HalfWave
    };

    class RectifyStage : public IDspStage
    {
    public:
        /**
         * @brief Constructs a new Rectify Stage.
         * @param mode The rectification mode (FULL_WAVE or HALF_WAVE).
         */
        explicit RectifyStage(RectifyMode mode = RectifyMode::FullWave)
            : m_mode(mode) {}

        // Delete copy/move semantics
        RectifyStage(const RectifyStage &) = delete;
        RectifyStage &operator=(const RectifyStage &) = delete;
        RectifyStage(RectifyStage &&) noexcept = delete;
        RectifyStage &operator=(RectifyStage &&) noexcept = delete;

        /**
         * @brief Returns the type identifier of this stage.
         * @return A string identifying the stage type ("rectify").
         */
        const char *getType() const override
        {
            return "rectify";
        }

        /**
         * @brief Applies in-place rectification based on the configured mode.
         */
        void process(float *buffer, size_t numSamples, int /*numChannels*/) override
        {
            for (size_t i = 0; i < numSamples; ++i)
            {
                switch (m_mode)
                {
                case RectifyMode::FullWave:
                    buffer[i] = std::fabs(buffer[i]);
                    break;
                case RectifyMode::HalfWave:
                    buffer[i] = std::max(0.0f, buffer[i]);
                    break;
                }
            }
        }

        /**
         * @brief Serializes the stage's configured mode.
         */
        Napi::Object serializeState(Napi::Env env) const override
        {
            Napi::Object state = Napi::Object::New(env);
            state.Set("type", "rectify");
            state.Set("mode", m_mode == RectifyMode::FullWave ? "full" : "half");
            return state;
        }

        /**
         * @brief Deserializes and restores the stage's configured mode.
         */
        void deserializeState(const Napi::Object &state) override
        {
            std::string mode = state.Get("mode").As<Napi::String>().Utf8Value();
            if (mode == "full")
                m_mode = RectifyMode::FullWave;
            else if (mode == "half")
                m_mode = RectifyMode::HalfWave;
            else
                throw std::runtime_error("Invalid rectify mode");
        }

        void reset() override {} // No internal buffers

    private:
        RectifyMode m_mode;
    };
}
