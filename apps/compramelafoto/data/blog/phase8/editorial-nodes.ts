import type { JSONContent } from "@tiptap/core";
import { buildCtaParagraph } from "@/data/blog/phase8/cta";
import type { CtaAudience, EditorialBlock, EditorialFaqItem, EditorialInlinePart, EditorialPromoCta } from "@/data/blog/phase8/types";

export function p(text: string): EditorialBlock {
  return { type: "p", text };
}

/** Párrafo con enlaces internos (SEO). */
export function pr(...parts: EditorialInlinePart[]): EditorialBlock {
  return { type: "pr", parts };
}

function inlinePartsToJson(parts: EditorialInlinePart[]): JSONContent {
  return {
    type: "paragraph",
    content: parts.map((part) => {
      if (part.type === "text") {
        return { type: "text", text: part.text };
      }
      return {
        type: "text",
        text: part.text,
        marks: [
          {
            type: "link",
            attrs: { href: part.href, target: "_self", rel: "noopener noreferrer" },
          },
        ],
      };
    }),
  };
}

export function h2(text: string): EditorialBlock {
  return { type: "h2", text };
}

export function h3(text: string): EditorialBlock {
  return { type: "h3", text };
}

export function ul(items: string[]): EditorialBlock {
  return { type: "ul", items };
}

export function blockquote(text: string): EditorialBlock {
  return { type: "blockquote", text };
}

function blockToJson(block: EditorialBlock): JSONContent {
  switch (block.type) {
    case "p":
      return { type: "paragraph", content: [{ type: "text", text: block.text }] };
    case "pr":
      return inlinePartsToJson(block.parts);
    case "h2":
      return {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: block.text }],
      };
    case "h3":
      return {
        type: "heading",
        attrs: { level: 3 },
        content: [{ type: "text", text: block.text }],
      };
    case "ul":
      return {
        type: "bulletList",
        content: block.items.map((item) => ({
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: item }] }],
        })),
      };
    case "blockquote":
      return {
        type: "blockquote",
        content: [{ type: "paragraph", content: [{ type: "text", text: block.text }] }],
      };
  }
}

export function assembleContentJson(
  blocks: EditorialBlock[],
  faq: EditorialFaqItem[],
  conclusion: string,
  ctaAudience: CtaAudience,
  promoCta?: EditorialPromoCta
): JSONContent {
  const content: JSONContent[] = blocks.map(blockToJson);

  if (faq.length > 0) {
    content.push(blockToJson(h2("Preguntas frecuentes")));
    for (const item of faq) {
      content.push(blockToJson(h3(item.q)));
      content.push(blockToJson(p(item.a)));
    }
  }

  content.push(blockToJson(h2("Conclusión")));
  content.push(blockToJson(p(conclusion)));

  if (!promoCta) {
    content.push(blockToJson(p(buildCtaParagraph(ctaAudience))));
  }

  return { type: "doc", content };
}
