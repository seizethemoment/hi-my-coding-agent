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
    description?: string;
    parameters: Record<string, unknown>;
  };
};

export type ChatToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type ChatCompletionRequest = {
  model: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  stream?: boolean;
  extraBody?: Record<string, unknown>;
};

export type ChatCompletionResponse = {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: "assistant";
      content: string | null;
      tool_calls?: ChatToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type StreamEvent =
  | {
      type: "text_delta";
      delta: string;
    }
  | {
      type: "tool_call_delta";
      delta: unknown;
    }
  | {
      type: "done";
    };
