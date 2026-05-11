import type { StreamEvent } from "./protocol.js";

export async function* parseChatCompletionStream(
  response: Response,
): AsyncGenerator<StreamEvent> {
  if (!response.body) {
    throw new Error("Streaming response did not include a body.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const event = parseSsePart(part);
      if (event) {
        yield event;
      }
    }
  }

  if (buffer.trim()) {
    const event = parseSsePart(buffer);
    if (event) {
      yield event;
    }
  }
}

function parseSsePart(part: string): StreamEvent | null {
  const data = part
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())
    .join("\n");

  if (!data) {
    return null;
  }

  if (data === "[DONE]") {
    return { type: "done" };
  }

  const parsed = JSON.parse(data) as {
    choices?: Array<{
      delta?: {
        content?: string | null;
        tool_calls?: unknown;
      };
    }>;
  };
  const delta = parsed.choices?.[0]?.delta;

  if (delta?.content) {
    return {
      type: "text_delta",
      delta: delta.content,
    };
  }

  if (delta?.tool_calls) {
    return {
      type: "tool_call_delta",
      delta: delta.tool_calls,
    };
  }

  return null;
}
