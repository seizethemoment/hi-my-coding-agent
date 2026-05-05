export type JsonSchema = {
  type?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  enum?: string[];
  items?: JsonSchema;
  [key: string]: unknown;
};

export type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: JsonSchema;
  };
};

export type ToolChoice =
  | "none"
  | "auto"
  | {
      type: "function";
      function: {
        name: string;
      };
    };

export type ChatContentPart = {
  type: "text";
  text: string;
};

export type ChatContent = string | ChatContentPart[];

export type ChatToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type SystemMessage = {
  role: "system";
  content: ChatContent;
};

export type UserMessage = {
  role: "user";
  content: ChatContent;
};

export type AssistantMessage = {
  role: "assistant";
  content: string | null;
  reasoning_content?: string | null;
  tool_calls?: ChatToolCall[];
};

export type ToolMessage = {
  role: "tool";
  content: string;
  tool_call_id: string;
};

export type ChatMessage =
  | SystemMessage
  | UserMessage
  | AssistantMessage
  | ToolMessage;

export type ChatCompletionUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  completion_tokens_details?: Record<string, unknown> | null;
  prompt_tokens_details?: Record<string, unknown> | null;
};

export type ChatCompletionFinishReason =
  | "stop"
  | "length"
  | "tool_calls"
  | "content_filter"
  | null;

export type ChatCompletionChoice = {
  index: number;
  message: AssistantMessage;
  finish_reason: ChatCompletionFinishReason;
  logprobs?: unknown | null;
};

export type ChatCompletionResponse = {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage?: ChatCompletionUsage | null;
  system_fingerprint?: string | null;
  service_tier?: string | null;
};

export type ChatCompletionRequest = {
  model: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  tool_choice?: ToolChoice;
  temperature?: number;
  max_tokens?: number;
  stop?: string[];
  stream_options?: {
    include_usage?: boolean;
  };
  extraBody?: Record<string, unknown>;
};

export type ChatCompletionDeltaToolCall = {
  index: number;
  id?: string;
  type?: "function";
  function?: {
    name?: string;
    arguments?: string;
  };
};

export type ChatCompletionDelta = {
  role?: "assistant";
  content?: string | null;
  reasoning_content?: string | null;
  tool_calls?: ChatCompletionDeltaToolCall[] | null;
};

export type ChatCompletionChunkChoice = {
  index: number;
  delta: ChatCompletionDelta;
  finish_reason: ChatCompletionFinishReason;
  logprobs?: unknown | null;
};

export type ChatCompletionChunk = {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatCompletionChunkChoice[];
  usage?: ChatCompletionUsage | null;
  system_fingerprint?: string | null;
  service_tier?: string | null;
};

export type ChatCompletionStreamEvent =
  | {
      type: "chunk";
      chunk: ChatCompletionChunk;
    }
  | {
      type: "text_delta";
      choiceIndex: number;
      delta: string;
    }
  | {
      type: "reasoning_delta";
      choiceIndex: number;
      delta: string;
    }
  | {
      type: "tool_call_delta";
      choiceIndex: number;
      toolCallIndex: number;
      delta: ChatCompletionDeltaToolCall;
    }
  | {
      type: "finish";
      choiceIndex: number;
      finishReason: ChatCompletionFinishReason;
    }
  | {
      type: "usage";
      usage: ChatCompletionUsage;
    }
  | {
      type: "done";
    };

export type OpenAICompatibleErrorBody = {
  error?: {
    message?: string;
    type?: string;
    param?: string | null;
    code?: string | null;
  };
};
