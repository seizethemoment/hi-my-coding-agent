import type {
  AssistantMessage,
  ChatCompletionChunk,
  ChatCompletionChunkChoice,
  ChatCompletionDeltaToolCall,
  ChatCompletionResponse,
  ChatCompletionStreamEvent,
  ChatCompletionUsage,
  ChatToolCall,
} from "./protocol.js";

type AggregateChoiceState = {
  index: number;
  role: "assistant";
  content: string;
  reasoningContent: string;
  toolCalls: ChatToolCall[];
  finishReason: ChatCompletionChunkChoice["finish_reason"];
  logprobs?: unknown | null;
};

type AggregateState = {
  id: string;
  object: string;
  created: number;
  model: string;
  usage?: ChatCompletionUsage | null;
  systemFingerprint?: string | null;
  serviceTier?: string | null;
  choices: Map<number, AggregateChoiceState>;
};

export async function* parseChatCompletionChunks(
  response: Response,
): AsyncGenerator<ChatCompletionChunk> {
  if (!response.body) {
    throw new Error("Streaming response did not include a body.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

    let boundary = findEventBoundary(buffer);
    while (boundary) {
      const rawEvent = buffer.slice(0, boundary.index);
      buffer = buffer.slice(boundary.nextOffset);

      const data = extractDataPayload(rawEvent);
      if (data && data !== "[DONE]") {
        yield JSON.parse(data) as ChatCompletionChunk;
      }

      boundary = findEventBoundary(buffer);
    }

    if (done) {
      buffer += decoder.decode();
      break;
    }
  }

  const finalData = extractDataPayload(buffer);
  if (finalData && finalData !== "[DONE]") {
    yield JSON.parse(finalData) as ChatCompletionChunk;
  }
}

export async function* toStreamEvents(
  chunks: AsyncIterable<ChatCompletionChunk>,
): AsyncGenerator<ChatCompletionStreamEvent> {
  for await (const chunk of chunks) {
    yield { type: "chunk", chunk };

    if (chunk.usage) {
      yield { type: "usage", usage: chunk.usage };
    }

    for (const choice of chunk.choices) {
      if (choice.delta.content) {
        yield {
          type: "text_delta",
          choiceIndex: choice.index,
          delta: choice.delta.content,
        };
      }

      if (choice.delta.reasoning_content) {
        yield {
          type: "reasoning_delta",
          choiceIndex: choice.index,
          delta: choice.delta.reasoning_content,
        };
      }

      for (const toolCall of choice.delta.tool_calls ?? []) {
        yield {
          type: "tool_call_delta",
          choiceIndex: choice.index,
          toolCallIndex: toolCall.index,
          delta: toolCall,
        };
      }

      if (choice.finish_reason) {
        yield {
          type: "finish",
          choiceIndex: choice.index,
          finishReason: choice.finish_reason,
        };
      }
    }
  }

  yield { type: "done" };
}

export async function collectChatCompletionResponse(
  chunks: AsyncIterable<ChatCompletionChunk>,
): Promise<ChatCompletionResponse> {
  let aggregate: AggregateState | null = null;

  for await (const chunk of chunks) {
    if (!aggregate) {
      aggregate = {
        id: chunk.id,
        object: chunk.object.replace(".chunk", ""),
        created: chunk.created,
        model: chunk.model,
        usage: chunk.usage ?? null,
        systemFingerprint: chunk.system_fingerprint ?? null,
        serviceTier: chunk.service_tier ?? null,
        choices: new Map<number, AggregateChoiceState>(),
      };
    }

    aggregate.usage = chunk.usage ?? aggregate.usage ?? null;
    aggregate.systemFingerprint =
      chunk.system_fingerprint ?? aggregate.systemFingerprint ?? null;
    aggregate.serviceTier = chunk.service_tier ?? aggregate.serviceTier ?? null;

    for (const choice of chunk.choices) {
      const state = getOrCreateChoiceState(aggregate.choices, choice.index);
      mergeChoiceDelta(state, choice);
    }
  }

  if (!aggregate) {
    throw new Error("Streaming response ended before any chunks were received.");
  }

  return {
    id: aggregate.id,
    object: aggregate.object,
    created: aggregate.created,
    model: aggregate.model,
    choices: [...aggregate.choices.values()]
      .sort((left, right) => left.index - right.index)
      .map((choice) => ({
        index: choice.index,
        message: toAssistantMessage(choice),
        finish_reason: choice.finishReason,
        logprobs: choice.logprobs ?? null,
      })),
    usage: aggregate.usage ?? null,
    system_fingerprint: aggregate.systemFingerprint ?? null,
    service_tier: aggregate.serviceTier ?? null,
  };
}

function findEventBoundary(
  value: string,
): { index: number; nextOffset: number } | null {
  const match = /\r?\n\r?\n/.exec(value);
  if (!match || match.index === undefined) {
    return null;
  }

  return {
    index: match.index,
    nextOffset: match.index + match[0].length,
  };
}

function extractDataPayload(rawEvent: string): string | null {
  const dataLines = rawEvent
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart());

  if (dataLines.length === 0) {
    return null;
  }

  return dataLines.join("\n").trim();
}

function getOrCreateChoiceState(
  choices: Map<number, AggregateChoiceState>,
  index: number,
): AggregateChoiceState {
  const existing = choices.get(index);
  if (existing) {
    return existing;
  }

  const created: AggregateChoiceState = {
    index,
    role: "assistant",
    content: "",
    reasoningContent: "",
    toolCalls: [],
    finishReason: null,
    logprobs: null,
  };
  choices.set(index, created);
  return created;
}

function mergeChoiceDelta(
  state: AggregateChoiceState,
  choice: ChatCompletionChunkChoice,
): void {
  state.logprobs = choice.logprobs ?? state.logprobs ?? null;
  state.finishReason = choice.finish_reason ?? state.finishReason;

  if (choice.delta.content) {
    state.content += choice.delta.content;
  }

  if (choice.delta.reasoning_content) {
    state.reasoningContent += choice.delta.reasoning_content;
  }

  for (const deltaToolCall of choice.delta.tool_calls ?? []) {
    mergeToolCallDelta(state.toolCalls, deltaToolCall);
  }
}

function mergeToolCallDelta(
  toolCalls: ChatToolCall[],
  delta: ChatCompletionDeltaToolCall,
): void {
  const current =
    toolCalls[delta.index] ??
    ({
      id: "",
      type: "function",
      function: {
        name: "",
        arguments: "",
      },
    } satisfies ChatToolCall);

  if (delta.id) {
    current.id = delta.id;
  }

  if (delta.type) {
    current.type = delta.type;
  }

  if (delta.function?.name) {
    current.function.name += delta.function.name;
  }

  if (delta.function?.arguments) {
    current.function.arguments += delta.function.arguments;
  }

  toolCalls[delta.index] = current;
}

function toAssistantMessage(choice: AggregateChoiceState): AssistantMessage {
  const content = choice.content.length > 0 ? choice.content : null;
  const reasoningContent =
    choice.reasoningContent.length > 0 ? choice.reasoningContent : null;
  const toolCalls =
    choice.toolCalls.length > 0
      ? choice.toolCalls.filter((toolCall) => toolCall !== undefined)
      : undefined;

  const message: AssistantMessage = {
    role: choice.role,
    content,
    reasoning_content: reasoningContent,
  };

  if (toolCalls) {
    message.tool_calls = toolCalls;
  }

  return message;
}
