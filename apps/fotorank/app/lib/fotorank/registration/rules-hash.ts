import { createHash } from "node:crypto";

/** Normaliza contenido de bases antes de hashear (LF, trim final). */
export function normalizeRulesContent(content: string): string {
  return content.replace(/\r\n/g, "\n").replace(/\s+$/u, "");
}

export function hashRulesContent(content: string): string {
  const normalized = normalizeRulesContent(content);
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

export const RULES_PLACEHOLDER_MARKER = "BORRADOR — REEMPLAZAR POR BASES OFICIALES ANTES DE PRODUCCIÓN";

export function contentContainsPlaceholder(content: string): boolean {
  return content.includes(RULES_PLACEHOLDER_MARKER);
}
