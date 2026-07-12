# ComprameLaFoto — `release_validate` real (Vercel API)

**Fecha:** 2026-07-08  
**Input:**

```json
{
  "platformId": "compramelafoto",
  "dryRun": false
}
```

**Proyecto Vercel:** `compramelafoto-dnxsuite`  
**Duración:** ~53 s (`release_prepare` real) + ~15 s (`release_validate` real)  
**Sin `release_execute` · sin deploy · sin DNS · sin cambios de variables**

---

## Resumen ejecutivo

| Campo                 | Valor     |
| --------------------- | --------- |
| **decision**          | **NO-GO** |
| **validation.passed** | `false`   |
| **Brain score**       | `0`       |
| **Brain shouldBlock** | `true`    |
| **canExecute**        | `false`   |
| **phase**             | `failed`  |

**Causa raíz:** no existe **deployment de preview** en Vercel para validar. Los últimos 20 deployments del proyecto son `target: production`. El assess de Git, Prisma y PostgreSQL está **OK**.

---

## Prerequisito operativo

`release_validate` con `dryRun: false` exige fase `prepared | validated`. Se ejecutó **`release_prepare` real** en la misma sesión del orquestador antes del validate (solo lectura API Vercel — no deploy).

---

## Decisión GO / NO-GO

### NO-GO

| Bloqueante                                            | Fuente                    |
| ----------------------------------------------------- | ------------------------- |
| **No se encontró deployment de preview para validar** | `vercel_validate_staging` |

### Providers (sin bloqueos)

| Provider   | Estado                                                         |
| ---------- | -------------------------------------------------------------- |
| Git        | OK — rama `migration-legacy-clf-to-monorepo`, `riskLevel: low` |
| Prisma     | OK — `schemaValid: true`, 0 migraciones pendientes             |
| PostgreSQL | OK — conectado, `_prisma_migrations` existe                    |

---

## Brain

| Campo         | Valor                                        |
| ------------- | -------------------------------------------- |
| Score         | `0`                                          |
| Verdict       | `reject`                                     |
| shouldBlock   | `true`                                       |
| Recomendación | Score insuficiente — validación Vercel falló |

> Con `dryRun: false`, la política de staging relajada del Brain **no aplica**. El score refleja el fallo de validación Vercel.

---

## Blockers

1. `No se encontró deployment de preview para validar.`

---

## Warnings

- Rama `migration-legacy-clf-to-monorepo` permitida para staging (catalog)
- Sin upstream en rama de staging (no bloqueante)
- (mismo issue de preview ausente listado como warning en validation)

---

## Vercel — proyecto monorepo

| Campo        | Valor                                            |
| ------------ | ------------------------------------------------ |
| Proyecto     | `compramelafoto-dnxsuite`                        |
| Project ID   | `prj_onlsJ1X9XOYyBFK0Qn5ojth4D1He`               |
| Framework    | `nextjs`                                         |
| API invocada | **Sí** — token + team `compramelafotos-projects` |

---

## Deployment actual

### Preview (objetivo de validate)

| Campo                   | Valor                                           |
| ----------------------- | ----------------------------------------------- |
| **Preview deployments** | **0** en los últimos 20 listados                |
| Resultado validate      | No se pudo auditar build/logs/health de preview |

### Production (último deployment — referencia)

| Campo              | Valor                                                                   |
| ------------------ | ----------------------------------------------------------------------- |
| ID                 | `dpl_GnsG3Frihrq44dDaGTMmFtyvJZFi`                                      |
| URL                | `compramelafoto-dnxsuite-o3nc8f524-compramelafotos-projects.vercel.app` |
| state / readyState | `READY`                                                                 |
| target             | `production`                                                            |

> **Nota:** existen deployments de producción saludables, pero `release_validate` audita **preview/staging**, no production.

### Estadística deployments (API v6, limit=20)

| Tipo                              | Cantidad |
| --------------------------------- | -------- |
| `production`                      | 20       |
| `preview` / sin target production | **0**    |

---

## Build status

No evaluado — sin deployment preview. El último deployment production listado está `READY`.

---

## Aliases / dominios del proyecto

| Dominio                               | Verificado |
| ------------------------------------- | ---------- |
| `compramelafoto.staging.dnxsuite.com` | sí         |
| `compramelafoto.dnxsuite.com`         | sí         |
| `compramelafoto-dnxsuite.vercel.app`  | sí         |

