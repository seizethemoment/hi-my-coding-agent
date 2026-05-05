import type {
  AssistantMessage,
  ChatMessage,
  SystemMessage,
  ToolMessage,
  UserMessage,
} from "../llm/protocol.js";

export class MessageState {
  private readonly messages: ChatMessage[];

  constructor(systemPrompt?: string) {
    this.messages = [];

    if (systemPrompt) {
      const systemMessage: SystemMessage = {
        role: "system",
        content: systemPrompt,
      };
      this.messages.push(systemMessage);
    }
  }

  appendUserText(content: string): UserMessage {
    const message: UserMessage = {
      role: "user",
      content,
    };
    this.messages.push(message);
    return message;
  }

  appendAssistantMessage(message: AssistantMessage): AssistantMessage {
    this.messages.push(message);
    return message;
  }

  appendToolResult(toolCallId: string, content: string): ToolMessage {
    const message: ToolMessage = {
      role: "tool",
      tool_call_id: toolCallId,
      content,
    };
    this.messages.push(message);
    return message;
  }

  getMessages(): ChatMessage[] {
    return [...this.messages];
  }
}
