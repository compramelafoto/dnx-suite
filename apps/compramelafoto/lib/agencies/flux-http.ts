import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { authenticateAgencyDevice, type FluxDeviceCtx } from "@/lib/agencies/flux-keys";

/** Piezas comunes de la API de DNX FLUX en CLF (`/api/agency-ingest/v1/*`). Nunca se loguean datos personales. */

export const FLUX_REQUESTS_PER_MINUTE = 120;
export const FLUX_LINKS_PER_MINUTE_PER_IP = 10;
const MINUTE_MS = 60_000;

export const FLUX_MESSAGES = {
  badKey: "Llave inválida o desvinculada. Volvé a vincular DNX FLUX desde Agencias → Mis agencias.",
  slowDown: "Demasiados pedidos seguidos. Esperá un momento y reintentá.",
  data: "Los datos no son válidos.",
  error: "No pudimos completar el pedido. Reintentá en un momento.",
} as const;

const NO_STORE = { "Cache-Control": "no-store" } as const;

export function fluxJson(body: unknown, status = 200, headers: Record<string, string> = {}): NextResponse {
  return NextResponse.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

export function fluxError(error: string, status: number, headers: Record<string, string> = {}): NextResponse {
  return fluxJson({ error }, status, headers);
}

function retryAfter(resetAt: number): Record<string, string> {
  return { "Retry-After": String(Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))) };
}

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

// Freno en memoria por instancia (lib/rate-limit): en Vercel cada instancia cuenta aparte, así que es contención, no
// una cuota exacta. Contra adivinar códigos la defensa real es la entropía (32^8), el vencimiento a 10 min y el uso único.
export function linkRateLimit(request: Request): NextResponse | null {
  const r = checkRateLimit({ key: `flux-link:${clientIp(request)}`, limit: FLUX_LINKS_PER_MINUTE_PER_IP, windowMs: MINUTE_MS });
  return r.allowed ? null : fluxError(FLUX_MESSAGES.slowDown, 429, retryAfter(r.resetAt));
}

/** Llave → contexto (401) y freno por llave (429). */
export async function authorizeFluxRequest(request: Request): Promise<{ ctx: FluxDeviceCtx } | { res: NextResponse }> {
  const ctx = await authenticateAgencyDevice(request.headers.get("authorization"));
  if (!ctx) return { res: fluxError(FLUX_MESSAGES.badKey, 401, { "WWW-Authenticate": "Bearer" }) };
  const r = checkRateLimit({ key: `flux:${ctx.deviceKeyId}`, limit: FLUX_REQUESTS_PER_MINUTE, windowMs: MINUTE_MS });
  if (!r.allowed) return { res: fluxError(FLUX_MESSAGES.slowDown, 429, retryAfter(r.resetAt)) };
  return { ctx };
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const v: unknown = await request.json();
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
