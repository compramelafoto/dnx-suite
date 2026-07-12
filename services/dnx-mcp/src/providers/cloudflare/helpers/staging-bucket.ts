import type { PlatformDefinition } from "../../../platforms/types.js";
import { getPlatform } from "../../../platforms/index.js";
import { CloudflareGuardError } from "../errors.js";
import { assertStagingBucketName, isProductionBucketName } from "./bucket-name.js";
import { assertMutableAllowed } from "./guards.js";
import type { R2BucketsService } from "../services/r2-buckets.service.js";
import type { R2CorsService } from "../services/r2-cors.service.js";
import type { R2DomainService } from "../services/r2-domain.service.js";
import {
  prepareStagingBucketInputSchema,
  prepareStagingBucketResultSchema,
  type PrepareStagingBucketInput,
  type PrepareStagingBucketResult,
} from "../types/index.js";

export interface StagingBucketServices {
  buckets: R2BucketsService;
  cors: R2CorsService;
  domains: R2DomainService;
}

/**
 * Prepara / audita un bucket R2 de staging sin tocar producción.
 */
export async function prepareStagingBucket(
  services: StagingBucketServices,
  input: PrepareStagingBucketInput,
): Promise<PrepareStagingBucketResult> {
  const parsed = prepareStagingBucketInputSchema.parse(input);
  const blockers: string[] = [];
  const warnings: string[] = [];
  const actions: string[] = [];

  try {
    assertStagingBucketName(parsed.bucketName);
  } catch (error) {
    blockers.push(error instanceof Error ? error.message : "Nombre de bucket staging inválido");
  }

  if (isProductionBucketName(parsed.bucketName)) {
    blockers.push(`Bucket "${parsed.bucketName}" contiene prod/production — bloqueado`);
  }

  const platform = resolvePlatform(parsed.platformId);
  if (!platform) {
    warnings.push(`Plataforma "${parsed.platformId}" no encontrada en catalog`);
  }

  if (platform?.r2?.productionProtected !== false && platform?.r2?.productionBucket) {
    if (parsed.bucketName === platform.r2.productionBucket) {
      blockers.push(
        `Bucket de producción "${platform.r2.productionBucket}" — NO TOCAR desde prepareStagingBucket`,
      );
    }
  }

  if (platform?.r2?.stagingOperationsAllowed === false) {
    blockers.push(`Plataforma ${parsed.platformId} no permite operaciones R2 staging vía MCP`);
  }

  if (platform?.r2?.stagingBucket && platform.r2.stagingBucket !== parsed.bucketName) {
    warnings.push(
      `Catalog staging bucket es "${platform.r2.stagingBucket}", se solicitó "${parsed.bucketName}"`,
    );
  }

  let exists = false;
  let created = false;
  let wouldCreate = false;
  let corsReady: boolean | null = null;
  let publicDomainReady: boolean | null = null;

  if (blockers.length === 0) {
    try {
      exists = await services.buckets.bucketExists(parsed.bucketName);
    } catch {
      blockers.push(`No se pudo verificar existencia de "${parsed.bucketName}"`);
    }
  }

  if (blockers.length === 0 && !exists) {
    wouldCreate = true;
    actions.push(`Crear bucket "${parsed.bucketName}"`);

    try {
      assertMutableAllowed("prepareStagingBucket.create", {
        dryRun: parsed.dryRun,
        confirm: parsed.confirm,
      });
    } catch (error) {
      if (parsed.dryRun) {
        // dryRun: no crear
      } else {
        blockers.push(error instanceof Error ? error.message : "Confirmación requerida para crear");
      }
    }

    if (!parsed.dryRun && parsed.confirm) {
      const result = await services.buckets.createBucket(parsed.bucketName, {
        dryRun: false,
        confirm: true,
      });
      created = result.created;
      exists = result.created;
      wouldCreate = false;
      actions.push(`Bucket "${parsed.bucketName}" creado`);
    } else if (parsed.dryRun) {
      warnings.push("dryRun=true — no se creará el bucket");
    } else if (!parsed.confirm) {
      blockers.push("Creación requiere confirm: true y dryRun: false");
    }
  } else if (exists) {
    actions.push("Bucket ya existe — no se modificará sin confirm explícito en tools específicas");
    warnings.push("Bucket existente: CORS/dominio no se modifican automáticamente");
  }

  if (exists && blockers.length === 0) {
    try {
      const rules = await services.cors.getCors(parsed.bucketName);
      corsReady = services.cors.isCorsReady(rules);
      if (!corsReady) {
        warnings.push("CORS no configurado o incompleto");
        actions.push("Revisar/actualizar CORS con r2_cors_update");
      }
    } catch {
      corsReady = null;
      warnings.push("No se pudo leer CORS del bucket");
    }

    try {
      const domain = await services.domains.getPublicDomain(parsed.bucketName);
      publicDomainReady = domain.enabled;
      if (!publicDomainReady) {
        warnings.push("Dominio público managed (r2.dev) no habilitado");
        actions.push("Habilitar con r2_public_domain_enable si aplica");
      }
    } catch {
      publicDomainReady = null;
      warnings.push("No se pudo leer dominio público managed");
    }
  }

  const status =
    blockers.length > 0 ? "BLOCKED" : !exists || corsReady === false ? "ACTION_REQUIRED" : "READY";

  const recommendation =
    status === "READY"
      ? `Bucket staging "${parsed.bucketName}" listo para QA de assets`
      : status === "BLOCKED"
        ? `Bloqueado: ${blockers.join("; ")}`
        : `Acción requerida: ${actions.join("; ") || warnings.join("; ")}`;

  return prepareStagingBucketResultSchema.parse({
    status,
    platformId: parsed.platformId,
    bucketName: parsed.bucketName,
    dryRun: parsed.dryRun,
    confirm: parsed.confirm,
    exists,
    created,
    wouldCreate,
    corsReady,
    publicDomainReady,
    blockers,
    warnings,
    actions,
    recommendation,
  });
}

function resolvePlatform(platformId: string): PlatformDefinition | undefined {
  return getPlatform(platformId);
}

export function assertNotProductionBucket(name: string): void {
  if (isProductionBucketName(name)) {
    throw new CloudflareGuardError(`Bucket de producción "${name}" — NO TOCAR`);
  }
}
