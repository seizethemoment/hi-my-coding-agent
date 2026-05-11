import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type ToolExecutionContext = {
  workdir: string;
};

export type ToolExecutionResult = {
  ok: boolean;
  output: string;
  metadata?: Record<string, unknown>;
};

export type RegisteredTool = {
  definition: ToolDefinition;
  execute: (
    input: unknown,
    context: ToolExecutionContext,
  ) => Promise<ToolExecutionResult>;
};

const MAX_OUTPUT_CHARS = 20_000;
const DEFAULT_TIMEOUT_MS = 20_000;
const DANGEROUS_COMMAND_PATTERNS = [
  "rm -rf /",
  "sudo ",
  "shutdown",
  "reboot",
  "mkfs",
  "dd if=",
  ":(){",
];

export const toolRegistry = {
  read_file: {
    definition: {
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
    execute: executeReadFile,
  },
  write_file: {
    definition: {
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
    execute: executeWriteFile,
  },
  bash: {
    definition: {
      type: "function",
      function: {
        name: "bash",
        description: "Run a shell command inside the workspace.",
        parameters: {
          type: "object",
          properties: {
            command: { type: "string" },
            timeout_ms: { type: "integer" },
          },
          required: ["command"],
          additionalProperties: false,
        },
      },
    },
    execute: executeBash,
  },
} satisfies Record<string, RegisteredTool>;

export const toolDefinitions = Object.values(toolRegistry).map(
  (tool) => tool.definition,
);

export async function executeTool(
  name: string,
  input: unknown,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const tool = toolRegistry[name as keyof typeof toolRegistry];
  if (!tool) {
    return { ok: false, output: `Error: Unknown tool: ${name}` };
  }

  return tool.execute(input, context);
}

async function executeReadFile(
  input: unknown,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  try {
    const record = asObject(input);
    const filePath = requireString(record.path, "path");
    const absolutePath = resolveWorkspacePath(context.workdir, filePath);
    const output = await readFile(absolutePath, "utf8");

    return {
      ok: true,
      output,
      metadata: { path: toWorkspaceRelativePath(context.workdir, absolutePath) },
    };
  } catch (error) {
    return { ok: false, output: formatError(error) };
  }
}

async function executeWriteFile(
  input: unknown,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  try {
    const record = asObject(input);
    const filePath = requireString(record.path, "path");
    const content = requireString(record.content, "content");
    const absolutePath = resolveWorkspacePath(context.workdir, filePath);

    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content, "utf8");

    return {
      ok: true,
      output: `Wrote ${content.length} characters.`,
      metadata: { path: toWorkspaceRelativePath(context.workdir, absolutePath) },
    };
  } catch (error) {
    return { ok: false, output: formatError(error) };
  }
}

async function executeBash(
  input: unknown,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  try {
    const record = asObject(input);
    const command = requireString(record.command, "command");
    const timeoutMs =
      typeof record.timeout_ms === "number"
        ? record.timeout_ms
        : DEFAULT_TIMEOUT_MS;
    const blockedReason = getBlockedReason(command);

    if (blockedReason) {
      return {
        ok: false,
        output: `Error: Command blocked by safety policy: ${blockedReason}`,
      };
    }

    return await runCommand(command, timeoutMs, context.workdir);
  } catch (error) {
    return { ok: false, output: formatError(error) };
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

function toWorkspaceRelativePath(workdir: string, absolutePath: string): string {
  return path.relative(path.resolve(workdir), absolutePath) || ".";
}

function getBlockedReason(command: string): string | null {
  const normalized = command.toLowerCase();
  return (
    DANGEROUS_COMMAND_PATTERNS.find((pattern) =>
      normalized.includes(pattern.toLowerCase()),
    ) ?? null
  );
}

async function runCommand(
  command: string,
  timeoutMs: number,
  workdir: string,
): Promise<ToolExecutionResult> {
  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd: workdir,
      env: process.env,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    let truncated = false;
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    const append = (chunk: Buffer | string) => {
      const next = output + chunk.toString();
      if (next.length > MAX_OUTPUT_CHARS) {
        output = next.slice(0, MAX_OUTPUT_CHARS);
        truncated = true;
        return;
      }
      output = next;
    };

    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.on("close", (code, signal) => {
      clearTimeout(timeout);
      resolve({
        ok: code === 0 && !timedOut,
        output: output.trim() || "(no output)",
        metadata: { exitCode: code, signal, timedOut, truncated },
      });
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

function formatError(error: unknown): string {
  return error instanceof Error ? `Error: ${error.message}` : "Error: Unknown tool failure";
}
