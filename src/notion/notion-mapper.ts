/** Notion API helpers: map title, description, and Markdown-ish body to block children. */

const NOTION_VERSION = "2022-06-28";

export interface NotionRichText {
  type: "text";
  text: { content: string };
  annotations?: { bold?: boolean; italic?: boolean };
}

export interface NotionBlock {
  object: "block";
  type: string;
  [key: string]: unknown;
}

function paragraph(text: string): NotionBlock {
  return {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: text
        ? [{ type: "text", text: { content: text.slice(0, 2000) } }]
        : [],
    },
  };
}

function heading(level: 1 | 2 | 3, text: string): NotionBlock {
  const t = `heading_${level}` as const;
  return {
    object: "block",
    type: t,
    [t]: {
      rich_text: [{ type: "text", text: { content: text.slice(0, 2000) } }],
    },
  };
}

function bullet(text: string): NotionBlock {
  return {
    object: "block",
    type: "bulleted_list_item",
    bulleted_list_item: {
      rich_text: [{ type: "text", text: { content: text.slice(0, 2000) } }],
    },
  };
}

function codeBlock(code: string): NotionBlock {
  return {
    object: "block",
    type: "code",
    code: {
      rich_text: [{ type: "text", text: { content: code.slice(0, 2000) } }],
      language: "plain text",
    },
  };
}

/**
 * Simplified Markdown → Notion blocks: headings (#/##/###), bullets (-), fenced ``` code ```, paragraphs.
 */
export function markdownToNotionBlocks(markdown: string): NotionBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: NotionBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === "") {
      i += 1;
      continue;
    }
    if (trimmed.startsWith("```")) {
      const fence = trimmed;
      const lang = fence.slice(3).trim();
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        body.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push(codeBlock(body.join("\n")));
      void lang;
      continue;
    }
    if (trimmed.startsWith("### ")) {
      blocks.push(heading(3, trimmed.slice(4)));
      i += 1;
      continue;
    }
    if (trimmed.startsWith("## ")) {
      blocks.push(heading(2, trimmed.slice(3)));
      i += 1;
      continue;
    }
    if (trimmed.startsWith("# ")) {
      blocks.push(heading(1, trimmed.slice(2)));
      i += 1;
      continue;
    }
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      blocks.push(bullet(trimmed.slice(2)));
      i += 1;
      continue;
    }
    blocks.push(paragraph(trimmed));
    i += 1;
  }
  if (blocks.length === 0) blocks.push(paragraph(""));
  return blocks;
}

function normalizeNotionId(id: string): string {
  const s = id.replace(/-/g, "").trim();
  if (s.length !== 32) return id.trim();
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

async function resolveParentType(
  token: string,
  id: string
): Promise<"page" | "database"> {
  const res = await fetch(`https://api.notion.com/v1/databases/${id}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
    },
  });
  return res.ok ? "database" : "page";
}

export async function createNotionPage(params: {
  token: string;
  parentPageId: string;
  title: string;
  description: string;
  bodyMarkdown: string;
  tags?: string[];
}): Promise<{ id: string; url?: string }> {
  const parentId = normalizeNotionId(params.parentPageId);
  const parentType = await resolveParentType(params.token, parentId);

  const titleProp = {
    title: [{ type: "text" as const, text: { content: params.title.slice(0, 2000) } }],
  };

  const properties: Record<string, unknown> = { title: titleProp };

  if (parentType === "database" && params.tags && params.tags.length > 0) {
    properties["Tags"] = {
      multi_select: params.tags.map((t) => ({ name: t })),
    };
  }

  const children: NotionBlock[] = [];
  if (params.description.trim()) {
    children.push(paragraph(params.description.trim()));
  }
  children.push(...markdownToNotionBlocks(params.bodyMarkdown));

  const chunkSize = 100;
  const firstBatch = children.slice(0, chunkSize);
  const rest = children.slice(chunkSize);

  const parent =
    parentType === "database"
      ? { database_id: parentId }
      : { page_id: parentId };

  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.token}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      parent,
      properties,
      children: firstBatch,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Notion ${res.status}: ${errText}`);
  }

  const data = (await res.json()) as { id: string; url?: string };
  const pageUrl =
    data.url ??
    `https://www.notion.so/${data.id.replace(/-/g, "")}`;

  for (let off = 0; off < rest.length; off += chunkSize) {
    const batch = rest.slice(off, off + chunkSize);
    const patch = await fetch(
      `https://api.notion.com/v1/blocks/${data.id}/children`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${params.token}`,
          "Content-Type": "application/json",
          "Notion-Version": NOTION_VERSION,
        },
        body: JSON.stringify({ children: batch }),
      }
    );
    if (!patch.ok) {
      const errText = await patch.text();
      throw new Error(`Notion append blocks ${patch.status}: ${errText}`);
    }
  }

  return { id: data.id, url: pageUrl };
}
