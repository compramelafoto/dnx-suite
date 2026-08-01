export interface Rfc7807Problem {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  /** MP-specific error codes may appear here or in `errors` array. */
  code?: string;
  message?: string;
  errors?: Array<{
    code?: string;
    message?: string;
    field?: string;
    /** Orders: e.g. `pay_…: rejected_by_issuer` */
    details?: string[];
  }>;
}

export interface ParsedMpResponse<T> {
  status: number;
  headers: Headers;
  body: T | null;
  rawText: string;
  problem: Rfc7807Problem | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseRfc7807(raw: unknown): Rfc7807Problem | null {
  if (!isRecord(raw)) {
    return null;
  }
  const problem: Rfc7807Problem = {};
  if (typeof raw.type === "string") problem.type = raw.type;
  if (typeof raw.title === "string") problem.title = raw.title;
  if (typeof raw.status === "number") problem.status = raw.status;
  if (typeof raw.detail === "string") problem.detail = raw.detail;
  if (typeof raw.instance === "string") problem.instance = raw.instance;
  if (typeof raw.code === "string") problem.code = raw.code;
  if (typeof raw.message === "string") problem.message = raw.message;
  if (Array.isArray(raw.errors)) {
    problem.errors = raw.errors.filter(isRecord).map((e) => {
      const item: {
        code?: string;
        message?: string;
        field?: string;
        details?: string[];
      } = {};
      if (typeof e.code === "string") item.code = e.code;
      if (typeof e.message === "string") item.message = e.message;
      if (typeof e.field === "string") item.field = e.field;
      if (Array.isArray(e.details)) {
        item.details = e.details.filter((d): d is string => typeof d === "string");
      }
      return item;
    });
  }
  if (
    problem.type ||
    problem.title ||
    problem.status ||
    problem.detail ||
    problem.code ||
    problem.message ||
    (problem.errors && problem.errors.length > 0)
  ) {
    return problem;
  }
  return null;
}
