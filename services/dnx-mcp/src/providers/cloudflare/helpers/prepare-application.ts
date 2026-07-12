import { randomBytes } from "node:crypto";
import { getPlatform } from "../../../platforms/index.js";
import type { PlatformDefinition } from "../../../platforms/types.js";
import { R2S3Client } from "../client/index.js";
import {
  buildR2S3Endpoint,
  hasR2ObjectCredentials,
  type CloudflareConfig,
} from "../config.js";
import { CloudflareGuardError } from "../errors.js";
import { assertStagingBucketName, isProductionBucketName } from "./bucket-name.js";
import { assertMutableAllowed } from "./guards.js";
import type { R2BucketsService } from "../services/r2-buckets.service.js";
import {
  fingerprintSecret,
  isCredentialsCreateUnauthorized,
  R2CredentialsService,
} from "../services/r2-credentials.service.js";
import { R2ObjectsService } from "../services/r2-objects.service.js";
import {
  prepareApplicationInputSchema,
  prepareApplicationResultSchema,
  type PrepareApplicationInput,
  type PrepareApplicationResult,
  type PrepareApplicationR2EnvVars,
} from "../types/index.js";

/** Variables R2_* esperadas por apps DNX / Vercel Preview. */
export const PREPARE_APPLICATION_R2_ENV_KEYS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_ENDPOINT",
  "R2_BUCKET",
  "R2_BUCKET_NAME",
  "R2_REGION",
] as const;

export type PrepareApplicationR2EnvKey = (typeof PREPARE_APPLICATION_R2_ENV_KEYS)[number];

export interface VercelPreviewEnvPort {
  isConfigured(): boolean;
  listPreviewEnvKeys(projectIdOrName: string): Promise<string[]>;
  createPreviewEnvVar(
    projectIdOrName: string,
    key: string,
    value: string,
  ): Promise<void>;
}

export interface PrepareApplicationServices {
  config: CloudflareConfig;
  buckets: R2BucketsService;
  objects: R2ObjectsService;
  credentials: R2CredentialsService;
  /** Cliente S3 del provider (credenciales de env del MCP). */
  createS3Client: (overrides?: Partial<CloudflareConfig>) => R2S3Client;
  vercel?: VercelPreviewEnvPort;
}

/**
 * Prepara R2 para una aplicación en staging/preview.
 * Nunca toca buckets de producción ni variables Vercel production.
 */
