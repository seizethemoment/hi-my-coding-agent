import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { executeTool, toolDefinitions } from "./tools.js";

async function runVerify(): Promise<void> {
  const workdir = await mkdtemp(path.join(os.tmpdir(), "step-03-tools-"));

  const writeResult = await executeTool(
    "write_file",
    { path: "hello.txt", content: "hello tools" },
    { workdir },
  );
  assert.equal(writeResult.ok, true);

  const readResult = await executeTool("read_file", { path: "hello.txt" }, { workdir });
  assert.equal(readResult.ok, true);
  assert.equal(readResult.output, "hello tools");

  const bashResult = await executeTool(
    "bash",
    { command: "node -e \"console.log('bash ok')\"" },
    { workdir },
  );
  assert.equal(bashResult.ok, true);
  assert.match(bashResult.output, /bash ok/);

  const escapeResult = await executeTool(
    "read_file",
    { path: "../escape.txt" },
    { workdir },
  );
  assert.equal(escapeResult.ok, false);
  assert.match(escapeResult.output, /escapes workspace/);

  const dangerousResult = await executeTool(
    "bash",
    { command: "rm -rf /" },
    { workdir },
  );
  assert.equal(dangerousResult.ok, false);
  assert.match(dangerousResult.output, /blocked by safety policy/);

  console.log("Step 03 verify passed.");
}

async function runToolList(): Promise<void> {
  for (const definition of toolDefinitions) {
    console.log(`- ${definition.function.name}: ${definition.function.description}`);
  }
}

async function runToolRun(args: string[]): Promise<void> {
  const [toolName, rawJson = "{}"] = args;
  if (!toolName) {
    throw new Error("Usage: tool-run <tool-name> '<json-input>'");
  }

  const input = JSON.parse(rawJson) as unknown;
  const result = await executeTool(toolName, input, { workdir: process.cwd() });
  console.log(JSON.stringify(result, null, 2));
}

const [command = "tool-list", ...args] = process.argv.slice(2);

try {
  if (command === "verify") {
    await runVerify();
  } else if (command === "tool-list") {
    await runToolList();
  } else if (command === "tool-run") {
    await runToolRun(args);
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Step 03 failed: ${message}`);
  process.exitCode = 1;
}
