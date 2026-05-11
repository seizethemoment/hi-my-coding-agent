import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  StreamEvent,
} from "./protocol.js";
import { parseChatCompletionStream } from "./stream.js";

export type FetchLike = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export type ClientOptions = {
  apiKey: string;
  baseURL: string;
  fetchFn?: FetchLike;
  extraHeaders?: Record<string, string>;
};

export class OpenAICompatibleClient {
  private readonly apiKey: string;
  private readonly baseURL: string;
  private readonly fetchFn: FetchLike;
  private readonly extraHeaders: Record<string, string>;

  constructor(options: ClientOptions) {
    this.apiKey = options.apiKey;
    this.baseURL = options.baseURL.replace(/\/$/, "");
    this.fetchFn = options.fetchFn ?? fetch;
    this.extraHeaders = options.extraHeaders ?? {};
  }

  async createChatCompletion(
    request: ChatCompletionRequest,
  ): Promise<ChatCompletionResponse> {
    const response = await this.send({ ...request, stream: false });
    return (await response.json()) as ChatCompletionResponse;
  }

  async *streamChatCompletion(
    request: ChatCompletionRequest,
  ): AsyncGenerator<StreamEvent> {
    const response = await this.send({ ...request, stream: true });
    yield* parseChatCompletionStream(response);
  }

  private async send(request: ChatCompletionRequest): Promise<Response> {
    const { extraBody, ...baseBody } = request;
    const response = await this.fetchFn(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...this.extraHeaders,
      },
      body: JSON.stringify({
        ...baseBody,
        ...(extraBody ?? {}),
      }),
    });

    if (!response.ok) {
      const raw = await response.text();
      throw new Error(`LLM request failed: ${response.status} ${raw}`);
    }

    return response;
  }
}
