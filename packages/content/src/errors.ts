export const CONTENT_ERROR_CODES = [
  "CONTENT_PLATFORM_REQUIRED",
  "CONTENT_NOT_FOUND",
  "CONTENT_SLUG_CONFLICT",
  "CONTENT_CATEGORY_NOT_FOUND",
  "CONTENT_TAG_NOT_FOUND",
  "CONTENT_AUTHOR_NOT_FOUND",
  "CONTENT_MEDIA_NOT_FOUND",
  "CONTENT_RELATION_PLATFORM_MISMATCH",
  "CONTENT_INVALID_STATUS",
] as const;

export type ContentErrorCode = (typeof CONTENT_ERROR_CODES)[number];

export class ContentError extends Error {
  readonly code: ContentErrorCode;

  constructor(code: ContentErrorCode, message?: string) {
    super(message ?? code);
    this.name = "ContentError";
    this.code = code;
  }
}

export function isContentError(error: unknown): error is ContentError {
  return error instanceof ContentError;
}
