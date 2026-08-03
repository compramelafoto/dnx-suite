/**
 * Feature flags — placas participante V2 (Template Engine).
 *
 * Defaults:
 * - Public V2 (`CLICKATON_PARTICIPANT_CARDS_V2_ENABLED`): **false** unless env set.
 *   Do not enable in production without explicit env + legal review.
 * - Admin V2 panel (`CLICKATON_PARTICIPANT_CARDS_V2_ADMIN_ENABLED`): **true** outside
 *   production for staging QA; **false** in production unless env set.
 * - Persistence (`CLICKATON_PARTICIPANT_CARDS_PERSISTENCE_ENABLED`): **false** unless env set.
 */

export const PARTICIPANT_CARDS_V2_FLAG = "CLICKATON_PARTICIPANT_CARDS_V2_ENABLED";
export const PARTICIPANT_CARDS_V2_ADMIN_FLAG =
  "CLICKATON_PARTICIPANT_CARDS_V2_ADMIN_ENABLED";
export const PARTICIPANT_CARDS_PERSISTENCE_FLAG =
  "CLICKATON_PARTICIPANT_CARDS_PERSISTENCE_ENABLED";
export const CARD_RENDER_PROVIDER_FLAG = "CLICKATON_CARD_RENDER_PROVIDER";
export const CARD_REMOTE_RENDER_URL_FLAG = "CLICKATON_CARD_REMOTE_RENDER_URL";
export const PARTICIPANT_CARDS_STORAGE_PROVIDER_FLAG =
  "CLICKATON_PARTICIPANT_CARDS_STORAGE_PROVIDER";
export const PARTICIPANT_CARDS_KEY_PREFIX_FLAG =
  "CLICKATON_PARTICIPANT_CARDS_KEY_PREFIX";

function parseTruthy(raw: string | undefined): boolean | undefined {
  if (raw == null) return undefined;
  const value = raw.trim().toLowerCase();
  if (value === "") return undefined;
  if (value === "true" || value === "1" || value === "yes") return true;
  if (value === "false" || value === "0" || value === "no") return false;
  return undefined;
}

function isProductionRuntime(): boolean {
  if (process.env.VERCEL_ENV === "production") return true;
  if (process.env.NODE_ENV === "production") return true;
  return false;
}

export function isParticipantCardsV2Enabled(): boolean {
  // eslint-disable-next-line turbo/no-undeclared-env-vars -- documented feature flag
  return parseTruthy(process.env.CLICKATON_PARTICIPANT_CARDS_V2_ENABLED) ?? false;
}

export function isAdminCardsV2Enabled(): boolean {
  const defaultValue = !isProductionRuntime();
  // eslint-disable-next-line turbo/no-undeclared-env-vars -- documented feature flag
  return parseTruthy(process.env.CLICKATON_PARTICIPANT_CARDS_V2_ADMIN_ENABLED) ?? defaultValue;
}

export function isPersistenceEnabled(): boolean {
  // eslint-disable-next-line turbo/no-undeclared-env-vars -- documented feature flag
  return parseTruthy(process.env.CLICKATON_PARTICIPANT_CARDS_PERSISTENCE_ENABLED) ?? false;
}

export function getCardRenderProviderName(): string {
  // eslint-disable-next-line turbo/no-undeclared-env-vars -- documented feature flag
  return (process.env.CLICKATON_CARD_RENDER_PROVIDER ?? "local").trim().toLowerCase();
}

export function getCardRemoteRenderUrl(): string | undefined {
  // eslint-disable-next-line turbo/no-undeclared-env-vars -- documented feature flag
  const raw = process.env.CLICKATON_CARD_REMOTE_RENDER_URL?.trim();
  return raw || undefined;
}

/** Prefer DNX_TEMPLATE_RENDER_HMAC_SECRET; accept DNX_RENDER_HMAC_SECRET alias. */
export function getTemplateRenderHmacSecret(): string | undefined {
  // eslint-disable-next-line turbo/no-undeclared-env-vars -- documented secret
  const primary = process.env.DNX_TEMPLATE_RENDER_HMAC_SECRET?.trim();
  if (primary) return primary;
  // eslint-disable-next-line turbo/no-undeclared-env-vars -- documented alias
  const alias = process.env.DNX_RENDER_HMAC_SECRET?.trim();
  return alias || undefined;
}

export function getParticipantCardsStorageProvider(): string {
  // eslint-disable-next-line turbo/no-undeclared-env-vars -- documented feature flag
  const raw = process.env.CLICKATON_PARTICIPANT_CARDS_STORAGE_PROVIDER?.trim().toLowerCase();
  if (raw) return raw;
  const hasR2 =
    Boolean(process.env.R2_BUCKET_NAME || process.env.R2_BUCKET) &&
    Boolean(process.env.R2_ENDPOINT) &&
    Boolean(process.env.R2_ACCESS_KEY_ID) &&
    Boolean(process.env.R2_SECRET_ACCESS_KEY);
  return hasR2 ? "r2" : "local";
}

export function getParticipantCardsKeyPrefix(): string {
  // eslint-disable-next-line turbo/no-undeclared-env-vars -- optional staging key prefix
  const raw = process.env.CLICKATON_PARTICIPANT_CARDS_KEY_PREFIX?.trim();
  if (raw) return raw.replace(/^\/+|\/+$/g, "");
  return "clickaton/participant-cards";
}
