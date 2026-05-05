import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionStreamEvent,
  OpenAICompatibleErrorBody,
} from "./protocol.js";
import {
  collectChatCompletionResponse,
  parseChatCompletionChunks,
  toStreamEvents,
} from "./stream.js";

export type OpenAICompatibleClientOptions = {
  apiKey: string;
  baseURL: string;
  defaultHeaders?: Record<string, string>;
  fetchImpl?: typeof fetch;
};

export type ClientRequestOptions = {
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

export class LLMClientError extends Error {
  readonly status: number;
  readonly requestId: string | null;
  readonly code: string | null;
  readonly responseBody: string;

  constructor(args: {
    message: string;
    status: number;
    requestId: string | null;
    code?: string | null;
    responseBody: string;
  }) {
    super(args.message);
    this.name = "LLMClientError";
    this.status = args.status;
    this.requestId = args.requestId;
    this.code = args.code ?? null;
    this.responseBody = args.responseBody;
  }
}

export class OpenAICompatibleClient {
  private readonly apiKey: string;
  private readonly baseURL: string;
  private readonly defaultHeaders: Record<string, string>;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenAICompatibleClientOptions) {
    this.apiKey = options.apiKey;
    this.baseURL = trimTrailingSlash(options.baseURL);
    this.defaultHeaders = options.defaultHeaders ?? {};
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async createChatCompletion(
    request: ChatCompletionRequest,
    options?: ClientRequestOptions,
  ): Promise<ChatCompletionResponse> {
    const response = await this.postChatCompletions(
      {
        ...request,
        stream: false,
      },
      options,
    );

    return (await response.json()) as ChatCompletionResponse;
  }

  async *streamChatCompletion(
    request: ChatCompletionRequest,
    options?: ClientRequestOptions,
  ): AsyncGenerator<ChatCompletionStreamEvent> {
    const response = await this.postChatCompletions(
      {
        ...request,
        stream: true,
        stream_options: {
          include_usage: true,
          ...request.stream_options,
        },
      },
      options,
    );

    yield* toStreamEvents(parseChatCompletionChunks(response));
  }

  async collectStreamChatCompletion(
    request: ChatCompletionRequest,
    options?: ClientRequestOptions,
  ): Promise<ChatCompletionResponse> {
    const response = await this.postChatCompletions(
      {
        ...request,
        stream: true,
        stream_options: {
          include_usage: true,
          ...request.stream_options,
        },
      },
      options,
    );

    return collectChatCompletionResponse(parseChatCompletionChunks(response));
  }

  private async postChatCompletions(
    request: ChatCompletionRequest & { stream: boolean },
    options?: ClientRequestOptions,
  ): Promise<Response> {
    const endpoint = `${this.baseURL}/chat/completions`;
    const { extraBody, ...baseBody } = request;
    const payload = {
      ...baseBody,
      ...(extraBody ?? {}),
    };

    const response = await this.fetchImpl(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        Accept: request.stream ? "text/event-stream" : "application/json",
        ...this.defaultHeaders,
        ...(options?.headers ?? {}),
      },
      body: JSON.stringify(payload),
      ...(options?.signal ? { signal: options.signal } : {}),
    });

    if (!response.ok) {
      throw await toLLMClientError(response);
    }

    return response;
  }
}

async function toLLMClientError(response: Response): Promise<LLMClientError> {
  const responseBody = await response.text();
  const parsed = safeParseJSON<OpenAICompatibleErrorBody>(responseBody);
  const requestId =
    response.headers.get("x-request-id") ??
    response.headers.get("request-id") ??
    null;
  const providerMessage = parsed?.error?.message?.trim();
  const fallbackMessage = responseBody.trim() || response.statusText;

  return new LLMClientError({
    message: providerMessage
      ? `LLM request failed (${response.status}): ${providerMessage}`
      : `LLM request failed (${response.status}): ${fallbackMessage}`,
    status: response.status,
    requestId,
    code: parsed?.error?.code ?? null,
    responseBody,
  });
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function safeParseJSON<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
