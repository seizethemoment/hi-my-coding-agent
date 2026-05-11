import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const binExt = process.platform === "win32" ? ".cmd" : "";
const tscBin = path.join(rootDir, "node_modules", ".bin", `tsc${binExt}`);
const tsxBin = path.join(rootDir, "node_modules", ".bin", `tsx${binExt}`);

const chapters = [
  "step-01-bootstrap",
  "step-02-llm-client",
  "step-03-tool-system",
  "step-04-agent-loop",
  "step-05-cli",
  "step-06-session-logging",
];

for (const chapter of chapters) {
  const chapterDir = path.join(rootDir, "chapter-code", chapter);
  await run(`${chapter} build`, tscBin, ["-p", path.join(chapterDir, "tsconfig.json")]);
  await run(`${chapter} verify`, tsxBin, [path.join(chapterDir, "src", "index.ts"), "verify"]);
}

console.log("All chapter code checks passed.");

function run(label, command, args) {
  return new Promise((resolve, reject) => {
    console.log(`\n==> ${label}`);
    const child = spawn(command, args, {
      cwd: rootDir,
      env: {
        ...process.env,
        FORCE_COLOR: "0",
      },
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${label} failed with exit code ${code}`));
    });
  });
}
