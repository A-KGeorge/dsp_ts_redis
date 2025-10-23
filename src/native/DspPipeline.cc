// src/DspPipeline.cpp
#include "DspPipeline.h"
#include "adapters/MovingAverageStage.h"     // Moving Average method
#include "adapters/RmsStage.h"               // RMS method
#include "adapters/RectifyStage.h"           // Rectify method
#include "adapters/VarianceStage.h"          // Variance method
#include "adapters/ZScoreNormalizeStage.h"   // Z-Score Normalize method
#include "adapters/MeanAbsoluteValueStage.h" // Mean Absolute Value method

#include <iostream>
#include <ctime>

namespace dsp
{

    // N-API Boilerplate: Init function
    Napi::Object DspPipeline::Init(Napi::Env env, Napi::Object exports)
    {
        Napi::Function func = DefineClass(env, "DspPipeline", {
                                                                  // Pipeline building
                                                                  InstanceMethod("addStage", &DspPipeline::AddStage),

                                                                  // Processing
                                                                  InstanceMethod("process", &DspPipeline::ProcessAsync),

                                                                  // State management (for Redis persistence from TypeScript)
                                                                  InstanceMethod("saveState", &DspPipeline::SaveState),
                                                                  InstanceMethod("loadState", &DspPipeline::LoadState),
                                                                  InstanceMethod("clearState", &DspPipeline::ClearState),
                                                                  InstanceMethod("listState", &DspPipeline::ListState),
                                                              });

        exports.Set("DspPipeline", func);
        return exports;
    }

    // N-API Boilerplate: Constructor
    DspPipeline::DspPipeline(const Napi::CallbackInfo &info)
        : Napi::ObjectWrap<DspPipeline>(info)
    {
        // Config logic from TS (redis, stateKey) would go here
        InitializeStageFactories();
    }

    /**
     * Initialize the stage factory map with all available stages
     * This is where the methods get exposed to TypeScript
     */
    void DspPipeline::InitializeStageFactories()
    {
        // Factory for Moving Average stage
        m_stageFactories["movingAverage"] = [](const Napi::Object &params)
        {
            std::string modeStr = params.Get("mode").As<Napi::String>().Utf8Value();
            dsp::adapters::AverageMode mode = (modeStr == "moving") ? dsp::adapters::AverageMode::Moving : dsp::adapters::AverageMode::Batch;

            size_t windowSize = 0;
            if (mode == dsp::adapters::AverageMode::Moving)
            {
                if (!params.Has("windowSize"))
                {
                    throw std::invalid_argument("MovingAverage: 'windowSize' is required for 'moving' mode");
                }
                windowSize = params.Get("windowSize").As<Napi::Number>().Uint32Value();
            }

            return std::make_unique<dsp::adapters::MovingAverageStage>(mode, windowSize);
        };

        // Factory for RMS stage
        m_stageFactories["rms"] = [](const Napi::Object &params)
        {
            std::string modeStr = params.Get("mode").As<Napi::String>().Utf8Value();
            dsp::adapters::RmsMode mode = (modeStr == "moving") ? dsp::adapters::RmsMode::Moving : dsp::adapters::RmsMode::Batch;

            size_t windowSize = 0;
            if (mode == dsp::adapters::RmsMode::Moving)
            {
                if (!params.Has("windowSize"))
                {
                    throw std::invalid_argument("RMS: 'windowSize' is required for 'moving' mode");
                }
                windowSize = params.Get("windowSize").As<Napi::Number>().Uint32Value();
            }

            return std::make_unique<dsp::adapters::RmsStage>(mode, windowSize);
        };

        // Factory for Rectify stage
        m_stageFactories["rectify"] = [](const Napi::Object &params)
        {
            std::string modeStr = params.Get("mode").As<Napi::String>().Utf8Value();
            dsp::adapters::RectifyMode mode = (modeStr == "half") ? dsp::adapters::RectifyMode::HalfWave : dsp::adapters::RectifyMode::FullWave;
            return std::make_unique<dsp::adapters::RectifyStage>(mode);
        };

        // Factory for Variance stage
        m_stageFactories["variance"] = [](const Napi::Object &params)
        {
            std::string modeStr = params.Get("mode").As<Napi::String>().Utf8Value();
            dsp::adapters::VarianceMode mode = (modeStr == "moving") ? dsp::adapters::VarianceMode::Moving : dsp::adapters::VarianceMode::Batch;

            size_t windowSize = 0;
            if (mode == dsp::adapters::VarianceMode::Moving)
            {
                if (!params.Has("windowSize"))
                {
                    throw std::invalid_argument("Variance: 'windowSize' is required for 'moving' mode");
                }
                windowSize = params.Get("windowSize").As<Napi::Number>().Uint32Value();
            }

            return std::make_unique<dsp::adapters::VarianceStage>(mode, windowSize);
        };

        // Factory for zScoreNormalize stage
        m_stageFactories["zScoreNormalize"] = [](const Napi::Object &params)
        {
            std::string modeStr = params.Get("mode").As<Napi::String>().Utf8Value();
            dsp::adapters::ZScoreNormalizeMode mode = (modeStr == "moving") ? dsp::adapters::ZScoreNormalizeMode::Moving : dsp::adapters::ZScoreNormalizeMode::Batch;

            size_t windowSize = 0;
            if (mode == dsp::adapters::ZScoreNormalizeMode::Moving)
            {
                if (!params.Has("windowSize"))
                {
                    throw std::invalid_argument("ZScoreNormalize: 'windowSize' is required for 'moving' mode");
                }
                windowSize = params.Get("windowSize").As<Napi::Number>().Uint32Value();
            }

            // Get optional epsilon, default to 1e-6
            float epsilon = 1e-6f;
            if (params.Has("epsilon"))
            {
                epsilon = params.Get("epsilon").As<Napi::Number>().FloatValue();
            }

            return std::make_unique<dsp::adapters::ZScoreNormalizeStage>(mode, windowSize, epsilon);
        };

        // Factory for Mean Absolute Value stage
        m_stageFactories["meanAbsoluteValue"] = [](const Napi::Object &params)
        {
            std::string modeStr = params.Get("mode").As<Napi::String>().Utf8Value();
            dsp::adapters::MavMode mode = (modeStr == "moving") ? dsp::adapters::MavMode::Moving : dsp::adapters::MavMode::Batch;

            size_t windowSize = 0;
            if (mode == dsp::adapters::MavMode::Moving)
            {
                if (!params.Has("windowSize"))
                {
                    throw std::invalid_argument("MeanAbsoluteValue: 'windowSize' is required for 'moving' mode");
                }
                windowSize = params.Get("windowSize").As<Napi::Number>().Uint32Value();
            }

            return std::make_unique<dsp::adapters::MeanAbsoluteValueStage>(mode, windowSize);
        };
    }

