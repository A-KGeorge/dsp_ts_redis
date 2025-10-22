{
  "targets": [
    {
      "target_name": "dsp-js-native",
      "sources": [
        "src/native/DspPipeline.cc",
        "src/native/core/MovingAverageFilter.cc",
        "src/native/utils/CircularBufferArray.cc",
        "src/native/utils/CircularBufferVector.cc"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "src/native",
        "src/native/core",
        "src/native/utils",
        "src/native/adapters"
      ],
      "defines": [
        "NAPI_VERSION=10"
      ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "cflags_cc": [ "-std=c++17" ],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": 1,
          "AdditionalOptions": [ "/std:c++17" ]
        }
      },
      "xcode_settings": {
        "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
        "CLANG_CXX_LIBRARY": "libc++",
        "MACOSX_DEPLOYMENT_TARGET": "10.15",
        "OTHER_CPLUSPLUSFLAGS": [ "-std=c++17", "-stdlib=libc++" ]
      },
      "conditions": [
        ["OS=='win'", {
          "defines": [ "_HAS_EXCEPTIONS=1" ]
        }]
      ]
    }
  ]
}
