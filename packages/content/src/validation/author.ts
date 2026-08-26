import { z } from "zod";
import { parseContentSlug } from "../slug";
import { formatContentValidationError, optionalTrimmedString } from "./shared";

export const contentAuthorCreateSchema = z
  .object({
    name: z.string().trim().min(1, "El nombre es obligatorio").max(120),
    slug: z.string().trim().min(1).max(60).optional(),
    bio: optionalTrimmedString(2000),
    avatarUrl: optionalTrimmedString(2000),
    role: optionalTrimmedString(120),
    userId: z.coerce.number().int().positive().optional().nullable(),
    isActive: z.boolean().optional().default(true),
  })
  .transform((data) => {
    const slugSource = data.slug?.trim() || data.name;
    const slugResult = parseContentSlug(slugSource);
    if (!slugResult.ok) {
      throw new z.ZodError([
        {
          code: "custom",
          message: slugResult.error,
          path: ["slug"],
        },
      ]);
    }
    return {
      ...data,
      slug: slugResult.normalizedSlug,
    };
  });

export const contentAuthorUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    slug: z.string().trim().min(1).max(60).optional(),
    bio: optionalTrimmedString(2000),
    avatarUrl: optionalTrimmedString(2000),
    role: optionalTrimmedString(120),
    userId: z.coerce.number().int().positive().optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.slug !== undefined) {
      const slugResult = parseContentSlug(data.slug);
      if (!slugResult.ok) {
        ctx.addIssue({
          code: "custom",
          message: slugResult.error,
          path: ["slug"],
        });
      }
    }
  })
  .transform((data) => {
    if (data.slug === undefined) return data;
    const slugResult = parseContentSlug(data.slug);
    if (!slugResult.ok) return data;
    return { ...data, slug: slugResult.normalizedSlug };
  });

export type ContentAuthorCreateInput = z.infer<typeof contentAuthorCreateSchema>;
export type ContentAuthorUpdateInput = z.infer<typeof contentAuthorUpdateSchema>;

export const blogAuthorCreateSchema = contentAuthorCreateSchema;
export const blogAuthorUpdateSchema = contentAuthorUpdateSchema;
export type BlogAuthorCreateInput = ContentAuthorCreateInput;
export type BlogAuthorUpdateInput = ContentAuthorUpdateInput;

export function parseContentAuthorCreate(body: unknown) {
  return contentAuthorCreateSchema.safeParse(body);
}

export function parseContentAuthorUpdate(body: unknown) {
  return contentAuthorUpdateSchema.safeParse(body);
}

export const parseBlogAuthorCreate = parseContentAuthorCreate;
export const parseBlogAuthorUpdate = parseContentAuthorUpdate;

export { formatContentValidationError, formatBlogValidationError } from "./shared";
