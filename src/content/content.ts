import { extractConversation } from "./extract.js";

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "GET_CONVERSATION") {
    try {
      const conv = extractConversation();
      sendResponse({ ok: true, conversation: conv });
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
    return true;
  }
  return undefined;
});
