# DNX Brain

Motor de decisión puro que evalúa información estructurada proveniente de **Orchestrators**. No realiza HTTP, no invoca providers ni MCP tools.

## Posición en la arquitectura

```
┌─────────────────────────────────────────┐
│           MCP Client (Cursor)           │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│              MCP Tools                  │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│            Orchestrators                │
│   ReleaseOrchestrator, futuros...       │
└─────────────────┬───────────────────────┘
                  │  BrainInput (señales estructuradas)
┌─────────────────▼───────────────────────┐
│              DNX Brain                  │  ← esta capa
│   evaluar → score → confianza → veredicto│
└─────────────────────────────────────────┘
```

El Brain **no ejecuta acciones**. Produce decisiones explicables que los orquestadores o agentes pueden usar para proceder, pausar o rechazar operaciones.

## Módulo

```
src/brain/
├── brain.ts                  # Facade DnxBrain
├── types.ts                  # Tipos centrales
├── index.ts                  # Exports públicos
├── decision-engine/          # Motor principal de decisión
│   └── decision-engine.ts
├── risk-engine/              # Evaluación de riesgos + inconsistencias
│   ├── risk-engine.ts
│   └── inconsistency-detector.ts
├── planner/                    # Generación de nextActions
│   └── planner.ts
├── recommendations/            # Texto de recommendation
│   └── recommender.ts
├── history/                    # Historial in-memory de decisiones
│   └── decision-history.ts
└── knowledge/                  # Reglas, umbrales y patrones
    └── rules.ts
```

## Contrato de entrada: `BrainInput`

```typescript
interface BrainInput {
  context: BrainContext;
  signals: BrainSignal[];
  metadata?: Record<string, unknown>;
}

interface BrainContext {
  operation: BrainOperation;
  platformId: string;
  platformName: string;
  phase?: string;
  dryRun?: boolean;
  orchestrator?: string;
}
```

### Operaciones soportadas

| Operación          | Descripción                       |
| ------------------ | --------------------------------- |
| `release.prepare`  | Preparación de release            |
| `release.validate` | Validación GO/NO-GO               |
| `release.execute`  | Ejecución de deploy en producción |
| `release.rollback` | Rollback a deployment anterior    |

### Tipos de señal (`BrainSignal`)

| Tipo        | Uso típico                                      |
| ----------- | ----------------------------------------------- |
| `risk`      | Riesgos explícitos del orquestador              |
| `issue`     | Problemas detectados en checklist o auditoría   |
| `metric`    | Contadores numéricos (issues, checklist failed) |
| `checklist` | Items de checklist completados/fallidos         |
| `policy`    | Políticas de plataforma (mantenimiento, etc.)   |
| `state`     | Estado del pipeline (validado, GO, preview)     |
| `health`    | Salud de deployments o endpoints                |

Cada señal incluye `source`, `key`, `message`, y opcionalmente `severity` y `value`.

## Contrato de salida: `BrainDecision`

Toda decisión incluye los campos requeridos:

```typescript
interface BrainDecision {
  verdict: "approve" | "caution" | "reject";
  score: number; // 0–100
  confidence: number; // 0.1–0.99
  reasoning: string[]; // Explicación paso a paso
  recommendation: string; // Resumen accionable
  nextActions: BrainAction[];
  risks: EvaluatedRisk[];
  inconsistencies: Inconsistency[];
  rejected: boolean;
  shouldBlock: boolean;
  context: BrainContext;
  evaluatedAt: string;
}
```

## Pipeline de evaluación

```
BrainInput
    │
    ├─► RiskEngine          → riesgos + penalización de score
    │
    ├─► InconsistencyDetector → contradicciones entre señales
    │
    ├─► Knowledge rules     → reglas declarativas (mantenimiento, staging)
    │
    ├─► Score calculator    → 100 − penalizaciones + bonificaciones
    │
    ├─► Confidence calc     → basado en cantidad y diversidad de señales
    │
    ├─► Verdict resolver    → approve / caution / reject
    │
    ├─► Recommender         → texto de recommendation
    │
    └─► ActionPlanner       → nextActions priorizadas
```

