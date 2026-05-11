import readline from "node:readline";

import {
  type ChatCompletionClient,
  type ChatMessage,
  createInitialMessages,
  runAgentTurn,
} from "./core.js";

export function handleSlashCommand(
  input: string,
  context: {
    model: string;
    resetMessages: () => void;
  },
): "continue" | "exit" {
  const name = input.trim().split(/\s+/)[0]?.toLowerCase();

  if (name === "/help") {
    console.log("Commands: /help /model /clear /new /quit");
    return "continue";
  }
  if (name === "/model") {
    console.log(`Current model: ${context.model}`);
    return "continue";
  }
  if (name === "/clear") {
    process.stdout.write("\x1Bc");
    return "continue";
  }
  if (name === "/new") {
    context.resetMessages();
    console.log("Started a fresh conversation.");
    return "continue";
  }
  if (name === "/quit") {
    return "exit";
  }

  console.log(`Unknown command: ${input}`);
  return "continue";
}

export async function startRepl(options: {
  client: ChatCompletionClient;
  model: string;
  workdir: string;
}): Promise<void> {
  let messages: ChatMessage[] = createInitialMessages();
  let busy = false;
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    prompt: "agent> ",
  });

  console.log("Interactive CLI");
  console.log("Commands: /help /model /clear /new /quit");
  rl.prompt();

  return new Promise((resolve) => {
    rl.on("line", async (line) => {
      const input = line.trim();
      if (!input) {
        rl.prompt();
        return;
      }
      if (busy) {
        console.log("Agent is busy. Please wait.");
        rl.prompt();
        return;
      }
      if (input.startsWith("/")) {
        const result = handleSlashCommand(input, {
          model: options.model,
          resetMessages() {
            messages = createInitialMessages();
          },
        });
        if (result === "exit") {
          rl.close();
          return;
        }
        rl.prompt();
        return;
      }

      busy = true;
      console.log(`\nyou: ${input}`);
      try {
        const result = await runAgentTurn({
          client: options.client,
          model: options.model,
          workdir: options.workdir,
          prompt: input,
          messages,
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
        const message = error instanceof Error ? error.message : "Unknown error";
        console.log(`Error: ${message}`);
      } finally {
        busy = false;
        rl.prompt();
      }
    });

    rl.on("close", () => {
      console.log("\nCLI closed.");
      resolve();
    });
  });
}
