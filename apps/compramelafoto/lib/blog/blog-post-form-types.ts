import type { JSONContent } from "@tiptap/core";
import type { BlogPostStatusValue, BlogPostTypeValue } from "@/lib/blog/blog-enums";

export type BlogPostFormValues = {
  title: string;
  slug: string;
  excerpt: string;
  contentJson: JSONContent;
  heroImageUrl: string;
  status: BlogPostStatusValue;
  type: BlogPostTypeValue;
  categoryId: string;
  authorId: string;
  tagIds: number[];
  seoTitle: string;
  seoDescription: string;
  seoGoal: string;
  ogImageUrl: string;
  canonicalUrl: string;
  noIndex: boolean;
  lastReviewedAt: string;
  isFeatured: boolean;
  featuredUntil: string;
};

export type BlogPostSavedPayload = {
  status: BlogPostFormValues["status"];
  slug: string;
};
