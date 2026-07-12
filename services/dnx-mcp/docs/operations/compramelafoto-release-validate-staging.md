# ComprameLaFoto — `release_validate` staging (dry-run)

**Fecha:** 2026-07-08  
**Input:**

```json
{
  "platformId": "compramelafoto",
  "dryRun": true
}
```

**Duración:** ~9 s (validate) · ~48 s (prepare comparativo)  
**Sin deploy · sin `release_execute` · sin DNS · sin cambios Vercel**

**Contexto previo:** migraciones Prisma aplicadas en staging Neon (6/6). PostgreSQL assess OK en `release_prepare`.

---

## Resumen ejecutivo

| Campo                 | Valor        |
| --------------------- | ------------ |
| **decision**          | **NO-GO**    |
| **Brain score**       | **90** / 100 |
| **Brain verdict**     | `caution`    |
| **Brain shouldBlock** | `false`      |
| **canExecute**        | `false`      |
| **phase**             | `failed`     |
| **blocked**           | `true`       |

**Veredicto operativo:** staging DB y PostgreSQL están listos, pero **`release_validate` en `dryRun: true` devuelve NO-GO por diseño** — `vercel_validate_staging` no marca `passed: true` en simulación. Además, **Git y Prisma no se evaluaron** en esta ejecución porque el volumen del monorepo no estaba montado.

---

## Decisión GO / NO-GO

### NO-GO (esta ejecución)

| Causa                      | Severidad             | Detalle                                                                |
| -------------------------- | --------------------- | ---------------------------------------------------------------------- |
| Validación Vercel simulada | **Bloqueante formal** | `validation.passed !== true` en dry-run → `preliminaryDecision: NO-GO` |
| Monorepo no montado        | **Operativa**         | `GIT_REPO_PATH` inaccesible → Git/Prisma `null`                        |
| Modo dryRun                | Informativa           | Brain penaliza levemente; no bloquea (`shouldBlock: false`)            |

### Señales positivas (staging DB)

| Componente            | Estado                                          |
| --------------------- | ----------------------------------------------- |
| PostgreSQL            | **OK** — conectado, `_prisma_migrations` existe |
| Brain (providers)     | Score **90**, sin bloqueo Brain                 |
| Blockers de providers | **Ninguno** (`[]`)                              |

---

## Brain

| Campo         | Valor                                                        |
| ------------- | ------------------------------------------------------------ |
| Score         | `90`                                                         |
| Confianza     | `95%`                                                        |
| Verdict       | `caution`                                                    |
| shouldBlock   | `false`                                                      |
| Recomendación | Proceder con precaución — 2 riesgos bajos, 0 inconsistencias |

### Riesgos Brain (no bloqueantes)

| Nivel | Fuente       | Mensaje                         |
| ----- | ------------ | ------------------------------- |
| low   | orchestrator | Ejecución en modo dryRun        |
| low   | postgres     | Nivel de riesgo PostgreSQL: low |

### Reasoning

1. Score 90/100 — por encima del umbral típico de bloqueo (60).
2. Sin inconsistencias entre providers.
3. Modo dryRun: no autoriza ejecución real (`canExecute: false`).

---

## Blockers

**Lista consolidada de providers/issues:** `[]` (vacía).

> El NO-GO **no** proviene de blockers Prisma/PostgreSQL/Git en esta corrida. Proviene de la regla `validation.passed === true` no cumplida en simulación Vercel.

---

## Warnings

| Fuente       | Mensaje                         |
| ------------ | ------------------------------- |
| orchestrator | Ejecución en modo dryRun        |
| postgres     | Nivel de riesgo PostgreSQL: low |

---

## Git status

| Campo                        | Valor                                                                                           |
| ---------------------------- | ----------------------------------------------------------------------------------------------- |
| **Evaluado**                 | **No** (`git: null`)                                                                            |
| **Causa**                    | Volumen `/Volumes/HD DNX 10/PROGRAMACIONES/dnx-suite` **no montado** en el entorno de ejecución |
| `gitProvider.isConfigured()` | `false`                                                                                         |

### Estado esperado (última corrida con monorepo montado)

| Campo                | Valor                              |
| -------------------- | ---------------------------------- |
| Rama                 | `migration-legacy-clf-to-monorepo` |
| Permitida en catalog | **Sí** (`allowedBranches`)         |
| dirtyTree            | `false`                            |
| blockers             | `[]`                               |

> La rama `migration-legacy-clf-to-monorepo` es válida para staging/preparación según Platform Catalog.

---

## Prisma status

| Campo                           | Valor                                              |
| ------------------------------- | -------------------------------------------------- |
| **Evaluado**                    | **No** (`prisma: null`)                            |
| **Causa**                       | Schema path inaccesible — mismo volumen no montado |
| `prismaProvider.isConfigured()` | `false`                                            |

### Estado esperado (post `migrate deploy` en staging)

| Campo                  | Valor             |
| ---------------------- | ----------------- |
| schemaValid            | `true`            |
| Migraciones pendientes | `0` (6 aplicadas) |
| blockers               | `[]`              |

---

## PostgreSQL status