> Dominio catalog `preview.compramelafoto.com` no aparece en esta lista de dominios del proyecto — verificar DNS/aliases fuera de este validate.

---

## Env vars audit (sin valores)

| Entorno                   | Cantidad | Keys                                                                                                                                                                          |
| ------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preview**               | 10       | `APP_URL`, `AUTH_SECRET`, `AUTH_URL`, `COOKIE_DOMAIN`, `DATABASE_URL`, `DIRECT_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `NEXT_PUBLIC_APP_URL` |
| **Production**            | 10       | mismas keys                                                                                                                                                                   |
| **Missing in production** | 0        | preview y production alineados en keys                                                                                                                                        |

**No se modificaron variables.** Valores no incluidos en este informe.

---

## Logs

No disponibles en esta ejecución — `vercel_validate_staging` terminó antes de obtener deployment preview (sin ID para build/runtime logs).

---

## Git / Prisma / PostgreSQL (assess en validate real)

### Git

| Campo     | Valor                              |
| --------- | ---------------------------------- |
| branch    | `migration-legacy-clf-to-monorepo` |
| dirtyTree | `false`                            |
| riskLevel | `low`                              |
| blockers  | `[]`                               |

### Prisma

| Campo             | Valor                     |
| ----------------- | ------------------------- |
| schemaValid       | `true`                    |
| migrationCount    | 6                         |
| pendingMigrations | `[]`                      |
| latestMigration   | `add_evaluaciones_engine` |
| riskLevel         | `low`                     |

### PostgreSQL

| Campo                | Valor    |
| -------------------- | -------- |
| connected            | `true`   |
| migrationTableExists | `true`   |
| databaseSize         | ~17,8 MB |
| riskLevel            | `low`    |

---

## canExecute

| Campo          | Valor       |
| -------------- | ----------- |
| **canExecute** | **`false`** |

Requiere `decision: GO` y `brain.shouldBlock: false`.

---

## Recomendación concreta

1. **Generar un deployment preview** en `compramelafoto-dnxsuite` (push a rama con PR / deploy hook preview) — sin usar `release_execute`.
2. **Re-ejecutar** `release_prepare` + `release_validate` con `dryRun: false`.
3. Opcional: validar deployment específico con `deploymentId` si ya existe uno preview fuera del listado reciente.
4. **No avanzar a `release_execute`** hasta `decision: GO`.
5. Investigar parser de deployments Vercel (`uid` vs `id`, `aliasAssigned` timestamp) — puede afectar detección de preview aunque hoy el bloqueo principal es **ausencia real de previews**.

---

## Confirmaciones de alcance

| Restricción                   | Cumplida |
| ----------------------------- | -------- |
| No `release_execute`          | ✅       |
| No deploy desde MCP           | ✅       |
| No DNS / dominios             | ✅       |
| No modificar variables Vercel | ✅       |
| API Vercel real consultada    | ✅       |

---

## Comando de reproducción

```bash
cd "/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite/services/dnx-mcp"

node --import tsx/esm -e "
import './src/config/bootstrap-env.ts';
import { resetReleaseToolContext, getReleaseOrchestrator } from './src/tools/release/context.ts';
import { handleReleasePrepare } from './src/tools/release/release-prepare.ts';
import { handleReleaseValidate } from './src/tools/release/release-validate.ts';

resetReleaseToolContext();
const orchestrator = getReleaseOrchestrator();

await handleReleasePrepare({ platformId: 'compramelafoto', dryRun: false }, orchestrator);
const r = await handleReleaseValidate({ platformId: 'compramelafoto', dryRun: false }, orchestrator);

console.log(JSON.stringify({
  decision: r.decision,
  canExecute: r.canExecute,
  brainScore: r.brain?.score,
  blockers: r.issues,
  validationPassed: r.validation?.passed,
}, null, 2));
"
```

---

## Referencias

- [`compramelafoto-release-validate-staging.md`](./compramelafoto-release-validate-staging.md) — dry-run previo
- Platform catalog: `src/platforms/platforms/compramelafoto.ts`
- Validate staging: `src/tools/vercel/vercel-validate-staging.ts`
