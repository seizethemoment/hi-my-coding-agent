import "dotenv/config";

import assert from "node:assert/strict";

import { OpenAICompatibleClient } from "./client.js";
import type { ChatCompletionRequest } from "./protocol.js";

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
  };
}

async function runVerify(): Promise<void> {
  const client = new OpenAICompatibleClient({
    apiKey: "sk-test",
    baseURL: "https://example.test/v1",
    fetchFn: async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as ChatCompletionRequest;
      assert.equal(body.model, "mock-model");

      if (body.stream) {
        return new Response(
          [
            'data: {"choices":[{"delta":{"content":"hello "}}]}',
            "",
            'data: {"choices":[{"delta":{"content":"stream"}}]}',
            "",
            "data: [DONE]",
            "",
          ].join("\n"),
          { status: 200 },
        );
      }

      return Response.json({
        id: "chatcmpl_mock",
        object: "chat.completion",
        created: 1,
        model: body.model,
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
                    name: "read_file",
                    arguments: "{\"path\":\"README.md\"}",
                  },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      });
    },
  });

  const response = await client.createChatCompletion({
    model: "mock-model",
    messages: [{ role: "user", content: "hello" }],
    tools: [
      {
        type: "function",
        function: {
          name: "read_file",
          parameters: { type: "object" },
        },
      },
    ],
  });
  assert.equal(response.choices[0]?.message.tool_calls?.[0]?.function.name, "read_file");
  assert.equal(response.usage?.total_tokens, 15);

  let streamed = "";
  for await (const event of client.streamChatCompletion({
    model: "mock-model",
    messages: [{ role: "user", content: "hello" }],
  })) {
    if (event.type === "text_delta") {
      streamed += event.delta;
    }
  }
  assert.equal(streamed, "hello stream");

  console.log("Step 02 verify passed.");
}

async function runReal(command: string, prompt: string): Promise<void> {
  const config = loadConfig();
  const client = new OpenAICompatibleClient({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });
  const request = {
    model: config.model,
    messages: [{ role: "user" as const, content: prompt }],
  };

  if (command === "stream") {
    for await (const event of client.streamChatCompletion(request)) {
      if (event.type === "text_delta") {
        process.stdout.write(event.delta);
      }
    }
    process.stdout.write("\n");
    return;
  }

  const response = await client.createChatCompletion(request);
  console.log(response.choices[0]?.message.content ?? "(no content)");
}

const [command = "ping", ...promptParts] = process.argv.slice(2);
const prompt = promptParts.join(" ") || "hello";

try {
  if (command === "verify") {
    await runVerify();
  } else {
    await runReal(command, prompt);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Step 02 failed: ${message}`);
  process.exitCode = 1;
}
