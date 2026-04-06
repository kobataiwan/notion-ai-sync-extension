import { loadSettings } from "../lib/storage.js";
import { originFromBaseUrl } from "../llm/llm-client.js";

const statusEl = document.getElementById("status")!;
const syncBtn = document.getElementById("sync") as HTMLButtonElement;
const openOpts = document.getElementById("open-options") as HTMLAnchorElement;

openOpts.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

async function ensureLlmPermission(): Promise<void> {
  const s = await loadSettings();
  if (!s.useLlmReformat || !s.llmApiKey.trim()) return;
  const origin = originFromBaseUrl(s.llmBaseUrl);
  if (!origin) return;
  const has = await chrome.permissions.contains({ origins: [`${origin}/*`] });
  if (has) return;
  const granted = await chrome.permissions.request({ origins: [`${origin}/*`] });
  if (!granted) throw new Error("Permission denied for LLM API origin");
}

syncBtn.addEventListener("click", async () => {
  statusEl.textContent = "Checking permissions…";
  syncBtn.disabled = true;
  try {
    await ensureLlmPermission();
    statusEl.textContent = "Reading page…";
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab");
    const resp = await chrome.tabs.sendMessage(tab.id, { type: "GET_CONVERSATION" });
    if (!resp?.ok) throw new Error(resp?.error ?? "Failed to read conversation");
    statusEl.textContent = "Syncing…";
    const sync = await chrome.runtime.sendMessage({
      type: "SYNC_CONVERSATION",
      conversation: resp.conversation,
    });
    if (!sync?.ok) throw new Error(sync?.error ?? "Sync failed");
    if (sync.pageUrl) {
      statusEl.textContent = "Done.";
      await chrome.tabs.create({ url: sync.pageUrl });
    } else {
      statusEl.textContent = "Synced (no URL returned).";
    }
  } catch (e) {
    statusEl.textContent = e instanceof Error ? e.message : String(e);
  } finally {
    syncBtn.disabled = false;
  }
});
