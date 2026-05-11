export type ChatToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type ChatMessage =
  | {
      role: "system" | "user";
      content: string;
    }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: ChatToolCall[];
    }
  | {
      role: "tool";
      content: string;
      tool_call_id: string;
    };

export type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type ChatCompletionRequest = {
  model: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  tool_choice?: "auto" | "none";
};

export type AssistantMessage = Extract<ChatMessage, { role: "assistant" }>;

export type ChatCompletionResponse = {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: AssistantMessage;
    finish_reason: string | null;
  }>;
};

export type ChatCompletionClient = {
  createChatCompletion(
    request: ChatCompletionRequest,
  ): Promise<ChatCompletionResponse>;
};
