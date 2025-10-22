cmake_minimum_required(VERSION 3.15)
cmake_policy(SET CMP0091 NEW)
cmake_policy(SET CMP0042 NEW)

project (dsp-js-native VERSION 1.0 LANGUAGES C CXX)
set(CMAKE_CXX_STANDARD 17)

add_definitions(-DNAPI_VERSION=10)
include_directories(${CMAKE_JS_INC} "src/native" "src/native/core" "src/native/utils" "src/native/adapters")
file(GLOB_RECURSE SOURCE_FILES "src/native/*.cc" "src/native/*.cpp")

add_library(${PROJECT_NAME} SHARED ${SOURCE_FILES} ${CMAKE_JS_SRC})
set_target_properties(${PROJECT_NAME} PROPERTIES PREFIX "" SUFFIX ".node")
target_link_libraries(${PROJECT_NAME} ${CMAKE_JS_LIB})

if(MSVC AND CMAKE_JS_NODELIB_DEF AND CMAKE_JS_NODELIB_TARGET)
  # Generate node.lib
  execute_process(COMMAND ${CMAKE_AR} /def:${CMAKE_JS_NODELIB_DEF} /out:${CMAKE_JS_NODELIB_TARGET} ${CMAKE_STATIC_LINKER_FLAGS})
endif()

# Copy the built addon to the build directory, so we can require() without
# going into either [build/Release] or [build/Debug] directories.
add_custom_command (TARGET ${PROJECT_NAME} POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E make_directory ${CMAKE_SOURCE_DIR}/src/build
    COMMAND ${CMAKE_COMMAND} -E copy
    $<TARGET_FILE:${PROJECT_NAME}>
    ${CMAKE_SOURCE_DIR}/src/build/${PROJECT_NAME}.node
)