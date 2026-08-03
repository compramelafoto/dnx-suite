import type { ContentFormError } from "./types";

export function toContentFormError(error: unknown, fallback = "Error inesperado"): ContentFormError {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message || fallback);
    const field =
      "field" in error && typeof (error as { field?: unknown }).field === "string"
        ? (error as { field: string }).field
        : undefined;
    const code =
      "code" in error && typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code
        : undefined;
    return { message, field, code };
  }
  if (typeof error === "string") return { message: error };
  return { message: fallback };
}
