/**
 * Optional OpenAI-compatible chat completion for Markdown body reformatting.
 * Caller must ensure host permission for `llmBaseUrl` origin exists.
 */

export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export async function reformatBodyWithLlm(
  plainConversation: string,
  reformatPrompt: string,
  config: LlmConfig
): Promise<string> {
  const base = config.baseUrl.replace(/\/$/, "");
  const url = `${base}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: "system",
          content: reformatPrompt,
        },
        {
          role: "user",
          content: plainConversation,
        },
      ],
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`LLM ${res.status}: ${t}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("LLM response missing content");
  }
  return content.trim();
}

/** Returns origin (e.g. https://api.openai.com) for permission requests. */
export function originFromBaseUrl(baseUrl: string): string | null {
  try {
    const u = new URL(baseUrl);
    return u.origin;
  } catch {
    return null;
  }
}
