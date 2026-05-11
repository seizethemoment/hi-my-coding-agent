import "dotenv/config";

import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { startRepl } from "./cli.js";
import {
  type ChatCompletionClient,
  type ChatCompletionRequest,
  type ChatCompletionResponse,
  OpenAICompatibleClient,
  createInitialMessages,
  runAgentTurn,
} from "./core.js";
import { SessionStore } from "./session.js";

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
  const workdir = await mkdtemp(path.join(os.tmpdir(), "step-06-session-"));
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
                      arguments: JSON.stringify({
                        path: "hello.txt",
                        content: "hello session",
                      }),
                    },
                  },
                ],
              },
              finish_reason: "tool_calls",
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
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
            message: { role: "assistant", content: "Session task completed." },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 20, completion_tokens: 7, total_tokens: 27 },
      };
    },
  };

  const sessionStore = await SessionStore.create({
    workdir,
    model: "mock-model",
    baseURL: "https://example.test/v1",
    mode: "agent-once",
  });
  const result = await runAgentTurn({
    client: fakeClient,
    model: "mock-model",
    workdir,
    prompt: "Create hello.txt",
    messages: createInitialMessages(),
    sessionStore,
  });
  await sessionStore.close("completed");

  assert.equal(result.finalText, "Session task completed.");
  assert.equal(await readFile(path.join(workdir, "hello.txt"), "utf8"), "hello session");

  const records = (await readFile(sessionStore.filePath, "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as { type: string; token_usage?: unknown });
  assert.ok(records.some((record) => record.type === "request_start"));
  assert.ok(records.some((record) => record.type === "tool_call"));
  assert.ok(records.some((record) => record.type === "tool_result"));
  const summary = records.find((record) => record.type === "session_summary") as
    | {
        token_usage?: {
          input_tokens: number;
          output_tokens: number;
          total_tokens: number;
        };
      }
    | undefined;
  assert.equal(summary?.token_usage?.input_tokens, 30);
  assert.equal(summary?.token_usage?.output_tokens, 12);
  assert.equal(summary?.token_usage?.total_tokens, 42);

  console.log("Step 06 verify passed.");
  console.log(`Session log: ${sessionStore.filePath}`);
}

async function runAgentOnce(prompt: string): Promise<void> {
  const config = loadConfig();
  const sessionStore = await SessionStore.create({
    workdir: config.workdir,
    model: config.model,
    baseURL: config.baseURL,
    mode: "agent-once",
  });
  console.log(`Session log: ${sessionStore.filePath}`);

  try {
    const result = await runAgentTurn({
      client: new OpenAICompatibleClient({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
      }),
      model: config.model,
      workdir: config.workdir,
      prompt,
      messages: createInitialMessages(),
      sessionStore,
      onEvent(event) {
        console.log(JSON.stringify(event));
      },
    });
    console.log(result.finalText || "(no content)");
    await sessionStore.close("completed");
  } catch (error) {
    await sessionStore.logError("agent_once", error);
    await sessionStore.close("error");
    throw error;
  }
}

async function runChat(): Promise<void> {
  const config = loadConfig();
  const sessionStore = await SessionStore.create({
    workdir: config.workdir,
    model: config.model,
    baseURL: config.baseURL,
    mode: "interactive",
  });
  await startRepl({
    client: new OpenAICompatibleClient({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    }),
    model: config.model,
    workdir: config.workdir,
    sessionStore,
  });
}

const [command = "chat", ...promptParts] = process.argv.slice(2);
const prompt = promptParts.join(" ") || "请简单介绍你自己";

try {
  if (command === "verify") {
    await runVerify();
  } else if (command === "agent-once") {
    await runAgentOnce(prompt);
  } else if (command === "chat") {
    await runChat();
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Step 06 failed: ${message}`);
  process.exitCode = 1;
}
