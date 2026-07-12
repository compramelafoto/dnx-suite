import { z } from "zod";
import { GoogleCloudError } from "./errors.js";
import type { GcpEnvironment } from "./types.js";

/** Project ID oficial GCP: 6–30 chars, lowercase, letter start, alnum/hyphen. */
const PROJECT_ID_RE = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
const API_SERVICE_RE = /^[a-z][a-z0-9-]*\.googleapis\.com$/;
const SA_ACCOUNT_ID_RE = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
const SA_EMAIL_RE = /^[a-z][a-z0-9-]{4,28}[a-z0-9]@[a-z][a-z0-9-]{4,28}[a-z0-9]\.iam\.gserviceaccount\.com$/;
const SECRET_ID_RE = /^[a-zA-Z0-9_-]{1,255}$/;

export const gcpEnvironmentSchema = z.enum(["development", "staging", "production"]);

export function validateProjectId(projectId: string): string {
  const trimmed = projectId.trim();
  if (!PROJECT_ID_RE.test(trimmed)) {
    throw new GoogleCloudError("GCP_INVALID_INPUT", `Project ID inválido: "${trimmed}"`, {
      resource: trimmed,
      recommendedAction: "Usar un project ID válido de Google Cloud (6–30 chars, lowercase).",
    });
  }
  return trimmed;
}

export function assertProjectAllowed(projectId: string, allowedPrefixes: readonly string[]): void {
  const id = validateProjectId(projectId);
  if (allowedPrefixes.length === 0) return;
  const ok = allowedPrefixes.some((prefix) => id.startsWith(prefix));
  if (!ok) {
    throw new GoogleCloudError(
      "GCP_PROJECT_NOT_ALLOWED",
      `Proyecto "${id}" fuera de prefijos permitidos (${allowedPrefixes.join(", ")})`,
      {
        projectId: id,
        recommendedAction: "Ajustá DNX_GCP_ALLOWED_PROJECT_PREFIXES o usá un proyecto autorizado.",
      },
    );
  }
}

export function validateApiService(name: string): string {
  const trimmed = name.trim().toLowerCase();
  if (!API_SERVICE_RE.test(trimmed)) {
    throw new GoogleCloudError("GCP_INVALID_SERVICE", `Nombre de API inválido: "${name}"`, {
      resource: name,
      recommendedAction: "Usá el formato *.googleapis.com (ej. secretmanager.googleapis.com).",
    });
  }
  return trimmed;
}

export function normalizeServiceList(services: readonly string[]): {
  unique: string[];
  duplicates: string[];
  invalid: string[];
} {
  const seen = new Set<string>();
  const unique: string[] = [];
  const duplicates: string[] = [];
  const invalid: string[] = [];

  for (const raw of services) {
    try {
      const name = validateApiService(raw);
      if (seen.has(name)) {
        duplicates.push(name);
      } else {
        seen.add(name);
        unique.push(name);
      }
    } catch {
      invalid.push(raw);
    }
  }

  return { unique, duplicates, invalid };
}

export function validateServiceAccountId(accountId: string): string {
  const trimmed = accountId.trim().toLowerCase();
  if (!SA_ACCOUNT_ID_RE.test(trimmed)) {
    throw new GoogleCloudError("GCP_INVALID_INPUT", `Service account ID inválido: "${accountId}"`, {
      resource: accountId,
      recommendedAction: "Usá 6–30 chars lowercase (letra inicial).",
    });
  }
  return trimmed;
}

export function validateServiceAccountEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  if (!SA_EMAIL_RE.test(trimmed)) {
    throw new GoogleCloudError("GCP_INVALID_INPUT", `Email de service account inválido: "${email}"`, {
      resource: email,
    });
  }
  return trimmed;
}

export function validateSecretId(secretId: string): string {
  const trimmed = secretId.trim();
  if (!SECRET_ID_RE.test(trimmed)) {
    throw new GoogleCloudError("GCP_INVALID_INPUT", `Secret ID inválido: "${secretId}"`, {
      resource: secretId,
    });
  }
  return trimmed;
}

export function parseEnvironment(value: string): GcpEnvironment {
  const parsed = gcpEnvironmentSchema.safeParse(value);
  if (!parsed.success) {
    throw new GoogleCloudError(
      "GCP_INVALID_INPUT",
      `Environment inválido: "${value}". Usá development|staging|production.`,
      { resource: value },
    );
  }
  return parsed.data;
}

export function assertExactConfirmation(actual: string | undefined, expected: string): void {
  if (actual !== expected) {
    throw new GoogleCloudError(
      "GCP_CONFIRMATION_REQUIRED",
      `Confirmación exacta requerida: "${expected}"`,
      {
        recommendedAction: `Reenviá confirmation exactamente como: ${expected}`,
      },
    );
  }
}

