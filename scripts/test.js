import { readdirSync } from "fs";
import { join } from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const testDir = join(__dirname, "../src/ts/__tests__");

// Get all test files
const testFiles = readdirSync(testDir)
  .filter((file) => file.endsWith(".test.ts"))
  .map((file) => join(testDir, file));

// Run node test runner with all test files
const args = ["--import", "tsx", "--test", ...testFiles];
const child = spawn("node", args, {
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code) => {
  process.exit(code);
});
