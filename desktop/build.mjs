import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const desktop = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(desktop, "..");
const appDir = path.join(desktop, "app");

const rob = (src, dst) => {
  const r = spawnSync("robocopy", [src, dst, "/E", "/NJH", "/NJS", "/NFL", "/NDL"], { stdio: "inherit" });
  if (r.status != null && r.status > 7) {
    throw new Error(`robocopy failed with status ${r.status}`);
  }
};

fs.rmSync(appDir, { recursive: true, force: true });
fs.mkdirSync(path.join(appDir, "server"), { recursive: true });
fs.mkdirSync(path.join(appDir, "client"), { recursive: true });

rob(path.join(root, "server", "dist"), path.join(appDir, "server"));
rob(path.join(root, "server", "node_modules"), path.join(appDir, "server", "node_modules"));

for (const d of [
  "@types",
  ".bin",
  "typescript",
  "prettier",
  "eslint",
  "esbuild",
  "tsx",
  "undici-types",
  "ts-node",
]) {
  fs.rmSync(path.join(appDir, "server", "node_modules", d), { recursive: true, force: true });
}

rob(path.join(root, "client", "dist"), path.join(appDir, "client", "dist"));

console.log(`bundled → ${appDir}`);