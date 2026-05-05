import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { resolveWorkspacePath, toWorkspaceRelativePath } from "../safety/workspace.js";
import type { ToolDefinition } from "../llm/protocol.js";
import type {
  ToolExecutionContext,
  ToolExecutionResult,
  WriteFileInput,
} from "./types.js";
import { asObject } from "./types.js";

export const writeFileToolDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "write_file",
    description: "Create or overwrite a UTF-8 text file in the workspace.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the file, relative to the workspace root.",
        },
        content: {
          type: "string",
          description: "Full file content to write.",
        },
      },
      required: ["path", "content"],
      additionalProperties: false,
    },
  },
};

export async function executeWriteFile(
  input: unknown,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  try {
    const parsed = parseWriteFileInput(input);
    const absolutePath = resolveWorkspacePath(context.workdir, parsed.path);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, parsed.content, "utf8");

    const relativePath = toWorkspaceRelativePath(context.workdir, absolutePath);

    return {
      ok: true,
      output: `Wrote ${parsed.content.length} characters to ${relativePath}`,
      metadata: {
        path: relativePath,
        absolutePath,
        bytes: Buffer.byteLength(parsed.content, "utf8"),
      },
    };
  } catch (error) {
    return {
      ok: false,
      output: formatError(error),
    };
  }
}

function parseWriteFileInput(input: unknown): WriteFileInput {
  const record = asObject(input);
  const pathValue = record.path;
  const contentValue = record.content;

  if (typeof pathValue !== "string" || !pathValue.trim()) {
    throw new Error("write_file requires a non-empty string field: path");
  }

  if (typeof contentValue !== "string") {
    throw new Error("write_file requires a string field: content");
  }

  return {
    path: pathValue,
    content: contentValue,
  };
}

function formatError(error: unknown): string {
  return error instanceof Error ? `Error: ${error.message}` : "Error: Unknown write_file failure";
}
