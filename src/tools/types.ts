import type { ToolDefinition } from "../llm/protocol.js";

export type ToolExecutionContext = {
  workdir: string;
};

export type ToolExecutionResult = {
  ok: boolean;
  output: string;
  metadata?: Record<string, unknown>;
};

export type ToolExecutor = (
  input: unknown,
  context: ToolExecutionContext,
) => Promise<ToolExecutionResult>;

export type RegisteredTool = {
  definition: ToolDefinition;
  execute: ToolExecutor;
};

export type ReadFileInput = {
  path: string;
  limit?: number;
};

export type WriteFileInput = {
  path: string;
  content: string;
};

export type BashInput = {
  command: string;
  timeout_ms?: number;
};

export function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Tool input must be a JSON object.");
  }

  return value as Record<string, unknown>;
}
