/** Valor fijo de `state` OAuth (sin roles ni onboarding). */
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
