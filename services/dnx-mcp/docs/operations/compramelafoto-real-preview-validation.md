# ComprameLaFoto — Validación Preview real (monorepo)

**Fecha:** 2026-07-09  
**Proyecto Vercel:** `compramelafoto-dnxsuite`  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Commit objetivo:** `79b07129fee8172e1889b705f2fdfbbe125cd358`  
**Sin producción · sin DNS · sin `release_execute` · sin promoción · sin merge a `main`**

---

## Resumen ejecutivo

| Paso                                 | Resultado               |
| ------------------------------------ | ----------------------- |
| Preview deployment desde GitHub      | **READY**               |
| Commit SHA coincide                  | **Sí** (`79b07129…`)    |
| Build                                | **READY** — sin errores |
| Health                               | **healthy**             |
| `release_validate` (`dryRun: false`) | **GO**                  |
| Brain score                          | **100**                 |
| Blockers                             | **ninguno**             |

**Interpretación:** el primer preview **real** del código monorepo en la rama de migración está desplegado, saludable y formalmente validado por el orquestador DNX-MCP.

---

## 1. Deployment preview

### Estado final

| Campo                | Valor                                                                           |
| -------------------- | ------------------------------------------------------------------------------- |
| **Deployment ID**    | `dpl_H7PcURopCLk4GrviSFsHnKMZcjJK`                                              |
| **URL**              | `https://compramelafoto-dnxsuite-b5dmuuqr3-compramelafotos-projects.vercel.app` |
| **target**           | `null` (= preview)                                                              |
| **readyState**       | **READY**                                                                       |
| **health**           | **healthy**                                                                     |
| **build.state**      | **READY**                                                                       |
| **build.hasErrors**  | `false`                                                                         |
| **build.durationMs** | ~221 s (~3.7 min)                                                               |

### Procedencia (Git)

| Campo                    | Valor                                                         |
| ------------------------ | ------------------------------------------------------------- |
| **githubCommitSha**      | `79b07129fee8172e1889b705f2fdfbbe125cd358`                    |
| **githubCommitRef**      | `migration-legacy-clf-to-monorepo`                            |
| **githubCommitMessage**  | `fix(clf): resolve final monorepo build blockers`             |
| **originalDeploymentId** | — (deploy desde git, **no** redeploy de artefacto production) |
| **SHA match**            | **Confirmado**                                                |

### Comparación con preview anterior (artefacto)

| Deployment                                      | SHA        | Ref                                | Origen                        |
| ----------------------------------------------- | ---------- | ---------------------------------- | ----------------------------- |
| `dpl_BM3BwkoZ7NAc4dC7ShtFPmjtSVCG` (anterior)   | `39860e5…` | `main`                             | Redeploy desde production     |
| `dpl_H7PcURopCLk4GrviSFsHnKMZcjJK` (**actual**) | `79b0712…` | `migration-legacy-clf-to-monorepo` | **Git push → build monorepo** |

---

## 2. `release_validate` (`dryRun: false`)

**Input:**

```json
{
  "platformId": "compramelafoto",
  "dryRun": false
}
```

> El orquestador requiere `prepareRelease` previo (máquina de estados). `vercel_prepare_staging` resolvió automáticamente el preview `dpl_H7PcURopCLk4GrviSFsHnKMZcjJK` (último preview del proyecto).

### Decisión formal

| Campo                    | Valor                                         |
| ------------------------ | --------------------------------------------- |
| **decision**             | **GO**                                        |
| **canExecute**           | `true`                                        |
| **Brain score**          | **100**                                       |
| **brain.verdict**        | `approve`                                     |
| **brain.shouldBlock**    | `false`                                       |
| **brain.recommendation** | Operación aprobada (score 100, confianza 95%) |

### Vercel validate

| Campo               | Valor                                                          |
| ------------------- | -------------------------------------------------------------- |
| `validation.passed` | `true`                                                         |
| `validation.issues` | `[]`                                                           |
| summary             | Staging validado correctamente. Listo para planificar release. |

### Blockers

| Provider      | Blockers |
| ------------- | -------- |
| Git           | `[]`     |
| Prisma        | `[]`     |
| PostgreSQL    | `[]`     |
| Brain         | `[]`     |
| Vercel issues | `[]`     |

### Warnings

| Provider   | Warnings |
| ---------- | -------- |
| Git        | `[]`     |
| Prisma     | `[]`     |
| PostgreSQL | `[]`     |

> Nota: `stagingReady: false` por 10 diffs de env preview vs production (esperado). La política Brain corregida no bloquea por estos warnings cuando `validation.passed === true`.

---

## 3. Staging audit (informativo)

| Campo                                   | Valor                                                       |
| --------------------------------------- | ----------------------------------------------------------- |
| Preview detectado por `prepare_staging` | `dpl_H7PcURopCLk4GrviSFsHnKMZcjJK`                          |
| Production baseline                     | `dpl_GnsG3Frihrq44dDaGTMmFtyvJZFi`                          |
| Env diffs preview/prod                  | 10 (`value_mismatch` — URLs, DB, OAuth, etc.)               |
| `stagingReady` formal                   | `false` (solo por env diffs; preview existe y está healthy) |

---

## 4. Otros deployments en la misma rama (monorepo)

El push del monorepo también disparó builds de otros proyectos Vercel en la misma rama:

| Proyecto                  | Deployment                         | Estado    |
| ------------------------- | ---------------------------------- | --------- |
| `compramelafoto-dnxsuite` | `dpl_H7PcURopCLk4GrviSFsHnKMZcjJK` | **READY** |
| `fotorank-dnxsuite`       | `dpl_4dNhLaChzref8B2SDouDQ46qwznJ` | ERROR     |

Solo se validó **ComprameLaFoto** (`compramelafoto-dnxsuite`).

---

## 5. Próximos pasos (sin ejecutar)

1. **Smoke test manual** del preview URL — auth, DB staging, rutas críticas CLF.
2. **QA funcional** en preview antes de planificar cutover a production.
3. **No ejecutar `release_execute`** hasta checklist de negocio completo y ventana de release acordada.
4. **No mergear a `main`** ni promover este deployment a production sin plan explícito.
5. Opcional: corregir build **ERROR** de `fotorank-dnxsuite` en la misma rama (no bloquea CLF preview).

---

## Confirmaciones de alcance

| Restricción            | Cumplida |
| ---------------------- | -------- |
| No production deploy   | ✅       |
| No DNS / dominios      | ✅       |
| No `release_execute`   | ✅       |
| No promover deployment | ✅       |
| No merge a `main`      | ✅       |

---

## Referencias

- [`compramelafoto-preview-brain-discrepancy-fix.md`](./compramelafoto-preview-brain-discrepancy-fix.md)
- [`compramelafoto-preview-deployment-validation.md`](./compramelafoto-preview-deployment-validation.md)
- Preview URL: `https://compramelafoto-dnxsuite-b5dmuuqr3-compramelafotos-projects.vercel.app`
