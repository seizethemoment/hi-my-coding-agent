import readline from "node:readline";

import {
  type ChatCompletionClient,
  type ChatMessage,
  createInitialMessages,
  runAgentTurn,
} from "./core.js";
import type { SessionStore } from "./session.js";

export async function startRepl(options: {
  client: ChatCompletionClient;
  model: string;
  workdir: string;
  sessionStore: SessionStore;
}): Promise<void> {
  let messages: ChatMessage[] = createInitialMessages();
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    prompt: "agent> ",
  });

  console.log("Interactive CLI");
  console.log("Commands: /help /model /new /quit");
  console.log(`Session log: ${options.sessionStore.filePath}`);
  rl.prompt();

  return new Promise((resolve) => {
    rl.on("line", async (line) => {
      const input = line.trim();
      if (!input) {
        rl.prompt();
        return;
      }
      if (input === "/quit") {
        rl.close();
        return;
      }
      if (input === "/help") {
        console.log("Commands: /help /model /new /quit");
        rl.prompt();
        return;
      }
      if (input === "/model") {
        console.log(`Current model: ${options.model}`);
        rl.prompt();
        return;
      }
      if (input === "/new") {
        messages = createInitialMessages();
        console.log("Started a fresh conversation.");
        rl.prompt();
        return;
      }

      try {
        const result = await runAgentTurn({
          client: options.client,
          model: options.model,
          workdir: options.workdir,
          prompt: input,
          messages,
          sessionStore: options.sessionStore,
          onEvent(event) {
            if (event.type === "round_start") {
              console.log(`round: ${event.round}`);
            } else if (event.type === "tool_call") {
              console.log(`tool: ${event.name} ${event.arguments}`);
            } else if (event.type === "tool_result") {
              console.log(`ok: ${event.ok}`);
              console.log(event.output.slice(0, 240));
            }
          },
        });
        console.log(`assistant:\n${result.finalText || "(no content)"}`);
      } catch (error) {
        await options.sessionStore.logError("cli_turn", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        console.log(`Error: ${message}`);
      }
      rl.prompt();
    });

    rl.on("close", () => {
      void (async () => {
        await options.sessionStore.close("cli_closed");
        console.log("\nCLI closed.");
        resolve();
      })();
    });
  });
}
