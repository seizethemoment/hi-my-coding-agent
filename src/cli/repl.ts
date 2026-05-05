import readline from "node:readline";

import {
  DEFAULT_SYSTEM_PROMPT,
  runAgentLoop,
} from "../agent/agentLoop.js";
import { MessageState } from "../agent/messageState.js";
import type { OpenAICompatibleClient } from "../llm/client.js";
import type { SessionStore } from "../storage/sessionStore.js";
import { handleSlashCommand, isSlashCommand } from "./commands.js";
import {
  renderAssistantMessage,
  renderCliIntro,
  renderInfo,
  renderPromptHint,
  renderToolCall,
  renderToolResult,
  renderUserMessage,
} from "./render.js";

export type StartReplOptions = {
  client: OpenAICompatibleClient;
  model: string;
  workdir: string;
  sessionStore: SessionStore;
};

export async function startRepl(options: StartReplOptions): Promise<void> {
  let state = new MessageState(DEFAULT_SYSTEM_PROMPT);
  let awaitingSecondCtrlC = false;
  let busy = false;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    historySize: 500,
    prompt: "agent> ",
  });

  renderCliIntro();
  renderPromptHint();
  renderInfo(`Session log: ${options.sessionStore.filePath}`);
  rl.prompt();

  rl.on("SIGINT", () => {
    if (busy) {
      renderInfo("Agent is running. Wait for the current turn to finish.");
      rl.prompt();
      return;
    }

    if (rl.line.trim().length > 0) {
      rl.write(null, { ctrl: true, name: "u" });
      rl.prompt();
      awaitingSecondCtrlC = false;
      return;
    }

    if (awaitingSecondCtrlC) {
      rl.close();
      return;
    }

    awaitingSecondCtrlC = true;
    renderInfo("Press Ctrl+C again or use /quit to exit.");
    rl.prompt();
  });

  return new Promise<void>((resolve) => {
    rl.on("line", async (line) => {
      const input = line.trim();
      awaitingSecondCtrlC = false;

      if (busy) {
        renderInfo("Agent is busy. Please wait.");
        rl.prompt();
        return;
      }

      if (!input) {
        rl.prompt();
        return;
      }

      if (isSlashCommand(input)) {
        const result = handleSlashCommand(input, {
          model: options.model,
          onResetConversation() {
            state = new MessageState(DEFAULT_SYSTEM_PROMPT);
          },
        });

        if (input === "/new") {
          await options.sessionStore.logConversationReset();
        }

        if (result.type === "exit") {
          rl.close();
          return;
        }

        rl.prompt();
        return;
      }

      busy = true;
      renderUserMessage(input);
      rl.pause();

      try {
        const result = await runAgentLoop({
          client: options.client,
          model: options.model,
          workdir: options.workdir,
          prompt: input,
          state,
          sessionStore: options.sessionStore,
          onEvent(event) {
            switch (event.type) {
              case "round_start":
                renderInfo(`round ${event.round}`);
                break;
              case "assistant_message":
                break;
              case "tool_call":
                renderToolCall(event.toolCall);
                break;
              case "tool_result":
                renderToolResult(event.result);
                break;
              default:
                assertNever(event);
            }
          },
        });

        renderAssistantMessage(result.finalText);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown agent loop failure";
        renderInfo(`Error: ${message}`);
      } finally {
        busy = false;
        rl.resume();
        rl.prompt();
      }
    });

    rl.on("close", () => {
      void (async () => {
        await options.sessionStore.close("cli_closed");
        console.log("");
        renderInfo("CLI closed.");
        resolve();
      })();
    });
  });
}

function assertNever(value: never): never {
  throw new Error(`Unhandled event: ${JSON.stringify(value)}`);
}
