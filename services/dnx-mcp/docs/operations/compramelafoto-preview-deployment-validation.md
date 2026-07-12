# ComprameLaFoto — Preview Deployment + `release_validate` real

**Fecha:** 2026-07-08  
**Proyecto Vercel:** `compramelafoto-dnxsuite` (monorepo — **no** legacy `compramelafoto`)  
**Target:** **preview** (`target: null` en API Vercel = preview)  
**Sin production deploy · sin DNS · sin cambios de dominios · sin `release_execute`**

---

## Resumen ejecutivo

| Paso                                  | Resultado                   |
| ------------------------------------- | --------------------------- |
| Prechecks (Git / Prisma / PostgreSQL) | **OK**                      |
| Preview deployment creado             | **OK — READY**              |
| `vercel_validate_staging` (real)      | **PASSED**                  |
| `release_validate` decision formal    | **NO-GO** (Brain score `0`) |
| `canExecute`                          | `false`                     |

**Interpretación:** el preview deployment existe y Vercel lo valida como saludable. La decisión formal del orquestador queda **NO-GO** por Brain score `0` pese a `validation.passed: true` — discrepancia a investigar en evaluación Brain con status/staging real (`dryRun: false`).

---

## Prechecks (antes del deploy)

| Check              | Resultado                                                            |
| ------------------ | -------------------------------------------------------------------- |
| Git limpio         | **OK** — `dirtyTree: false`, rama `migration-legacy-clf-to-monorepo` |
| Prisma             | **OK** — `schemaValid: true`, 0 migraciones pendientes               |
| PostgreSQL staging | **OK** — conectado, `_prisma_migrations` existe                      |
| Proyecto           | `compramelafoto-dnxsuite` (no legacy)                                |
| Target confirmado  | **preview** — no `production`                                        |

---

## Preview deployment

### Método

1. **Intento git deploy** desde rama `migration-legacy-clf-to-monorepo` → falló: rama no existe en GitHub remoto (`incorrect_git_source_info`).
2. **Método aplicado:** `POST /v13/deployments` con `deploymentId` del último deployment production como **artefacto fuente**, **sin** `target` (Vercel asigna preview por defecto). **No** se promovió a production ni se tocaron aliases productivos.

### Deployment creado

| Campo                  | Valor                                                                           |
| ---------------------- | ------------------------------------------------------------------------------- |
| **ID**                 | `dpl_BM3BwkoZ7NAc4dC7ShtFPmjtSVCG`                                              |
| **URL**                | `https://compramelafoto-dnxsuite-20oabir0b-compramelafotos-projects.vercel.app` |
| **target**             | `null` (= preview en Vercel)                                                    |
| **readyState**         | `READY`                                                                         |
| **health**             | `healthy`                                                                       |
| **build.state**        | `READY`                                                                         |
| **build.hasErrors**    | `false`                                                                         |
| **Tiempo hasta READY** | ~3 min                                                                          |

> El código desplegado hereda el artefacto del deployment production fuente (`dpl_GnsG3Frihrq44dDaGTMmFtyvJZFi`). Usa **variables de entorno preview** del proyecto.

---

## `release_validate` (`dryRun: false`)

**Input:**

```json
{
  "platformId": "compramelafoto",
  "dryRun": false,
  "deploymentId": "dpl_BM3BwkoZ7NAc4dC7ShtFPmjtSVCG"
}
```

### Vercel validate (real)

| Campo               | Valor                                                          |
| ------------------- | -------------------------------------------------------------- |
| `validation.passed` | **`true`**                                                     |
| summary             | Staging validado correctamente. Listo para planificar release. |
| health              | `healthy`                                                      |
| build               | `READY`, sin errores en logs                                   |
| issues              | `[]`                                                           |

### Decisión orquestador

| Campo                 | Valor     |
| --------------------- | --------- |
| **decision**          | **NO-GO** |
| **Brain score**       | `0`       |
| **brain.shouldBlock** | `true`    |
| **canExecute**        | `false`   |

### Blockers (providers)

`[]` — ninguno en Git, Prisma, PostgreSQL ni issues Vercel.

### Warnings

- Rama `migration-legacy-clf-to-monorepo` permitida para staging (catalog)
- Sin upstream en rama de staging (no bloqueante)

---

## Providers en validate

| Provider   | Estado                              |
| ---------- | ----------------------------------- |
| Git        | OK — `riskLevel: low`, sin blockers |
| Prisma     | OK — schema válido, sin pendientes  |
| PostgreSQL | OK — conectado, migraciones OK      |

---

## Fix operativo aplicado

Durante validate se corrigió el parser de logs Vercel (`parseVercelLogEvents`) para aceptar respuestas en formato array de `/v3/deployments/:id/events`. Sin este fix, `release_validate` fallaba con `ZodError` tras el deploy.

---

## Recomendaciones

1. **Push** rama `migration-legacy-clf-to-monorepo` a GitHub para habilitar preview deploys desde git con código monorepo actual.
2. **Investigar** Brain score `0` con `validation.passed: true` en validate real — posible penalización excesiva de señales `vercel_status` / `vercel_prepare_staging` cuando `dryRun: false`.
3. **Re-ejecutar** `release_validate` tras ajuste Brain; objetivo: `decision: GO` con preview `dpl_BM3BwkoZ7NAc4dC7ShtFPmjtSVCG` o deploy posterior desde git.
4. **No** ejecutar `release_execute` hasta `decision: GO` y `canExecute: true`.

---

## Confirmaciones de alcance

| Restricción                        | Cumplida                         |
| ---------------------------------- | -------------------------------- |
| No production deploy               | ✅ (nuevo deployment es preview) |
| No DNS / dominios                  | ✅                               |
| No `release_execute`               | ✅                               |
| No proyecto legacy                 | ✅                               |
| Proyecto `compramelafoto-dnxsuite` | ✅                               |

---

## Referencias

- [`compramelafoto-release-validate-vercel-real.md`](./compramelafoto-release-validate-vercel-real.md)
- [`compramelafoto-release-validate-staging.md`](./compramelafoto-release-validate-staging.md)
- Preview URL: `https://compramelafoto-dnxsuite-20oabir0b-compramelafotos-projects.vercel.app`
