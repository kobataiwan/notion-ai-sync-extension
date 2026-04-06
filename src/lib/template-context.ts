import type { Conversation, ConversationMessage } from "./conversation.js";

/**
 * Placeholder keys documented for users (see README).
 * Passed to the Mustache-style template engine.
 */
export interface TemplateContext extends Record<string, unknown> {
  date: string;
  time: string;
  datetime_compact: string;
  site: string;
  model: string;
  conversation_id: string;
  title_from_first_user_message: string;
  message_count: string;
  messages: ConversationMessage[];
}

export function buildTemplateContext(
  conv: Conversation,
  opts: { firstUserTitleMaxLen: number; now?: Date }
): TemplateContext {
  const d = opts.now ?? new Date();
  const isoDate = d.toISOString();
  const date = isoDate.slice(0, 10);
  const time = isoDate.slice(11, 19);
  const datetime_compact =
    d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0") +
    String(d.getHours()).padStart(2, "0") +
    String(d.getMinutes()).padStart(2, "0");
  const firstUser = conv.messages.find((m) => m.role === "user");
  const firstAny = conv.messages[0];
  const rawTitle = firstUser?.content?.trim() || firstAny?.content?.trim() || "";
  const title_from_first_user_message =
    rawTitle.length > opts.firstUserTitleMaxLen
      ? `${rawTitle.slice(0, opts.firstUserTitleMaxLen)}…`
      : rawTitle;

  return {
    date,
    time,
    datetime_compact,
    site: conv.site,
    model: conv.model || "unknown",
    conversation_id: conv.conversation_id || "",
    title_from_first_user_message,
    message_count: String(conv.messages.length),
    messages: conv.messages,
  };
}
