import { z } from "zod";

export const optionalTrimmedString = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : null;
    });

export function formatContentValidationError(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join("; ");
}

/** Alias CLF. */
export const formatBlogValidationError = formatContentValidationError;
