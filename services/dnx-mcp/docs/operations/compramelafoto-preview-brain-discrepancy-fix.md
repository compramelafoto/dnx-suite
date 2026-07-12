# ComprameLaFoto — Fix integración Brain/Vercel (preview)

**Fecha:** 2026-07-08  
**Preview deployment (sin cambios):** `dpl_BM3BwkoZ7NAc4dC7ShtFPmjtSVCG`  
**Base:** [`compramelafoto-preview-brain-discrepancy.md`](./compramelafoto-preview-brain-discrepancy.md)

---

## Resumen

Se corrigieron los dos bugs de integración que causaban Brain score `0` y `NO-GO` pese a Vercel `PASSED` y providers sin blockers.

| Antes                             | Después (`release_validate` real) |
| --------------------------------- | --------------------------------- |
| Brain score `0`                   | Brain score **100**               |
| `shouldBlock: true`               | `shouldBlock: false`              |
| `decision: NO-GO`                 | `decision: GO`                    |
| `verdict: reject`                 | `verdict: approve`                |
| 1 inconsistencia crítica fantasma | `inconsistencies: []`             |

**Sin deploy · sin producción · sin DNS · sin `release_execute` · sin nuevo preview.**

---

## Cambios aplicados

### 1. Shape mismatch `vercel_status`

**Archivo nuevo:** `src/orchestrators/release/release-vercel-status.ts`

- `normalizeVercelStatusSnapshot(status, vercelProject)` mapea `projects[]` → `project` (por nombre o primer elemento).
- Usado en:
  - `resolveStatusAndStaging` (orquestador) — al fetch y al leer cache
  - `buildRisks` / `buildChecklist` — defensa ante status sin normalizar
  - `appendStatusSignals` — emite health cuando el proyecto existe

**Efecto:** elimina el riesgo fantasma _"Proyecto no encontrado en el panorama de status"_ y los checklist `failed` en cascada.

### 2. Separación issues staging vs validación

**`release-brain.ts` — señales:**

| Señal anterior             | Señal nueva                | Uso                                              |
| -------------------------- | -------------------------- | ------------------------------------------------ |
| `issues.count` (env diffs) | `staging.env.issues.count` | Informativo — diffs preview/prod                 |
| —                          | `validation.issues.count`  | Bloqueante — issues de `vercel_validate_staging` |

**`inconsistency-detector.ts`:**

- `go-with-issues` y `validated-with-issues` usan `validation.issues.count`, no env diffs de staging.

**`release-checklist.ts`:**

- `value_mismatch` en env audit **no** genera riesgo en `buildRisks`.
- `staging_ready` → `attention` (no `failed`) cuando solo hay diffs de env y preview existe.

### 3. Política staging en validate real

**`applyStagingDryRunBrainPolicy`** extendida (mismo export, comportamiento ampliado):

- `dryRun: true` — sin cambio (caution, no bloquea si score ≥ mínimo y providers OK).
- `dryRun: false` + `validationPassed: true` + providers OK + rama staging permitida → `shouldBlock: false`, `rejected: false`, verdict `approve`/`caution`.

El orquestador pasa `validationPassed` desde `validateRelease`.

---

## Tests añadidos / actualizados

| Archivo                                     | Cobertura                                                                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `release-brain.test.ts`                     | `projects[]` healthy sin project_missing; env diff sin `go-with-issues`; validate real no bloqueante; policy dryRun:false |
| `inconsistency-detector.test.ts`            | `validation.issues.count` bloquea; `staging.env.issues.count` no bloquea                                                  |
| `brain.test.ts` / `decision-engine.test.ts` | Actualizados a `validation.issues.count`                                                                                  |

---

## Verificación

```bash
pnpm check   # OK
pnpm build   # OK
```

### `release_validate` real (preview existente)

```json
{
  "input": {
    "platformId": "compramelafoto",
    "dryRun": false,
    "deploymentId": "dpl_BM3BwkoZ7NAc4dC7ShtFPmjtSVCG"
  },
  "decision": "GO",
  "canExecute": true,
  "brain": {
    "score": 100,
    "shouldBlock": false,
    "verdict": "approve"
  },
  "validation": {
    "passed": true,
    "issues": []
  }
}
```

---

## Limitaciones conocidas (sin cambio en este fix)

1. **El preview sigue siendo artefacto de producción** (`originalDeploymentId: dpl_GnsG3Frihrq44dDaGTMmFtyvJZFi`, SHA `39860e5`, ref `main`). El fix corrige la evaluación Brain; no valida código de `migration-legacy-clf-to-monorepo`.
2. **Para validar código monorepo actual:** push de la rama a GitHub + preview deploy desde git (cuando se autorice).
3. **`release_execute` sigue prohibido** hasta que el equipo confirme el plan de release completo.

---

## Archivos modificados

| Archivo                                                | Cambio                                                           |
| ------------------------------------------------------ | ---------------------------------------------------------------- |
| `src/orchestrators/release/release-vercel-status.ts`   | **nuevo** — normalización status                                 |
| `src/orchestrators/release/release-orchestrator.ts`    | normaliza en `resolveStatusAndStaging`; pasa `validationPassed`  |
| `src/orchestrators/release/release-checklist.ts`       | normaliza status; env diff no es riesgo; staging_ready attention |
| `src/orchestrators/release/release-brain.ts`           | señales separadas; policy validate real                          |
| `src/brain/risk-engine/inconsistency-detector.ts`      | usa `validation.issues.count`                                    |
| `src/orchestrators/release/release-brain.test.ts`      | tests integración                                                |
| `src/brain/risk-engine/inconsistency-detector.test.ts` | tests env diff                                                   |
| `src/brain/brain.test.ts`                              | signal key actualizado                                           |
| `src/brain/decision-engine/decision-engine.test.ts`    | signal key actualizado                                           |

---

## Confirmaciones de alcance

| Restricción          | Cumplida |
| -------------------- | -------- |
| No deploy            | ✅       |
| No producción        | ✅       |
| No DNS               | ✅       |
| No `release_execute` | ✅       |
| No nuevo preview     | ✅       |
| No commit            | ✅       |
