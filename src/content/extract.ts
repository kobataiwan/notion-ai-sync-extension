import type { Conversation, ConversationMessage, MessageRole } from "../lib/conversation.js";

function host(): string {
  return globalThis.location.hostname;
}

function asRole(r: string | null): MessageRole | null {
  if (r === "user" || r === "assistant" || r === "system") return r;
  return null;
}

/** ChatGPT / chat.openai.com: message articles expose data-message-author-role. */
function extractChatGpt(): ConversationMessage[] {
  const nodes = document.querySelectorAll("[data-message-author-role]");
  const out: ConversationMessage[] = [];
  nodes.forEach((el) => {
    const role = asRole(el.getAttribute("data-message-author-role"));
    if (!role) return;
    const text = (el as HTMLElement).innerText?.trim() ?? "";
    if (!text) return;
    out.push({ role, content: text });
  });
  return out;
}

/** Claude.ai: heuristic on message containers. */
function extractClaude(): ConversationMessage[] {
  const out: ConversationMessage[] = [];
  const candidates = document.querySelectorAll(
    "[data-is-streaming], .font-user-message, [data-testid='user-message'], [data-testid='assistant-message']"
  );
  candidates.forEach((el) => {
    const t = (el as HTMLElement).innerText?.trim();
    if (!t || t.length < 2) return;
    const cls = el.className?.toString() ?? "";
    const role: MessageRole = cls.includes("user") || el.getAttribute("data-testid") === "user-message"
      ? "user"
      : "assistant";
    out.push({ role, content: t });
  });
  if (out.length > 0) return dedupeAdjacent(out);
  const articles = document.querySelectorAll("div[data-test-render-count]");
  articles.forEach((el, i) => {
    const text = (el as HTMLElement).innerText?.trim();
    if (!text) return;
    out.push({ role: i % 2 === 0 ? "user" : "assistant", content: text });
  });
  return dedupeAdjacent(out);
}

function dedupeAdjacent(msgs: ConversationMessage[]): ConversationMessage[] {
  const r: ConversationMessage[] = [];
  for (const m of msgs) {
    const prev = r[r.length - 1];
    if (prev && prev.role === m.role && prev.content === m.content) continue;
    r.push(m);
  }
  return r;
}

/** Gemini: heuristic blocks. */
function extractGemini(): ConversationMessage[] {
  const out: ConversationMessage[] = [];
  const rows = document.querySelectorAll("message-content, .user-query, model-response");
  if (rows.length === 0) {
    const fallback = document.body?.innerText?.trim();
    if (fallback)
      return [{ role: "user", content: fallback.slice(0, 120_000) }];
    return [];
  }
  rows.forEach((el) => {
    const tag = el.tagName.toLowerCase();
    const text = (el as HTMLElement).innerText?.trim() ?? "";
    if (!text) return;
    const role: MessageRole =
      tag === "user-query" || el.classList.contains("user-query") ? "user" : "assistant";
    out.push({ role, content: text });
  });
  return dedupeAdjacent(out);
}

export function extractConversation(): Conversation {
  const h = host();
  let messages: ConversationMessage[] = [];
  if (h.includes("openai.com") || h.includes("chatgpt.com")) {
    messages = extractChatGpt();
  } else if (h.includes("claude.ai")) {
    messages = extractClaude();
  } else if (h.includes("gemini.google.com")) {
    messages = extractGemini();
  } else {
    const t = document.body?.innerText?.trim() ?? "";
    if (t) messages = [{ role: "user", content: t.slice(0, 120_000) }];
  }

  const model =
    document.querySelector("[data-testid='model-selector']")?.textContent?.trim() ??
    document.querySelector(".model-name")?.textContent?.trim() ??
    "";

  return {
    conversation_id: "",
    site: h,
    model,
    messages,
  };
}
