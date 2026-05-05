import { spawn } from "node:child_process";

import type { ToolDefinition } from "../llm/protocol.js";
import type {
  BashInput,
  ToolExecutionContext,
  ToolExecutionResult,
} from "./types.js";
import { asObject } from "./types.js";

const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_OUTPUT_CHARS = 20_000;
const DANGEROUS_COMMAND_PATTERNS = [
  "rm -rf /",
  "sudo ",
  "shutdown",
  "reboot",
  "mkfs",
  "dd if=",
  ":(){",
  "diskutil eraseDisk",
];

export const bashToolDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "bash",
    description: "Run a shell command inside the current workspace.",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "Shell command to execute.",
        },
        timeout_ms: {
          type: "integer",
          description: "Optional timeout in milliseconds.",
        },
      },
      required: ["command"],
      additionalProperties: false,
    },
  },
};

export async function executeBash(
  input: unknown,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  try {
    const parsed = parseBashInput(input);
    const blockedReason = getBlockedReason(parsed.command);

    if (blockedReason) {
      return {
        ok: false,
        output: `Error: Command blocked by safety policy: ${blockedReason}`,
      };
    }

    return await runCommand(parsed.command, parsed.timeout_ms ?? DEFAULT_TIMEOUT_MS, context);
  } catch (error) {
    return {
      ok: false,
      output: formatError(error),
    };
  }
}

function parseBashInput(input: unknown): BashInput {
  const record = asObject(input);
  const commandValue = record.command;
  const timeoutValue = record.timeout_ms;

  if (typeof commandValue !== "string" || !commandValue.trim()) {
    throw new Error("bash requires a non-empty string field: command");
  }

  if (
    timeoutValue !== undefined &&
    (!Number.isInteger(timeoutValue) || Number(timeoutValue) < 1)
  ) {
    throw new Error("bash timeout_ms must be a positive integer when provided");
  }

  return {
    command: commandValue,
    ...(timeoutValue !== undefined
      ? { timeout_ms: Number(timeoutValue) }
      : {}),
  };
}

function getBlockedReason(command: string): string | null {
  const normalized = command.toLowerCase();
  const matchedPattern = DANGEROUS_COMMAND_PATTERNS.find((pattern) =>
    normalized.includes(pattern.toLowerCase()),
  );

  return matchedPattern ?? null;
}

async function runCommand(
  command: string,
  timeoutMs: number,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  return new Promise<ToolExecutionResult>((resolve) => {
    const child = spawn(command, {
      cwd: context.workdir,
      env: process.env,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    let truncated = false;
    let timedOut = false;
    let settled = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer | string) => {
      output = appendOutput(output, chunk.toString(), () => {
        truncated = true;
      });
    });

    child.stderr.on("data", (chunk: Buffer | string) => {
      output = appendOutput(output, chunk.toString(), () => {
        truncated = true;
      });
    });

    child.on("error", (error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      resolve({
        ok: false,
        output: `Error: ${error.message}`,
      });
    });

    child.on("close", (code, signal) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);

      let finalOutput = output.trim() || "(no output)";
      if (timedOut) {
        finalOutput = `${finalOutput}\n\n[terminated after ${timeoutMs} ms timeout]`;
      } else if (signal) {
        finalOutput = `${finalOutput}\n\n[terminated by signal ${signal}]`;
      }

      if (truncated) {
        finalOutput = `${finalOutput}\n\n[output truncated at ${MAX_OUTPUT_CHARS} characters]`;
      }

      resolve({
        ok: code === 0 && !timedOut,
        output: finalOutput,
        metadata: {
          exitCode: code,
          signal,
          timedOut,
          truncated,
          timeoutMs,
        },
      });
    });
  });
}

function appendOutput(
  current: string,
  chunk: string,
  onTruncate: () => void,
): string {
  const remaining = MAX_OUTPUT_CHARS - current.length;
  if (remaining <= 0) {
    onTruncate();
    return current;
  }

  if (chunk.length > remaining) {
    onTruncate();
    return current + chunk.slice(0, remaining);
  }

  return current + chunk;
}

function formatError(error: unknown): string {
  return error instanceof Error ? `Error: ${error.message}` : "Error: Unknown bash failure";
}
