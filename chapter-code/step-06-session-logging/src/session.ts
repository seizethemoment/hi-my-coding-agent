import { randomUUID } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatToolCall,
} from "./core.js";

export type TokenUsageSummary = {
  request_count: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
};

export type SessionMode = "agent-once" | "interactive";

export class SessionStore {
  readonly sessionId = randomUUID();
  readonly filePath: string;
  private sequence = 0;
  private readonly usage: TokenUsageSummary = {
    request_count: 0,
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
    prompt_tokens: 0,
    completion_tokens: 0,
  };

  private constructor(filePath: string) {
    this.filePath = filePath;
  }

  static async create(options: {
    workdir: string;
    model: string;
    baseURL: string;
    mode: SessionMode;
  }): Promise<SessionStore> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const store = new SessionStore(
      path.join(
        options.workdir,
        ".hi-my-coding-agent",
        "sessions",
        `${timestamp}-${randomUUID()}.jsonl`,
      ),
    );
    await store.log("session_start", {
      model: options.model,
      base_url: options.baseURL,
      mode: options.mode,
      cwd: options.workdir,
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
      this.addUsage(response.usage);
      await this.log("token_usage", {
        round,
        usage: response.usage,
        cumulative_usage: this.getUsageSummary(),
      });
    }
  }

  async logAssistantMessage(
    round: number,
    message: unknown,
  ): Promise<void> {
    await this.log("assistant_message", { round, message });
  }

  async logToolCall(round: number, toolCall: ChatToolCall): Promise<void> {
    await this.log("tool_call", { round, tool_call: toolCall });
  }

  async logToolResult(
    round: number,
    toolCall: ChatToolCall,
    result: unknown,
  ): Promise<void> {
    await this.log("tool_result", {
      round,
      tool_call: toolCall,
      result,
    });
  }

  async logError(stage: string, error: unknown): Promise<void> {
    await this.log("error", {
      stage,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }

  async close(reason: string): Promise<void> {
    await this.log("session_summary", {
      token_usage: this.getUsageSummary(),
    });
    await this.log("session_end", { reason });
  }

  private addUsage(usage: NonNullable<ChatCompletionResponse["usage"]>): void {
    const inputTokens = usage.prompt_tokens ?? 0;
    const outputTokens = usage.completion_tokens ?? 0;
    this.usage.request_count += 1;
    this.usage.input_tokens += inputTokens;
    this.usage.output_tokens += outputTokens;
    this.usage.total_tokens += usage.total_tokens ?? 0;
    this.usage.prompt_tokens += inputTokens;
    this.usage.completion_tokens += outputTokens;
  }

  private getUsageSummary(): TokenUsageSummary {
    return { ...this.usage };
  }

  private async log(type: string, payload: Record<string, unknown>): Promise<void> {
    const record = {
      session_id: this.sessionId,
      sequence: ++this.sequence,
      timestamp: new Date().toISOString(),
      type,
      ...payload,
    };
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await appendFile(this.filePath, `${JSON.stringify(record)}\n`, "utf8");
  }
}
