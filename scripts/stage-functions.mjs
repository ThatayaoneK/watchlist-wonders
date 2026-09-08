import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
const root = resolve(import.meta.dirname, "..");
const stage = resolve(root, ".firebase/functions-stage");
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Run through npm run stage:functions");
const npm = (...args) => execFileSync(process.execPath, [npmCli, ...args], { cwd: root, stdio: "inherit" });
npm("run", "build:shared");
npm("--workspace", "functions", "run", "build");
await mkdir(stage, { recursive: true });
await cp(resolve(root, "functions/lib"), resolve(stage, "lib"), { recursive: true });
await cp(resolve(root, "packages/shared/dist"), resolve(stage, "shared/dist"), { recursive: true });
await cp(resolve(root, "packages/shared/package.json"), resolve(stage, "shared/package.json"));
for (const name of await readdir(resolve(root, "functions"))) {
  if (/^\.env(?:\.[\w-]+)?$/.test(name) && name !== ".env.local") {
    await cp(resolve(root, "functions", name), resolve(stage, name));
  }
}
const pkg = JSON.parse(await readFile(resolve(root, "functions/package.json"), "utf8"));
pkg.dependencies["@watchmarks/shared"] = "file:./shared";
delete pkg.scripts;
await writeFile(resolve(stage, "package.json"), JSON.stringify(pkg, null, 2));
console.log("Staged compiled Functions and shared runtime at .firebase/functions-stage");


