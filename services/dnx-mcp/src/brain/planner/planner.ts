import type {
  BrainAction,
  BrainContext,
  BrainVerdict,
  EvaluatedRisk,
  Inconsistency,
} from "../types.js";

export interface PlanInput {
  context: BrainContext;
  verdict: BrainVerdict;
  risks: EvaluatedRisk[];
  inconsistencies: Inconsistency[];
  rejected: boolean;
}

export class ActionPlanner {
  plan(input: PlanInput): BrainAction[] {
    const actions: BrainAction[] = [];

    if (input.rejected) {
      actions.push({
        id: "halt-operation",
        priority: "high",
        action: "Detener la operación y resolver bloqueos antes de continuar",
        rationale: "El Brain rechazó la operación por riesgos o inconsistencias críticas",
      });
    }

    this.addRiskActions(input.risks, actions);
    this.addGitRemediationActions(input.risks, actions);
    this.addPrismaRemediationActions(input.risks, actions);
    this.addPostgresRemediationActions(input.risks, actions);
    this.addInconsistencyActions(input.inconsistencies, actions);
    this.addOperationActions(input.context, input.verdict, actions);

    return dedupeActions(actions).slice(0, 8);
  }

  private addRiskActions(risks: EvaluatedRisk[], actions: BrainAction[]): void {
    for (const risk of risks.filter((r) => r.blocking || r.level === "critical")) {
      actions.push({
        id: `resolve-risk-${risk.id}`,
        priority: "high",
        action: `Resolver: ${risk.message}`,
        rationale: `Riesgo ${risk.level} bloqueante desde ${risk.source}`,
      });
    }

    for (const risk of risks.filter((r) => !r.blocking && r.level === "medium")) {
      actions.push({
        id: `review-risk-${risk.id}`,
        priority: "medium",
        action: `Revisar: ${risk.message}`,
        rationale: `Riesgo medio que afecta el score`,
      });
    }
  }

  private addGitRemediationActions(risks: EvaluatedRisk[], actions: BrainAction[]): void {
    const gitRisks = risks.filter((risk) => risk.source === "git");

    if (gitRisks.some((risk) => /sucio|dirty|commitear/i.test(risk.message))) {
      actions.push({
        id: "git-commit-changes",
        priority: "high",
        action: "Commitear o descartar cambios locales antes del release",
        rationale: "El repositorio Git tiene cambios sin commitear",
      });
    }

    if (gitRisks.some((risk) => /sin push|unpushed/i.test(risk.message))) {
      actions.push({
        id: "git-push-commits",
        priority: "high",
        action: "Hacer push de commits locales al remoto",
        rationale: "Hay commits locales que no están en el remoto",
      });
    }

    if (
      gitRisks.some((risk) => /rama.*no permitida|no permitida para release/i.test(risk.message))
    ) {
      actions.push({
        id: "git-merge-branch",
        priority: "high",
        action: "Cambiar a la rama permitida o mergear hacia la rama de release",
        rationale: "La rama actual no cumple la política de release de la plataforma",
      });
    }
  }

  private addPrismaRemediationActions(risks: EvaluatedRisk[], actions: BrainAction[]): void {
    const prismaRisks = risks.filter((risk) => risk.source === "prisma");

    if (prismaRisks.some((risk) => /migración.*pendiente|pending migration/i.test(risk.message))) {
      actions.push({
        id: "prisma-apply-migrations",
        priority: "high",
        action: "Aplicar migraciones pendientes en el entorno objetivo antes del release",
        rationale: "Hay migraciones Prisma sin aplicar en la base de datos",
      });
    }

    if (prismaRisks.some((risk) => /schema.*inválido|prisma validate/i.test(risk.message))) {
      actions.push({
        id: "prisma-validate-schema",
        priority: "high",
        action: "Corregir y validar el schema Prisma (prisma validate)",
        rationale: "El schema Prisma no pasa validación",
      });
    }

    if (prismaRisks.some((risk) => /format|drift/i.test(risk.message))) {
      actions.push({
        id: "prisma-review-drift",
        priority: "medium",
        action: "Revisar drift de schema (prisma format --check y alinear migraciones)",
        rationale: "Se detectó drift de formato o estado en Prisma",
      });
    }
  }

