import { readFile } from "node:fs/promises";

import { resolveWorkspacePath, toWorkspaceRelativePath } from "../safety/workspace.js";
import type { ToolDefinition } from "../llm/protocol.js";
import type {
  ReadFileInput,
  ToolExecutionContext,
  ToolExecutionResult,
} from "./types.js";
import { asObject } from "./types.js";

export const readFileToolDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "read_file",
    description: "Read a UTF-8 text file from the current workspace.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the file, relative to the workspace root.",
        },
        limit: {
          type: "integer",
          description: "Optional max number of lines to return.",
        },
      },
      required: ["path"],
      additionalProperties: false,
    },
  },
};

export async function executeReadFile(
  input: unknown,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  try {
    const parsed = parseReadFileInput(input);
    const absolutePath = resolveWorkspacePath(context.workdir, parsed.path);
    const rawContent = await readFile(absolutePath, "utf8");
    const relativePath = toWorkspaceRelativePath(context.workdir, absolutePath);
    const output = applyLineLimit(rawContent, parsed.limit);

    return {
      ok: true,
      output,
      metadata: {
        path: relativePath,
        absolutePath,
        limited: parsed.limit !== undefined,
      },
    };
  } catch (error) {
    return {
      ok: false,
      output: formatError(error),
    };
  }
}

function parseReadFileInput(input: unknown): ReadFileInput {
  const record = asObject(input);
  const pathValue = record.path;
  const limitValue = record.limit;

  if (typeof pathValue !== "string" || !pathValue.trim()) {
    throw new Error("read_file requires a non-empty string field: path");
  }

  if (
    limitValue !== undefined &&
    (!Number.isInteger(limitValue) || Number(limitValue) < 1)
  ) {
    throw new Error("read_file limit must be a positive integer when provided");
  }

  return {
    path: pathValue,
    ...(limitValue !== undefined ? { limit: Number(limitValue) } : {}),
  };
}

function applyLineLimit(content: string, limit?: number): string {
  if (!limit) {
    return content;
  }

  const lines = content.split("\n");
  if (lines.length <= limit) {
    return content;
  }

  const remaining = lines.length - limit;
  return `${lines.slice(0, limit).join("\n")}\n... (${remaining} more lines)`;
}

function formatError(error: unknown): string {
  return error instanceof Error ? `Error: ${error.message}` : "Error: Unknown read_file failure";
}
