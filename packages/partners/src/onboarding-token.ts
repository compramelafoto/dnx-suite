import { createHash, randomBytes } from "node:crypto";
import { shouldSkipClickForRateLimit } from "./tracking";

const DEFAULT_EXPIRES_DAYS = 14;

export function resolveOnboardingExpiresInDays(
  env: Record<string, string | undefined> = process.env,
): number {
  const raw = env.DNX_PARTNER_ONBOARDING_EXPIRES_DAYS;
  if (!raw) return DEFAULT_EXPIRES_DAYS;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_EXPIRES_DAYS;
}

/** Token opaco criptográfico + hash SHA-256 (mismo patrón que DnxAppInvitation). */
export function createPartnerOnboardingToken(bytes = 32): {
  rawToken: string;
  tokenHash: string;
} {
  const rawToken = randomBytes(bytes).toString("hex");
  return { rawToken, tokenHash: hashPartnerOnboardingToken(rawToken) };
}

export function hashPartnerOnboardingToken(rawToken: string): string {
  return createHash("sha256").update(rawToken.trim()).digest("hex");
}

export function buildPartnerOnboardingPath(rawToken: string): string {
  return `/partners/completar-datos/${rawToken.trim()}`;
}

export function buildPartnerOnboardingUrl(
  origin: string,
  rawToken: string,
): string {
  const base = origin.replace(/\/$/, "");
  return `${base}${buildPartnerOnboardingPath(rawToken)}`;
}

/** Rate limit in-memory por token (sin Redis). */
export function shouldSkipOnboardingRateLimit(
  tokenOrHash: string,
  limit = 30,
  windowMs = 60_000,
): boolean {
  return shouldSkipClickForRateLimit(
    `onboarding:${tokenOrHash}`,
    limit,
    windowMs,
  );
}
