import { runAgentLoop } from "./agent/agentLoop.js";
import { startRepl } from "./cli/repl.js";
import { loadConfig } from "./config/env.js";
import { OpenAICompatibleClient } from "./llm/client.js";
import type { ChatCompletionRequest } from "./llm/protocol.js";
import { SessionStore } from "./storage/sessionStore.js";
import { executeTool, toolDefinitions } from "./tools/index.js";

function printBanner(): void {
  console.log("");
  console.log("========================================");
  console.log("  hi-my-coding-agent");
  console.log("  Step 06: session logging");
  console.log("========================================");
  console.log("");
}

async function main(): Promise<void> {
  const config = loadConfig();
  const [command, ...restArgs] = process.argv.slice(2);

  printBanner();
  console.log("LLM, tool, agent-loop, CLI, and session logging are ready.");
  console.log("");
  console.log(`baseURL : ${config.baseURL}`);
  console.log(`model   : ${config.model}`);
  console.log(`workdir : ${config.workdir}`);
  console.log(`apiKey  : ${maskSecret(config.apiKey)}`);

  const client = new OpenAICompatibleClient({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });

  if (!command) {
    const sessionStore = await SessionStore.create({
      workdir: config.workdir,
      model: config.model,
      baseURL: config.baseURL,
      mode: "interactive",
    });
    await startRepl({
      client,
      model: config.model,
      workdir: config.workdir,
      sessionStore,
    });
    return;
  }

  const prompt = restArgs.join(" ").trim() || "你是谁？";

  switch (command) {
    case "ping":
      await runPing(client, buildSimpleRequest(config.model, prompt));
      return;
    case "ping-stream":
      await runPingStream(client, buildSimpleRequest(config.model, prompt));
      return;
    case "tool-list":
      runToolList();
      return;
    case "tool-run":
      await runToolCommand(config.workdir, restArgs);
      return;
    case "agent-once":
      await runAgentOnce(
        client,
        config.model,
        config.baseURL,
        config.workdir,
        prompt,
      );
      return;
    case "chat":
      {
        const sessionStore = await SessionStore.create({
          workdir: config.workdir,
          model: config.model,
          baseURL: config.baseURL,
          mode: "interactive",
        });
        await startRepl({
          client,
          model: config.model,
          workdir: config.workdir,
          sessionStore,
        });
      }
      return;
    default:
      throw new Error(
        "Unknown command: " +
          `${command}. Supported commands: chat, ping, ping-stream, tool-list, tool-run, agent-once`,
      );
  }
}

function maskSecret(value: string): string {
  if (value.length <= 8) {
    return "*".repeat(value.length);
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function buildSimpleRequest(
  model: string,
  prompt: string,
): ChatCompletionRequest {
  return {
    model,
    messages: [
      {
        role: "system",
        content: "You are a concise coding assistant.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  };
}

async function runPing(
  client: OpenAICompatibleClient,
  request: ChatCompletionRequest,
): Promise<void> {
  console.log("");
  console.log("Running non-streaming chat completion...");
  console.log("");

  const response = await client.createChatCompletion(request);
  const message = response.choices[0]?.message;

  console.log("assistant:");
  console.log(message?.content ?? "(no content)");

  if (message?.tool_calls?.length) {
    console.log("");
    console.log("tool_calls:");
    console.log(JSON.stringify(message.tool_calls, null, 2));
  }

  if (response.usage) {
    console.log("");
    console.log("usage:");
    console.log(JSON.stringify(response.usage, null, 2));
  }
}

async function runPingStream(
  client: OpenAICompatibleClient,
  request: ChatCompletionRequest,
): Promise<void> {
  console.log("");
  console.log("Running streaming chat completion...");
  console.log("");
  process.stdout.write("assistant:\n");

  for await (const event of client.streamChatCompletion(request)) {
    switch (event.type) {
      case "text_delta":
        process.stdout.write(event.delta);
        break;
      case "tool_call_delta":
        process.stdout.write(
          `\n[tool_call_delta choice=${event.choiceIndex} tool=${event.toolCallIndex}] ${JSON.stringify(event.delta)}\n`,
        );
        break;
      case "usage":
        process.stdout.write(
          `\n\nusage:\n${JSON.stringify(event.usage, null, 2)}\n`,
        );
        break;
      case "finish":
        process.stdout.write(`\n\nfinish_reason: ${event.finishReason}\n`);
        break;
      case "reasoning_delta":
      case "chunk":
      case "done":
        break;
      default:
        assertNever(event);
    }
  }
}

function runToolList(): void {
  console.log("");
  console.log("Available tools:");
  for (const definition of toolDefinitions) {
    console.log(`- ${definition.function.name}: ${definition.function.description ?? ""}`);
  }
}

async function runToolCommand(workdir: string, args: string[]): Promise<void> {
  const [toolName, ...rawInputParts] = args;

  if (!toolName) {
    throw new Error(
      'tool-run requires a tool name. Example: npm run dev -- tool-run read_file \'{"path":"README.md"}\'',
    );
  }

  const rawInput = rawInputParts.join(" ").trim();
  const parsedInput = rawInput ? parseJsonInput(rawInput) : {};
  const result = await executeTool(toolName, parsedInput, { workdir });

  console.log("");
  console.log(`tool   : ${toolName}`);
  console.log(`ok     : ${result.ok}`);
  console.log("output :");
  console.log(result.output);

  if (result.metadata) {
    console.log("");
    console.log("metadata:");
    console.log(JSON.stringify(result.metadata, null, 2));
  }
}

async function runAgentOnce(
  client: OpenAICompatibleClient,
  model: string,
  baseURL: string,
  workdir: string,
  prompt: string,
): Promise<void> {
  console.log("");
  console.log("Running agent loop...");
  const sessionStore = await SessionStore.create({
    workdir,
    model,
    baseURL,
    mode: "agent-once",
  });
  console.log(`Session log: ${sessionStore.filePath}`);

  try {
    const result = await runAgentLoop({
      client,
      model,
      workdir,
      prompt,
      sessionStore,
      onEvent(event) {
        switch (event.type) {
          case "round_start":
            console.log("");
            console.log(`round  : ${event.round}`);
            break;
          case "assistant_message":
            if (event.message.tool_calls?.length) {
              console.log(
                `assistant requested ${event.message.tool_calls.length} tool call(s)`,
              );
            }
            break;
          case "tool_call":
            console.log(
              `tool    : ${event.toolCall.function.name} ${event.toolCall.function.arguments}`,
            );
            break;
          case "tool_result":
            console.log(`ok      : ${event.result.ok}`);
            console.log(`result  : ${truncateForTerminal(event.result.output)}`);
            break;
          default:
            assertNever(event);
        }
      },
    });

    console.log("");
    console.log("assistant:");
    console.log(result.finalText || "(no content)");
    console.log("");
    console.log(`rounds  : ${result.rounds}`);
    await sessionStore.close("completed");
  } catch (error) {
    await sessionStore.close("error");
    throw error;
  }
}

function parseJsonInput(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown JSON parse error";
    throw new Error(`Failed to parse tool JSON input: ${reason}`);
  }
}

function truncateForTerminal(value: string, limit = 240): string {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit)}...`;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled event: ${JSON.stringify(value)}`);
}

try {
  await main();
} catch (error) {
  const message =
    error instanceof Error ? error.message : "Unknown startup error";

  console.error(`Startup failed: ${message}`);
  process.exitCode = 1;
}
