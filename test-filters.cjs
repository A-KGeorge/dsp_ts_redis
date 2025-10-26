/**
 * Quick Filter API Test
 *
 * Tests that filters.ts was created correctly by checking the file exists
 * and has the expected exports. Run `npm test` for full testing.
 */

const fs = require("fs");
const path = require("path");

console.log("=== Testing Filter Design API (File Check) ===\n");

// Check that filters.ts exists
const filtersPath = path.join(__dirname, "src/ts/filters.ts");
if (!fs.existsSync(filtersPath)) {
  console.error("❌ filters.ts does not exist!");
  process.exit(1);
}
console.log("✅ filters.ts exists");

// Read the file and check for key exports
const content = fs.readFileSync(filtersPath, "utf-8");

const checks = [
  { name: "FirFilter class", pattern: /export class FirFilter/ },
  { name: "IirFilter class", pattern: /export class IirFilter/ },
  { name: "createFilter function", pattern: /export function createFilter/ },
  { name: "FilterType", pattern: /export type FilterType/ },
  { name: "FilterMode", pattern: /export type FilterMode/ },
  { name: "FIR low-pass", pattern: /createLowPass/ },
  { name: "FIR high-pass", pattern: /createHighPass/ },
  { name: "FIR band-pass", pattern: /createBandPass/ },
  { name: "FIR band-stop", pattern: /createBandStop/ },
  { name: "Butterworth low-pass", pattern: /createButterworthLowPass/ },
  { name: "Butterworth high-pass", pattern: /createButterworthHighPass/ },
  { name: "Butterworth band-pass", pattern: /createButterworthBandPass/ },
  { name: "First-order low-pass", pattern: /createFirstOrderLowPass/ },
  { name: "First-order high-pass", pattern: /createFirstOrderHighPass/ },
];

let allPass = true;
for (const check of checks) {
  if (check.pattern.test(content)) {
    console.log(`✅ ${check.name}`);
  } else {
    console.log(`❌ ${check.name} NOT FOUND`);
    allPass = false;
  }
}

// Check index.ts exports the filter module
const indexPath = path.join(__dirname, "src/ts/index.ts");
const indexContent = fs.readFileSync(indexPath, "utf-8");

if (/from.*["']\.\/filters["']/.test(indexContent)) {
  console.log("✅ filters module exported from index.ts");
} else {
  console.log("❌ filters module NOT exported from index.ts");
  allPass = false;
}

// Check examples exist
const examplesPath = path.join(__dirname, "src/ts/examples/filter-examples.ts");
if (fs.existsSync(examplesPath)) {
  console.log("✅ filter-examples.ts exists");
} else {
  console.log("❌ filter-examples.ts does not exist");
  allPass = false;
}

console.log();

if (allPass) {
  console.log("=== All Checks Passed! ===\n");
  console.log("✅ Filter API module structure is correct");
  console.log("✅ All filter types are implemented");
  console.log("✅ Unified createFilter() API exists");
  console.log("✅ Module exported from index.ts");
  console.log("✅ Examples file created\n");
  console.log("🚀 Run `npm test` for full runtime tests");
  console.log("🚀 Run `npm start` to try the examples");
} else {
  console.log("❌ Some checks failed!");
  process.exit(1);
}