export async function prepareApplication(
  services: PrepareApplicationServices,
  input: PrepareApplicationInput,
): Promise<PrepareApplicationResult> {
  const parsed = prepareApplicationInputSchema.parse(input);
  const blockers: string[] = [];
  const warnings: string[] = [];
  const actions: string[] = [];

  const platform = resolvePlatform(parsed.platformId);
  if (!platform) {
    blockers.push(`Plataforma "${parsed.platformId}" no encontrada en catalog`);
  }

  const bucketName = platform?.r2?.stagingBucket ?? null;
  if (!bucketName) {
    blockers.push(
      `Plataforma "${parsed.platformId}" no tiene r2.stagingBucket en catalog`,
    );
  }

  if (bucketName) {
    try {
      assertStagingBucketName(bucketName);
    } catch (error) {
      blockers.push(error instanceof Error ? error.message : "Nombre staging inválido");
    }
    if (isProductionBucketName(bucketName)) {
      blockers.push(`Bucket "${bucketName}" parece producción — bloqueado`);
    }
    if (
      platform?.r2?.productionBucket &&
      bucketName === platform.r2.productionBucket
    ) {
      blockers.push(
        `Bucket de producción "${platform.r2.productionBucket}" — NO TOCAR desde r2_prepare_application`,
      );
    }
  }

  if (platform?.r2?.stagingOperationsAllowed === false) {
    blockers.push(`Plataforma ${parsed.platformId} no permite operaciones R2 staging vía MCP`);
  }

  const accountId = services.config.accountId;
  const endpoint = accountId ? buildR2S3Endpoint(accountId, services.config.r2Jurisdiction) : "";
  const endpointValid =
    Boolean(accountId) &&
    /^https:\/\/[a-z0-9]+\.(eu\.|fedramp\.)?r2\.cloudflarestorage\.com$/.test(endpoint);

  if (!endpointValid) {
    blockers.push("Endpoint R2 inválido o accountId ausente");
  }

  let bucketExists = false;
  if (blockers.length === 0 && bucketName) {
    try {
      bucketExists = await services.buckets.bucketExists(bucketName);
      if (!bucketExists) {
        blockers.push(
          `Bucket staging "${bucketName}" no existe — crear antes con r2_prepare_staging_bucket`,
        );
        actions.push(`Crear bucket staging "${bucketName}"`);
      } else {
        actions.push(`Bucket staging "${bucketName}" verificado`);
      }
    } catch {
      blockers.push(`No se pudo verificar existencia de "${bucketName}"`);
    }
  }

  // --- Credenciales ---
  let accessKeyId = services.config.r2AccessKeyId || "";
  let secretAccessKey = services.config.r2SecretAccessKey || "";
  let credentialsSource: "env" | "created" | "missing" = hasR2ObjectCredentials(
    services.config,
  )
    ? "env"
    : "missing";
  let credentialsCreated = false;
  let createAttempted = false;
  let createError: string | null = null;

  if (credentialsSource === "missing" && blockers.length === 0 && bucketName) {
    actions.push("Crear Access Key S3 scoped al bucket staging (si no existen)");
    if (parsed.dryRun) {
      warnings.push("dryRun=true — no se crearán credenciales S3");
    } else {
      let credentialsBlocked = false;
      try {
        assertMutableAllowed("prepareApplication.createCredentials", {
          dryRun: parsed.dryRun,
          confirm: parsed.confirm,
        });
      } catch (error) {
        credentialsBlocked = true;
        blockers.push(
          error instanceof Error
            ? error.message
            : "Creación de credenciales requiere confirm: true y dryRun: false",
        );
      }

      // Ya estamos en rama dryRun=false; credentialsBlocked cubre el push a blockers.
      if (parsed.confirm && !credentialsBlocked) {
        createAttempted = true;
        try {
          const created = await services.credentials.createScopedObjectCredentials({
            accountId,
            bucketName,
            tokenName: `dnx-mcp-${parsed.platformId}-staging-${Date.now().toString(36)}`,
            jurisdiction: services.config.r2Jurisdiction,
          });
          accessKeyId = created.accessKeyId;
          secretAccessKey = created.secretAccessKey;
          credentialsSource = "created";
          credentialsCreated = true;
          actions.push(`Credenciales S3 creadas (token ${created.tokenName})`);
        } catch (error) {
          createError =
            error instanceof Error ? error.message : "Error creando credenciales R2";
          if (isCredentialsCreateUnauthorized(error)) {
            warnings.push(
              "El CLOUDFLARE_API_TOKEN no puede crear User Tokens (403). Crear Access Keys en Dashboard → R2 → Manage R2 API Tokens (Object Read & Write, solo bucket staging).",
            );
            actions.push(
              "Crear Access Key manualmente en Cloudflare Dashboard y configurar R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY en DNX-MCP",
            );
          } else {
            warnings.push(`No se pudieron crear credenciales automáticamente: ${createError}`);
          }
        }
      }
    }
  } else if (credentialsSource === "env") {
    actions.push("Reutilizando R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY del entorno MCP");
  }

  const hasCreds = accessKeyId.length > 0 && secretAccessKey.length > 0;
  if (!hasCreds && !parsed.dryRun && createAttempted) {
    actions.push("Completar credenciales S3 manualmente y reintentar r2_prepare_application");
  }

  // --- Variables R2_* ---
  const envVars: PrepareApplicationR2EnvVars | null =
    hasCreds && bucketName && endpoint
      ? {
          R2_ACCOUNT_ID: accountId,
          R2_ACCESS_KEY_ID: accessKeyId,
          R2_SECRET_ACCESS_KEY: secretAccessKey,
          R2_ENDPOINT: endpoint,
          R2_BUCKET: bucketName,
          R2_BUCKET_NAME: bucketName,
          R2_REGION: "auto",
        }
      : null;

  const envVarKeys = [...PREPARE_APPLICATION_R2_ENV_KEYS];
  if (!envVars) {
    warnings.push("Variables R2_* no generadas — faltan credenciales o bucket");
  } else {
    actions.push("Variables R2_* generadas (usar una sola vez; no loguear secretos)");
  }

  // --- Vercel Preview ---
  const vercelProject = platform?.vercelProject ?? null;
  let vercelConfigured = false;
  let vercelMissingKeys: string[] = [];
  let vercelPresentKeys: string[] = [];
  let loadOffered = false;
  const loadedKeys: string[] = [];
  let loadSkippedReason: string | null = null;

  if (vercelProject && services.vercel) {
    vercelConfigured = services.vercel.isConfigured();
    if (!vercelConfigured) {
      warnings.push("Vercel provider no configurado — no se puede auditar Preview env");
      loadSkippedReason = "vercel_not_configured";
    } else {
      try {
        const previewKeys = await services.vercel.listPreviewEnvKeys(vercelProject);
        const previewSet = new Set(previewKeys);
        vercelPresentKeys = envVarKeys.filter((k) => previewSet.has(k));
        vercelMissingKeys = envVarKeys.filter((k) => !previewSet.has(k));

        if (vercelMissingKeys.length > 0) {
          loadOffered = true;
          actions.push(
            `Cargar ${String(vercelMissingKeys.length)} variables R2_* faltantes a Vercel Preview (loadEnvToVercelPreview:true)`,
          );
          warnings.push(
            `Faltan en Vercel Preview (${vercelProject}): ${vercelMissingKeys.join(", ")}`,
          );
        } else {
          actions.push(`Vercel Preview (${vercelProject}): variables R2_* presentes`);
        }

        if (parsed.loadEnvToVercelPreview) {
          if (!envVars) {
            loadSkippedReason = "credentials_missing";
            warnings.push("No se pueden cargar env a Vercel sin valores R2_*");
          } else if (parsed.dryRun) {
            loadSkippedReason = "dry_run";
            warnings.push("dryRun=true — no se cargarán variables a Vercel Preview");
          } else {
            try {
              assertMutableAllowed("prepareApplication.loadVercelPreviewEnv", {
                dryRun: parsed.dryRun,
                confirm: parsed.confirm,
              });
            } catch (error) {
              loadSkippedReason = "confirm_required";
              blockers.push(
                error instanceof Error
                  ? error.message
                  : "Carga a Vercel Preview requiere confirm: true",
              );
            }

            // Rama dryRun=false: solo confirm + missing keys + sin skip previo.
            if (
              parsed.confirm &&
              vercelMissingKeys.length > 0 &&
              loadSkippedReason === null
            ) {
              for (const key of vercelMissingKeys) {
                const value = envVars[key as keyof PrepareApplicationR2EnvVars];
                if (typeof value !== "string") continue;
                await services.vercel.createPreviewEnvVar(vercelProject, key, value);
                loadedKeys.push(key);
              }
              actions.push(
                `Cargadas ${String(loadedKeys.length)} variables a Vercel Preview (solo target preview)`,
              );
              vercelMissingKeys = vercelMissingKeys.filter((k) => !loadedKeys.includes(k));
              vercelPresentKeys = [...vercelPresentKeys, ...loadedKeys];
            } else if (vercelMissingKeys.length === 0) {
              loadSkippedReason = "nothing_missing";
            }
          }
        } else if (vercelMissingKeys.length > 0) {
          loadSkippedReason = "load_not_requested";
        }
      } catch (error) {
        warnings.push(
          `No se pudo auditar env de Vercel Preview: ${
            error instanceof Error ? error.message : "error desconocido"
          }`,
        );
        loadSkippedReason = "vercel_list_failed";
      }
    }
  } else if (!vercelProject) {
    warnings.push("Plataforma sin vercelProject — se omite auditoría Preview");
    loadSkippedReason = "no_vercel_project";
  } else {
    warnings.push("Puerto Vercel no inyectado — se omite auditoría Preview");
    loadSkippedReason = "vercel_port_missing";
  }

  // --- Smoke upload/download ---
  const smokeKey = `smoke/dnx-mcp-prepare-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}.txt`;
  let uploadOk: boolean | null = null;
  let downloadOk: boolean | null = null;
  let cleanedUp = false;
  let smokeError: string | null = null;

  if (blockers.length === 0 && bucketName && hasCreds) {
    if (parsed.dryRun) {
      warnings.push("dryRun=true — smoke upload/download no ejecutado");
      actions.push(`Validar upload/download en key ${smokeKey} (ejecutar sin dryRun)`);
    } else {
      let smokeBlocked = false;
      try {
        assertMutableAllowed("prepareApplication.smokeTest", {
          dryRun: parsed.dryRun,
          confirm: parsed.confirm,
        });
      } catch (error) {
        smokeBlocked = true;
        blockers.push(
          error instanceof Error
            ? error.message
            : "Smoke test requiere confirm: true y dryRun: false",
        );
      }

      // Rama dryRun=false; smokeBlocked preserva el guard tras assertMutableAllowed.
      if (parsed.confirm && !smokeBlocked) {
        const payload = `dnx-mcp r2_prepare_application smoke ${new Date().toISOString()}`;
        const objects =
          credentialsSource === "created"
            ? createTemporaryObjectsService(
                services.createS3Client({
                  r2AccessKeyId: accessKeyId,
                  r2SecretAccessKey: secretAccessKey,
                }),
              )
            : services.objects;

        try {
          const uploaded = await objects.uploadObject(
            bucketName,
            smokeKey,
            payload,
            "text/plain",
            true,
            false,
          );
          uploadOk = uploaded.uploaded;

          const downloaded = await objects.downloadObject(bucketName, smokeKey);
          downloadOk =
            downloaded.ok &&
            downloaded.body !== null &&
            downloaded.body.toString("utf8") === payload;

          if (!downloadOk) {
            smokeError = `Download mismatch o falló (status=${String(downloaded.status)})`;
          }
        } catch (error) {
          uploadOk = uploadOk ?? false;
          downloadOk = downloadOk ?? false;
          smokeError = error instanceof Error ? error.message : "Smoke test falló";
        } finally {
          try {
            await objects.deleteObject(bucketName, smokeKey, true, false);
            cleanedUp = true;
          } catch {
            warnings.push(`No se pudo limpiar objeto smoke "${smokeKey}"`);
          }
        }

        if (uploadOk && downloadOk) {
          actions.push("Smoke upload/download OK (objeto temporal eliminado)");
        } else if (smokeError) {
          blockers.push(`Smoke test falló: ${smokeError}`);
        }
      }
    }
  } else if (!hasCreds) {
    warnings.push("Smoke upload/download omitido — sin credenciales S3");
  }

  const status = resolveStatus({
    blockers,
    dryRun: parsed.dryRun,
    bucketExists,
    hasCreds,
    endpointValid,
    uploadOk,
    downloadOk,
    credentialsSource,
  });

  const recommendation =
    status === "READY"
      ? `R2 application staging listo para ${parsed.platformId} (bucket ${bucketName ?? "?"})`
      : status === "BLOCKED"
        ? `Bloqueado: ${blockers.join("; ")}`
        : buildActionRequiredRecommendation({
            dryRun: parsed.dryRun,
            hasCreds,
            credentialsSource,
            loadOffered,
            vercelMissingKeys,
            actions,
            warnings,
          });

  return prepareApplicationResultSchema.parse({
    status,
    platformId: parsed.platformId,
    bucketName,
    dryRun: parsed.dryRun,
    confirm: parsed.confirm,
    loadEnvToVercelPreview: parsed.loadEnvToVercelPreview,
    bucketExists,
    endpoint,
    endpointValid,
    credentials: {
      source: credentialsSource,
      accessKeyIdPresent: accessKeyId.length > 0,
      accessKeyIdFingerprint: accessKeyId ? fingerprintSecret(accessKeyId) : null,
      secretFingerprint: secretAccessKey ? fingerprintSecret(secretAccessKey) : null,
      created: credentialsCreated,
      createAttempted,
      createError,
    },
    envVars,
    envVarKeys,
    vercelPreview: {
      project: vercelProject,
      configured: vercelConfigured,
      missingKeys: vercelMissingKeys,
      presentKeys: vercelPresentKeys,
      loadOffered,
      loadedKeys,
      loadSkippedReason,
    },
    smokeTest: {
      key: smokeKey,
      uploadOk,
      downloadOk,
      cleanedUp,
      error: smokeError,
    },
    blockers,
    warnings,
    actions,
    recommendation,
  });
}