  private addPostgresRemediationActions(risks: EvaluatedRisk[], actions: BrainAction[]): void {
    const postgresRisks = risks.filter((risk) => risk.source === "postgres");

    if (postgresRisks.some((risk) => /no conectado|no se pudo evaluar/i.test(risk.message))) {
      actions.push({
        id: "postgres-verify-connection",
        priority: "high",
        action: "Verificar conexión a PostgreSQL y credenciales de solo lectura",
        rationale: "No se pudo evaluar el estado de la base de datos",
      });
    }

    if (postgresRisks.some((risk) => /lock|bloqueante|en espera/i.test(risk.message))) {
      actions.push({
        id: "postgres-review-locks",
        priority: "high",
        action: "Revisar y resolver locks bloqueantes antes del release",
        rationale: "Hay locks en espera que pueden impedir migraciones o deploy",
      });
    }

    if (postgresRisks.some((risk) => /larga duración|long.?running/i.test(risk.message))) {
      actions.push({
        id: "postgres-terminate-long-queries",
        priority: "high",
        action: "Terminar o esperar queries de larga duración antes del release",
        rationale: "Queries activas prolongadas aumentan el riesgo durante el deploy",
      });
    }

    if (postgresRisks.some((risk) => /_prisma_migrations|migration table/i.test(risk.message))) {
      actions.push({
        id: "postgres-verify-migrations-table",
        priority: "high",
        action: "Verificar que la tabla _prisma_migrations existe y está accesible",
        rationale: "La tabla de migraciones Prisma no fue encontrada en public",
      });
    }

    if (postgresRisks.some((risk) => /conexión.*activa|muchas conexiones/i.test(risk.message))) {
      actions.push({
        id: "postgres-review-connections",
        priority: "medium",
        action: "Revisar el pool de conexiones y carga activa en PostgreSQL",
        rationale: "Hay muchas conexiones activas que pueden afectar el release",
      });
    }
  }

  private addInconsistencyActions(inconsistencies: Inconsistency[], actions: BrainAction[]): void {
    for (const item of inconsistencies) {
      actions.push({
        id: `fix-inconsistency-${item.id}`,
        priority: item.severity === "critical" || item.severity === "high" ? "high" : "medium",
        action: `Corregir inconsistencia: ${item.description}`,
        rationale: `Señales en conflicto: ${item.signals.join(", ")}`,
      });
    }
  }

  private addOperationActions(
    context: BrainContext,
    verdict: BrainVerdict,
    actions: BrainAction[],
  ): void {
    if (context.dryRun) {
      actions.push({
        id: "review-dry-run",
        priority: "low",
        action: "Revisar resultado de simulación antes de ejecutar en producción",
        rationale: "Operación ejecutada en modo dryRun",
      });
      return;
    }

    switch (context.operation) {
      case "release.prepare":
        if (verdict === "approve") {
          actions.push({
            id: "run-validate",
            priority: "high",
            action: "Ejecutar validateRelease en el orquestador",
            rationale: "Preparación aprobada — siguiente paso del pipeline",
          });
        }
        break;
      case "release.validate":
        if (verdict === "approve") {
          actions.push({
            id: "prepare-execute",
            priority: "high",
            action: "Proceder a executeRelease con confirm: true",
            rationale: "Validación aprobada con GO",
          });
        }
        break;
      case "release.execute":
        if (verdict === "approve") {
          actions.push({
            id: "monitor-post-deploy",
            priority: "medium",
            action: "Monitorear health endpoints y smoke tests post-deploy",
            rationale: "Deploy aprobado — verificar estabilidad",
          });
        }
        break;
      case "release.rollback":
        if (verdict === "approve") {
          actions.push({
            id: "verify-rollback",
            priority: "high",
            action: "Verificar que el deployment anterior está healthy",
            rationale: "Rollback aprobado — confirmar recuperación",
          });
        }
        break;
    }
  }
}

function dedupeActions(actions: BrainAction[]): BrainAction[] {
  const seen = new Set<string>();
  return actions.filter((action) => {
    if (seen.has(action.id)) {
      return false;
    }
    seen.add(action.id);
    return true;
  });
}
