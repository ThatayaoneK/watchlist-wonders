#!/usr/bin/env node
/**
 * Build-time env validation.
 *
 * Reads .env.example to discover which `VITE_*` keys the build expects, then
 * confirms each REQUIRED key is set in the build environment (process.env or
 * loaded from .env). Fails the build with a clear message rather than letting
 * Vite ship a bundle that throws on first paint.
 *
 * Optional keys (those whose .env.example value contains the word "optional"
 * or that match the OPTIONAL_KEYS list below) are tolerated when missing.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const OPTIONAL_KEYS = new Set([
  "VITE_FIREBASE_MEASUREMENT_ID",
  "VITE_FIREBASE_VAPID_KEY",
  "VITE_SENTRY_DSN",
  "VITE_APP_URL",
]);

function parseEnvFile(path) {
  if (!existsSync(path)) return new Map();
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  const map = new Map();
  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    map.set(key, value);
  }
  return map;
}

const exampleKeys = [...parseEnvFile(resolve(projectRoot, ".env.example")).keys()];
if (exampleKeys.length === 0) {
  console.error("[validate-env] .env.example missing or empty — cannot validate build env.");
  process.exit(1);
}

const envFromFile = parseEnvFile(resolve(projectRoot, ".env"));

const missing = [];
for (const key of exampleKeys) {
  if (OPTIONAL_KEYS.has(key)) continue;
  const value = process.env[key] ?? envFromFile.get(key);
  if (!value || !String(value).trim()) {
    missing.push(key);
  }
}

if (missing.length > 0) {
  console.error("\n[validate-env] Build aborted — missing required environment variables:");
  for (const key of missing) console.error(`  - ${key}`);
  console.error(
    "\nPopulate them in .env (local) or your CI secrets and re-run the build.\n",
  );
  process.exit(1);
}

console.log(`[validate-env] OK — ${exampleKeys.length} key(s) checked (${OPTIONAL_KEYS.size} optional).`);