| Campo                   | Valor                                                                    |
| ----------------------- | ------------------------------------------------------------------------ |
| **Estado**              | **OK**                                                                   |
| connected               | `true`                                                                   |
| version                 | PostgreSQL 17.10                                                         |
| databaseSize            | ~17,8 MB (post-migraciones; antes ~7 MB vacía)                           |
| activeConnections       | 1                                                                        |
| migrationTableExists    | **`true`**                                                               |
| applied migrations (DB) | 6                                                                        |
| riskLevel               | `low`                                                                    |
| blockers                | `[]`                                                                     |
| warnings                | `[]`                                                                     |
| recommendation          | Base de datos PostgreSQL lista para continuar con el pipeline de release |

---

## Vercel status

| Campo             | Valor                        |
| ----------------- | ---------------------------- |
| Proyecto          | `compramelafoto-dnxsuite`    |
| API invocada      | **No** — `dryRun: true`      |
| validation.passed | **No definido** (simulación) |

### Simulación `vercel_validate_staging`

```json
{
  "dryRun": true,
  "project": "compramelafoto-dnxsuite",
  "wouldValidate": ["deployment_ready", "health", "build", "runtime_logs", "aliases", "env_vars"]
}
```

**Sin cambios en Vercel, DNS ni variables de entorno.**

---

## canExecute

| Campo          | Valor       |
| -------------- | ----------- |
| **canExecute** | **`false`** |

Cálculo: `decision === "GO" && !brain.shouldBlock` → `false` porque `decision === "NO-GO"`.

En `dryRun: true`, `canExecute` será **siempre false** aunque Brain apruebe.

---

## Por qué NO-GO con Brain 90

Flujo en `release-orchestrator.ts`:

```
validationPassed = validation.passed === true   // false en dry-run
preliminaryDecision = validationPassed ? GO : NO-GO
decision = preliminaryDecision === GO && !brain.shouldBlock ? GO : NO-GO
```

En dry-run, `handleVercelValidateStaging` retorna `wouldValidate` pero **no** `passed: true`. Por eso la decisión formal es NO-GO independientemente del score Brain.

---

## Recomendación concreta

### Para confirmar staging listo (sin deploy)

1. **Montar el volumen del monorepo** (`/Volumes/HD DNX 10/PROGRAMACIONES/dnx-suite`) para que Git y Prisma se evalúen en validate.
2. **Re-ejecutar `release_prepare`** y confirmar:
   - `prisma.blockers: []`
   - `postgres.connected: true`
   - `git.blockers: []`
3. **Ejecutar `release_validate` con `dryRun: false`** cuando se quiera auditar el deployment preview real en Vercel (health, build, logs, aliases, env vars). Eso es lo que puede devolver **GO** formal si el preview está sano.
4. **No ejecutar `release_execute`** hasta tener GO en validate real + confirmación explícita.

### Interpretación actual

| Pregunta                              | Respuesta                                           |
| ------------------------------------- | --------------------------------------------------- |
| ¿Staging DB lista?                    | **Sí** — esquema aplicado, PostgreSQL OK            |
| ¿Prisma lista (con monorepo montado)? | **Sí** (estado post-migrate deploy)                 |
| ¿Validate dry-run dice GO?            | **No** — limitación de simulación Vercel            |
| ¿Listo para deploy preview?           | **Pendiente** — validate real contra Vercel preview |

### Próximo paso sugerido

```json
{
  "platformId": "compramelafoto",
  "dryRun": false
}
```

Solo cuando el monorepo esté montado y se quiera validar el deployment preview existente — **sin** `release_execute`.

---

## Confirmaciones de alcance

| Restricción                                                   | Cumplida |
| ------------------------------------------------------------- | -------- |
| No deploy                                                     | ✅       |
| No `release_execute`                                          | ✅       |
| No DNS / dominios                                             | ✅       |
| No modificar variables Vercel                                 | ✅       |
| Rama `migration-legacy-clf-to-monorepo` aceptada para staging | ✅       |

---

## Comando de reproducción

```bash
cd "/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite/services/dnx-mcp"

node --import tsx/esm -e "
import './src/config/bootstrap-env.ts';
import { handleReleaseValidate } from './src/tools/release/release-validate.ts';

const r = await handleReleaseValidate({
  platformId: 'compramelafoto',
  dryRun: true,
});

console.log(JSON.stringify({
  decision: r.decision,
  canExecute: r.canExecute,
  brainScore: r.brain?.score,
  blockers: r.issues,
  git: r.git,
  prisma: r.prisma,
  postgres: r.postgres ? {
    connected: r.postgres.connected,
    migrationTableExists: r.postgres.migrationTableExists,
    blockers: r.postgres.blockers,
  } : null,
  validation: r.validation,
}, null, 2));
"
```

---

## Referencias

- [`compramelafoto-staging-prisma-migrations-plan.md`](./compramelafoto-staging-prisma-migrations-plan.md)
- [`compramelafoto-postgres-connection-diagnostic.md`](./compramelafoto-postgres-connection-diagnostic.md)
- [`compramelafoto-release-prepare-monorepo.md`](./compramelafoto-release-prepare-monorepo.md)
- Platform catalog: `src/platforms/platforms/compramelafoto.ts`
- Validate staging dry-run: `src/tools/vercel/vercel-validate-staging.ts`
