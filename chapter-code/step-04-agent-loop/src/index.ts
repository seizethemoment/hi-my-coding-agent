import "dotenv/config";

import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { runAgentLoop } from "./agent.js";
import { OpenAICompatibleClient } from "./client.js";
import type {
  ChatCompletionClient,
  ChatCompletionRequest,
  ChatCompletionResponse,
} from "./protocol.js";

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
  const workdir = await mkdtemp(path.join(os.tmpdir(), "step-04-agent-"));
  let requestCount = 0;
  const fakeClient: ChatCompletionClient = {
    async createChatCompletion(
      request: ChatCompletionRequest,
    ): Promise<ChatCompletionResponse> {
      requestCount += 1;
      assert.ok(request.tools?.some((tool) => tool.function.name === "write_file"));

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
                      arguments: JSON.stringify({
                        path: "hello.txt",
                        content: "hello agent loop",
                      }),
                    },
                  },
                ],
              },
              finish_reason: "tool_calls",
            },
          ],
        };
      }

      assert.ok(request.messages.some((message) => message.role === "tool"));
      return {
        id: "mock_2",
        object: "chat.completion",
        created: 2,
        model: request.model,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "Created hello.txt.",
            },
            finish_reason: "stop",
          },
        ],
      };
    },
  };

  const result = await runAgentLoop({
    client: fakeClient,
    model: "mock-model",
    workdir,
    prompt: "Create hello.txt",
  });

  assert.equal(result.finalText, "Created hello.txt.");
  assert.equal(await readFile(path.join(workdir, "hello.txt"), "utf8"), "hello agent loop");
  assert.equal(requestCount, 2);
  console.log("Step 04 verify passed.");
}

async function runReal(prompt: string): Promise<void> {
  const config = loadConfig();
  const client = new OpenAICompatibleClient({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });
  const result = await runAgentLoop({
    client,
    model: config.model,
    workdir: config.workdir,
    prompt,
    onEvent(event) {
      console.log(JSON.stringify(event));
    },
  });
  console.log(result.finalText || "(no content)");
}

const [command = "agent-once", ...promptParts] = process.argv.slice(2);
const prompt = promptParts.join(" ") || "请简单介绍你自己";

try {
  if (command === "verify") {
    await runVerify();
  } else if (command === "agent-once") {
    await runReal(prompt);
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Step 04 failed: ${message}`);
  process.exitCode = 1;
}
