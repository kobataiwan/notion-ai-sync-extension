import type { Conversation } from "../lib/conversation.js";
import { conversationToPlainText } from "../lib/conversation.js";
import { buildTemplateContext } from "../lib/template-context.js";
import { renderTemplate } from "../lib/template-engine.js";
import { loadSettings } from "../lib/storage.js";
import { createNotionPage } from "../notion/notion-mapper.js";
import {
  originFromBaseUrl,
  reformatBodyWithLlm,
} from "../llm/llm-client.js";

async function ensureOptionalOrigin(origin: string): Promise<void> {
  const has = await chrome.permissions.contains({
    origins: [`${origin}/*`],
  });
  if (!has) {
    const granted = await chrome.permissions.request({
      origins: [`${origin}/*`],
    });
    if (!granted) throw new Error("Permission denied for LLM API origin");
  }
}

export async function syncConversationToNotion(
  conv: Conversation
): Promise<{ pageUrl?: string; error?: string }> {
  const settings = await loadSettings();
  if (!settings.notionToken?.trim()) {
    return { error: "Set Notion integration token in extension options." };
  }
  if (!settings.parentPageId?.trim()) {
    return { error: "Set parent Notion page ID in extension options." };
  }

  const ctx = buildTemplateContext(conv, {
    firstUserTitleMaxLen: settings.firstUserTitleMaxLen,
  });

  let title = renderTemplate(settings.titleTemplate, ctx);
  let description = renderTemplate(settings.descriptionTemplate, ctx);
  let body = renderTemplate(settings.bodyTemplate, ctx);

  if (settings.useLlmReformat && settings.llmApiKey.trim()) {
    const o = originFromBaseUrl(settings.llmBaseUrl);
    if (!o) throw new Error("Invalid LLM base URL");
    await ensureOptionalOrigin(o);
    const plain = conversationToPlainText(conv);
    body = await reformatBodyWithLlm(plain, settings.llmReformatPrompt, {
      baseUrl: settings.llmBaseUrl,
      apiKey: settings.llmApiKey,
      model: settings.llmModel,
    });
  }

  const created = await createNotionPage({
    token: settings.notionToken,
    parentPageId: settings.parentPageId,
    title,
    description,
    bodyMarkdown: body,
  });

  return { pageUrl: created.url };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "SYNC_CONVERSATION" && msg.conversation) {
    syncConversationToNotion(msg.conversation as Conversation)
      .then((r) => sendResponse({ ok: true, ...r }))
      .catch((e: unknown) =>
        sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) })
      );
    return true;
  }
  return undefined;
});
