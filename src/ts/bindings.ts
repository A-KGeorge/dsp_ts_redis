import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

export interface DSPSystem {
  greet(name: string): void;
}

interface DSPSystemConstructor {
  new (name: string): DSPSystem;
}

interface NativeModule {
  DSPSystem: DSPSystemConstructor;
}

const native = require("../build/dsp-js-native.node") as NativeModule;

export const DSPSystem = native.DSPSystem;
