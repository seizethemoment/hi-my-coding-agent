import "dotenv/config";

import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { handleSlashCommand, startRepl } from "./cli.js";
import {
  type ChatCompletionClient,
  type ChatCompletionRequest,
  type ChatCompletionResponse,
  OpenAICompatibleClient,
  createInitialMessages,
  runAgentTurn,
} from "./core.js";

function loadConfig() {
  const apiKey = process.env.CODING_AGENT_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing required env: CODING_AGENT_API_KEY");
  }
  return {
    apiKey,
    baseURL:
      process.env.CODING_AGENT_BASE_URL?.trim() ??
      "https://coding.dashscope.aliyuncs.com/v1",
    model: process.env.CODING_AGENT_MODEL?.trim() ?? "qwen3.6-plus",
    workdir: path.resolve(process.env.CODING_AGENT_WORKDIR?.trim() || "."),
  };
}

async function runVerify(): Promise<void> {
  const workdir = await mkdtemp(path.join(os.tmpdir(), "step-05-cli-"));
  let requestCount = 0;
  const fakeClient: ChatCompletionClient = {
    async createChatCompletion(
      request: ChatCompletionRequest,
    ): Promise<ChatCompletionResponse> {
      requestCount += 1;
      if (requestCount === 1) {
        return {
          id: "mock_1",
          object: "chat.completion",
          created: 1,
          model: request.model,
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: null,
                tool_calls: [
                  {
                    id: "call_1",
                    type: "function",
                    function: {
                      name: "write_file",
                      arguments: JSON.stringify({ path: "hello.txt", content: "hello cli" }),
                    },
                  },
                ],
              },
              finish_reason: "tool_calls",
            },
          ],
        };
      }
      return {
        id: "mock_2",
        object: "chat.completion",
        created: 2,
        model: request.model,
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "CLI task completed." },
            finish_reason: "stop",
          },
        ],
      };
    },
  };

  const messages = createInitialMessages();
  const result = await runAgentTurn({
    client: fakeClient,
    model: "mock-model",
    workdir,
    prompt: "Create hello.txt",
    messages,
  });

  assert.equal(result.finalText, "CLI task completed.");
  assert.equal(await readFile(path.join(workdir, "hello.txt"), "utf8"), "hello cli");
  assert.equal(handleSlashCommand("/model", { model: "mock-model", resetMessages() {} }), "continue");
  assert.equal(handleSlashCommand("/quit", { model: "mock-model", resetMessages() {} }), "exit");
  console.log("Step 05 verify passed.");
}

const [command = "chat"] = process.argv.slice(2);

try {
  if (command === "verify") {
    await runVerify();
  } else if (command === "chat") {
    const config = loadConfig();
    await startRepl({
      client: new OpenAICompatibleClient({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
      }),
      model: config.model,
      workdir: config.workdir,
    });
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Step 05 failed: ${message}`);
  process.exitCode = 1;
}
