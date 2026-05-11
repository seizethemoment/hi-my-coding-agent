import type {
  AssistantMessage,
  ChatCompletionClient,
  ChatCompletionResponse,
  ChatMessage,
} from "./protocol.js";
import { executeTool, toolDefinitions } from "./tools.js";

const DEFAULT_MAX_ROUNDS = 8;
const DEFAULT_SYSTEM_PROMPT = [
  "You are a local coding agent.",
  "Use tools when you need to inspect files, modify files, or run shell commands.",
  "When a tool fails, inspect the error and try a corrected action.",
].join(" ");

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

export type AgentLoopOptions = {
  client: ChatCompletionClient;
  model: string;
  workdir: string;
  prompt: string;
  maxRounds?: number;
  onEvent?: (event: AgentEvent) => void;
};

export type AgentLoopResult = {
  finalText: string;
  rounds: number;
  response: ChatCompletionResponse;
  messages: ChatMessage[];
};

export async function runAgentLoop(
  options: AgentLoopOptions,
): Promise<AgentLoopResult> {
  const messages: ChatMessage[] = [
    { role: "system", content: DEFAULT_SYSTEM_PROMPT },
    { role: "user", content: options.prompt },
  ];
  const maxRounds = options.maxRounds ?? DEFAULT_MAX_ROUNDS;

  for (let round = 1; round <= maxRounds; round += 1) {
    options.onEvent?.({ type: "round_start", round });

    const response = await options.client.createChatCompletion({
      model: options.model,
      messages,
      tools: toolDefinitions,
      tool_choice: "auto",
    });
    const assistantMessage = getAssistantMessage(response);
    messages.push(assistantMessage);

    const toolCalls = assistantMessage.tool_calls ?? [];
    if (toolCalls.length === 0) {
      return {
        finalText: assistantMessage.content ?? "",
        rounds: round,
        response,
        messages,
      };
    }

    for (const toolCall of toolCalls) {
      options.onEvent?.({
        type: "tool_call",
        round,
        name: toolCall.function.name,
        arguments: toolCall.function.arguments,
      });

      const parsed = parseToolArguments(toolCall.function.arguments);
      const result = parsed.ok
        ? await executeTool(toolCall.function.name, parsed.value, {
            workdir: options.workdir,
          })
        : { ok: false, output: parsed.output };

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify({
          tool: toolCall.function.name,
          ok: result.ok,
          output: result.output,
        }),
      });
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

function getAssistantMessage(response: ChatCompletionResponse): AssistantMessage {
  const message = response.choices[0]?.message;
  if (!message) {
    throw new Error("Model response did not contain an assistant message.");
  }
  return message;
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
