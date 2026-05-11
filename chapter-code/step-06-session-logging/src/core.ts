import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { SessionStore } from "./session.js";

export type ChatToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type ChatMessage =
  | {
      role: "system" | "user";
      content: string;
    }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: ChatToolCall[];
    }
  | {
      role: "tool";
      content: string;
      tool_call_id: string;
    };

export type ChatCompletionRequest = {
  model: string;
  messages: ChatMessage[];
  tools: ToolDefinition[];
  tool_choice: "auto";
};

export type ChatCompletionResponse = {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: Extract<ChatMessage, { role: "assistant" }>;
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type ChatCompletionClient = {
  createChatCompletion(
    request: ChatCompletionRequest,
  ): Promise<ChatCompletionResponse>;
};

export type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type AgentEvent =
  | {
      type: "round_start";
      round: number;
    }
  | {
      type: "tool_call";
      round: number;
      name: string;
      arguments: string;
    }
  | {
      type: "tool_result";
      round: number;
      ok: boolean;
      output: string;
    };

export class OpenAICompatibleClient implements ChatCompletionClient {
  constructor(
    private readonly options: {
      apiKey: string;
      baseURL: string;
    },
  ) {}

  async createChatCompletion(
    request: ChatCompletionRequest,
  ): Promise<ChatCompletionResponse> {
    const response = await fetch(
      `${this.options.baseURL.replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      },
    );

    if (!response.ok) {
      throw new Error(`LLM request failed: ${response.status} ${await response.text()}`);
    }

    return (await response.json()) as ChatCompletionResponse;
  }
}

export function createInitialMessages(): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        "You are a local coding agent. Use tools to inspect files, write files, and run shell commands.",
    },
  ];
}

export async function runAgentTurn(options: {
  client: ChatCompletionClient;
  model: string;
  workdir: string;
  prompt: string;
  messages: ChatMessage[];
  sessionStore?: SessionStore;
  maxRounds?: number;
  onEvent?: (event: AgentEvent) => void;
}): Promise<{ finalText: string; rounds: number }> {
  options.messages.push({ role: "user", content: options.prompt });
  await options.sessionStore?.logUserMessage(options.prompt);
  const maxRounds = options.maxRounds ?? 8;

  for (let round = 1; round <= maxRounds; round += 1) {
    options.onEvent?.({ type: "round_start", round });
    const request: ChatCompletionRequest = {
      model: options.model,
      messages: options.messages,
      tools: toolDefinitions,
      tool_choice: "auto",
    };
    await options.sessionStore?.logRequestStart(round, request);
    const response = await options.client.createChatCompletion(request);
    await options.sessionStore?.logRequestEnd(round, response);

    const assistant = response.choices[0]?.message;
    if (!assistant) {
      throw new Error("Model response did not include an assistant message.");
    }

    options.messages.push(assistant);
    await options.sessionStore?.logAssistantMessage(round, assistant);

    const toolCalls = assistant.tool_calls ?? [];
    if (toolCalls.length === 0) {
      return { finalText: assistant.content ?? "", rounds: round };
    }

    for (const toolCall of toolCalls) {
      await options.sessionStore?.logToolCall(round, toolCall);
      options.onEvent?.({
        type: "tool_call",
        round,
        name: toolCall.function.name,
        arguments: toolCall.function.arguments,
      });
      const parsed = parseToolArguments(toolCall.function.arguments);
      const result = parsed.ok
        ? await executeTool(toolCall.function.name, parsed.value, options.workdir)
        : { ok: false, output: parsed.output };
      options.messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify({
          tool: toolCall.function.name,
          ok: result.ok,
          output: result.output,
        }),
      });
      await options.sessionStore?.logToolResult(round, toolCall, result);
      options.onEvent?.({
        type: "tool_result",
        round,
        ok: result.ok,
        output: result.output,
      });
    }
  }

  throw new Error(`Agent loop exceeded max rounds: ${maxRounds}`);
}

export const toolDefinitions: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read a UTF-8 text file from the workspace.",
      parameters: { type: "object", properties: { path: { type: "string" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Create or overwrite a UTF-8 text file in the workspace.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bash",
      description: "Run a shell command inside the workspace.",
      parameters: { type: "object", properties: { command: { type: "string" } } },
    },
  },
];

async function executeTool(
  name: string,
  input: unknown,
  workdir: string,
): Promise<{ ok: boolean; output: string }> {
  try {
    const record = asObject(input);
    if (name === "read_file") {
      return {
        ok: true,
        output: await readFile(resolveWorkspacePath(workdir, requireString(record.path, "path")), "utf8"),
      };
    }
    if (name === "write_file") {
      const absolutePath = resolveWorkspacePath(workdir, requireString(record.path, "path"));
      const content = requireString(record.content, "content");
      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, content, "utf8");
      return { ok: true, output: `Wrote ${content.length} characters.` };
    }
    if (name === "bash") {
      const command = requireString(record.command, "command");
      if (command.toLowerCase().includes("rm -rf /")) {
        return { ok: false, output: "Error: Command blocked by safety policy." };
      }
      return await runCommand(command, workdir);
    }
    return { ok: false, output: `Error: Unknown tool: ${name}` };
  } catch (error) {
    return {
      ok: false,
      output: error instanceof Error ? `Error: ${error.message}` : "Error: Unknown tool failure",
    };
  }
}

function resolveWorkspacePath(workdir: string, candidatePath: string): string {
  const absoluteWorkdir = path.resolve(workdir);
  const resolvedPath = path.resolve(absoluteWorkdir, candidatePath);
  const relativePath = path.relative(absoluteWorkdir, resolvedPath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Path escapes workspace: ${candidatePath}`);
  }
  return resolvedPath;
}

async function runCommand(command: string, workdir: string): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd: workdir,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk: Buffer | string) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      output += chunk.toString();
    });
    child.on("close", (code) => {
      resolve({ ok: code === 0, output: output.trim() || "(no output)" });
    });
  });
}

function parseToolArguments(
  raw: string,
): { ok: true; value: unknown } | { ok: false; output: string } {
  try {
    return { ok: true, value: raw.trim() ? JSON.parse(raw) : {} };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown JSON error";
    return { ok: false, output: `Error: Tool arguments were not valid JSON: ${message}` };
  }
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Tool input must be a JSON object.");
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Tool input requires a non-empty string field: ${field}`);
  }
  return value;
}
