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
