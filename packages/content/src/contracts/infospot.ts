import { z } from "zod";
import { contentPlatformSchema, type ContentPlatform } from "../platform";

/**
 * Contrato futuro de envío editorial a Info Spot.
 * Types only — no side effects, no Info Spot model imports.
 */
export type SubmitContentToInfoSpotInput = {
  sourcePlatform: ContentPlatform;
  sourceContentId: string;
  sourceUrl?: string;
  title: string;
  excerpt?: string;
  contentHtml: string;
  contentJson?: unknown;
  featuredImageUrl?: string;
  relatedImageUrls?: string[];
  authorName?: string;
  submittedByUserId: number;
  submittedAt: Date;
};

export const submitContentToInfoSpotInputSchema = z.object({
  sourcePlatform: contentPlatformSchema,
  sourceContentId: z.string().min(1),
  sourceUrl: z.string().url().optional(),
  title: z.string().min(1),
  excerpt: z.string().optional(),
  contentHtml: z.string(),
  contentJson: z.unknown().optional(),
  featuredImageUrl: z.string().url().optional(),
  relatedImageUrls: z.array(z.string().url()).optional(),
  authorName: z.string().optional(),
  submittedByUserId: z.number().int().positive(),
  submittedAt: z.coerce.date(),
});
