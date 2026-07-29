import { createHash } from "node:crypto";
import type { ContestRulesConfiguration } from "./types";

/** Normaliza JSON con claves ordenadas recursivamente para hash estable. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

export function hashContestRulesConfiguration(config: ContestRulesConfiguration): string {
  const normalized = stableStringify(config);
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}
