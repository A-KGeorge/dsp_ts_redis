#pragma once

#include <napi.h>

// demo, plan to add functions later
class DSPSystem : public Napi::ObjectWrap<DSPSystem>
{
public:
    // core methods used to create and define the class
    DSPSystem(const Napi::CallbackInfo &info); // Constructor
    static Napi::Function GetClass(Napi::Env env);

    // functions exposed to JavaScript

private:
    std::string name;
};