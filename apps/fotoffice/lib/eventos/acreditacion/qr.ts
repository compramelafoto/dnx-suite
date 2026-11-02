import { createHmac, createHash } from "node:crypto";
import { resolverClaveDeEnlace } from "@/lib/presupuestos/enlace";

/**
 * El QR de la credencial de un inscripto. Copiado de Clickatón
 * (`lib/registration/security/qr-token.ts`): un texto opaco que se re-deriva con
 * HMAC cuando hace falta mostrarlo; en la base sólo va su SHA-256.
 *
 * La clave es la de los enlaces de FOTOFFICE (`resolverClaveDeEnlace`), con un
 * propósito propio en el mensaje: un QR no sirve como enlace ni al revés.
 */
const QR_PURPOSE = "fotoffice:evento:qr:v1";

export function claveDeQr(env: Record<string, string | undefined> = process.env): string {
  const secret = resolverClaveDeEnlace(env);
  if (!secret || secret.length < 16) {
    throw new Error("Falta la clave de enlaces (PRESUPUESTO_TOKEN_SECRET o STORE_ORDER_TOKEN_SECRET) para emitir el QR");
  }
  return secret;
}

export function deriveRegistrationQrPlaintext(input: { inscriptoId: string; secret?: string }): string {
  const secret = input.secret ?? claveDeQr();
  const mac = createHmac("sha256", secret).update(`${QR_PURPOSE}:${input.inscriptoId}`).digest("base64url");
  return mac.slice(0, 43);
}

export function hashQrPlaintext(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}

export function issueRegistrationQrToken(input: { inscriptoId: string; secret?: string }): {
  plaintext: string;
  tokenHash: string;
} {
  const plaintext = deriveRegistrationQrPlaintext(input);
  return { plaintext, tokenHash: hashQrPlaintext(plaintext) };
}
