import { readFileSync } from "node:fs";
import type { PricingConfigurationIssue } from "../models.js";
import { PricingIssueCode } from "../issue-codes.js";
import { issue } from "../issues.js";

export type RawJsonLoadResult =
  | { status: "OK"; value: unknown }
  | { status: "NOT_FOUND"; issues: PricingConfigurationIssue[] }
  | { status: "INVALID"; issues: PricingConfigurationIssue[] };

/**
 * Lectura JSON explícita (solo cuando se invoca).
 * No loguea contenido económico.
 */
export function loadJsonFile(filePath: string): RawJsonLoadResult {
  try {
    const raw = readFileSync(filePath, "utf8");
    try {
      return { status: "OK", value: JSON.parse(raw) as unknown };
    } catch {
      return {
        status: "INVALID",
        issues: [
          issue(
            PricingIssueCode.JSON_INVALID,
            filePath,
            "ERROR",
            "El archivo no contiene JSON válido.",
          ),
        ],
      };
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return {
        status: "NOT_FOUND",
        issues: [
          issue(
            PricingIssueCode.FILE_NOT_FOUND,
            filePath,
            "ERROR",
            "Archivo de configuración no encontrado.",
          ),
        ],
      };
    }
    return {
      status: "INVALID",
      issues: [
        issue(
          PricingIssueCode.JSON_INVALID,
          filePath,
          "ERROR",
          "No se pudo leer el archivo de configuración.",
        ),
      ],
    };
  }
}