## Umbrales y reglas

### Veredictos por score

| Veredicto | Score mínimo |
| --------- | ------------ |
| `approve` | ≥ 75         |
| `caution` | ≥ 50         |
| `reject`  | < 50         |

### Score mínimo por operación

| Operación          | Mínimo |
| ------------------ | ------ |
| `release.prepare`  | 40     |
| `release.validate` | 60     |
| `release.execute`  | 80     |
| `release.rollback` | 55     |

### Reglas de conocimiento

- **Mantenimiento activo** bloquea `release.execute`
- **Staging no validado** bloquea `release.execute`
- **dryRun** nunca produce `approve` (máximo `caution`)

### Inconsistencias detectadas

| ID                            | Condición                                       |
| ----------------------------- | ----------------------------------------------- |
| `maintenance-vs-execute`      | Execute con `policy:maintenance.enabled = true` |
| `validated-with-issues`       | Staging validado pero `issues.count > 0`        |
| `staging-ready-unhealthy`     | Checklist ready pero health `failed`            |
| `go-with-issues`              | Decisión GO con issues pendientes               |
| `validate-without-preview`    | Validación passed sin preview disponible        |
| `ready-with-failed-checklist` | Ready para validación con checklist fallido     |

### Patrones de riesgo

El `RiskEngine` reconoce patrones en mensajes: dominios sin verificar, env mismatch, preview no disponible, health failed, build errors.

## Uso

```typescript
import { DnxBrain } from "./brain/index.js";

const brain = new DnxBrain();

const decision = brain.evaluate({
  context: {
    operation: "release.validate",
    platformId: "fotorank",
    platformName: "Fotorank",
    orchestrator: "release",
  },
  signals: [
    {
      source: "release-checklist",
      type: "checklist",
      key: "staging.ready",
      message: "Staging listo para validación",
      value: true,
    },
    {
      source: "release-checklist",
      type: "metric",
      key: "issues.count",
      message: "Issues abiertos",
      value: 0,
    },
    {
      source: "vercel-validate",
      type: "state",
      key: "validation.decision",
      message: "Decisión de validación",
      value: "GO",
    },
  ],
});

console.log(decision.verdict); // "approve" | "caution" | "reject"
console.log(decision.score); // 0–100
console.log(decision.confidence); // 0.1–0.99
console.log(decision.reasoning); // string[]
console.log(decision.recommendation); // resumen accionable
console.log(decision.nextActions); // acciones priorizadas
console.log(decision.rejected); // true si operación peligrosa
```

### Historial

```typescript
const history = brain.getHistory();

history.record(input, decision); // automático en evaluate()
history.getByPlatform("fotorank");
history.getLatest();
history.getStats(); // approvals, rejections, promedios
```

### Sin historial

```typescript
brain.evaluate(input, { recordHistory: false });
```

## Extensibilidad

Cada componente es inyectable vía constructor:

```typescript
const brain = new DnxBrain({
  decisionEngine: new DecisionEngine({
    riskEngine: new RiskEngine(),
    inconsistencyDetector: new InconsistencyDetector(),
    planner: new ActionPlanner(),
    recommender: new Recommender(),
  }),
  history: new DecisionHistory(1000),
});
```

Para añadir reglas: editar `src/brain/knowledge/rules.ts` (`KNOWLEDGE_RULES`, `RISK_PATTERNS`, umbrales).

## Integración con Release Orchestrator

El Brain está integrado en `ReleaseOrchestrator` vía `release-brain.ts`:

```
vercel_status + vercel_prepare_staging + vercel_validate_staging
  + git.assessReleaseReadiness() + prisma.assessReleaseReadiness()
  + postgres.assessReleaseReadiness()
        │
        ▼
  buildReleaseBrainSignals()  (+ appendGitSignals + appendPrismaSignals + appendPostgresSignals)
        │
        ▼
  DnxBrain.evaluate()
        │
        ▼
  mergeBrainWithProviderGates()  (Git + Prisma + PostgreSQL)
        │
        ▼
  ReleaseBrainAssessment
```

