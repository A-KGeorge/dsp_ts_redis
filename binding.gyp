{
  "targets": [
    {
      "target_name": "dsp-ts-redis",
      "sources": [
        "<!@(node -p \"require('fs').readdirSync('src/native').concat(require('fs').readdirSync('src/native/core').map(f=>'core/'+f), require('fs').readdirSync('src/native/utils').map(f=>'utils/'+f), require('fs').existsSync('src/native/emg') ? require('fs').readdirSync('src/native/emg').map(f=>'emg/'+f) : []).filter(f=>f.endsWith('.cc')).map(f=>'src/native/'+f).join(' ')\")"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "src/native",
        "src/native/core",
        "src/native/utils",
        "src/native/adapters",
        "src/native/emg"
      ],
      "defines": [
        "NAPI_VERSION=8"
      ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "cflags": [ "-O3", "-ffast-math" ],
      "cflags_cc": [ "-std=c++17", "-O3", "-ffast-math" ],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": 1,
          "AdditionalOptions": [ "/std:c++17", "/O2", "/fp:fast", "/arch:AVX2" ],
          "Optimization": 3,
          "FavorSizeOrSpeed": 1,
          "InlineFunctionExpansion": 2
        }
      },
      "xcode_settings": {
        "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
        "CLANG_CXX_LIBRARY": "libc++",
        "MACOSX_DEPLOYMENT_TARGET": "10.15",
        "OTHER_CPLUSPLUSFLAGS": [ "-std=c++17", "-stdlib=libc++", "-O3", "-ffast-math" ],
        "GCC_OPTIMIZATION_LEVEL": "3"
      },
      "conditions": [
        ["OS=='win'", {
          "defines": [ "_HAS_EXCEPTIONS=1" ]
        }]
      ]
    }
  ]
}
