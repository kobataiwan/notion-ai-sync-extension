import type { UserTemplateSettings } from "./storage.js";

export type PresetId = "minimal" | "thread" | "qa";

export const PRESETS: Record<PresetId, UserTemplateSettings> = {
  minimal: {
    titleTemplate: "{{date}} — {{site}} ({{message_count}} msgs)",
    descriptionTemplate: "Model: {{model}}",
    bodyTemplate: `{{#each messages}}
**{{role}}**
{{content}}

{{/each}}`,
  },
  thread: {
    titleTemplate: "{{title_from_first_user_message}}",
    descriptionTemplate: "{{site}} · {{model}} · {{date}} {{time}}",
    bodyTemplate: `{{#each messages}}
## {{role}}
{{content}}

{{/each}}`,
  },
  qa: {
    titleTemplate: "Q&A — {{title_from_first_user_message}}",
    descriptionTemplate: "Messages: {{message_count}} · {{site}}",
    bodyTemplate: `{{#each messages}}
### {{role}}
{{content}}

{{/each}}`,
  },
};
