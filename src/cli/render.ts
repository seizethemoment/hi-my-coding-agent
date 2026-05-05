import type { ChatToolCall } from "../llm/protocol.js";
import type { ToolExecutionResult } from "../tools/types.js";

const RESET = "\x1b[0m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";

export function renderCliIntro(): void {
  console.log("");
  console.log(`${CYAN}Interactive CLI${RESET}`);
  console.log(`${DIM}Commands: /help /clear /model /quit${RESET}`);
}

export function renderPromptHint(): void {
  console.log(`${DIM}Type a request and press Enter.${RESET}`);
}

export function renderInfo(message: string): void {
  console.log(`${DIM}${message}${RESET}`);
}

export function renderUserMessage(message: string): void {
  console.log("");
  console.log(`${CYAN}you${RESET}: ${message}`);
}

export function renderAssistantMessage(message: string): void {
  console.log("");
  console.log(`${GREEN}assistant${RESET}:`);
  console.log(message || "(no content)");
}

export function renderToolCall(toolCall: ChatToolCall): void {
  console.log("");
  console.log(
    `${YELLOW}tool${RESET}: ${toolCall.function.name} ${toolCall.function.arguments}`,
  );
}

export function renderToolResult(result: ToolExecutionResult): void {
  const color = result.ok ? GREEN : RED;
  console.log(`${color}ok${RESET}: ${String(result.ok)}`);
  console.log(`${DIM}${truncateForTerminal(result.output)}${RESET}`);
}

export function clearScreen(): void {
  process.stdout.write("\x1Bc");
}

function truncateForTerminal(value: string, limit = 240): string {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit)}...`;
}
