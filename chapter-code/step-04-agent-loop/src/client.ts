import type {
  ChatCompletionClient,
  ChatCompletionRequest,
  ChatCompletionResponse,
} from "./protocol.js";

export class OpenAICompatibleClient implements ChatCompletionClient {
  private readonly apiKey: string;
  private readonly baseURL: string;

  constructor(options: { apiKey: string; baseURL: string }) {
    this.apiKey = options.apiKey;
    this.baseURL = options.baseURL.replace(/\/$/, "");
  }

  async createChatCompletion(
    request: ChatCompletionRequest,
  ): Promise<ChatCompletionResponse> {
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`LLM request failed: ${response.status} ${await response.text()}`);
    }

    return (await response.json()) as ChatCompletionResponse;
  }
}