function resolvePlatform(platformId: string): PlatformDefinition | undefined {
  return getPlatform(platformId);
}

function resolveStatus(input: {
  blockers: string[];
  dryRun: boolean;
  bucketExists: boolean;
  hasCreds: boolean;
  endpointValid: boolean;
  uploadOk: boolean | null;
  downloadOk: boolean | null;
  credentialsSource: "env" | "created" | "missing";
}): PrepareApplicationResult["status"] {
  if (input.blockers.length > 0) {
    return "BLOCKED";
  }
  if (input.dryRun) {
    return "ACTION_REQUIRED";
  }
  if (
    input.bucketExists &&
    input.hasCreds &&
    input.endpointValid &&
    input.uploadOk === true &&
    input.downloadOk === true
  ) {
    return "READY";
  }
  if (input.credentialsSource === "missing" || !input.hasCreds) {
    return "ACTION_REQUIRED";
  }
  return "ACTION_REQUIRED";
}

function buildActionRequiredRecommendation(input: {
  dryRun: boolean;
  hasCreds: boolean;
  credentialsSource: string;
  loadOffered: boolean;
  vercelMissingKeys: string[];
  actions: string[];
  warnings: string[];
}): string {
  if (input.dryRun) {
    return "Ejecutar con dryRun:false + confirm:true para crear credenciales (si faltan), smoke test y opcionalmente cargar env a Preview";
  }
  if (!input.hasCreds) {
    return "Crear Access Keys R2 en Dashboard (Object Read & Write, solo staging) y reintentar";
  }
  if (input.loadOffered && input.vercelMissingKeys.length > 0) {
    return `Cargar variables faltantes a Vercel Preview con loadEnvToVercelPreview:true (keys: ${input.vercelMissingKeys.join(", ")})`;
  }
  return `Acción requerida: ${input.actions.slice(0, 3).join("; ") || input.warnings.join("; ")}`;
}

/** Objetos service sobre un S3 client efímero (credenciales recién creadas). */
function createTemporaryObjectsService(s3: R2S3Client): R2ObjectsService {
  return new R2ObjectsService(s3);
}

export function assertNotProductionBucketForApplication(name: string): void {
  if (isProductionBucketName(name)) {
    throw new CloudflareGuardError(`Bucket de producción "${name}" — NO TOCAR`);
  }
}
