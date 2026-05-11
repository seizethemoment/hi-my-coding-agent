import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ToolDefinition } from "./protocol.js";

export type ToolExecutionResult = {
  ok: boolean;
  output: string;
};

export type ToolContext = {
  workdir: string;
};

export const toolDefinitions: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read a UTF-8 text file from the workspace.",
      parameters: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
        additionalProperties: false,
      },
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
        required: ["path", "content"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bash",
      description: "Run a shell command inside the workspace.",
      parameters: {
        type: "object",
        properties: { command: { type: "string" } },
        required: ["command"],
        additionalProperties: false,
      },
    },
  },
];

export async function executeTool(
  name: string,
  input: unknown,
  context: ToolContext,
): Promise<ToolExecutionResult> {
  try {
    const record = asObject(input);
    if (name === "read_file") {
      const absolutePath = resolveWorkspacePath(context.workdir, requireString(record.path, "path"));
      return { ok: true, output: await readFile(absolutePath, "utf8") };
    }

    if (name === "write_file") {
      const absolutePath = resolveWorkspacePath(context.workdir, requireString(record.path, "path"));
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
      return await runCommand(command, context.workdir);
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

async function runCommand(
  command: string,
  workdir: string,
): Promise<ToolExecutionResult> {
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
