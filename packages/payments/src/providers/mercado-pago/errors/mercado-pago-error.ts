import type { Rfc7807Problem } from "../client/mercado-pago-response.js";

export interface MercadoPagoErrorBody {
  message?: string;
  error?: string;
  status?: number;
  cause?: Array<{ code?: string; description?: string; message?: string }>;
  /** Orders API often returns `{ errors: [{ code, message, details }] }` (Imp 05). */
  errors?: Array<{ code?: string; message?: string; details?: string[] }>;
  causes?: Array<{ code?: string; message?: string; details?: unknown }>;
}

/** Strip payment id prefixes from MP detail strings — keep status_detail only. */
export function sanitizeMpTransactionDetail(detail: string): string {
  const trimmed = detail.trim();
  const colon = trimmed.lastIndexOf(":");
  if (colon >= 0 && colon < trimmed.length - 1) {
    return trimmed.slice(colon + 1).trim().slice(0, 80);
  }
  return trimmed.slice(0, 80);
}

export function extractMpErrorCodes(
  problem: Rfc7807Problem | null,
  body: MercadoPagoErrorBody | null,
): string[] {
  const codes: string[] = [];
  if (problem?.code) codes.push(problem.code);
  if (problem?.errors) {
    for (const e of problem.errors) {
      if (e.code) codes.push(e.code);
    }
  }
  if (body?.cause) {
    for (const c of body.cause) {
      if (c.code) codes.push(c.code);
    }
  }
  if (body?.errors) {
    for (const e of body.errors) {
      if (e.code) codes.push(e.code);
    }
  }
  if (body?.causes) {
    for (const c of body.causes) {
      if (c.code) codes.push(c.code);
    }
  }
  return codes;
}

export function extractMpErrorMessage(
  problem: Rfc7807Problem | null,
  body: MercadoPagoErrorBody | null,
  fallback: string,
): string {
  const detailFromProblem = problem?.errors?.[0]?.details?.[0];
  const detailFromBody = body?.errors?.[0]?.details?.[0];
  const statusDetail = detailFromProblem || detailFromBody
    ? sanitizeMpTransactionDetail(
        String(detailFromProblem || detailFromBody),
      )
    : null;

  let base: string | null = null;
  if (problem?.detail) base = problem.detail;
  else if (problem?.message) base = problem.message;
  else if (problem?.title) base = problem.title;
  else if (problem?.errors?.[0]?.message) base = problem.errors[0].message;
  else if (body?.message) base = body.message;
  else if (body?.error) base = body.error;
  else if (body?.errors?.[0]?.message) base = body.errors[0].message;
  else if (body?.causes?.[0]?.message) base = body.causes[0].message;
  else if (body?.cause?.[0]?.description) base = body.cause[0].description;
  else if (body?.cause?.[0]?.message) base = body.cause[0].message;

  if (base && statusDetail && !base.includes(statusDetail)) {
    return `${base} (${statusDetail})`;
  }
  if (base) return base;
  if (statusDetail) return statusDetail;
  return fallback;
}
