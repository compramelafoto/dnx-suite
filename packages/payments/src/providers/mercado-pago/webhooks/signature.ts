import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verificación de Webhooks firmados de Mercado Pago (documentación oficial).
 *
 * Manifest:
 *   id:[data.id];request-id:[x-request-id];ts:[ts];
 *
 * Header x-signature: `ts=…,v1=…` (orden de partes variable).
 * data.id: preferir query `data.id`; si es alfanumérico con mayúsculas → lowercase.
 * Si falta data.id o x-request-id, se omiten del manifest antes del HMAC.
 */

export type MercadoPagoSignatureParse = {
  ts: string | null;
  v1: string | null;
};

export function parseMercadoPagoSignatureHeader(
  signatureHeader: string | null | undefined,
): MercadoPagoSignatureParse {
  if (!signatureHeader?.trim()) return { ts: null, v1: null };
  let ts: string | null = null;
  let v1: string | null = null;
  for (const part of signatureHeader.split(",")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key === "ts") ts = value || null;
    if (key === "v1") v1 = value || null;
  }
  return { ts, v1 };
}

/** MP: convertir data.id alfanumérico a minúsculas antes del manifest. */
export function normalizeMercadoPagoDataId(dataId: string): string {
  const trimmed = dataId.trim();
  if (/[A-Za-z]/.test(trimmed)) return trimmed.toLowerCase();
  return trimmed;
}

export function buildMercadoPagoWebhookManifest(input: {
  dataId: string | null | undefined;
  requestId: string | null | undefined;
  ts: string;
}): string {
  const parts: string[] = [];
  if (input.dataId) {
    parts.push(`id:${normalizeMercadoPagoDataId(input.dataId)}`);
  }
  if (input.requestId) {
    parts.push(`request-id:${input.requestId}`);
  }
  parts.push(`ts:${input.ts}`);
  return `${parts.join(";")};`;
}

export type VerifyMercadoPagoWebhookSignatureInput = {
  signatureHeader: string | null | undefined;
  requestIdHeader: string | null | undefined;
  dataId: string | null | undefined;
  secret: string | null | undefined;
  /** Tolerancia opcional en ms respecto a Date.now(); 0/undefined = sin chequeo. */
  maxSkewMs?: number;
  nowMs?: number;
};

export type VerifyMercadoPagoWebhookSignatureResult =
  | { ok: true; ts: string; manifest: string }
  | {
      ok: false;
      reason:
        | "missing_secret"
        | "missing_signature"
        | "invalid_signature_header"
        | "missing_data_id"
        | "missing_request_id"
        | "signature_mismatch"
        | "timestamp_out_of_tolerance";
    };

export function verifyMercadoPagoWebhookSignature(
  input: VerifyMercadoPagoWebhookSignatureInput,
): VerifyMercadoPagoWebhookSignatureResult {
  if (!input.secret) {
    return { ok: false, reason: "missing_secret" };
  }
  if (!input.signatureHeader?.trim()) {
    return { ok: false, reason: "missing_signature" };
  }

  const { ts, v1 } = parseMercadoPagoSignatureHeader(input.signatureHeader);
  if (!ts || !v1) {
    return { ok: false, reason: "invalid_signature_header" };
  }

  const dataId = input.dataId?.trim() || null;
  const requestId = input.requestIdHeader?.trim() || null;

  // Para notificaciones de pago Clickatón exigimos ambos (manifest completo).
  if (!dataId) return { ok: false, reason: "missing_data_id" };
  if (!requestId) return { ok: false, reason: "missing_request_id" };

  if (input.maxSkewMs != null && input.maxSkewMs > 0) {
    const tsNum = Number(ts);
    const now = input.nowMs ?? Date.now();
    if (!Number.isFinite(tsNum) || Math.abs(now - tsNum) > input.maxSkewMs) {
      return { ok: false, reason: "timestamp_out_of_tolerance" };
    }
  }

  const manifest = buildMercadoPagoWebhookManifest({ dataId, requestId, ts });
  const digest = createHmac("sha256", input.secret).update(manifest).digest("hex");

  const expected = Buffer.from(digest, "utf8");
  const provided = Buffer.from(v1, "utf8");
  const valid =
    expected.length === provided.length && timingSafeEqual(expected, provided);

  if (!valid) {
    return { ok: false, reason: "signature_mismatch" };
  }

  return { ok: true, ts, manifest };
}
