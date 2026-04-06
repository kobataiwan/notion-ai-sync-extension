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

async function checkOptionalOrigin(origin: string): Promise<void> {
  const has = await chrome.permissions.contains({
    origins: [`${origin}/*`],
  });
  if (!has) {
    throw new Error(
      `Missing host permission for ${origin}. Please grant it when prompted and retry.`
    );
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

  const title = renderTemplate(settings.titleTemplate, ctx);
  const description = renderTemplate(settings.descriptionTemplate, ctx);
  let body = renderTemplate(settings.bodyTemplate, ctx);
  let tags: string[] = [];

  if (settings.useLlmReformat && settings.llmApiKey.trim()) {
    const o = originFromBaseUrl(settings.llmBaseUrl);
    if (!o) throw new Error("Invalid LLM base URL");
    await checkOptionalOrigin(o);
    const plain = conversationToPlainText(conv);
    const result = await reformatBodyWithLlm(plain, settings.llmReformatPrompt, {
      baseUrl: settings.llmBaseUrl,
      apiKey: settings.llmApiKey,
      model: settings.llmModel,
    });
    body = result.body;
    tags = result.tags;
  }

  const created = await createNotionPage({
    token: settings.notionToken,
    parentPageId: settings.parentPageId,
    title,
    description,
    bodyMarkdown: body,
    tags,
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
