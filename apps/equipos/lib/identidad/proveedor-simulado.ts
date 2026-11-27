import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { IdentityProvider } from "./proveedor";
import type { ProviderResult } from "./resultado";

/** HMAC-SHA256 hexadecimal del cuerpo crudo. */
export function signBody(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = Buffer.from(signBody(rawBody, secret), "utf8");
  const received = Buffer.from(signature, "utf8");
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

/**
 * El simulador aprueba identidades sin documento: sólo en desarrollo local o en una vista
 * privada de Vercel (`VERCEL_ENV=preview`, protegida con login). Nunca en producción.
 */
export function simuladorPermitido(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.IDENTITY_PROVIDER !== "simulado") return false;
  if (env.VERCEL_ENV === "production") return false;
  return env.NODE_ENV !== "production" || env.VERCEL_ENV === "preview";
}

const OUTCOMES = ["approved", "rejected", "review"] as const;

export class SimulatedProvider implements IdentityProvider {
  name = "simulado";

  async startSession(input: { userId: number; returnUrl: string }) {
    const providerRef = `sim_${randomBytes(12).toString("hex")}`;
    const qs = new URLSearchParams({ ref: providerRef, returnUrl: input.returnUrl });
    return { redirectUrl: `/verificacion/simulador?${qs.toString()}`, providerRef };
  }

  async parseWebhook(rawBody: string, headers: Headers): Promise<ProviderResult | null> {
    const secret = process.env.IDENTITY_WEBHOOK_SECRET;
    if (!secret) return null;
    if (!verifySignature(rawBody, headers.get("x-signature"), secret)) return null;
    try {
      const b = JSON.parse(rawBody) as Record<string, unknown>;
      if (typeof b.providerRef !== "string" || !b.providerRef) return null;
      if (!OUTCOMES.includes(b.outcome as (typeof OUTCOMES)[number])) return null;
      const str = (v: unknown) => (typeof v === "string" ? v : undefined);
      return {
        providerRef: b.providerRef,
        outcome: b.outcome as ProviderResult["outcome"],
        documentNumber: str(b.documentNumber),
        legalName: str(b.legalName),
        reason: str(b.reason),
      };
    } catch {
      return null;
    }
  }
}
