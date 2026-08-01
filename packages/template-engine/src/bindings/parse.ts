import { DANGEROUS_PATH_SEGMENTS } from "../core/constants";
import type { ParseBindingResult, TemplateBindingRef } from "./types";

/** Token entre llaves simples: `{clave}` (Template V2). */
export const BRACE_TOKEN_RE = /\{([^{}]+)\}/g;

/** Placeholder legacy school-render: `{{key | "fallback"}}`. */
export const DOUBLE_BRACE_TOKEN_RE =
  /\{\{\s*([a-zA-Z0-9_.]+)(?:\s*\|\s*"([^"]*)")?\s*\}\}/g;

const PATH_SEGMENT_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function normalizeBraceSlug(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/ñ/g, "n")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

export function isDangerousPath(path: string): boolean {
  const segments = path.split(".");
  return segments.some((seg) => DANGEROUS_PATH_SEGMENTS.has(seg));
}

export function isValidVariablePath(path: string): boolean {
  if (!path || typeof path !== "string") return false;
  if (isDangerousPath(path)) return false;
  const segments = path.split(".");
  if (segments.length === 0) return false;
  return segments.every((seg) => PATH_SEGMENT_RE.test(seg));
}

/**
 * Parsea una expresión de binding (con o sin llaves).
 * No resuelve aliases de dominio — eso lo hace `normalizeTemplateBinding` con registry/alias map.
 */
export function parseTemplateBinding(expression: string): ParseBindingResult {
  if (typeof expression !== "string") {
    return { ok: false, error: "expression debe ser string", original: String(expression) };
  }

  const trimmed = expression.trim();
  if (!trimmed) {
    return { ok: false, error: "expression vacía", original: expression };
  }

  // `{{key | "fallback"}}`
  const double = /^\{\{\s*([a-zA-Z0-9_.]+)(?:\s*\|\s*"([^"]*)")?\s*\}\}$/.exec(trimmed);
  if (double) {
    const path = double[1] ?? "";
    if (!isValidVariablePath(path)) {
      return {
        ok: false,
        error: isDangerousPath(path) ? "path peligroso bloqueado" : "path inválido",
        original: expression,
      };
    }
    const binding: TemplateBindingRef = {
      type: "variable",
      path,
      original: expression,
      fallback: double[2] ?? undefined,
    };
    return { ok: true, binding };
  }

  // `{key}` o key desnuda
  let inner = trimmed;
  const single = /^\{([^{}]+)\}$/.exec(trimmed);
  if (single) {
    inner = (single[1] ?? "").trim();
  }

  if (!inner) {
    return { ok: false, error: "token vacío", original: expression };
  }

  // Paths con puntos: student.fullName
  if (inner.includes(".")) {
    if (!isValidVariablePath(inner)) {
      return {
        ok: false,
        error: isDangerousPath(inner) ? "path peligroso bloqueado" : "path inválido",
        original: expression,
      };
    }
    return {
      ok: true,
      binding: { type: "variable", path: inner, original: expression },
    };
  }

  // Alias o segmento simple — se valida peligrosidad; path canónico se fija en normalize
  const slug = normalizeBraceSlug(inner);
  if (!slug || DANGEROUS_PATH_SEGMENTS.has(slug)) {
    return { ok: false, error: "path peligroso o inválido", original: expression };
  }
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(slug) && !PATH_SEGMENT_RE.test(inner.trim())) {
    // permitir slug normalizado alfanumérico
    if (!/^[a-z0-9_]+$/.test(slug)) {
      return { ok: false, error: "sintaxis de binding inválida", original: expression };
    }
  }

  return {
    ok: true,
    binding: {
      type: "variable",
      path: inner.trim(), // provisional; normalize aplica aliases
      original: expression,
      aliasUsed: inner.trim() !== slug ? inner.trim() : undefined,
    },
  };
}

export function isTemplateBinding(value: unknown): value is TemplateBindingRef {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    v.type === "variable" &&
    typeof v.path === "string" &&
    typeof v.original === "string" &&
    isValidVariablePath(v.path)
  );
}