    /**
     * This is the "Factory" method.
     * TS calls: native.addStage("movingAverage", { windowSize: 100 })
     */
    Napi::Value DspPipeline::AddStage(const Napi::CallbackInfo &info)
    {
        Napi::Env env = info.Env();

        // 1. Get arguments from TypeScript
        std::string stageName = info[0].As<Napi::String>();
        Napi::Object params = info[1].As<Napi::Object>();

        // 2. Look up the stage factory in the map
        auto it = m_stageFactories.find(stageName);
        if (it != m_stageFactories.end())
        {
            try
            {
                // Factory found - create and add the stage
                m_stages.push_back(it->second(params));
            }
            catch (const std::invalid_argument &e)
            {
                // Validation error in constructor - throw as JavaScript TypeError
                Napi::TypeError::New(env, e.what()).ThrowAsJavaScriptException();
                return env.Undefined();
            }
            catch (const std::exception &e)
            {
                // Other errors - throw as JavaScript Error
                Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
                return env.Undefined();
            }
        }
        else
        {
            // Unknown stage type - throw error
            Napi::TypeError::New(env, "Unknown stage type: " + stageName).ThrowAsJavaScriptException();
        }

        return env.Undefined();
    }

    /**
     * AsyncWorker for processing DSP pipeline in background thread
     */
    class ProcessWorker : public Napi::AsyncWorker
    {
    public:
        ProcessWorker(Napi::Env env,
                      Napi::Promise::Deferred deferred,
                      std::vector<std::unique_ptr<IDspStage>> &stages,
                      float *data,
                      size_t numSamples,
                      int channels,
                      Napi::Reference<Napi::Float32Array> &&bufferRef)
            : Napi::AsyncWorker(env),
              m_deferred(std::move(deferred)),
              m_stages(stages),
              m_data(data),
              m_numSamples(numSamples),
              m_channels(channels),
              m_bufferRef(std::move(bufferRef))
        {
        }

    protected:
        // This runs on a worker thread (not blocking the event loop)
        void Execute() override
        {
            try
            {
                // Process the buffer through all stages
                for (const auto &stage : m_stages)
                {
                    stage->process(m_data, m_numSamples, m_channels);
                }
            }
            catch (const std::exception &e)
            {
                SetError(e.what());
            }
        }

