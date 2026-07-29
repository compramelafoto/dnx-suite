import { createHash } from "node:crypto";
import { normalizeContestRulesDocument } from "./normalize-document";

export type ExternalRulesAiResponse = {
  documentTitle: string;
  rulesDocument: string;
  configurationSummary: Record<string, unknown>;
  missingDecisions: string[];
  warnings: string[];
  declaredConfigurationHash: string;
  sectionsCovered: string[];
};

export type StructuredImportResult =
  | { ok: true; parsed: ExternalRulesAiResponse; normalized: ReturnType<typeof normalizeContestRulesDocument> }
  | { ok: false; error: string };

const MAX_JSON_CHARS = 500_000;

export function parseExternalRulesAiResponse(raw: string): StructuredImportResult {
  if (!raw.trim()) return { ok: false, error: "JSON vacío." };
  if (raw.length > MAX_JSON_CHARS) return { ok: false, error: "JSON demasiado grande." };

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: "JSON inválido." };
  }

  if (!data || typeof data !== "object") return { ok: false, error: "La respuesta debe ser un objeto." };
  const o = data as Record<string, unknown>;

  const rulesDocument = typeof o.rulesDocument === "string" ? o.rulesDocument : null;
  if (!rulesDocument?.trim()) return { ok: false, error: "Falta rulesDocument." };

  const documentTitle =
    typeof o.documentTitle === "string" && o.documentTitle.trim()
      ? o.documentTitle.trim()
      : "Bases y Condiciones";

  const declaredConfigurationHash =
    typeof o.declaredConfigurationHash === "string" ? o.declaredConfigurationHash.trim() : "";

  const configurationSummary =
    o.configurationSummary && typeof o.configurationSummary === "object"
      ? (o.configurationSummary as Record<string, unknown>)
      : {};

  const missingDecisions = Array.isArray(o.missingDecisions)
    ? o.missingDecisions.filter((x): x is string => typeof x === "string")
    : [];
  const warnings = Array.isArray(o.warnings)
    ? o.warnings.filter((x): x is string => typeof x === "string")
    : [];
  const sectionsCovered = Array.isArray(o.sectionsCovered)
    ? o.sectionsCovered.filter((x): x is string => typeof x === "string")
    : [];

  let normalized;
  try {
    normalized = normalizeContestRulesDocument(rulesDocument);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Normalización fallida." };
  }

  if (!normalized.normalized.trim()) return { ok: false, error: "Documento vacío tras normalizar." };

  return {
    ok: true,
    parsed: {
      documentTitle,
      rulesDocument: normalized.normalized,
      configurationSummary,
      missingDecisions,
      warnings,
      declaredConfigurationHash,
      sectionsCovered,
    },
    normalized,
  };
}

export function hashesMatch(declared: string, actual: string): boolean {
  if (!declared) return false;
  return declared.toLowerCase() === actual.toLowerCase();
}

export function emptyStructuredSkeleton(configurationHash: string): string {
  return JSON.stringify(
    {
      documentTitle: "",
      rulesDocument: "",
      configurationSummary: {},
      missingDecisions: [],
      warnings: [],
      declaredConfigurationHash: configurationHash,
      sectionsCovered: [],
    },
    null,
    2,
  );
}

/** Hash auxiliar para tests de estabilidad de payload. */
export function hashJsonPayload(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}
