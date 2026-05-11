import assert from "node:assert/strict";

import { loadConfig } from "./config/env.js";

function printBanner(): void {
  console.log("");
  console.log("========================================");
  console.log("  Step 01: Bootstrap");
  console.log("========================================");
  console.log("");
}

function maskSecret(value: string): string {
  if (value.length <= 8) {
    return "*".repeat(value.length);
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function runVerify(): void {
  assert.throws(() => loadConfig({}), /CODING_AGENT_API_KEY/);

  const config = loadConfig({
    CODING_AGENT_API_KEY: "sk-test-123456",
    CODING_AGENT_WORKDIR: ".",
  });

  assert.equal(config.baseURL, "https://coding.dashscope.aliyuncs.com/v1");
  assert.equal(config.model, "qwen3.6-plus");
  assert.ok(config.workdir.length > 0);

  console.log("Step 01 verify passed.");
}

function main(): void {
  if (process.argv[2] === "verify") {
    runVerify();
    return;
  }

  const config = loadConfig();
  printBanner();
  console.log("TypeScript CLI skeleton is ready.");
  console.log(`baseURL : ${config.baseURL}`);
  console.log(`model   : ${config.model}`);
  console.log(`workdir : ${config.workdir}`);
  console.log(`apiKey  : ${maskSecret(config.apiKey)}`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Startup failed: ${message}`);
  process.exitCode = 1;
}
