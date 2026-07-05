import { createHash, randomBytes } from "crypto";

const TOKEN_BYTES = 32;
const DEFAULT_TOKEN_TTL_DAYS = 365;

export function hashQuotePublicViewToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateQuotePublicViewToken(): { token: string; tokenHash: string } {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  return { token, tokenHash: hashQuotePublicViewToken(token) };
}

export function resolveQuotePublicViewTokenTtlDays(): number {
  const raw = process.env.CC_QUOTE_PUBLIC_TOKEN_TTL_DAYS;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_TOKEN_TTL_DAYS;
}

export function addDays(base: Date, days: number): Date {
  const next = new Date(base.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

export function isQuotePublicViewTokenActive(input: {
  tokenHash: string | null;
  revokedAt: Date | null;
  expiresAt: Date | null;
  now?: Date;
}): boolean {
  if (!input.tokenHash) return false;
  if (input.revokedAt) return false;
  const now = input.now ?? new Date();
  if (input.expiresAt && input.expiresAt.getTime() <= now.getTime()) return false;
  return true;
}

export function buildQuotePublicViewUrl(token: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "https://compramelafoto.com";
  return `${base.replace(/\/$/, "")}/cuantocobro/p/${token}`;
}
