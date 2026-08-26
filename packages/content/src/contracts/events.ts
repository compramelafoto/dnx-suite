import { z } from "zod";
import { contentPlatformSchema, type ContentPlatform } from "../platform";

/**
 * Contrato futuro de eventos de contenido (DNX Communications).
 * Types only — no emit, no import of @repo/communications.
 */
export const CONTENT_EVENT_TYPES = [
  "CONTENT_CREATED",
  "CONTENT_UPDATED",
  "CONTENT_PUBLISHED",
  "CONTENT_UNPUBLISHED",
  "CONTENT_ARCHIVED",
  "CONTENT_SUBMITTED_TO_INFOSPOT",
] as const;

export type ContentEventType = (typeof CONTENT_EVENT_TYPES)[number];

export type ContentEventPayload = {
  platform: ContentPlatform;
  contentId: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  occurredAt: string;
};

export const contentEventTypeSchema = z.enum(CONTENT_EVENT_TYPES);

export const contentEventPayloadSchema = z.object({
  platform: contentPlatformSchema,
  contentId: z.string().min(1),
  slug: z.string().min(1),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  occurredAt: z.string().min(1),
});
