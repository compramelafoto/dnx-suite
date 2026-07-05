import { z } from "zod";
import { parseBlogSlug } from "@/lib/blog/slugify-blog";
import { formatBlogValidationError } from "@/lib/blog/validate-blog-category";

export const blogTagCreateSchema = z
  .object({
    name: z.string().trim().min(1, "El nombre es obligatorio").max(80),
    slug: z.string().trim().min(1).max(60).optional(),
  })
  .transform((data) => {
    const slugSource = data.slug?.trim() || data.name;
    const slugResult = parseBlogSlug(slugSource);
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

export const blogTagUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    slug: z.string().trim().min(1).max(60).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.slug !== undefined) {
      const slugResult = parseBlogSlug(data.slug);
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
    const slugResult = parseBlogSlug(data.slug);
    if (!slugResult.ok) return data;
    return { ...data, slug: slugResult.normalizedSlug };
  });

export type BlogTagCreateInput = z.infer<typeof blogTagCreateSchema>;
export type BlogTagUpdateInput = z.infer<typeof blogTagUpdateSchema>;

export function parseBlogTagCreate(body: unknown) {
  return blogTagCreateSchema.safeParse(body);
}

export function parseBlogTagUpdate(body: unknown) {
  return blogTagUpdateSchema.safeParse(body);
}

export { formatBlogValidationError };
