import type { JSONContent } from "@tiptap/core";
import type { Phase7ArticleDraft } from "@/data/blog/phase7/types";

export type CtaAudience = "fotografos" | "organizadores" | "escuelas" | "clientes";

export type EditorialInlinePart =
  | { type: "text"; text: string }
  | { type: "link"; text: string; href: string };

export type EditorialBlock =
  | { type: "p"; text: string }
  | { type: "pr"; parts: EditorialInlinePart[] }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "blockquote"; text: string };

export type EditorialPromoCta = {
  title: string;
  paragraphs: string[];
  buttonLabel: string;
  buttonHref: string;
};

export type EditorialFaqItem = { q: string; a: string };

/** Contenido editorial completo listo para publicar (Fase 8). */
export type Phase8ArticleContent = {
  seoTitle: string;
  seoDescription: string;
  excerpt: string;
  blocks: EditorialBlock[];
  faq: EditorialFaqItem[];
  conclusion: string;
  ctaAudience: CtaAudience;
  /** Si está definido, reemplaza el párrafo CTA genérico al final del artículo. */
  promoCta?: EditorialPromoCta;
  imageScene: string;
  imageAltSubject: string;
  imageCaption?: string;
};

export type Phase8PreparedArticle = Phase7ArticleDraft & {
  contentJson: JSONContent;
  contentHtml: string;
  readingTimeMin: number;
  seoGoal: string;
};