        // This runs on the main thread after Execute() completes
        void OnOK() override
        {
            Napi::Env env = Env();
            // Resolve the promise with the processed buffer
            Napi::Float32Array buffer = m_bufferRef.Value();
            m_deferred.Resolve(buffer);
        }

        void OnError(const Napi::Error &error) override
        {
            m_deferred.Reject(error.Value());
        }

    private:
        Napi::Promise::Deferred m_deferred;
        std::vector<std::unique_ptr<IDspStage>> &m_stages;
        float *m_data;
        size_t m_numSamples;
        int m_channels;
        Napi::Reference<Napi::Float32Array> m_bufferRef;
    };

    /**
     * This is the "Process" method.
     * TS calls: await native.process(buffer, { sampleRate: 2000, channels: 4 })
     * Returns a Promise that resolves when processing is complete.
     */
    Napi::Value DspPipeline::ProcessAsync(const Napi::CallbackInfo &info)
    {
        Napi::Env env = info.Env();

        // 1. Get buffer from TypeScript (zero-copy)
        Napi::Float32Array jsBuffer = info[0].As<Napi::Float32Array>();
        float *data = jsBuffer.Data();
        size_t numSamples = jsBuffer.ElementLength();

        // 2. Get options
        Napi::Object options = info[1].As<Napi::Object>();
        int channels = options.Get("channels").As<Napi::Number>().Uint32Value();
        // int sampleRate = options.Get("sampleRate").As<Napi::Number>().Uint32Value();

        // 3. Create a deferred promise and get the promise before moving
        Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
        Napi::Promise promise = deferred.Promise();

        // 4. Create a reference to the buffer to keep it alive during async operation
        Napi::Reference<Napi::Float32Array> bufferRef = Napi::Reference<Napi::Float32Array>::New(jsBuffer, 1);

        // 5. Create and queue the worker
        ProcessWorker *worker = new ProcessWorker(env, std::move(deferred), m_stages, data, numSamples, channels, std::move(bufferRef));
        worker->Queue();

        // 6. Return the promise immediately
        return promise;
    }

    /**
     * Save current pipeline state as JSON string
     * TypeScript will handle storing this in Redis
     *
     * Returns: JSON string with pipeline configuration and stage states
     */
    Napi::Value DspPipeline::SaveState(const Napi::CallbackInfo &info)
    {
        Napi::Env env = info.Env();
        Napi::Object stateObj = Napi::Object::New(env);

        // Save timestamp
        stateObj.Set("timestamp", static_cast<double>(std::time(nullptr)));

        // Save pipeline configuration and full state
        Napi::Array stagesArray = Napi::Array::New(env, m_stages.size());

        for (size_t i = 0; i < m_stages.size(); ++i)
        {
            Napi::Object stageConfig = Napi::Object::New(env);

            stageConfig.Set("index", static_cast<uint32_t>(i));
            stageConfig.Set("type", m_stages[i]->getType());

            // Serialize the stage's internal state
            stageConfig.Set("state", m_stages[i]->serializeState(env));

            stagesArray.Set(static_cast<uint32_t>(i), stageConfig);
        }

        stateObj.Set("stages", stagesArray);
        stateObj.Set("stageCount", static_cast<uint32_t>(m_stages.size()));

        // Convert to JSON string using JavaScript's JSON.stringify
        Napi::Object JSON = env.Global().Get("JSON").As<Napi::Object>();
        Napi::Function stringify = JSON.Get("stringify").As<Napi::Function>();
        return stringify.Call(JSON, {stateObj});
    }

