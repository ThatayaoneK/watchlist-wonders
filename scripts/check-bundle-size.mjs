import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const DIST_ASSETS_DIR = join(process.cwd(), "dist", "assets");
const BUDGET_BYTES = 950 * 1024;

const assetFiles = readdirSync(DIST_ASSETS_DIR)
  .filter((name) => name.endsWith(".js"))
  .map((name) => {
    const fullPath = join(DIST_ASSETS_DIR, name);
    return { name, size: statSync(fullPath).size };
  });

if (assetFiles.length === 0) {
  throw new Error("No JS bundle files found under dist/assets.");
}

const largest = assetFiles.reduce((max, file) => (file.size > max.size ? file : max));

if (largest.size > BUDGET_BYTES) {
  const mb = (largest.size / (1024 * 1024)).toFixed(2);
  const budgetMb = (BUDGET_BYTES / (1024 * 1024)).toFixed(2);
  throw new Error(
    `Largest JS bundle "${largest.name}" is ${mb} MB, exceeding budget ${budgetMb} MB.`,
  );
}

console.log(
  `Bundle budget check passed. Largest JS bundle "${largest.name}" is ${(largest.size / 1024).toFixed(1)} KB.`,
);
