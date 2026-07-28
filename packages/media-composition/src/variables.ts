import type { CompositionVariableMap } from "./types";

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function interpolateTemplate(
  content: string,
  variables: CompositionVariableMap,
): string {
  return content.replace(PLACEHOLDER_RE, (_m, key: string) => {
    const v = variables[key];
    if (v == null || v === "") return "";
    return String(v);
  });
}

export function collectMissingVariables(
  required: string[],
  variables: CompositionVariableMap,
): string[] {
  return required.filter((k) => {
    const v = variables[k];
    return v == null || String(v).trim() === "";
  });
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
