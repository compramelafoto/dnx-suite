/**
 * Validación fail-closed de runtime para placas V2 en staging/producción.
 * Nunca cae en silencio a LOCAL/INLINE cuando el provider exige R2/remote.
 */
import {
  getCardRemoteRenderUrl,
  getCardRenderProviderName,
  getParticipantCardsKeyPrefix,
  getTemplateRenderHmacSecret,
  isAdminCardsV2Enabled,
  isParticipantCardsV2Enabled,
  isPersistenceEnabled,
  getParticipantCardsStorageProvider,
} from "./participant-card-feature-flags";

export type ParticipantCardsRuntimeConfigIssue = {
  code:
    | "V2_WITHOUT_PERSISTENCE"
    | "REMOTE_WITHOUT_URL"
    | "REMOTE_WITHOUT_HMAC"
    | "R2_WITHOUT_BUCKET"
    | "R2_WITHOUT_CREDENTIALS"
    | "PREFIX_EMPTY"
    | "PREFIX_PRODUCTIVE_ON_STAGING"
    | "LOCAL_OR_INLINE_FORBIDDEN_FOR_STAGING_GO";
  message: string;
};

export type ParticipantCardsRuntimeConfigResult = {
  ok: boolean;
  issues: ParticipantCardsRuntimeConfigIssue[];
  snapshot: {
    v2Enabled: boolean;
    adminV2Enabled: boolean;
    persistenceEnabled: boolean;
    renderProvider: string;
    storageProvider: string;
    keyPrefix: string;
    hasRemoteUrl: boolean;
    hasHmac: boolean;
    hasR2Bucket: boolean;
    hasR2Endpoint: boolean;
    hasR2AccessKey: boolean;
    hasR2Secret: boolean;
  };
};

function isStagingLikeRuntime(): boolean {
  const envBag = process.env as Record<string, string | undefined>;
  const dnxEnv = (envBag.DNX_ENVIRONMENT ?? "").trim().toLowerCase();
  if (dnxEnv === "staging" || dnxEnv === "preview") return true;
  const vercelEnv = (envBag.VERCEL_ENV ?? "").trim().toLowerCase();
  if (vercelEnv === "preview") return true;
  const project = (envBag.VERCEL_PROJECT_NAME ?? "").trim().toLowerCase();
  if (project === "clickaton-staging") return true;
  const publicUrl = (
    envBag.CLICKATON_PUBLIC_URL ??
    envBag.CLICKATON_PUBLIC_WEB_BASE_URL ??
    ""
  ).toLowerCase();
  return publicUrl.includes("clickaton-staging.vercel.app");
}

export function validateParticipantCardsRuntimeConfig(options?: {
  /** Si true, LOCAL/INLINE se consideran inválidos para declarar GO staging. */
  requireRealStorageForGo?: boolean;
}): ParticipantCardsRuntimeConfigResult {
  const requireRealStorageForGo = options?.requireRealStorageForGo ?? false;
  const v2Enabled = isParticipantCardsV2Enabled();
  const adminV2Enabled = isAdminCardsV2Enabled();
  const persistenceEnabled = isPersistenceEnabled();
  const renderProvider = getCardRenderProviderName();
  const storageProvider = getParticipantCardsStorageProvider();
  const keyPrefix = getParticipantCardsKeyPrefix();
  const remoteUrl = getCardRemoteRenderUrl();
  const hmac = getTemplateRenderHmacSecret();
  const bucket = (
    process.env.R2_BUCKET_NAME ||
    process.env.R2_BUCKET ||
    ""
  ).trim();
  const endpoint = (process.env.R2_ENDPOINT ?? "").trim();
  const accessKey = (process.env.R2_ACCESS_KEY_ID ?? "").trim();
  const secretKey = (process.env.R2_SECRET_ACCESS_KEY ?? "").trim();

  const issues: ParticipantCardsRuntimeConfigIssue[] = [];
  const active = v2Enabled || adminV2Enabled;

  if (v2Enabled && !persistenceEnabled) {
    issues.push({
      code: "V2_WITHOUT_PERSISTENCE",
      message:
        "CLICKATON_PARTICIPANT_CARDS_V2_ENABLED=true requiere PERSISTENCE_ENABLED=true",
    });
  }

  if (active && renderProvider === "remote") {
    if (!remoteUrl) {
      issues.push({
        code: "REMOTE_WITHOUT_URL",
        message: "CLICKATON_CARD_REMOTE_RENDER_URL requerido con provider=remote",
      });
    }
    if (!hmac || hmac.length < 32) {
      issues.push({
        code: "REMOTE_WITHOUT_HMAC",
        message:
          "DNX_TEMPLATE_RENDER_HMAC_SECRET (o DNX_RENDER_HMAC_SECRET) ausente o demasiado corto",
      });
    }
  }

  if (active && (storageProvider === "r2" || persistenceEnabled)) {
    if (storageProvider === "r2") {
      if (!bucket) {
        issues.push({
          code: "R2_WITHOUT_BUCKET",
          message: "R2_BUCKET_NAME / R2_BUCKET requerido con storage=r2",
        });
      }
      if (!endpoint || !accessKey || !secretKey) {
        issues.push({
          code: "R2_WITHOUT_CREDENTIALS",
          message: "R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY incompletos",
        });
      }
    }
  }

  if (!keyPrefix) {
    issues.push({
      code: "PREFIX_EMPTY",
      message: "CLICKATON_PARTICIPANT_CARDS_KEY_PREFIX vacío",
    });
  }

  if (
    isStagingLikeRuntime() &&
    keyPrefix &&
    (keyPrefix === "clickaton/participant-cards" ||
      keyPrefix.startsWith("clickaton/participant-cards/"))
  ) {
    issues.push({
      code: "PREFIX_PRODUCTIVE_ON_STAGING",
      message:
        "En staging usar CLICKATON_PARTICIPANT_CARDS_KEY_PREFIX=clickaton-staging/participant-cards",
    });
  }

  if (
    requireRealStorageForGo &&
    active &&
    (storageProvider === "local" ||
      storageProvider === "inline" ||
      storageProvider === "memory")
  ) {
    issues.push({
      code: "LOCAL_OR_INLINE_FORBIDDEN_FOR_STAGING_GO",
      message:
        "No se puede declarar staging GO con storage LOCAL/INLINE/MEMORY",
    });
  }

  return {
    ok: issues.length === 0,
    issues,
    snapshot: {
      v2Enabled,
      adminV2Enabled,
      persistenceEnabled,
      renderProvider,
      storageProvider,
      keyPrefix,
      hasRemoteUrl: Boolean(remoteUrl),
      hasHmac: Boolean(hmac),
      hasR2Bucket: Boolean(bucket),
      hasR2Endpoint: Boolean(endpoint),
      hasR2AccessKey: Boolean(accessKey),
      hasR2Secret: Boolean(secretKey),
    },
  };
}

/** True si la UI/API de placas V2 puede ofrecer acciones activas. */
export function canExposeParticipantCardsActions(): boolean {
  if (!isParticipantCardsV2Enabled() && !isAdminCardsV2Enabled()) return false;
  return validateParticipantCardsRuntimeConfig().ok;
}