const DISPLAY_NAME_RE = /^[\p{L}\p{N} .,_()\-/+]{1,30}$/u;
const BILLING_ACCOUNT_ID_RE = /^[0-9A-Fa-f]{6}-[0-9A-Fa-f]{6}-[0-9A-Fa-f]{6}$/;
const PARENT_ID_RE = /^\d{6,25}$/;
const LABEL_KEY_RE = /^[a-z][a-z0-9_-]{0,62}$/;
const LABEL_VALUE_RE = /^[a-z0-9_-]{0,63}$/;
const MAX_LABELS = 64;
const SENSITIVE_LABEL_RE =
  /(secret|password|token|apikey|api_key|private|credential|bearer|email|@)/i;

export type GcpParentTypeInput = "organization" | "folder" | null;

export function validateDisplayName(displayName: string): string {
  const trimmed = displayName.trim();
  if (!DISPLAY_NAME_RE.test(trimmed)) {
    throw new GoogleCloudError("GCP_INVALID_INPUT", `displayName inválido: "${displayName}"`, {
      resource: displayName,
      recommendedAction: "Usá 1–30 caracteres alfanuméricos (espacios y .,_()/-/+ permitidos).",
    });
  }
  return trimmed;
}

export function validateBillingAccountId(billingAccountId: string): string {
  const trimmed = billingAccountId.trim();
  const normalized = trimmed.replace(/^billingAccounts\//, "");
  if (!BILLING_ACCOUNT_ID_RE.test(normalized)) {
    throw new GoogleCloudError(
      "GCP_INVALID_INPUT",
      `Billing account ID inválido: "${billingAccountId}"`,
      {
        resource: billingAccountId,
        recommendedAction: "Usá el formato XXXXXX-XXXXXX-XXXXXX (hex).",
      },
    );
  }
  return normalized.toUpperCase();
}

export function validateParent(
  parentType: GcpParentTypeInput | undefined,
  parentId: string | null | undefined,
): { parentType: "organization" | "folder"; parentId: string } | null {
  const hasType = parentType === "organization" || parentType === "folder";
  const hasId = typeof parentId === "string" && parentId.trim() !== "";

  if (!hasType && !hasId) {
    return null;
  }

  if (!hasType) {
    throw new GoogleCloudError(
      "GCP_PROJECT_PARENT_INVALID",
      "parentType inválido: se esperaba organization, folder o null.",
      {
        recommendedAction: "Usá organization, folder o null.",
      },
    );
  }

  if (!hasId) {
    throw new GoogleCloudError(
      "GCP_PROJECT_PARENT_INVALID",
      "parentId es obligatorio cuando parentType está definido.",
      { recommendedAction: "Proveé el ID numérico de la organización o folder." },
    );
  }

  const id = parentId.trim().replace(/^(organizations|folders)\//, "");
  if (!PARENT_ID_RE.test(id)) {
    throw new GoogleCloudError("GCP_PROJECT_PARENT_INVALID", `parentId inválido: "${parentId}"`, {
      resource: parentId,
      recommendedAction: "Usá un ID numérico de organización/folder (6–25 dígitos).",
    });
  }

  return { parentType, parentId: id };
}

/**
 * Valida labels GCP. No modifica el projectId.
 * Normaliza a lowercase solo cuando el valor resultante sigue siendo válido.
 */
export function validateAndNormalizeLabels(
  labels: Record<string, string> | null | undefined,
): Record<string, string> {
  if (labels === null || labels === undefined) return {};

  const entries = Object.entries(labels);
  if (entries.length > MAX_LABELS) {
    throw new GoogleCloudError(
      "GCP_INVALID_INPUT",
      `Demasiados labels (${String(entries.length)}). Máximo ${String(MAX_LABELS)}.`,
    );
  }

  const out: Record<string, string> = {};
  for (const [rawKey, rawValue] of entries) {
    const keyCandidate = rawKey.trim().toLowerCase();
    const valueCandidate = rawValue.trim().toLowerCase();

    if (SENSITIVE_LABEL_RE.test(keyCandidate) || SENSITIVE_LABEL_RE.test(valueCandidate)) {
      throw new GoogleCloudError(
        "GCP_INVALID_INPUT",
        `Label rechazado por contenido sensible: "${rawKey}"`,
        { resource: rawKey, recommendedAction: "No incluir secretos, tokens ni emails en labels." },
      );
    }

    if (!LABEL_KEY_RE.test(keyCandidate)) {
      throw new GoogleCloudError("GCP_INVALID_INPUT", `Label key inválida: "${rawKey}"`, {
        resource: rawKey,
        recommendedAction: "Keys: [a-z][a-z0-9_-]{0,62}.",
      });
    }

    if (!LABEL_VALUE_RE.test(valueCandidate)) {
      throw new GoogleCloudError("GCP_INVALID_INPUT", `Label value inválido para "${rawKey}"`, {
        resource: rawKey,
        recommendedAction: "Values: [a-z0-9_-]{0,63}.",
      });
    }

    if (keyCandidate in out) {
      // duplicado tras normalización — conservar el primero
      continue;
    }
    out[keyCandidate] = valueCandidate;
  }

  return out;
}

export function formatLabelsFlag(labels: Record<string, string>): string | undefined {
  const keys = Object.keys(labels);
  if (keys.length === 0) return undefined;
  return keys.map((k) => `${k}=${labels[k] ?? ""}`).join(",");
}
