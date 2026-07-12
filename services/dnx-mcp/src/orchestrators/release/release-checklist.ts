import type {
  ChecklistItem,
  ReleaseRisk,
  RiskLevel,
  StagingSnapshot,
  StatusSnapshot,
} from "./release-types.js";
import { normalizeVercelStatusSnapshot } from "./release-vercel-status.js";

export function buildRisks(
  status: StatusSnapshot | Record<string, unknown>,
  staging: StagingSnapshot | Record<string, unknown>,
): ReleaseRisk[] {
  const risks: ReleaseRisk[] = [];

  if (isDryRunPayload(status) || isDryRunPayload(staging)) {
    return [{ level: "low", source: "orchestrator", message: "Ejecución en modo dryRun" }];
  }

  const stagingData = staging as StagingSnapshot;
  const statusData = normalizeVercelStatusSnapshot(
    status,
    stagingData.project.name,
  ) as StatusSnapshot;

  if (!statusData.project) {
    risks.push({
      level: "high",
      source: "vercel_status",
      message: "Proyecto no encontrado en el panorama de status",
    });
    return risks;
  }

  if (statusData.project.health === "failed") {
    risks.push({
      level: "high",
      source: "vercel_status",
      message: "El último deployment reporta salud fallida",
    });
  }

  if (statusData.project.health === "building") {
    risks.push({
      level: "medium",
      source: "vercel_status",
      message: "Hay un deployment en progreso",
    });
  }

  if (!stagingData.deployments.preview) {
    risks.push({
      level: "high",
      source: "vercel_prepare_staging",
      message: "No hay deployment de preview disponible",
    });
  }

  for (const issue of stagingData.environment.issues) {
    // Diffs preview vs production son esperados en staging; no penalizar como riesgo.
    if (issue.type === "value_mismatch") {
      continue;
    }
    risks.push({
      level: "high",
      source: "vercel_prepare_staging",
      message: issue.message,
    });
  }

  for (const domain of stagingData.domains.diff.unverified) {
    risks.push({
      level: "high",
      source: "vercel_prepare_staging",
      message: `Dominio sin verificar: ${domain}`,
    });
  }

  if (stagingData.domains.diff.previewOnly.length > 0) {
    risks.push({
      level: "low",
      source: "vercel_prepare_staging",
      message: "Dominios solo en preview — revisar antes de producción",
    });
  }

  return dedupeRisks(risks);
}

export function buildChecklist(
  status: StatusSnapshot | Record<string, unknown>,
  staging: StagingSnapshot | Record<string, unknown>,
  risks: ReleaseRisk[],
): ChecklistItem[] {
  if (isDryRunPayload(status) || isDryRunPayload(staging)) {
    return [
      {
        id: "dry_run",
        label: "Modo simulación",
        status: "ready",
        notes: "Ejecutar sin dryRun para checklist real",
      },
    ];
  }

  const stagingData = staging as StagingSnapshot;
  const statusData = normalizeVercelStatusSnapshot(
    status,
    stagingData.project.name,
  ) as StatusSnapshot;
  const highRisks = risks.filter((r) => r.level === "high");
  const envIssueCount = stagingData.environment.issues.length;
  const envMismatchOnly =
    envIssueCount > 0 &&
    stagingData.environment.issues.every((issue) => issue.type === "value_mismatch");
  const unverifiedCount = stagingData.domains.diff.unverified.length;
  const aliasCount = stagingData.aliases.length;
  const project = statusData.project;

  return [
    {
      id: "project_exists",
      label: "Proyecto verificado",
      status: project ? "ready" : "failed",
      ...(project ? { notes: project.name } : {}),
    },
    {
      id: "preview_deployment",
      label: "Deployment preview disponible",
      status: stagingData.deployments.preview ? "ready" : "failed",
    },
    {
      id: "production_baseline",
      label: "Baseline de producción identificado",
      status: stagingData.deployments.production ? "ready" : "attention",
    },
    {
      id: "env_alignment",
      label: "Variables de entorno alineadas",
      status: envIssueCount === 0 ? "ready" : "attention",
      notes: `${String(envIssueCount)} issue(s)`,
    },
    {
      id: "domains_verified",
      label: "Dominios verificados",
      status: unverifiedCount === 0 ? "ready" : "failed",
    },
    {
      id: "aliases_reviewed",
      label: "Aliases revisados",
      status: aliasCount > 0 ? "ready" : "attention",
      notes: `${String(aliasCount)} alias(es)`,
    },
    {
      id: "health_check",
      label: "Salud del deployment",
      status:
        project?.health === "healthy"
          ? "ready"
          : project?.health === "building"
            ? "attention"
            : "failed",
    },
    {
      id: "risk_assessment",
      label: "Evaluación de riesgos",
      status: highRisks.length === 0 ? "ready" : "failed",
      notes: `${String(highRisks.length)} riesgo(s) alto(s)`,
    },
    {
      id: "staging_ready",
      label: "Staging listo para validación",
      status: !stagingData.deployments.preview
        ? "failed"
        : stagingData.stagingReady
          ? "ready"
          : envMismatchOnly && unverifiedCount === 0
            ? "attention"
            : "failed",
    },
    {
      id: "validate_next",
      label: "Ejecutar validateRelease",
      status: "pending",
      notes: "Siguiente paso del pipeline",
    },
  ];
}

export function isReadyForValidation(checklist: ChecklistItem[], risks: ReleaseRisk[]): boolean {
  const blockingItems = checklist.filter(
    (item) => item.status === "failed" && item.id !== "validate_next",
  );
  const highRisks = risks.filter((r) => r.level === "high");
  return blockingItems.length === 0 && highRisks.length === 0;
}

function isDryRunPayload(
  value: StatusSnapshot | StagingSnapshot | Record<string, unknown>,
): boolean {
  return (value as Record<string, unknown>).dryRun === true;
}

function dedupeRisks(risks: ReleaseRisk[]): ReleaseRisk[] {
  const seen = new Set<string>();
  return risks.filter((risk) => {
    const key = `${risk.source}:${risk.message}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function highestRiskLevel(risks: ReleaseRisk[]): RiskLevel {
  if (risks.some((r) => r.level === "high")) {
    return "high";
  }
  if (risks.some((r) => r.level === "medium")) {
    return "medium";
  }
  return "low";
}
