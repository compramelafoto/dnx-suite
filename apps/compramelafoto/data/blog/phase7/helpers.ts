import type { BlogPostType } from "@prisma/client";
import type { BlogContentIntent, Phase7ArticleDraft } from "@/data/blog/phase7/types";

type DraftInput = {
  title: string;
  slug: string;
  categorySlug: string;
  type?: BlogPostType;
  excerpt: string;
  seoDescription?: string;
  audience: string[];
  intents: BlogContentIntent[];
  tags: string[];
  sections: string[];
  intro: string;
  imageScene: string;
  imageAltSubject?: string;
  isFeatured?: boolean;
  seoGoalNotes?: string;
};

export function article(input: DraftInput): Phase7ArticleDraft {
  return {
    title: input.title,
    slug: input.slug,
    categorySlug: input.categorySlug,
    type: input.type ?? "BLOG",
    excerpt: input.excerpt,
    seoTitle: input.title,
    seoDescription: input.seoDescription ?? input.excerpt,
    audience: input.audience,
    intents: input.intents,
    tags: input.tags,
    sections: input.sections,
    intro: input.intro,
    imageScene: input.imageScene,
    imageAltSubject: input.imageAltSubject ?? input.title,
    isFeatured: input.isFeatured,
    seoGoalNotes: input.seoGoalNotes,
  };
}

export const SUPPORT_INTENTS: BlogContentIntent[] = ["seo", "ai-discovery", "support"];
export const PHOTOGRAPHER_INTENTS: BlogContentIntent[] = [
  ...SUPPORT_INTENTS,
  "acquisition-photographer",
  "feature-adoption",
];
export const ORGANIZER_INTENTS: BlogContentIntent[] = [
  ...SUPPORT_INTENTS,
  "acquisition-organizer",
  "feature-adoption",
];
