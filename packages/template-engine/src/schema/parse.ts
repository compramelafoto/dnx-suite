import { ZodError } from "zod";
import {
  SUPPORTED_TEMPLATE_SCHEMA_VERSIONS,
  TEMPLATE_SCHEMA_VERSION,
} from "../core/constants";
import { templateDocumentSchema, type TemplateDocument } from "./document";

export type ParseTemplateDocumentResult =
  | { ok: true; data: TemplateDocument }
  | { ok: false; error: string; issues?: string[] };

function issuesFromZod(err: ZodError): string[] {
  return err.issues.map((i) => {
    const path = i.path.length ? i.path.join(".") : "(root)";
    return `${path}: ${i.message}`;
  });
}

/**
 * Valida y parsea un documento canónico en runtime (Zod).
 */
export function parseTemplateDocument(input: unknown): ParseTemplateDocumentResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "documento inválido: se esperaba un objeto" };
  }

  const raw = input as Record<string, unknown>;
  if (typeof raw.schemaVersion === "number") {
    if (
      !(SUPPORTED_TEMPLATE_SCHEMA_VERSIONS as readonly number[]).includes(raw.schemaVersion)
    ) {
      return {
        ok: false,
        error: `schemaVersion ${raw.schemaVersion} no soportada (soportadas: ${SUPPORTED_TEMPLATE_SCHEMA_VERSIONS.join(", ")})`,
      };
    }
  }

  const result = templateDocumentSchema.safeParse(input);
  if (!result.success) {
    return {
      ok: false,
      error: "documento no cumple el schema canónico",
      issues: issuesFromZod(result.error),
    };
  }
  return { ok: true, data: result.data };
}

export function createEmptyTemplateDocument(partial?: {
  id?: string;
  name?: string;
  width?: number;
  height?: number;
}): TemplateDocument {
  return {
    schemaVersion: TEMPLATE_SCHEMA_VERSION,
    id: partial?.id,
    name: partial?.name ?? "Untitled",
    width: partial?.width ?? 1000,
    height: partial?.height ?? 1000,
    unit: "px",
    blocks: [],
    bindings: [],
    metadata: {},
  };
}
