const statusEl = document.getElementById("status")!;
const syncBtn = document.getElementById("sync") as HTMLButtonElement;
const openOpts = document.getElementById("open-options") as HTMLAnchorElement;

openOpts.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

syncBtn.addEventListener("click", async () => {
  statusEl.textContent = "Reading page…";
  syncBtn.disabled = true;
  try {
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
