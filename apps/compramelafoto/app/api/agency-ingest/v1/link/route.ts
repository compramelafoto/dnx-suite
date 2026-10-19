import { redeemLinkCode } from "@/lib/agencies/flux-keys";
import { FLUX_MESSAGES, fluxError, fluxJson, linkRateLimit, readJsonObject } from "@/lib/agencies/flux-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** DNX FLUX canjea el código de "Mis agencias" por su llave de dispositivo (se devuelve una sola vez). */
export async function POST(request: Request) {
  const limited = linkRateLimit(request);
  if (limited) return limited;
  const body = await readJsonObject(request);
  if (!body) return fluxError(FLUX_MESSAGES.data, 400);
  try {
    const r = await redeemLinkCode(body.code, body.deviceName);
    if (!r.ok) return fluxError(r.error, r.status);
    return fluxJson({ deviceKey: r.key }, 201);
  } catch {
    return fluxError(FLUX_MESSAGES.error, 503);
  }
}
