import { buildStageEnvelope } from "./prompt-contract.js";
import type { PlannerDecision } from "./schema.js";
import type { PlannerInput } from "./types.js";
import { emptyUsage } from "./usage.js";

export function createMockPlannerDecision(input: PlannerInput): PlannerDecision {
  const nextStageNumber =
    input.existingStages.reduce((max, s) => Math.max(max, s.stageNumber), 0) + 1;
  const title = "AUDITORIA Y PLAN INCREMENTAL";
  const envelope = buildStageEnvelope(nextStageNumber, title, input.task.project);

  const prompt = `${envelope}

Contexto:
Proyecto ${input.task.project}. Objetivo de task: ${input.task.objective}.
Working tree puede contener cambios ajenos; no tocarlos.

Objetivo:
Auditar el alcance mínimo y proponer la implementación incremental segura de la siguiente etapa técnica (sin ejecutarla todavía).

Alcance:
- Inspección read-only del área relevante.
- Definir archivos/módulos candidatos.
- No modificar código productivo en esta stage si basta con auditoría.
- No abrir scope fuera del objective.

Acciones permitidas:
- READ_REPO
- RUN_TESTS (solo si aplica y es seguro/local)

Acciones prohibidas:
- PUSH, MERGE, DEPLOY_PRODUCTION, FORCE_PUSH, RESET_HARD
- DROP_DATABASE, TRUNCATE_DATABASE, PROD_DATA_WRITE
- CHANGE_DNS, CLOUDFLARE_PROD_CHANGE, MERCADO_PAGO_PROD_CHANGE
- OAUTH_PROD_CHANGE, SECRET_ROTATION, MASS_DELETE

Preservar cambios ajenos:
No revertir, limpiar ni modificar trabajo preexistente no relacionado.

Validaciones requeridas:
- typecheck del paquete afectado si hay cambios
- tests unitarios del paquete afectado si hay cambios

Criterio de DONE:
- Informe claro del alcance
- Lista de archivos candidatos
- Riesgos y human gates identificados

Salida obligatoria:
Resumen estructurado con hallazgos y siguiente recomendación.

ACCIÓN LEGAL REQUERIDA: NO

NO comenzar automáticamente la siguiente etapa.

${envelope}`;

  return {
    decision: "CREATE_STAGE",
    reason: "Mock planner created an incremental audit stage (no OpenAI call).",
    stage: {
      stageNumber: nextStageNumber,
      title,
      objective: `Auditar e incrementar de forma segura: ${input.task.objective}`,
      prompt,
      riskLevel: "LOW",
      estimatedComplexity: "LOW",
      requiresHumanApproval: false,
      allowedActions: ["READ_REPO", "RUN_TESTS"],
      forbiddenActions: [
        "PUSH",
        "MERGE",
        "DEPLOY_PRODUCTION",
        "FORCE_PUSH",
        "RESET_HARD",
        "DROP_DATABASE",
        "TRUNCATE_DATABASE",
        "SECRET_ROTATION",
      ],
      validationCommands: [
        "pnpm --filter @dnx/dev-orchestrator typecheck",
        "pnpm --filter @dnx/dev-orchestrator test",
      ],
      completionCriteria: [
        "Alcance documentado",
        "Riesgos y human gates listados",
        "Sin modificar trabajo ajeno",
      ],
      legalActionRequired: false,
      legalNotes: null,
    },
  };
}

export function mockPlannerUsage() {
  return emptyUsage();
}
