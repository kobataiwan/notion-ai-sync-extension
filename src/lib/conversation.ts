/** Normalized message from an AI chat page (content script output). */

export type MessageRole = "user" | "assistant" | "system";

export interface ConversationMessage {
  role: MessageRole;
  content: string;
}

export interface Conversation {
  /** Stable id if the page exposes one (often empty). */
  conversation_id: string;
  site: string;
  /** Model label if visible in UI. */
  model: string;
  messages: ConversationMessage[];
}

export function conversationToPlainText(conv: Conversation): string {
  return conv.messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n\n");
}
