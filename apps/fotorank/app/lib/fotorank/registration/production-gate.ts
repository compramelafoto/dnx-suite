/**
 * Detección centralizada de placeholders y bloqueo en producción.
 * No solo NODE_ENV: también VERCEL_ENV y FOTORANK_APP_ENV.
 *
 * CAMINO B: permite textos con legalStatus PROVISIONALLY_AUTHORIZED_PENDING_LEGAL_REVIEW
 * siempre que no contengan marcadores de borrador / no publicar / pending visibles.
 */

export const PLACEHOLDER_PATTERNS = [
  /BORRADOR/i,
  /REEMPLAZAR/i,
  /VALIDAR ANTES DE PRODUCCI[OÓ]N/i,
  /\bTODO\b/,
  /PLACEHOLDER/i,
  /LOREM IPSUM/i,
  /NO PUBLICAR/i,
  /STAGING_TEST(?:_CONFIGURATION)?/i,
  /\[PENDING_[A-Z0-9_]+\]/,
] as const;

/** Marcadores internos de metadatos CAMINO B permitidos en cabeceras (no son copy de usuario final). */
const ALLOWED_INTERNAL_MARKERS = [
  "PROVISIONALLY_AUTHORIZED_PENDING_LEGAL_REVIEW",
  "PENDING_OPERATOR_INPUT",
  "LEGAL REVIEW REQUIRED",
  "CAMINO_B",
  "caminoB",
] as const;

export function detectPlaceholders(content: string): string[] {
  // Strip YAML/metadata fenced header blocks used by provisional legal docs.
  const stripped = content.replace(/```[\s\S]*?```/g, (block) => {
    if (
      /legalStatus:\s*PROVISIONALLY_AUTHORIZED_PENDING_LEGAL_REVIEW/i.test(block) ||
      /PENDING_OPERATOR_INPUT/.test(block)
    ) {
      return "\n";
    }
    return block;
  });

  const hits: string[] = [];
  for (const re of PLACEHOLDER_PATTERNS) {
    if (re.test(stripped)) {
      // Allow bare PENDING_OPERATOR_INPUT only inside already-stripped metadata; if it remains in body, block.
      if (re.source.includes("PENDING_") && /PENDING_OPERATOR_INPUT/.test(stripped) && !/\[PENDING_/.test(stripped)) {
        // PENDING_OPERATOR_INPUT without brackets is operator metadata; still block if in public body after strip.
        // After strip of metadata fences it should not appear; if it does, treat as hit.
      }
      hits.push(re.source);
    }
  }

  // Explicitly allow known internal phrases when they only appear as metadata labels already stripped.
  void ALLOWED_INTERNAL_MARKERS;
  return hits;
}

export function contentHasCriticalPlaceholder(content: string): boolean {
  return detectPlaceholders(content).length > 0;
}

export function isFotorankProductionEnvironment(): boolean {
  const appEnv = (process.env.FOTORANK_APP_ENV || process.env.DNX_APP_ENV || "").toLowerCase();
  if (appEnv === "production" || appEnv === "prod") return true;
  if (process.env.VERCEL_ENV === "production") return true;
  if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview" && process.env.VERCEL_ENV !== "development") {
    // En Vercel preview NODE_ENV=production pero VERCEL_ENV=preview → no bloquear como prod.
    if (!process.env.VERCEL_ENV) return true;
  }
  return false;
}

export type PlaceholderGateResult =
  | { allowed: true; warning: string | null; production: boolean }
  | { allowed: false; warning: string; production: true };

export function gatePlaceholderContent(content: string): PlaceholderGateResult {
  const production = isFotorankProductionEnvironment();
  const provisional =
    /legalStatus:\s*PROVISIONALLY_AUTHORIZED_PENDING_LEGAL_REVIEW/i.test(content) ||
    /PROVISIONALLY_AUTHORIZED_PENDING_LEGAL_REVIEW/.test(content);

  const has = contentHasCriticalPlaceholder(content);
  if (!has) {
    return {
      allowed: true,
      warning: provisional
        ? "Texto provisional CAMINO B autorizado; revisión legal profesional pendiente."
        : null,
      production,
    };
  }
  if (production) {
    return {
      allowed: false,
      warning:
        "Contenido con marcadores BORRADOR/NO PUBLICAR/STAGING_TEST/[PENDING_*] — bloqueado en producción.",
      production: true,
    };
  }
  return {
    allowed: true,
    warning: "Advertencia: el contenido tiene placeholders. No listo para producción.",
    production: false,
  };
}
