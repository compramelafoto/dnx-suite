import type { GoogleCloudConfig } from "./config.js";
import { GoogleCloudError } from "./errors.js";
import type { GcpEnvironment, GcpRiskLevel } from "./types.js";
import { assertExactConfirmation, assertProjectAllowed, validateProjectId } from "./validators.js";

export interface GcpPolicyGateInput {
  riskLevel: GcpRiskLevel;
  projectId?: string;
  environment?: GcpEnvironment;
  dryRun: boolean;
  confirmation?: string;
  /** Confirmación exacta requerida en production / high-risk. */
  requiredConfirmation?: string;
}

function optProject(projectId: string | undefined): { projectId: string } | Record<string, never> {
  return projectId !== undefined ? { projectId } : {};
}

export function assertModuleEnabled(config: GoogleCloudConfig): void {
  if (!config.enabled) {
    throw new GoogleCloudError(
      "GCP_DISABLED",
      "Módulo Google Cloud deshabilitado (DNX_GCP_ENABLED=false).",
      {
        recommendedAction: "Definí DNX_GCP_ENABLED=true en services/dnx-mcp/.env.local para lecturas.",
      },
    );
  }
}

export function assertWritePolicy(config: GoogleCloudConfig, input: GcpPolicyGateInput): void {
  assertModuleEnabled(config);

  if (input.riskLevel === "DESTRUCTIVE") {
    throw new GoogleCloudError(
      "GCP_DESTRUCTIVE_OPERATION_BLOCKED",
      "Operaciones destructivas están bloqueadas en Fase 1.",
      { recommendedAction: "No hay tools destructivas disponibles en esta fase." },
    );
  }

  if (input.riskLevel === "READ_ONLY") {
    if (input.projectId) {
      assertProjectAllowed(validateProjectId(input.projectId), config.allowedProjectPrefixes);
    }
    return;
  }

  // Escrituras
  if (input.dryRun) {
    if (input.projectId) {
      assertProjectAllowed(validateProjectId(input.projectId), config.allowedProjectPrefixes);
    }
    return;
  }

  if (!config.allowWrites) {
    throw new GoogleCloudError(
      "GCP_WRITE_BLOCKED",
      "Escrituras Google Cloud bloqueadas (DNX_GCP_ALLOW_WRITES=false).",
      {
        ...optProject(input.projectId),
        recommendedAction: "Usá dryRun:true o habilitá DNX_GCP_ALLOW_WRITES solo en entornos controlados.",
      },
    );
  }

  if (!input.environment) {
    throw new GoogleCloudError(
      "GCP_INVALID_INPUT",
      "environment es obligatorio para escrituras (development|staging|production).",
    );
  }

  if (input.projectId) {
    assertProjectAllowed(validateProjectId(input.projectId), config.allowedProjectPrefixes);
  }

  if (input.environment === "production") {
    if (!config.allowProductionWrites) {
      throw new GoogleCloudError(
        "GCP_PRODUCTION_WRITE_BLOCKED",
        "Escrituras en production bloqueadas (DNX_GCP_ALLOW_PRODUCTION_WRITES=false).",
        {
          ...optProject(input.projectId),
          recommendedAction: "Usá development/staging o habilitá producción con confirmación explícita.",
        },
      );
    }
    if (!input.requiredConfirmation) {
      throw new GoogleCloudError(
        "GCP_CONFIRMATION_REQUIRED",
        "Escrituras en production requieren confirmation exacta.",
        { ...optProject(input.projectId) },
      );
    }
    assertExactConfirmation(input.confirmation, input.requiredConfirmation);
  }

  if (input.riskLevel === "HIGH_RISK_WRITE") {
    if (!config.allowHighRiskWrites) {
      throw new GoogleCloudError(
        "GCP_WRITE_BLOCKED",
        "HIGH_RISK_WRITE bloqueado (DNX_GCP_ALLOW_HIGH_RISK_WRITES=false).",
        { ...optProject(input.projectId) },
      );
    }
    if (input.requiredConfirmation) {
      assertExactConfirmation(input.confirmation, input.requiredConfirmation);
    }
  }
}

export function assertKeysBlocked(config: GoogleCloudConfig): void {
  if (!config.allowServiceAccountKeys) {
    throw new GoogleCloudError(
      "GCP_KEYS_BLOCKED",
      "Creación/descarga de claves JSON de service account está bloqueada.",
      {
        recommendedAction: "Usá Workload Identity. DNX_GCP_ALLOW_SERVICE_ACCOUNT_KEYS permanece false.",
      },
    );
  }
}
