import { randomUUID } from "node:crypto";
import path from "node:path";

import type {
  AssistantMessage,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionUsage,
  ChatToolCall,
} from "../llm/protocol.js";
import type { ToolExecutionResult } from "../tools/types.js";
import { appendJsonlRecord } from "./jsonl.js";

const SESSION_DIR_NAME = ".hi-my-coding-agent/sessions";

export type SessionMode = "interactive" | "agent-once";

export type SessionStoreOptions = {
  workdir: string;
  model: string;
  baseURL: string;
  mode: SessionMode;
};

type SessionEventMap = {
  session_start: {
    started_at: string;
    cwd: string;
    model: string;
    base_url: string;
    mode: SessionMode;
  };
  session_end: {
    reason: string;
  };
  user_message: {
    content: string;
  };
  request_start: {
    round: number;
    request: ChatCompletionRequest;
  };
  request_end: {
    round: number;
    response: ChatCompletionResponse;
  };
  token_usage: {
    round: number;
    usage: ChatCompletionUsage;
    cumulative_usage: TokenUsageSummary;
  };
  assistant_message: {
    round: number;
    message: AssistantMessage;
  };
  tool_call: {
    round: number;
    tool_call: ChatToolCall;
  };
  tool_result: {
    round: number;
    tool_call: ChatToolCall;
    result: ToolExecutionResult;
  };
  conversation_reset: Record<string, never>;
  info: {
    message: string;
    data?: Record<string, unknown> | null;
  };
  error: {
    stage: string;
    message: string;
    stack?: string | null;
  };
  session_summary: {
    token_usage: TokenUsageSummary;
  };
};

type SessionEventRecord<TType extends keyof SessionEventMap> = {
  session_id: string;
  sequence: number;
  timestamp: string;
  type: TType;
} & SessionEventMap[TType];

export type TokenUsageSummary = {
  request_count: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  completion_text_tokens: number;
  completion_reasoning_tokens: number;
  prompt_text_tokens: number;
};

export class SessionStore {
  readonly sessionId: string;
  readonly filePath: string;

  private sequence = 0;
  private writeChain: Promise<void> = Promise.resolve();
  private closed = false;
  private readonly tokenUsage: TokenUsageSummary = {
    request_count: 0,
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    completion_text_tokens: 0,
    completion_reasoning_tokens: 0,
    prompt_text_tokens: 0,
  };

  private constructor(sessionId: string, filePath: string) {
    this.sessionId = sessionId;
    this.filePath = filePath;
  }

  static async create(options: SessionStoreOptions): Promise<SessionStore> {
    const sessionId = randomUUID();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `${timestamp}-${sessionId}.jsonl`;
    const filePath = path.join(options.workdir, SESSION_DIR_NAME, fileName);
    const store = new SessionStore(sessionId, filePath);

    await store.log("session_start", {
      started_at: new Date().toISOString(),
      cwd: options.workdir,
      model: options.model,
      base_url: options.baseURL,
      mode: options.mode,
    });

    return store;
  }

  async logUserMessage(content: string): Promise<void> {
    await this.log("user_message", { content });
  }

  async logRequestStart(
    round: number,
    request: ChatCompletionRequest,
  ): Promise<void> {
    await this.log("request_start", { round, request });
  }

  async logRequestEnd(
    round: number,
    response: ChatCompletionResponse,
  ): Promise<void> {
    await this.log("request_end", { round, response });

    if (response.usage) {
      this.addTokenUsage(response.usage);
      await this.log("token_usage", {
        round,
        usage: response.usage,
        cumulative_usage: this.getTokenUsageSummary(),
      });
    }
  }

  async logAssistantMessage(
    round: number,
    message: AssistantMessage,
  ): Promise<void> {
    await this.log("assistant_message", { round, message });
  }

  async logToolCall(round: number, toolCall: ChatToolCall): Promise<void> {
    await this.log("tool_call", { round, tool_call: toolCall });
  }

  async logToolResult(
    round: number,
    toolCall: ChatToolCall,
    result: ToolExecutionResult,
  ): Promise<void> {
    await this.log("tool_result", {
      round,
      tool_call: toolCall,
      result,
    });
  }

  async logConversationReset(): Promise<void> {
    await this.log("conversation_reset", {});
  }

  async logInfo(
    message: string,
    data?: Record<string, unknown> | null,
  ): Promise<void> {
    await this.log("info", {
      message,
      ...(data !== undefined ? { data } : {}),
    });
  }

  async logError(
    stage: string,
    error: unknown,
  ): Promise<void> {
    const message =
      error instanceof Error ? error.message : "Unknown session error";
    const stack = error instanceof Error ? (error.stack ?? null) : null;

    await this.log("error", {
      stage,
      message,
      ...(stack ? { stack } : {}),
    });
  }

  async close(reason: string): Promise<void> {
    if (this.closed) {
      await this.flush();
      return;
    }

    this.closed = true;
    await this.log("session_summary", {
      token_usage: this.getTokenUsageSummary(),
    });
    await this.log("session_end", { reason });
    await this.flush();
  }

  async flush(): Promise<void> {
    await this.writeChain;
  }

  private async log<TType extends keyof SessionEventMap>(
    type: TType,
    payload: SessionEventMap[TType],
  ): Promise<void> {
    const record: SessionEventRecord<TType> = {
      session_id: this.sessionId,
      sequence: this.nextSequence(),
      timestamp: new Date().toISOString(),
      type,
      ...payload,
    };

    this.writeChain = this.writeChain.then(() =>
      appendJsonlRecord(this.filePath, record),
    );

    await this.writeChain;
  }

  private nextSequence(): number {
    this.sequence += 1;
    return this.sequence;
  }

  private addTokenUsage(usage: ChatCompletionUsage): void {
    this.tokenUsage.request_count += 1;
    this.tokenUsage.prompt_tokens += usage.prompt_tokens ?? 0;
    this.tokenUsage.completion_tokens += usage.completion_tokens ?? 0;
    this.tokenUsage.total_tokens += usage.total_tokens ?? 0;
    this.tokenUsage.completion_text_tokens += getNumberDetail(
      usage.completion_tokens_details,
      "text_tokens",
    );
    this.tokenUsage.completion_reasoning_tokens += getNumberDetail(
      usage.completion_tokens_details,
      "reasoning_tokens",
    );
    this.tokenUsage.prompt_text_tokens += getNumberDetail(
      usage.prompt_tokens_details,
      "text_tokens",
    );
  }

  private getTokenUsageSummary(): TokenUsageSummary {
    return { ...this.tokenUsage };
  }
}

function getNumberDetail(
  details: Record<string, unknown> | null | undefined,
  key: string,
): number {
  const value = details?.[key];
  return typeof value === "number" ? value : 0;
}
