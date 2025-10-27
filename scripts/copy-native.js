// Cross-platform copy of dspx.node after node-gyp build
import fs from "fs";
import path from "path";

const src = path.resolve("build/Release/dspx.node");
const dest = path.resolve("src/build/dspx.node");

try {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log("Copied build/Release/dspx.node to src/build/dspx.node");
} catch (err) {
  console.error("Failed to copy dspx.node:", err);
  process.exit(1);
}
