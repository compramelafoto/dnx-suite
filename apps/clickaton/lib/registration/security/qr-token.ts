import { createHmac, createHash } from "node:crypto";

const QR_PURPOSE = "clickaton:qr:v1";

/**
 * Regenerable opaque QR plaintext.
 * Never store plaintext; derive with HMAC and persist only SHA-256 hash.
 */
export function getClickatonQrSigningSecret(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const secret =
    env.CLICKATON_QR_TOKEN_SECRET?.trim() ||
    env.CLICKATON_REGISTRATION_ACCESS_TOKEN_SECRET?.trim() ||
    env.DNX_SESSION_SECRET?.trim();
  if (!secret || secret.length < 16) {
    throw new Error(
      "CLICKATON_QR_TOKEN_SECRET (or registration/session secret) required for QR issuance",
    );
  }
  return secret;
}

export function deriveRegistrationQrPlaintext(input: {
  registrationId: string;
  credentialId: string;
  secret?: string;
}): string {
  const secret = input.secret ?? getClickatonQrSigningSecret();
  const mac = createHmac("sha256", secret)
    .update(`${QR_PURPOSE}:${input.registrationId}:${input.credentialId}`)
    .digest("base64url");
  return mac.slice(0, 43);
}

export function hashQrPlaintext(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}

export function issueRegistrationQrToken(input: {
  registrationId: string;
  credentialId: string;
  secret?: string;
}): { plaintext: string; tokenHash: string; tokenPrefix: string } {
  const plaintext = deriveRegistrationQrPlaintext(input);
  const tokenHash = hashQrPlaintext(plaintext);
  return {
    plaintext,
    tokenHash,
    tokenPrefix: plaintext.slice(0, 8),
  };
}
