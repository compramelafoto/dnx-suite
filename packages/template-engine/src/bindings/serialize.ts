import type { TemplateBindingRef } from "./types";

/**
 * Serializa un binding canónico a expresión brace simple `{path}`.
 */
export function serializeTemplateBinding(binding: TemplateBindingRef): string {
  if (binding.fallback != null && binding.fallback !== "") {
    // Forma legacy doble llave solo si hay fallback explícito
    const escaped = String(binding.fallback).replace(/"/g, "");
    return `{{${binding.path} | "${escaped}"}}`;
  }
  return `{${binding.path}}`;
}

/** Snippet de inserción UI: siempre path canónico. */
export function braceSnippetForPath(path: string): string {
  return `{${path}}`;
}
