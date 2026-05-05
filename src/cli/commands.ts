import {
  clearScreen,
  renderCliIntro,
  renderInfo,
} from "./render.js";

export type SlashCommandResult =
  | {
      type: "continue";
    }
  | {
      type: "exit";
    };

export type SlashCommandContext = {
  model: string;
  onResetConversation: () => void;
};

export function isSlashCommand(input: string): boolean {
  return input.trimStart().startsWith("/");
}

export function handleSlashCommand(
  input: string,
  context: SlashCommandContext,
): SlashCommandResult {
  const [rawName, ...args] = input.trim().split(/\s+/);
  const name = (rawName ?? "").toLowerCase();

  switch (name) {
    case "/help":
      renderCliIntro();
      renderInfo("Extra command: /new resets the current conversation state.");
      return { type: "continue" };
    case "/clear":
      clearScreen();
      renderCliIntro();
      return { type: "continue" };
    case "/model":
      renderInfo(`Current model: ${context.model}`);
      return { type: "continue" };
    case "/new":
      context.onResetConversation();
      renderInfo("Started a fresh conversation.");
      return { type: "continue" };
    case "/quit":
      return { type: "exit" };
    default:
      renderInfo(`Unknown command: ${rawName ?? ""}${args.length ? ` ${args.join(" ")}` : ""}`);
      renderInfo("Try /help.");
      return { type: "continue" };
  }
}
