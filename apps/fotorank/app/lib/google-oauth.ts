import { safeNextPath } from "./safe-next-path";

/** Prefijo de `state` OAuth FotoRank (sin roles ni onboarding). */
export const FOTORANK_GOOGLE_OAUTH_STATE = "fotorank";

export function resolveBaseUrl(originFromRequest: string): string {
  return (
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    originFromRequest ||
    "http://localhost:3000"
  );
}

export function resolveGoogleRedirectUri(baseUrl: string): string {
  return process.env.GOOGLE_REDIRECT_URI?.trim() || `${baseUrl}/api/auth/google/callback`;
}

/** Encode return path into OAuth state (safe relative paths only). */
export function buildFotorankGoogleOAuthState(next?: string | null): string {
  const safe = safeNextPath(next ?? null);
  if (!safe) return FOTORANK_GOOGLE_OAUTH_STATE;
  return `${FOTORANK_GOOGLE_OAUTH_STATE}:${encodeURIComponent(safe)}`;
}

export function parseFotorankGoogleOAuthState(state: string | null): {
  ok: boolean;
  next: string | null;
} {
  if (!state) return { ok: false, next: null };
  if (state === FOTORANK_GOOGLE_OAUTH_STATE) return { ok: true, next: null };
  const prefix = `${FOTORANK_GOOGLE_OAUTH_STATE}:`;
  if (!state.startsWith(prefix)) return { ok: false, next: null };
  try {
    const raw = decodeURIComponent(state.slice(prefix.length));
    return { ok: true, next: safeNextPath(raw) };
  } catch {
    return { ok: false, next: null };
  }
}
