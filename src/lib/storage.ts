/** Keys persisted in chrome.storage.local (survives service worker restarts). */

export interface UserTemplateSettings {
  titleTemplate: string;
  descriptionTemplate: string;
  bodyTemplate: string;
}

export interface ExtensionSettings extends UserTemplateSettings {
  notionToken: string;
  /** Parent page UUID (with or without dashes). */
  parentPageId: string;
  firstUserTitleMaxLen: number;
  useLlmReformat: boolean;
  llmBaseUrl: string;
  llmApiKey: string;
  llmModel: string;
  llmReformatPrompt: string;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  notionToken: "",
  parentPageId: "",
  firstUserTitleMaxLen: 80,
  titleTemplate: "{{date}} — {{site}} ({{message_count}} msgs)",
  descriptionTemplate: "Model: {{model}}",
  bodyTemplate: `{{#each messages}}
**{{role}}**
{{content}}

{{/each}}`,
  useLlmReformat: false,
  llmBaseUrl: "https://api.openai.com/v1",
  llmApiKey: "",
  llmModel: "gpt-4o-mini",
  llmReformatPrompt:
    "Rewrite the following conversation as clean Markdown: use ## for each speaker turn, keep code in fenced blocks.",
};

const STORAGE_KEY = "notionAiSyncSettings";

export async function loadSettings(): Promise<ExtensionSettings> {
  const raw = await chrome.storage.local.get(STORAGE_KEY);
  const v = raw[STORAGE_KEY] as Partial<ExtensionSettings> | undefined;
  return { ...DEFAULT_SETTINGS, ...v };
}

export async function saveSettings(
  partial: Partial<ExtensionSettings>
): Promise<ExtensionSettings> {
  const cur = await loadSettings();
  const next = { ...cur, ...partial };
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}
