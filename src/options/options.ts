import type { Conversation } from "../lib/conversation.js";
import { buildTemplateContext } from "../lib/template-context.js";
import { renderTemplate } from "../lib/template-engine.js";
import {
  DEFAULT_SETTINGS,
  type ExtensionSettings,
  loadSettings,
  saveSettings,
} from "../lib/storage.js";
import { PRESETS, type PresetId } from "../lib/presets.js";

const SAMPLE_CONVERSATION: Conversation = {
  conversation_id: "sample-1",
  site: "chatgpt.com",
  model: "gpt-4o",
  messages: [
    { role: "user", content: "Explain MV3 service workers in one sentence." },
    {
      role: "assistant",
      content:
        "MV3 runs your background logic in an event-driven service worker that may sleep, so persist state in chrome.storage instead of global variables.",
    },
  ],
};

function el<T extends HTMLElement>(id: string): T {
  const n = document.getElementById(id);
  if (!n) throw new Error(`Missing #${id}`);
  return n as T;
}

function readForm(): ExtensionSettings {
  return {
    notionToken: el<HTMLInputElement>("notionToken").value,
    parentPageId: el<HTMLInputElement>("parentPageId").value,
    firstUserTitleMaxLen: Number(el<HTMLInputElement>("firstUserTitleMaxLen").value) || 80,
    titleTemplate: el<HTMLTextAreaElement>("titleTemplate").value,
    descriptionTemplate: el<HTMLTextAreaElement>("descriptionTemplate").value,
    bodyTemplate: el<HTMLTextAreaElement>("bodyTemplate").value,
    useLlmReformat: el<HTMLInputElement>("useLlmReformat").checked,
    llmBaseUrl: el<HTMLInputElement>("llmBaseUrl").value,
    llmApiKey: el<HTMLInputElement>("llmApiKey").value,
    llmModel: el<HTMLInputElement>("llmModel").value,
    llmReformatPrompt: el<HTMLTextAreaElement>("llmReformatPrompt").value,
  };
}

function writeForm(s: ExtensionSettings): void {
  el<HTMLInputElement>("notionToken").value = s.notionToken;
  el<HTMLInputElement>("parentPageId").value = s.parentPageId;
  el<HTMLInputElement>("firstUserTitleMaxLen").value = String(s.firstUserTitleMaxLen);
  el<HTMLTextAreaElement>("titleTemplate").value = s.titleTemplate;
  el<HTMLTextAreaElement>("descriptionTemplate").value = s.descriptionTemplate;
  el<HTMLTextAreaElement>("bodyTemplate").value = s.bodyTemplate;
  el<HTMLInputElement>("useLlmReformat").checked = s.useLlmReformat;
  el<HTMLInputElement>("llmBaseUrl").value = s.llmBaseUrl;
  el<HTMLInputElement>("llmApiKey").value = s.llmApiKey;
  el<HTMLInputElement>("llmModel").value = s.llmModel;
  el<HTMLTextAreaElement>("llmReformatPrompt").value = s.llmReformatPrompt;
}

function updatePreview(): void {
  const s = readForm();
  const ctx = buildTemplateContext(SAMPLE_CONVERSATION, {
    firstUserTitleMaxLen: s.firstUserTitleMaxLen,
  });
  const title = renderTemplate(s.titleTemplate, ctx);
  const description = renderTemplate(s.descriptionTemplate, ctx);
  const body = renderTemplate(s.bodyTemplate, ctx);
  el<HTMLPreElement>("preview").textContent = [
    `TITLE:\n${title}`,
    "",
    `DESCRIPTION:\n${description}`,
    "",
    `BODY:\n${body}`,
  ].join("\n");
}

async function init(): Promise<void> {
  const s = await loadSettings();
  writeForm({ ...DEFAULT_SETTINGS, ...s });

  const onChange = () => updatePreview();
  ["titleTemplate", "descriptionTemplate", "bodyTemplate", "firstUserTitleMaxLen"].forEach((id) => {
    el<HTMLTextAreaElement | HTMLInputElement>(id).addEventListener("input", onChange);
  });

  document.querySelectorAll("[data-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = (btn as HTMLButtonElement).dataset.preset as PresetId;
      const p = PRESETS[id];
      if (!p) return;
      el<HTMLTextAreaElement>("titleTemplate").value = p.titleTemplate;
      el<HTMLTextAreaElement>("descriptionTemplate").value = p.descriptionTemplate;
      el<HTMLTextAreaElement>("bodyTemplate").value = p.bodyTemplate;
      updatePreview();
    });
  });

  updatePreview();

  el<HTMLButtonElement>("save").addEventListener("click", async () => {
    const status = el<HTMLSpanElement>("save-status");
    status.textContent = "Saving…";
    try {
      await saveSettings(readForm());
      status.textContent = "Saved.";
      setTimeout(() => {
        status.textContent = "";
      }, 2000);
    } catch (e) {
      status.textContent = e instanceof Error ? e.message : String(e);
    }
  });
}

void init();
