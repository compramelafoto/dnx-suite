import { z } from "zod";

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined))
  .refine(
    (v) => !v || /^https?:\/\//i.test(v),
    "La URL debe comenzar con http:// o https://",
  );

const optionalEmail = z
  .string()
  .trim()
  .email("Email inválido")
  .max(200);

export const publicEventSubmissionSchema = z.object({
  title: z.string().trim().min(3, "Título demasiado corto").max(160),
  categoryId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  summary: z
    .string()
    .trim()
    .max(280)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  description: z.string().trim().min(20, "Contanos un poco más del evento").max(8000),
  startAt: z.string().trim().min(1, "Indicá fecha y hora de inicio"),
  endAt: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  venueName: z
    .string()
    .trim()
    .max(160)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  city: z.string().trim().min(2, "Ciudad requerida").max(100),
  province: z.string().trim().min(2, "Provincia requerida").max(100),
  address: z
    .string()
    .trim()
    .max(240)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  postalCode: z
    .string()
    .trim()
    .max(32)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  countryCode: z
    .string()
    .trim()
    .max(8)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  countryName: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  latitude: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  longitude: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  locationVisibility: z
    .enum(["EXACT", "APPROXIMATE", "CITY_ONLY", "HIDDEN"])
    .optional()
    .default("CITY_ONLY"),
  locationConfirmed: z
    .string()
    .optional()
    .transform((v) => v === "1" || v === "true" || v === "on"),
  geocodingPlaceId: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  geocodingProvider: z
    .string()
    .trim()
    .max(64)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  wantPhotographers: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true" || v === "1"),
  photographerJoinPolicy: z
    .string()
    .optional()
    .transform((v) => {
      if (v === "OPEN" || v === "REQUEST" || v === "INVITE_ONLY") return v;
      return undefined;
    }),
  photographerMax: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  photographerTerms: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  organizerName: z.string().trim().min(2, "Nombre del organizador").max(120),
  organizerEmail: optionalEmail,
  organizerPhone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  organizerWebsite: optionalUrl,
  registrationUrl: optionalUrl,
  sourceUrl: optionalUrl,
  acceptTerms: z
    .union([z.literal("on"), z.literal("true"), z.boolean()])
    .refine((v) => v === true || v === "on" || v === "true", {
      message: "Debés aceptar los términos editoriales",
    }),
  /** Honeypot — debe quedar vacío. */
  website_url: z.string().optional(),
});

export const adminEventUpdateSchema = z.object({
  title: z.string().trim().min(3).max(160),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug inválido"),
  summary: z
    .string()
    .trim()
    .max(280)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  description: z.string().trim().min(20).max(8000),
  categoryId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  startAt: z.string().trim().min(1),
  endAt: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  venueName: z
    .string()
    .trim()
    .max(160)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  city: z.string().trim().min(2).max(100),
  province: z.string().trim().min(2).max(100),
  address: z
    .string()
    .trim()
    .max(240)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  postalCode: z
    .string()
    .trim()
    .max(32)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  countryCode: z
    .string()
    .trim()
    .max(8)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  countryName: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  latitude: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  longitude: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  locationVisibility: z
    .enum(["EXACT", "APPROXIMATE", "CITY_ONLY", "HIDDEN"])
    .optional()
    .default("CITY_ONLY"),
  locationConfirmed: z
    .string()
    .optional()
    .transform((v) => v === "1" || v === "true" || v === "on"),
  geocodingPlaceId: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  geocodingProvider: z
    .string()
    .trim()
    .max(64)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  organizerName: z.string().trim().min(2).max(120),
  organizerEmail: optionalEmail,
  organizerPhone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  organizerWebsite: optionalUrl,
  registrationUrl: optionalUrl,
  sourceUrl: optionalUrl,
  coverImageUrl: z
    .string()
    .trim()
    .max(800)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  internalNotes: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  contentTag: z
    .enum(["DEMO", "REAL", "NEEDS_REVIEW"])
    .optional()
    .default("NEEDS_REVIEW"),
});

export function formatFieldErrors(
  error: z.ZodError,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function parseDateTime(raw: string | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}
