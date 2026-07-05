import type { JSONContent } from "@tiptap/core";

/** Documento TipTap vacío reutilizable al crear artículos nuevos. */
export const EMPTY_BLOG_CONTENT_JSON: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export function createEmptyBlogContentJson(): JSONContent {
  return structuredClone(EMPTY_BLOG_CONTENT_JSON);
}

type ProseMirrorNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: ProseMirrorNode[];
  text?: string;
};

/** Convierte H1 residuales a H2 (p. ej. contenido pegado desde fuera). */
export function downgradeH1InContentJson(content: JSONContent): JSONContent {
  return normalizeHeadingLevels(structuredClone(content) as ProseMirrorNode) as JSONContent;
}

function normalizeHeadingLevels(node: ProseMirrorNode): ProseMirrorNode {
  if (node.type === "heading" && node.attrs?.level === 1) {
    return {
      ...node,
      attrs: { ...node.attrs, level: 2 },
    };
  }
  if (Array.isArray(node.content)) {
    return {
      ...node,
      content: node.content.map(normalizeHeadingLevels),
    };
  }
  return node;
}

/** Detecta si el JSON contiene un heading de nivel 1. */
export function contentJsonHasH1(content: JSONContent): boolean {
  return walkForH1(content as ProseMirrorNode);
}

function walkForH1(node: ProseMirrorNode): boolean {
  if (node.type === "heading" && node.attrs?.level === 1) {
    return true;
  }
  if (!Array.isArray(node.content)) {
    return false;
  }
  return node.content.some(walkForH1);
}

/** Extrae texto plano del documento TipTap (lectura, SEO auxiliar). */
export function extractPlainTextFromContentJson(content: JSONContent): string {
  const parts: string[] = [];
  collectText(content as ProseMirrorNode, parts);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function collectText(node: ProseMirrorNode, parts: string[]): void {
  if (typeof node.text === "string" && node.text.trim()) {
    parts.push(node.text.trim());
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      collectText(child, parts);
    }
  }
}
