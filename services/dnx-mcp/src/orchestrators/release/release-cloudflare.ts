import type { BrainSignal } from "../../brain/types.js";
import type { PlatformDefinition } from "../../platforms/types.js";
import type { CloudflareProvider } from "../../providers/cloudflare/provider.js";
import type { CloudflareReleaseReadiness } from "../../providers/cloudflare/types/index.js";

/**
 * Blockers críticos solo cuando la plataforma requiere assets (r2 !== null).
 * No bloquea release de módulos sin assets.
 */
export function cloudflareHasCriticalBlockers(readiness: CloudflareReleaseReadiness): boolean {
  if (!readiness.assetsRequired) {
    return false;
  }

  return readiness.blockers.length > 0 || readiness.riskLevel === "high";
}

export function describeCloudflareBlockers(readiness: CloudflareReleaseReadiness): string[] {
  if (!readiness.assetsRequired) {
    return [];
  }
  return [...readiness.blockers];
}

export function assertCloudflareAllowsPhotoQa(readiness: CloudflareReleaseReadiness): void {
  if (!cloudflareHasCriticalBlockers(readiness)) {
    return;
  }

  throw new CloudflareReleaseBlockedError(describeCloudflareBlockers(readiness));
}

export class CloudflareReleaseBlockedError extends Error {
  readonly blockers: string[];

  constructor(blockers: string[]) {
    super(`QA de fotos bloqueada por Cloudflare/R2: ${blockers.join("; ")}`);
    this.name = "CloudflareReleaseBlockedError";
    this.blockers = blockers;
  }
}

export function appendCloudflareSignals(
  readiness: CloudflareReleaseReadiness,
  signals: BrainSignal[],
): void {
  signals.push({
    source: "cloudflare",
    type: "state",
    key: "cloudflare.configured",
    message: readiness.configured ? "Cloudflare configurado" : "Cloudflare no configurado",
    value: readiness.configured,
    ...(!readiness.configured && readiness.assetsRequired ? { severity: "high" as const } : {}),
  });

  signals.push({
    source: "cloudflare",
    type: "state",
    key: "cloudflare.bucketExists",
    message: readiness.bucketExists
      ? `Bucket staging presente (${readiness.bucketName ?? "n/a"})`
      : `Bucket staging ausente (${readiness.bucketName ?? "n/a"})`,
    value: readiness.bucketExists,
    ...(!readiness.bucketExists && readiness.assetsRequired ? { severity: "high" as const } : {}),
  });

  signals.push({
    source: "cloudflare",
    type: "risk",
    key: "cloudflare.riskLevel",
    message: `Nivel de riesgo Cloudflare/R2: ${readiness.riskLevel}`,
    value: readiness.riskLevel,
    severity:
      readiness.riskLevel === "high" ? "high" : readiness.riskLevel === "medium" ? "medium" : "low",
  });

  if (readiness.corsReady !== null) {
    signals.push({
      source: "cloudflare",
      type: "state",
      key: "cloudflare.corsReady",
      message: readiness.corsReady ? "CORS R2 listo" : "CORS R2 incompleto",
      value: readiness.corsReady,
      ...(!readiness.corsReady ? { severity: "medium" as const } : {}),
    });
  }

  if (readiness.publicDomainReady !== null) {
    signals.push({
      source: "cloudflare",
      type: "state",
      key: "cloudflare.publicDomainReady",
      message: readiness.publicDomainReady
        ? "Dominio público R2 listo"
        : "Dominio público R2 no habilitado",
      value: readiness.publicDomainReady,
      ...(!readiness.publicDomainReady ? { severity: "medium" as const } : {}),
    });
  }

  for (const blocker of readiness.blockers) {
    signals.push({
      source: "cloudflare",
      type: "risk",
      key: "cloudflare.blocker",
      message: blocker,
      severity: "high",
    });
  }

  for (const warning of readiness.warnings) {
    signals.push({
      source: "cloudflare",
      type: "issue",
      key: "cloudflare.warning",
      message: warning,
      severity: "medium",
    });
  }
}

export function formatCloudflareReport(
  readiness: CloudflareReleaseReadiness,
): Record<string, unknown> {
  return {
    configured: readiness.configured,
    bucketExists: readiness.bucketExists,
    bucketName: readiness.bucketName,
    corsReady: readiness.corsReady,
    publicDomainReady: readiness.publicDomainReady,
    assetsRequired: readiness.assetsRequired,
    productionProtected: readiness.productionProtected,
    riskLevel: readiness.riskLevel,
    blockers: readiness.blockers,
    warnings: readiness.warnings,
    recommendation: readiness.recommendation,
  };
}

export type CloudflareProviderResolver = (
  platform: PlatformDefinition,
) => CloudflareProvider | undefined;

export function resolveCloudflareProvider(
  platform: PlatformDefinition,
  options: {
    cloudflare?: CloudflareProvider | undefined;
    getCloudflareProvider?: CloudflareProviderResolver | undefined;
  },
): CloudflareProvider | undefined {
  // Solo evaluar si la plataforma declara R2; módulos sin assets no requieren provider.
  if (platform.r2 === null) {
    return undefined;
  }

  return options.getCloudflareProvider?.(platform) ?? options.cloudflare;
}
