import type { Rfc7807Problem } from "../client/mercado-pago-response.js";

export interface MercadoPagoErrorBody {
  message?: string;
  error?: string;
  status?: number;
  cause?: Array<{ code?: string; description?: string }>;
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
  return codes;
}

export function extractMpErrorMessage(
  problem: Rfc7807Problem | null,
  body: MercadoPagoErrorBody | null,
  fallback: string,
): string {
  if (problem?.detail) return problem.detail;
  if (problem?.message) return problem.message;
  if (problem?.title) return problem.title;
  if (body?.message) return body.message;
  if (body?.error) return body.error;
  if (body?.cause?.[0]?.description) return body.cause[0].description;
  return fallback;
}
