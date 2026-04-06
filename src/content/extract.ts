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

/** Gemini: try multiple selector strategies. */
function extractGemini(): ConversationMessage[] {
  const out: ConversationMessage[] = [];

  const turns = document.querySelectorAll(".conversation-turn, .turn-content, [data-turn-id]");
  if (turns.length > 0) {
    turns.forEach((el) => {
      const text = (el as HTMLElement).innerText?.trim() ?? "";
      if (!text) return;
      const html = el.outerHTML.toLowerCase();
      const role: MessageRole =
        html.includes("user") || el.querySelector(".user-query, .query-text") ? "user" : "assistant";
      out.push({ role, content: text });
    });
    if (out.length > 0) return dedupeAdjacent(out);
  }

  const userEls = document.querySelectorAll(".user-query, .query-text, user-query");
  const modelEls = document.querySelectorAll("model-response, .model-response");
  if (userEls.length > 0 || modelEls.length > 0) {
    const pairs: Array<{ el: Element; role: MessageRole }> = [];
    userEls.forEach((el) => pairs.push({ el, role: "user" }));
    modelEls.forEach((el) => pairs.push({ el, role: "assistant" }));
    pairs.sort((a, b) => {
      const pos = a.el.compareDocumentPosition(b.el);
      return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
    for (const { el, role } of pairs) {
      const text = (el as HTMLElement).innerText?.trim() ?? "";
      if (text) out.push({ role, content: text });
    }
    if (out.length > 0) return dedupeAdjacent(out);
  }

  const msgContents = document.querySelectorAll("message-content");
  if (msgContents.length > 0) {
    msgContents.forEach((el, i) => {
      const text = (el as HTMLElement).innerText?.trim() ?? "";
      if (!text) return;
      out.push({ role: i % 2 === 0 ? "user" : "assistant", content: text });
    });
    if (out.length > 0) return dedupeAdjacent(out);
  }

  const fallback = document.body?.innerText?.trim();
  if (fallback) return [{ role: "user", content: fallback.slice(0, 120_000) }];
  return [];
}

function detectModel(hostname: string): string {
  const selectors = [
    "[data-testid='model-selector']",
    ".model-name",
    "[data-testid='model-switcher'] span",
    "button[aria-haspopup] [data-testid]",
  ];
  for (const s of selectors) {
    const t = document.querySelector(s)?.textContent?.trim();
    if (t) return t;
  }
  if (hostname.includes("gemini.google.com")) {
    const btn = document.querySelector(
      "mat-menu-trigger, .model-selector, button.mdc-button, [aria-label*='model'], .selected-model"
    );
    if (btn?.textContent?.trim()) return btn.textContent.trim();
    const title = document.title;
    const m = /gemini\s*([\d.]+\s*\w*)/i.exec(title);
    if (m) return `Gemini ${m[1].trim()}`;
    return "Gemini";
  }
  if (hostname.includes("claude.ai")) return "Claude";
  if (hostname.includes("chatgpt.com") || hostname.includes("openai.com")) return "ChatGPT";
  return "";
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

  const model = detectModel(h);

  return {
    conversation_id: "",
    site: h,
    model,
    messages,
  };
}
