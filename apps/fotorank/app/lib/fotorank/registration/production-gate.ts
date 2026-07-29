/**
 * Detección centralizada de placeholders y bloqueo en producción.
 * No solo NODE_ENV: también VERCEL_ENV y FOTORANK_APP_ENV.
 */

export const PLACEHOLDER_PATTERNS = [
  /BORRADOR/i,
  /REEMPLAZAR/i,
  /VALIDAR ANTES DE PRODUCCI[OÓ]N/i,
  /\bTODO\b/,
  /PLACEHOLDER/i,
  /LOREM IPSUM/i,
] as const;

export function detectPlaceholders(content: string): string[] {
  const hits: string[] = [];
  for (const re of PLACEHOLDER_PATTERNS) {
    if (re.test(content)) hits.push(re.source);
  }
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
  const has = contentHasCriticalPlaceholder(content);
  if (!has) return { allowed: true, warning: null, production };
  if (production) {
    return {
      allowed: false,
      warning: "Contenido con marcadores BORRADOR/REEMPLAZAR/TODO — bloqueado en producción.",
      production: true,
    };
  }
  return {
    allowed: true,
    warning: "Advertencia: el contenido tiene placeholders. No listo para producción.",
    production: false,
  };
}