### Señales Git

| Señal                 | Tipo   | Efecto                        |
| --------------------- | ------ | ----------------------------- |
| `git.dirtyTree`       | state  | Penalización crítica, bloqueo |
| `git.unpushedCommits` | metric | Penalización alta si > 0      |
| `git.branch.allowed`  | policy | Bloqueo si `false`            |
| `git.riskLevel`       | risk   | Penalización según nivel      |
| `git.blocker`         | risk   | Cada blocker como riesgo alto |

El Brain recomienda acciones Git vía `nextActions`: `git-commit-changes`, `git-push-commits`, `git-merge-branch`.

### Señales Prisma

| Señal                         | Tipo   | Efecto                        |
| ----------------------------- | ------ | ----------------------------- |
| `prisma.schemaValid`          | state  | Bloqueo si `false`            |
| `prisma.hasPendingMigrations` | state  | Bloqueo crítico si `true`     |
| `prisma.formatDrift`          | state  | Bloqueo si `true`             |
| `prisma.migrationCount`       | metric | Penalización media si > 30    |
| `prisma.driftRisk`            | risk   | Penalización según nivel      |
| `prisma.riskLevel`            | risk   | Penalización según nivel      |
| `prisma.blocker`              | risk   | Cada blocker como riesgo alto |

El Brain recomienda acciones Prisma vía `nextActions`: `prisma-apply-migrations`, `prisma-validate-schema`, `prisma-review-drift`.

### Señales PostgreSQL

| Señal                           | Tipo   | Efecto                              |
| ------------------------------- | ------ | ----------------------------------- |
| `postgres.connected`            | state  | Bloqueo crítico si `false`          |
| `postgres.riskLevel`            | risk   | Penalización según nivel            |
| `postgres.longRunningQueries`   | metric | Bloqueo crítico si > 0              |
| `postgres.locks`                | metric | Penalización alta si locks bloquean |
| `postgres.activeConnections`    | metric | Warning si ≥ 50 conexiones          |
| `postgres.migrationTableExists` | state  | Bloqueo si `false`                  |
| `postgres.blocker`              | risk   | Cada blocker como riesgo alto       |

El Brain recomienda acciones PostgreSQL vía `nextActions`: `postgres-verify-connection`, `postgres-review-locks`, `postgres-terminate-long-queries`, `postgres-verify-migrations-table`, `postgres-review-connections`.

### Reglas de bloqueo en release

| Fase              | `shouldBlock: true` implica               |
| ----------------- | ----------------------------------------- |
| `prepareRelease`  | `plan.readyForValidation = false`         |
| `validateRelease` | `decision = "NO-GO"`                      |
| `executeRelease`  | Error antes del deploy (excepto `dryRun`) |

### Inyección para tests

```typescript
const orchestrator = new ReleaseOrchestrator({
  invoker: mockInvoker,
  brain: new DnxBrain(),
  git: createGitProvider({ config: { repoPath: "/repo" } }),
});
```

## Integración MCP (futura)

El Brain **no está expuesto como MCP tool** todavía. Previsto:

- Tool `brain_evaluate` para evaluación directa desde el cliente
- Más orchestrators consumiendo el mismo motor de decisión

## Tests

```bash
pnpm test src/brain
```

Cobertura por módulo:

- `risk-engine.test.ts` — evaluación de riesgos y patrones
- `inconsistency-detector.test.ts` — detección de contradicciones
- `decision-engine.test.ts` — score, veredicto, rechazo
- `planner.test.ts` — generación de acciones
- `recommender.test.ts` — textos de recomendación
- `decision-history.test.ts` — historial y estadísticas
- `brain.test.ts` — integración end-to-end del facade
