import type { PlatformDefinition } from "../../../platforms/types.js";
import type { R2BucketsService } from "../services/r2-buckets.service.js";
import type { R2CorsService } from "../services/r2-cors.service.js";
import type { R2DomainService } from "../services/r2-domain.service.js";
import {
  cloudflareReleaseReadinessSchema,
  type CloudflareReleaseReadiness,
  type RiskLevel,
} from "../types/index.js";

export interface ReleaseReadinessServices {
  buckets: R2BucketsService;
  cors: R2CorsService;
  domains: R2DomainService;
  isConfigured: () => boolean;
}

/**
 * Evalúa readiness R2/Cloudflare para release.
 * - Sin `platform.r2` → no aplica (caller debe devolver null).
 * - Ausencia de staging bloquea QA de fotos (assetsRequired), no módulos sin assets.
 * - Producción nunca se modifica desde este flujo.
 */
export async function assessCloudflareReleaseReadiness(
  services: ReleaseReadinessServices,
  platform: PlatformDefinition,
): Promise<CloudflareReleaseReadiness> {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const configured = services.isConfigured();
  const assetsRequired = platform.r2 !== null;
  const productionProtected = platform.r2?.productionProtected !== false;

  const bucketName =
    platform.r2?.stagingBucket ??
    (platform.r2?.bucket && platform.r2.bucket.endsWith("-staging") ? platform.r2.bucket : null);

  let bucketExists = false;
  let corsReady: boolean | null = null;
  let publicDomainReady: boolean | null = null;

  if (!configured) {
    if (assetsRequired) {
      blockers.push("Cloudflare no configurado (CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID)");
    } else {
      warnings.push("Cloudflare no configurado — omitido (plataforma sin R2)");
    }
  } else if (!assetsRequired) {
    warnings.push("Plataforma sin R2 en catalog — readiness Cloudflare omitida para assets");
  } else if (!bucketName) {
    blockers.push(
      "Catalog R2 sin stagingBucket — QA de fotos bloqueada hasta definir bucket staging",
    );
  } else {
    if (platform.r2?.productionBucket) {
      warnings.push(
        `Bucket producción "${platform.r2.productionBucket}" marcado NO TOCAR (productionProtected=${String(productionProtected)})`,
      );
    }

    try {
      bucketExists = await services.buckets.bucketExists(bucketName);
      if (!bucketExists) {
        blockers.push(
          `Bucket staging "${bucketName}" no existe — bloquea QA de fotos (no afecta módulos sin assets)`,
        );
      } else {
        try {
          const rules = await services.cors.getCors(bucketName);
          corsReady = services.cors.isCorsReady(rules);
          if (!corsReady) {
            warnings.push(`CORS de "${bucketName}" incompleto`);
          }
        } catch {
          corsReady = null;
          warnings.push(`No se pudo evaluar CORS de "${bucketName}"`);
        }

        try {
          const domain = await services.domains.getPublicDomain(bucketName);
          publicDomainReady = domain.enabled;
          if (!publicDomainReady) {
            warnings.push(`Dominio público managed de "${bucketName}" no habilitado`);
          }
        } catch {
          publicDomainReady = null;
          warnings.push(`No se pudo evaluar dominio público de "${bucketName}"`);
        }
      }
    } catch {
      blockers.push(`Error al evaluar bucket staging "${bucketName}"`);
    }
  }

  const riskLevel = calculateRiskLevel(blockers, warnings);
  const recommendation = buildRecommendation(blockers, warnings, assetsRequired, bucketName);

  return cloudflareReleaseReadinessSchema.parse({
    configured,
    bucketExists,
    bucketName,
    corsReady,
    publicDomainReady,
    assetsRequired,
    productionProtected,
    riskLevel,
    blockers,
    warnings,
    recommendation,
  });
}

function calculateRiskLevel(blockers: string[], warnings: string[]): RiskLevel {
  if (blockers.length > 0) {
    return "high";
  }
  if (warnings.length > 0) {
    return "medium";
  }
  return "low";
}

function buildRecommendation(
  blockers: string[],
  warnings: string[],
  assetsRequired: boolean,
  bucketName: string | null,
): string {
  if (!assetsRequired) {
    return "R2 no requerido para esta plataforma — no bloquea release de módulos sin assets";
  }
  if (blockers.length > 0) {
    return `QA de fotos bloqueada: ${blockers.join("; ")}`;
  }
  if (warnings.length > 0) {
    return `Staging R2 usable con precaución (${bucketName ?? "n/a"}): ${warnings.join("; ")}`;
  }
  return `R2 staging "${bucketName ?? ""}" listo para QA de assets`;
}