    /**
     * Load pipeline state from JSON string
     * TypeScript retrieves this from Redis and passes it here
     *
     * Accepts: JSON string with pipeline configuration
     */
    Napi::Value DspPipeline::LoadState(const Napi::CallbackInfo &info)
    {
        Napi::Env env = info.Env();

        // Validate input
        if (info.Length() < 1 || !info[0].IsString())
        {
            Napi::TypeError::New(env, "Expected state JSON string as first argument")
                .ThrowAsJavaScriptException();
            return env.Undefined();
        }

        std::string stateJson = info[0].As<Napi::String>().Utf8Value();

        try
        {
            // Parse JSON string using JavaScript's JSON.parse
            Napi::Object JSON = env.Global().Get("JSON").As<Napi::Object>();
            Napi::Function parse = JSON.Get("parse").As<Napi::Function>();
            Napi::Object stateObj = parse.Call(JSON, {Napi::String::New(env, stateJson)}).As<Napi::Object>();

            // Validate state object has required fields
            if (!stateObj.Has("stages"))
            {
                Napi::Error::New(env, "Invalid state: missing 'stages' field")
                    .ThrowAsJavaScriptException();
                return Napi::Boolean::New(env, false);
            }

            // Get stages array
            Napi::Array stagesArray = stateObj.Get("stages").As<Napi::Array>();
            uint32_t stageCount = stagesArray.Length();

            // Validate stage count matches
            if (stageCount != m_stages.size())
            {
                Napi::Error::New(env, "Stage count mismatch: expected " +
                                          std::to_string(m_stages.size()) + " but got " + std::to_string(stageCount))
                    .ThrowAsJavaScriptException();
                return Napi::Boolean::New(env, false);
            }

            // Log restoration
            std::cout << "Restoring pipeline state with " << stageCount << " stages" << std::endl;

            // Restore each stage's state
            for (uint32_t i = 0; i < stageCount; ++i)
            {
                Napi::Object stageConfig = stagesArray.Get(i).As<Napi::Object>();
                if (stageConfig.Has("state"))
                {
                    Napi::Object stageState = stageConfig.Get("state").As<Napi::Object>();
                    m_stages[i]->deserializeState(stageState);
                }
            }

            std::cout << "State restoration complete!" << std::endl;

            return Napi::Boolean::New(env, true);
        }
        catch (const std::exception &e)
        {
            Napi::Error::New(env, std::string("Failed to load state: ") + e.what())
                .ThrowAsJavaScriptException();
            return Napi::Boolean::New(env, false);
        }
    }

    /**
     * Clear all pipeline state (reset all stages)
     * This resets filters to their initial state without removing them
     */
    Napi::Value DspPipeline::ClearState(const Napi::CallbackInfo &info)
    {
        Napi::Env env = info.Env();

        // Reset all stages
        for (auto &stage : m_stages)
        {
            stage->reset();
        }

        std::cout << "Pipeline state cleared (" << m_stages.size() << " stages reset)" << std::endl;

        return env.Undefined();
    }

    /**
     * List current pipeline state (summary information)
     * Returns a simplified view of the pipeline configuration
     * Useful for debugging and monitoring without parsing full JSON
     *
     * Returns: Object with pipeline summary (stage count, types, window sizes, etc.)
     */
    Napi::Value DspPipeline::ListState(const Napi::CallbackInfo &info)
    {
        Napi::Env env = info.Env();
        Napi::Object summary = Napi::Object::New(env);

        // Basic pipeline info
        summary.Set("stageCount", static_cast<uint32_t>(m_stages.size()));
        summary.Set("timestamp", static_cast<double>(std::time(nullptr)));

        // Create array of stage summaries
        Napi::Array stagesArray = Napi::Array::New(env, m_stages.size());

        for (size_t i = 0; i < m_stages.size(); ++i)
        {
            Napi::Object stageSummary = Napi::Object::New(env);

            // Basic stage info
            stageSummary.Set("index", static_cast<uint32_t>(i));
            stageSummary.Set("type", m_stages[i]->getType());

            // Get full state to extract key info
            Napi::Object fullState = m_stages[i]->serializeState(env);

            // Extract common fields (windowSize, numChannels, mode)
            if (fullState.Has("windowSize"))
            {
                stageSummary.Set("windowSize", fullState.Get("windowSize"));
            }

            if (fullState.Has("numChannels"))
            {
                stageSummary.Set("numChannels", fullState.Get("numChannels"));
            }

            if (fullState.Has("mode"))
            {
                stageSummary.Set("mode", fullState.Get("mode"));
            }

            // Add buffer occupancy info for stateful filters
            if (fullState.Has("channels"))
            {
                Napi::Array channels = fullState.Get("channels").As<Napi::Array>();
                if (channels.Length() > 0)
                {
                    Napi::Object firstChannel = channels.Get(uint32_t(0)).As<Napi::Object>();
                    if (firstChannel.Has("buffer"))
                    {
                        Napi::Array buffer = firstChannel.Get("buffer").As<Napi::Array>();
                        stageSummary.Set("bufferSize", buffer.Length());
                    }
                }
                stageSummary.Set("channelCount", channels.Length());
            }

            stagesArray.Set(static_cast<uint32_t>(i), stageSummary);
        }

        summary.Set("stages", stagesArray);

        return summary;
    }

} // namespace dsp

// This function is called by Node.js when the addon is loaded
Napi::Object InitAll(Napi::Env env, Napi::Object exports)
{
    // It initializes and exports your *one* DspPipeline class
    return dsp::DspPipeline::Init(env, exports);
}

// This line registers the module
NODE_API_MODULE(dsp_addon, InitAll)