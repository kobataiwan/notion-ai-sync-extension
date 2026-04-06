# Notion AI Sync (Chrome MV3 extension)

Sync AI chat pages (ChatGPT, Claude, Gemini) to Notion with **customizable title, description, and body templates**, optional **OpenAI-compatible LLM** to reformat the body, and a **live preview** on the options page.

## Manifest V3 (MV3) constraints

This extension targets **Manifest V3** (`manifest_version: 3`). Treat these as hard rules:

### Service worker (background)

- The background script is a **service worker**: it is **not** long-lived. The browser may stop it at any time after idle.
- **Do not** rely on in-memory global variables for settings, sync queues, or tokens. **Persist** user data with `chrome.storage.local` (or `session` if appropriate).
- Long work should be **chunked** or **idempotent**: if the worker is killed mid-flight, the user can retry. For larger Notion payloads, this project splits block appends into batches.
- Register listeners at **top level** of the service worker file (no conditional listener registration inside async callbacks).

### Permissions and network

- **Notion API** (`https://api.notion.com/*`) is declared under `host_permissions` because sync always uses it when configured.
- **LLM endpoints** use **`optional_host_permissions`** (`https://*/*`, `http://*/*`): the extension requests **only the origin** derived from your configured base URL when you enable LLM reformat and sync.
- **Content scripts** are limited to known AI host patterns in `manifest.json`; widen `matches` only when you add site adapters.

### Storage

- **Settings** (Notion token, parent page id, templates, LLM config) live in **`chrome.storage.local`** via [`src/lib/storage.ts`](src/lib/storage.ts), so they survive service worker restarts and browser restarts.

## User-facing template placeholders

| Placeholder | Meaning |
|-------------|---------|
| `{{date}}` | UTC date `YYYY-MM-DD` |
| `{{time}}` | UTC time `HH:MM:SS` |
| `{{site}}` | Hostname (e.g. `chatgpt.com`) |
| `{{model}}` | Model label if detected in the page |
| `{{conversation_id}}` | From page if available (often empty) |
| `{{title_from_first_user_message}}` | First user message, truncated (see max length option) |
| `{{message_count}}` | Number of messages |
| `{{#each messages}}` … `{{/each}}` | Loop; inside use `{{role}}` and `{{content}}` |

## Build

```bash
cd extension
npm install
npm run build
```

Load **unpacked** from `extension/dist` in `chrome://extensions` (Developer mode).

## Configure Notion

1. Create an integration at [notion.so/my-integrations](https://www.notion.so/my-integrations) and copy the **internal integration token**.
2. Open the **parent page** where child pages should be created, click **Share**, and invite your integration.
3. Copy the parent page ID from the URL (32-character hex, with or without dashes).
4. Paste token and parent page ID into the extension options page.

## Project layout

| Path | Role |
|------|------|
| [`src/background/service-worker.ts`](src/background/service-worker.ts) | MV3 background: template + optional LLM + Notion create |
| [`src/content/`](src/content/) | DOM extraction per supported site |
| [`src/lib/template-engine.ts`](src/lib/template-engine.ts) | Minimal Mustache-style rendering |
| [`src/lib/storage.ts`](src/lib/storage.ts) | Persistent settings |
| [`src/notion/notion-mapper.ts`](src/notion/notion-mapper.ts) | Notion API + Markdown → blocks |
| [`src/llm/llm-client.ts`](src/llm/llm-client.ts) | Optional OpenAI-compatible chat completion |
| [`src/options/`](src/options/) | Options UI, presets, preview |
| [`src/popup/`](src/popup/) | Quick “Sync to Notion” for the active tab |

## Privacy

- **Default path**: Parsed conversation text stays in the extension and is sent **only to Notion** using your token.
- **LLM reformat** (optional): Plain conversation text is sent to the **HTTP origin you configure** (OpenAI-compatible server). It is **off** by default.
