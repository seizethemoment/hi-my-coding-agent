import type { OpenAICompatibleClient } from "../llm/client.js";
import type {
  AssistantMessage,
  ChatCompletionResponse,
  ChatToolCall,
} from "../llm/protocol.js";
import type { SessionStore } from "../storage/sessionStore.js";
import { executeTool, toolDefinitions } from "../tools/index.js";
import type { ToolExecutionResult } from "../tools/types.js";
import { MessageState } from "./messageState.js";

const DEFAULT_MAX_ROUNDS = 12;
export const DEFAULT_SYSTEM_PROMPT = [
  "You are a local coding agent.",
  "Use tools when you need to inspect files, modify files, or run shell commands.",
  "Work step by step and prefer acting over guessing.",
  "When a tool fails, inspect the error and try a corrected action.",
].join(" ");

export type AgentLoopEvent =
  | {
      type: "round_start";
      round: number;
    }
  | {
      type: "assistant_message";
      round: number;
      message: AssistantMessage;
    }
  | {
      type: "tool_call";
      round: number;
      toolCall: ChatToolCall;
    }
  | {
      type: "tool_result";
      round: number;
      toolCall: ChatToolCall;
      result: ToolExecutionResult;
    };

export type AgentLoopOptions = {
  client: OpenAICompatibleClient;
  model: string;
  workdir: string;
  prompt: string;
  state?: MessageState;
  sessionStore?: SessionStore;
  systemPrompt?: string;
  maxRounds?: number;
  maxTokens?: number;
  temperature?: number;
  onEvent?: (event: AgentLoopEvent) => void;
};

export type AgentLoopResult = {
  finalText: string;
  rounds: number;
  response: ChatCompletionResponse;
  messages: ReturnType<MessageState["getMessages"]>;
};

export async function runAgentLoop(
  options: AgentLoopOptions,
): Promise<AgentLoopResult> {
  const state =
    options.state ??
    new MessageState(options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT);
  state.appendUserText(options.prompt);
  await options.sessionStore?.logUserMessage(options.prompt);

  const maxRounds = options.maxRounds ?? DEFAULT_MAX_ROUNDS;

  try {
    for (let round = 1; round <= maxRounds; round += 1) {
      options.onEvent?.({
        type: "round_start",
        round,
      });

      const request = {
        model: options.model,
        messages: state.getMessages(),
        tools: toolDefinitions,
        tool_choice: "auto" as const,
        ...(options.maxTokens !== undefined
          ? { max_tokens: options.maxTokens }
          : {}),
        ...(options.temperature !== undefined
          ? { temperature: options.temperature }
          : {}),
      };
      await options.sessionStore?.logRequestStart(round, request);

      const response = await options.client.createChatCompletion(request);
      await options.sessionStore?.logRequestEnd(round, response);

      const assistantMessage = getPrimaryAssistantMessage(response);
      state.appendAssistantMessage(assistantMessage);
      await options.sessionStore?.logAssistantMessage(round, assistantMessage);

      options.onEvent?.({
        type: "assistant_message",
        round,
        message: assistantMessage,
      });

      const toolCalls = assistantMessage.tool_calls ?? [];
      if (toolCalls.length === 0) {
        return {
          finalText: assistantMessage.content ?? "",
          rounds: round,
          response,
          messages: state.getMessages(),
        };
      }

      for (const toolCall of toolCalls) {
        await options.sessionStore?.logToolCall(round, toolCall);

        options.onEvent?.({
          type: "tool_call",
          round,
          toolCall,
        });

        const toolInput = parseToolArguments(toolCall.function.arguments);
        const result = toolInput.ok
          ? await executeTool(toolCall.function.name, toolInput.value, {
              workdir: options.workdir,
            })
          : {
              ok: false,
              output: toolInput.output,
            };

        state.appendToolResult(toolCall.id, formatToolResult(toolCall, result));
        await options.sessionStore?.logToolResult(round, toolCall, result);

        options.onEvent?.({
          type: "tool_result",
          round,
          toolCall,
          result,
        });
      }
    }

    throw new Error(
      `Agent loop exceeded the max round limit (${maxRounds}) without producing a final answer.`,
    );
  } catch (error) {
    await options.sessionStore?.logError("agent_loop", error);
    throw error;
  }
}

function getPrimaryAssistantMessage(
  response: ChatCompletionResponse,
): AssistantMessage {
  const message = response.choices[0]?.message;
  if (!message) {
    throw new Error("Model response did not contain a usable assistant message.");
  }

  return message;
}

function parseToolArguments(
  rawArguments: string,
): { ok: true; value: unknown } | { ok: false; output: string } {
  if (!rawArguments.trim()) {
    return {
      ok: true,
      value: {},
    };
  }

  try {
    return {
      ok: true,
      value: JSON.parse(rawArguments) as unknown,
    };
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Unknown JSON parse error";
    return {
      ok: false,
      output: `Error: Tool arguments were not valid JSON: ${reason}`,
    };
  }
}

function formatToolResult(
  toolCall: ChatToolCall,
  result: ToolExecutionResult,
): string {
  return JSON.stringify(
    {
      tool: toolCall.function.name,
      ok: result.ok,
      output: result.output,
      metadata: result.metadata ?? null,
    },
    null,
    2,
  );
}
