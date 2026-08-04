import type { ArgraVerificationStatus, EligibilityResult } from "./types";
import { SANTA_FE_CATEGORY_SLUGS } from "./types";

const MIN_LEN = 3;
const MAX_LEN = 32;

/** Normaliza número ARGRA (trim, colapsa espacios). Conserva como string. */
export function normalizeArgraMembershipNumber(raw: string | null | undefined): string {
  if (raw == null) return "";
  return raw.trim().replace(/\s+/g, " ");
}

export function validateArgraMembershipNumber(raw: string | null | undefined): EligibilityResult {
  const normalized = normalizeArgraMembershipNumber(raw);
  if (!normalized) {
    return {
      decision: "NOT_ELIGIBLE",
      reasonCode: "ARGRA_NUMBER_MISSING",
      publicMessage: "Para Reportero Gráfico debés ingresar tu número de socio de ARGRA.",
      internalMessage: "argraMembershipNumber empty",
      evidence: {},
    };
  }
  if (normalized.length < MIN_LEN || normalized.length > MAX_LEN) {
    return {
      decision: "NOT_ELIGIBLE",
      reasonCode: "ARGRA_NUMBER_INVALID",
      publicMessage: `El número de socio de ARGRA debe tener entre ${MIN_LEN} y ${MAX_LEN} caracteres.`,
      internalMessage: `argra length ${normalized.length}`,
      evidence: { length: normalized.length },
    };
  }
  return {
    decision: "ELIGIBLE",
    reasonCode: "ARGRA_VERIFICATION_PENDING",
    publicMessage:
      "Número recibido. Será utilizado únicamente para verificar la elegibilidad en esta categoría.",
    internalMessage: "argra accepted pending manual verification",
    evidence: { length: normalized.length, status: "PENDING_VERIFICATION" satisfies ArgraVerificationStatus },
  };
}

export function categoryRequiresArgra(categorySlug: string): boolean {
  const slug = categorySlug.trim().toLowerCase();
  return slug === SANTA_FE_CATEGORY_SLUGS.reporter || slug.includes("reportero");
}

/** Redacción segura para logs/admin listados (nunca valor completo en logs). */
export function redactArgraForLog(raw: string | null | undefined): string | null {
  const n = normalizeArgraMembershipNumber(raw);
  if (!n) return null;
  if (n.length <= 4) return "***";
  return `${n.slice(0, 2)}…${n.slice(-2)}`;
}
