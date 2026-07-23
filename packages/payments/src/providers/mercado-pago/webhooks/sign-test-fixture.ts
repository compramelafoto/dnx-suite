import { createHmac, randomUUID } from "node:crypto";
import { buildMercadoPagoWebhookManifest, normalizeMercadoPagoDataId } from "./signature.js";

/**
 * Sign a TEST webhook fixture with the official MP manifest HMAC.
 * Never use production secrets. Never log the secret.
 */
export function signMercadoPagoTestWebhook(input: {
  secret: string;
  dataId: string;
  requestId?: string;
  ts?: string;
}): { signatureHeader: string; requestId: string; ts: string; manifest: string } {
  const requestId = input.requestId?.trim() || randomUUID();
  const ts = input.ts?.trim() || String(Date.now());
  const manifest = buildMercadoPagoWebhookManifest({
    dataId: normalizeMercadoPagoDataId(input.dataId),
    requestId,
    ts,
  });
  const v1 = createHmac("sha256", input.secret).update(manifest).digest("hex");
  return {
    signatureHeader: `ts=${ts},v1=${v1}`,
    requestId,
    ts,
    manifest,
  };
}

export function buildOrdersWebhookFixtureBody(input: {
  providerOrderId: string;
  liveMode?: boolean;
  action?: string;
  userId?: string;
}): string {
  return JSON.stringify({
    action: input.action ?? "order.processed",
    api_version: "v1",
    data: { id: input.providerOrderId },
    date_created: new Date().toISOString(),
    id: Date.now(),
    live_mode: input.liveMode ?? false,
    type: "order",
    user_id: input.userId ?? "3141372692",
  });
}
