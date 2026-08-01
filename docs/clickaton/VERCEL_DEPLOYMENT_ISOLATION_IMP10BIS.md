# Vercel Deployment Isolation — Imp10bis

**Fecha:** 2026-08-01 (UTC-3)
**Implementación:** ETAPA 03 / Imp10bis
**Estado general:** `DONE WITH WARNINGS`

```text
DEPLOYMENT FREEZE: ACTIVE (no push de dbcc191 / Imp10bis en esta sesión)
```

> **Imp10ter (2026-08-01):** prueba real Git — push `ae25ad7..8dceb51` → staging git READY (`dpl_9XRxJBhTf6GtxxXPjeMgtgJ7e5S`) + producción git **CANCELED** (`dpl_CDn2wDMyWr58m6vz2KWVAeaZDFF7`).
> `DEPLOYMENT ISOLATION VERIFIED`. Ver [`CONTROLLED_STAGING_PUSH_VALIDATION_IMP10TER.md`](./CONTROLLED_STAGING_PUSH_VALIDATION_IMP10TER.md).

---

## 1. Causa raíz

```text
ROOT CAUSE
```

En `clickaton-dnxsuite` el **Ignored Build Step** estaba mal acotado:

```bash
# ANTES (incorrecto)
if [ "$VERCEL_GIT_COMMIT_REF" = "clickaton-staging" ]; then exit 0; else exit 1; fi
```

Efecto:

- Skip solo si la branch era `clickaton-staging`
- **Continuaba el build** para `migration-legacy-clf-to-monorepo` (Preview y, vía promote/CLI, riesgo Production)
- Production Branch Vercel ya era `main`, pero el ignore **no** limitaba builds a `main`

Factores agravantes:

- Ambos proyectos integran el mismo GitHub repo `compramelafoto/dnx-suite`
- Root directory idéntico: `apps/clickaton`
- `.vercel` en **raíz del monorepo** linkea `clickaton-dnxsuite` (riesgo CLI)
- `apps/clickaton/.vercel` linkea `clickaton-staging` (correcto)

---

## 2. Topología previa → canónica

| Campo | Staging | Producción |
| ----- | ------- | ---------- |
| Proyecto | clickaton-staging | clickaton-dnxsuite |
| Project ID parcial | `prj_MM6Bkdi8***` | `prj_wo7NXldJ***` |
| Git | compramelafoto/dnx-suite | mismo |
| Root | apps/clickaton | apps/clickaton |
| Production Branch previa | clickaton-staging | main |
| Production Branch final | clickaton-staging *(sin cambio API)* | main |
| Staging WIP branch | migration-legacy-clf-to-monorepo | n/a |
| Dominio | clickaton-staging.vercel.app | maratonfotografica.com |
| Auto-deploy WIP (antes) | sí | **sí (bug)** |
| Auto-deploy WIP (después) | sí (preview/staging) | **no (ignore solo main)** |

```text
CLICKATON_PRODUCTION_BRANCH=main
CLICKATON_STAGING_BRANCH=migration-legacy-clf-to-monorepo
```

---

## 3. Configuración modificada

### Producción (`clickaton-dnxsuite`)

```bash
# DESPUÉS (canónico)
if [ "$VERCEL_GIT_COMMIT_REF" = "main" ]; then exit 1; else exit 0; fi
```

- Variables productivas: **no** modificadas
- Dominios: **no** modificados
- Git link: **no** desconectado

### Staging (`clickaton-staging`)

- Sin cambio de Production Branch (API no expuso endpoint usable en esta sesión)
- Ignored Build Step: sigue ausente (deseable)
- Variables Communications: intactas (`ENABLED=false`, `MODE=disabled`, expected DB)

```text
STAGING AUTO-DEPLOY: ENABLED FOR EXPECTED BRANCH (previews / proyecto staging)
PRODUCTION AUTO-DEPLOY: DISABLED FOR EXPECTED STAGING BRANCH (ignore build)
```

Ignored Build Step: `CONFIGURED` (producción)

---

## 4. Prueba de aislamiento

- Tipo: **configuración efectiva + semántica ignore** (sin push de prueba)
- `decideProductionIgnoreBuild(migration-legacy-…) = skip_build`
- `decideProductionIgnoreBuild(main) = continue_build`
- API GET confirma comando canónico en proyecto prod
- Durante Imp10bis: **ningún deploy nuevo** en `clickaton-dnxsuite` (último Production sigue siendo el previo a Imp10bis)

Push de `dbcc191`: **NO** (retenido)

---

## 5. Rollback decisión

```text
NO ROLLBACK REQUIRED
```

Motivo: en producción el webhook sigue disabled (`404 {"received":false}`), sin secret, sin migración, sin tráfico Resend; rollback añadiría otro deploy productivo innecesario.

---

## 6. Post-checks

| Check | Resultado |
| ----- | --------- |
| prod home | 200 |
| prod webhook | 404 JSON disabled |
| staging home | 200 |
| staging webhook | 404 JSON disabled |
| staging health DB | ok / ep-round-fog*** |
| COMMUNICATIONS_* en prod | ninguna |
| COMMUNICATIONS_* en staging | 5 vars (disabled) |

```text
PRODUCTION INTACT AFTER ISOLATION: PASS
STAGING READY FOR CONTROLLED CHANGES: PASS
```

---

## 7. Commit local `dbcc191`

| Campo | Valor |
| ----- | ----- |
| Hash | `dbcc191` |
| Contenido | readiness staging_explicit + docs Imp10 |
| Secretos | no |
| Push | **NO** |
| Conservar | sí — push solo tras Imp10bis isolation PASS (esta sesión) y ventana controlada |

Imp10bis añade commit local adicional de guards/docs (**sin push** en esta sesión).

---

## 8. Guards

- `pnpm --filter clickaton deployment:identity`
- `pnpm --filter clickaton deploy:staging:safe -- --confirm-staging-deploy`
- `pnpm --filter clickaton communications:imp10-resume-readiness`
- Tests: `test:deployment-identity`

---

## 9. Readiness reanudar Imp10

Esperado:

```text
READY WITH MANUAL PREREQUISITES
```

Pendiente: backup Neon, `COMMUNICATIONS_STAGING_DATABASE_URL`, health token.

---

## 10. Estado final

```text
STAGING DEPLOYMENT ISOLATED — PRODUCTION PROTECTED
```

Advertencia: Production Branch Vercel del proyecto staging sigue `clickaton-staging` (no `migration-legacy-…`); el aislamiento crítico prod↔WIP está cerrado vía Ignored Build Step. Alinear Production Branch staging vía dashboard queda como deuda opcional.

---

## Referencias

- Topología: [`DEPLOYMENT_TOPOLOGY.md`](./DEPLOYMENT_TOPOLOGY.md)
- Imp10 (BLOCKED histórico): [`RESEND_WEBHOOK_STAGING_GO_LIVE_IMP10.md`](./RESEND_WEBHOOK_STAGING_GO_LIVE_IMP10.md)
