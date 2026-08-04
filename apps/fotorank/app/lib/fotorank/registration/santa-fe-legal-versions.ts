/** Version IDs for Santa Fe en Foco provisional CAMINO B legal pack (2026-08-04). */

export const SANTA_FE_LEGAL_STATUS = "PROVISIONALLY_AUTHORIZED_PENDING_LEGAL_REVIEW" as const;

export const SANTA_FE_TERMS_VERSION = "santa-fe-en-foco-terms-v2026-08-04-provisional";
export const SANTA_FE_PRIVACY_VERSION = "santa-fe-en-foco-privacy-v2026-08-04-provisional";
export const SANTA_FE_CONSENT_VERSION = "santa-fe-en-foco-consents-v2026-08-04-provisional";

export const SANTA_FE_LEGAL_PATHS = {
  terms: "docs/fotorank/legal/santa-fe-en-foco-terms-v2026-08-04-provisional.md",
  privacy: "docs/fotorank/legal/santa-fe-en-foco-privacy-v2026-08-04-provisional.md",
  consents: "docs/fotorank/legal/santa-fe-en-foco-consents-v2026-08-04-provisional.md",
  authorization: "docs/fotorank/legal/santa-fe-en-foco-camino-b-authorization-2026-08-04.md",
} as const;
