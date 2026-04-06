/**
 * Minimal Mustache-style templates:
 * - `{{key}}` with alphanumeric/underscore keys
 * - `{{#each messages}} ... {{/each}}` loops; inside each iteration, message fields are merged into the context
 */

const EACH_RE =
  /\{\{#each\s+([\w.]+)\}\}([\s\S]*?)\{\{\/each\}\}/;

export function renderTemplate(
  template: string,
  context: Record<string, unknown>
): string {
  let result = template;
  while (EACH_RE.test(result)) {
    result = result.replace(EACH_RE, (_full, arrayKey: string, inner: string) => {
      const key = arrayKey.trim();
      const arr = context[key];
      if (!Array.isArray(arr)) return "";
      return arr
        .map((item) => {
          const merged: Record<string, unknown> = {
            ...context,
            ...(typeof item === "object" && item !== null && !Array.isArray(item)
              ? (item as Record<string, unknown>)
              : { value: item }),
          };
          return renderTemplate(inner, merged);
        })
        .join("");
    });
  }
  return result.replace(/\{\{([\w.]+)\}\}/g, (_m, key: string) => {
    const k = key.trim();
    const v = context[k];
    if (v === undefined || v === null) return "";
    if (typeof v === "object") return "";
    return String(v);
  });
}
