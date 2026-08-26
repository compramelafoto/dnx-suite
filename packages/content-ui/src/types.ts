import type { JSONContent } from "@tiptap/core";
import type { ContentPostStatusValue, ContentPostTypeValue } from "@repo/content";

export type ContentOption = {
  id: number;
  name: string;
  slug?: string;
};

export type ContentPostFormValue = {
  title: string;
  slug: string;
  excerpt: string;
  contentJson: JSONContent;
  heroImageUrl: string;
  status: ContentPostStatusValue;
  type: ContentPostTypeValue;
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

export type ContentPostFormSubmitPayload = {
  title: string;
  slug?: string;
  excerpt: string | null;
  contentJson: JSONContent;
  heroImageUrl: string | null;
  status: ContentPostStatusValue;
  type: ContentPostTypeValue;
  categoryId: number | null;
  authorId: number | null;
  tagIds: number[];
  seoTitle: string | null;
  seoDescription: string | null;
  seoGoal: string | null;
  ogImageUrl: string | null;
  canonicalUrl: string | null;
  noIndex: boolean;
  lastReviewedAt: string | null;
  isFeatured: boolean;
  featuredUntil: string | null;
};

export type ContentPostSubmitResult = {
  id?: number;
  status: string;
  slug: string;
};

export type ContentFormError = {
  field?: string;
  code?: string;
  message: string;
};

export type ContentFormCapabilities = {
  canPublish?: boolean;
  canArchive?: boolean;
  canDelete?: boolean;
  canManageMedia?: boolean;
};

export type ContentMediaItem = {
  id: number;
  createdAt: string;
  title: string | null;
  altText: string | null;
  caption: string | null;
  filename: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
};
