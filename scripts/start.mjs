import { existsSync } from "node:fs";
import { spawnSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
if (Number(process.versions.node.split(".")[0]) !== 24) {
  console.error("Instale o Node.js 24 LTS para usar o Clareza.");
  process.exit(1);
}
if (!existsSync(new URL("../dist/index.html", import.meta.url))) {
  const built = spawnSync(
    process.execPath,
    ["node_modules/typescript/bin/tsc", "--noEmit"],
    { cwd: root, stdio: "inherit" },
  );
  if (built.status !== 0) process.exit(built.status ?? 1);
  const bundle = spawnSync(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "build"],
    { cwd: root, stdio: "inherit" },
  );
  if (bundle.status !== 0) process.exit(bundle.status ?? 1);
}
const child = spawn(
  process.execPath,
  ["server/index.ts", ...process.argv.slice(2)],
  { cwd: root, stdio: "inherit" },
);
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
