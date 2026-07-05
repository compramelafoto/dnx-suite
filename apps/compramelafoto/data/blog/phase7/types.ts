import type { BlogPostType } from "@prisma/client";
import type { JSONContent } from "@tiptap/core";

/** Brief para generación futura de imágenes (hero, thumbnail, OG). */
export type BlogImageAssetBrief = {
  prompt: string;
  altText: string;
  caption?: string;
};

export type BlogArticleImagePlan = {
  hero: BlogImageAssetBrief;
  thumbnail: BlogImageAssetBrief;
  og: BlogImageAssetBrief;
};

export type BlogContentIntent =
  | "seo"
  | "ai-discovery"
  | "support"
  | "acquisition-photographer"
  | "acquisition-organizer"
  | "referrals"
  | "feature-adoption";

export type BlogSeoGoalFaqItem = { q: string; a: string };

/** Metadatos estratégicos serializados en `BlogPost.seoGoal` (JSON). */
export type BlogSeoGoalPayload = {
  version: 1;
  audience: string[];
  intents: BlogContentIntent[];
  imagePlan: BlogArticleImagePlan;
  notes?: string;
  /** Preguntas frecuentes para FAQPage JSON-LD (Fase 8+). */
  faq?: BlogSeoGoalFaqItem[];
};

export type Phase7CategoryDef = {
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  isFeatured?: boolean;
};

export type Phase7ArticleDraft = {
  title: string;
  slug: string;
  categorySlug: string;
  type: BlogPostType;
  excerpt: string;
  seoTitle: string;
  seoDescription: string;
  audience: string[];
  intents: BlogContentIntent[];
  tags: string[];
  sections: string[];
  intro: string;
  imageScene: string;
  imageAltSubject: string;
  isFeatured?: boolean;
  contentJson?: JSONContent;
  seoGoalNotes?: string;
};
