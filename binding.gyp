{
  "targets": [
    {
      "target_name": "dsp-js-native",
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
