import { z } from "zod";
import { parseContentSlug } from "../slug";
import { formatContentValidationError } from "./shared";

export const contentTagCreateSchema = z
  .object({
    name: z.string().trim().min(1, "El nombre es obligatorio").max(80),
    slug: z.string().trim().min(1).max(60).optional(),
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
      name: data.name,
      slug: slugResult.normalizedSlug,
    };
  });

export const contentTagUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    slug: z.string().trim().min(1).max(60).optional(),
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

export type ContentTagCreateInput = z.infer<typeof contentTagCreateSchema>;
export type ContentTagUpdateInput = z.infer<typeof contentTagUpdateSchema>;

export const blogTagCreateSchema = contentTagCreateSchema;
export const blogTagUpdateSchema = contentTagUpdateSchema;
export type BlogTagCreateInput = ContentTagCreateInput;
export type BlogTagUpdateInput = ContentTagUpdateInput;

export function parseContentTagCreate(body: unknown) {
  return contentTagCreateSchema.safeParse(body);
}

export function parseContentTagUpdate(body: unknown) {
  return contentTagUpdateSchema.safeParse(body);
}

export const parseBlogTagCreate = parseContentTagCreate;
export const parseBlogTagUpdate = parseContentTagUpdate;

export { formatContentValidationError, formatBlogValidationError } from "./shared";
