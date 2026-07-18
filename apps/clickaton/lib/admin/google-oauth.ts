/** Re-export — OAuth helpers viven en lib/auth (login unificado). */
export {
  CLICKATON_GOOGLE_OAUTH_APP,
  CLICKATON_ACCOUNT_PATH,
  buildGoogleOAuthStartHref,
  friendlyGoogleLoginError,
  resolveClickatonPostGoogleLoginPath,
  attachClickatonSessionCookieToResponse,
  safeClickatonNextPath as safeClickatonAdminNextPath,
} from "@/lib/auth/google-oauth";
