# Notion AI Sync — Implementation Status

## Current State

| Area | Status | Notes |
|------|--------|-------|
| MV3 scaffolding | ✅ Done | manifest.json, service worker, content scripts, popup, options |
| Template engine | ✅ Done | Mustache subset, `{{datetime_compact}}` added |
| Notion mapper | ✅ Done | Auto-detect page vs database parent, batched writes, Tags multi_select |
| Gemini extractor | ✅ Done | Multi-strategy role detection, fallback heuristics |
| ChatGPT extractor | ✅ Done | `data-message-author-role` attribute |
| Claude extractor | ✅ Done | Heuristic selectors + dedupe |
| LLM reformat | ⏳ Pending | Prompt ready (summary/takeaways/tags/conversation); blocked on Gemini API free tier quota — retry when billing enabled |
| Options UI | ✅ Done | Templates, presets, LLM config, live preview |
| Popup sync flow | ✅ Done | Permission request in user-gesture context |
| PLAN.md review | ✅ Done | 3 rounds of Codex + Composer2 review, all comments addressed |

## Pending / Next

- [ ] **LLM reformat end-to-end test** — enable billing on Google AI Studio, verify summary/takeaways/tags flow
- [ ] Add unit tests (vitest) for template engine, Notion block mapper, LLM tag extraction
- [ ] Commit all current changes

---

## Activity Log

### 2026-04-06 22:10 — Manual smoke test (LLM disabled)

- **Event**: test (manual)
- **Scope**: Full sync pipeline — Gemini → Notion (database target)
- **Details**:
  - Title format `{{datetime_compact}}-{{title_from_first_user_message}}` verified
  - Database parent auto-detection working (page_id vs database_id)
  - Model detection now returns "Gemini" instead of "unknown"
  - LLM reformat blocked by Gemini API free tier quota (429, limit: 0) — marked pending
- **Status**: 10 files modified, 0 committed, build passing

### 2026-04-06 21:50 — Fix permission request context

- **Event**: edit
- **Scope**: `src/popup/popup.ts`, `src/background/service-worker.ts`
- **Details**:
  - Moved `chrome.permissions.request()` from service worker to popup click handler (user gesture required)
  - Service worker now only checks `permissions.contains()`
- **Status**: build passing

### 2026-04-06 21:30 — Feature: title format, LLM summary/tags, Notion Tags property

- **Event**: edit
- **Scope**: `src/lib/template-context.ts`, `src/lib/storage.ts`, `src/lib/presets.ts`, `src/llm/llm-client.ts`, `src/background/service-worker.ts`, `src/notion/notion-mapper.ts`
- **Details**:
  - Added `{{datetime_compact}}` placeholder (local YYYYMMDDHHmm)
  - Default title template → `{{datetime_compact}}-{{title_from_first_user_message}}`
  - LLM prompt now requests Summary, Key Takeaways, Tags, Conversation
  - `reformatBodyWithLlm` returns `{ body, tags }` — tags extracted from ## Tags section
  - Notion mapper writes `Tags` as multi_select property for database parents
- **Status**: build passing

### 2026-04-06 20:30 — Fix database parent support

- **Event**: edit
- **Scope**: `src/notion/notion-mapper.ts`
- **Details**:
  - Added `resolveParentType()` — probes Notion API to detect page vs database
  - `createNotionPage` now uses `database_id` or `page_id` accordingly
- **Status**: build passing

### 2026-04-06 19:30 — PLAN.md polished (3 rounds Codex + Composer2)

- **Event**: review
- **Scope**: `docs/PLAN.md`, `README.md`
- **Details**:
  - Deprecated YAML frontmatter todos
  - Added: product story, doc split table, non-goals, assumptions, extension surfaces (§3.1), Notion API version/backoff pins (§2.1), failure matrix (§8), test gate (§9), idempotency appendix, prompt-injection/Markdown edge cases (§7)
  - README: fixed build path, added contributor gate pointer, privacy storage note
  - Final verdicts: Codex "Ready (minor)", Composer2 "Ship"
- **Status**: docs complete
