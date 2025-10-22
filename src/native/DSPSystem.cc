#include "DSPSystem.h"
#include <iostream>

using namespace Napi;

// -----------------------------------------------------------------------------
// Constructor
// Initializes the DSPSystem object with a name provided from JavaScript
// @ param info - The Napi callback info
// @ return void
// -----------------------------------------------------------------------------
DSPSystem::DSPSystem(const Napi::CallbackInfo &info)
    : Napi::ObjectWrap<DSPSystem>(info)
{
    Napi::Env env = info.Env();

    if (info.Length() < 1)
    {
        Napi::TypeError::New(env, "Name expected").ThrowAsJavaScriptException();
        return;
    }

    if (!info[0].IsString())
    {
        Napi::TypeError::New(env, "Name must be a string").ThrowAsJavaScriptException();
        return;
    }

    this->name = info[0].As<Napi::String>().Utf8Value();
}

// -----------------------------------------------------------------------------
// Static Method: GetClass
// Defines and returns the DSPSystem class for JavaScript
// @ param env - The Napi environment
// @ return Napi::Function - The defined DSPSystem class
// -----------------------------------------------------------------------------
Napi::Function DSPSystem::GetClass(Napi::Env env)
{
    // return DefineClass(env, "DSPSystem",
    //                    {
    //                        DSPSystem::InstanceMethod("greet", &DSPSystem::Greet),
    //                    });
}

// -----------------------------------------------------------------------------
// Module Initialization
// Registers the DSPSystem class and exposes it to Node.js
// @ param env - The Napi environment
// @ param exports - The exports object to attach the class to
// @ return Napi::Object - The modified exports object
// -----------------------------------------------------------------------------
Napi::Object Init(Napi::Env env, Napi::Object exports)
{
    exports.Set("DSPSystem", DSPSystem::GetClass(env));
    return exports;
}

// -----------------------------------------------------------------------------
// Register the module with Node.js runtime
// The first argument must match your target name (from CMakeLists.txt or build)
// -----------------------------------------------------------------------------
NODE_API_MODULE(dsp_js_native, Init)
