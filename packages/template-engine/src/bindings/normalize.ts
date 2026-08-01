import { parseTemplateBinding, normalizeBraceSlug, isValidVariablePath } from "./parse";
import type { ParseBindingResult, TemplateBindingRef } from "./types";

export type NormalizeBindingOptions = {
  /** Mapa alias slug → path canónico (p.ej. alumno → student.fullName). */
  aliases?: Record<string, string>;
  /** Paths canónicos conocidos del registry (opcional). */
  knownPaths?: ReadonlySet<string> | readonly string[];
};

function knownSet(known?: NormalizeBindingOptions["knownPaths"]): Set<string> | null {
  if (!known) return null;
  return known instanceof Set ? known : new Set(known);
}

/**
 * Normaliza una expresión o binding a referencia canónica `{ type, path, original, ... }`.
 */
export function normalizeTemplateBinding(
  input: string | TemplateBindingRef,
  options: NormalizeBindingOptions = {}
): ParseBindingResult {
  const aliases = options.aliases ?? {};
  const known = knownSet(options.knownPaths);

  let parsed: ParseBindingResult;
  if (typeof input === "string") {
    parsed = parseTemplateBinding(input);
  } else if (input && input.type === "variable" && typeof input.path === "string") {
    parsed = { ok: true, binding: { ...input } };
  } else {
    return { ok: false, error: "binding inválido", original: String(input) };
  }

  if (!parsed.ok) return parsed;

  const binding = { ...parsed.binding };
  const rawPath = binding.path;

  // Ya es path canónico válido y conocido
  if (isValidVariablePath(rawPath) && rawPath.includes(".")) {
    if (known && !known.has(rawPath)) {
      // path válido sintácticamente pero desconocido — se conserva; resolución avisará
      return { ok: true, binding };
    }
    return { ok: true, binding };
  }

  const slug = normalizeBraceSlug(rawPath);
  const viaAlias = aliases[slug];
  if (viaAlias) {
    if (!isValidVariablePath(viaAlias)) {
      return { ok: false, error: "alias apunta a path inválido", original: binding.original };
    }
    return {
      ok: true,
      binding: {
        ...binding,
        path: viaAlias,
        aliasUsed: slug,
      },
    };
  }

  // Compact match: studentfullnameName → student.fullName
  if (known) {
    for (const key of known) {
      const compact = normalizeBraceSlug(key.replace(/\./g, ""));
      if (compact === slug && isValidVariablePath(key)) {
        return {
          ok: true,
          binding: {
            ...binding,
            path: key,
            aliasUsed: slug !== key ? slug : undefined,
          },
        };
      }
    }
  }

  // Path simple sin alias: inválido como canónico con puntos
  if (!isValidVariablePath(rawPath) || !rawPath.includes(".")) {
    return {
      ok: false,
      error: "alias o path desconocido",
      original: binding.original,
    };
  }

  return { ok: true, binding };
}
