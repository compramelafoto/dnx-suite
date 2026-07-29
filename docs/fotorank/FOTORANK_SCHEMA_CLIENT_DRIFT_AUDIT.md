# FotoRank — auditoría schema / client drift

**Fecha:** 2026-07-29  
**Etapa:** 10B.6.3  

## Causa raíz

Migraciones P0 (jury scoring, ranking/results, rules-config, rules lifecycle) estaban **aplicadas** en `ep-round-fog…` y referenciadas por código en `apps/fotorank`, pero **faltaban** modelos/enums/campos en `packages/db/prisma/schema.prisma`.

El cliente `@repo/db` se genera solo desde ese schema → Preview build fallaba (TS2339 / modelos inexistentes).

No hay Prisma paralelo en FotoRank: runtime usa `prisma` de `@repo/db`.

---

## Migraciones involucradas

| Migración | Dominio |
| --------- | ------- |
| `20260728140000_clickaton_jury_scoring` | Rúbricas, scoring session, evaluations |
| `20260728150000_clickaton_ranking_results` | Result batches / tie-break |
| `20260728200000_fotorank_p0_09a_contest_rules_configuration_engine` | ConfigurationVersion + RulesTemplate |
| `20260728210000_fotorank_p0_09b_rules_generation_review_publish` | Audit events, minor auth, lifecycle statuses |

---

## Corrección aplicada (sin `db push`)

1. Introspección staging (`prisma db pull` temporal) para alinear con DB real.  
2. Restauración quirúrgica en `schema.prisma`:
   - 16 modelos Fotorank faltantes;
   - 16 enums Fotorank faltantes;
   - campos en `FotorankContestRulesVersion`, `FotorankContestRegistration`, `FotorankJudgeAssignment`;
   - valores `FotorankRulesVersionStatus`: `GENERATED`, `UNDER_REVIEW`, `CHANGES_REQUESTED`, `APPROVED`;
   - `@default(cuid())` / `@updatedAt` en modelos restaurados (defaults de cliente).  
3. `prisma validate` + `prisma generate`.  
4. Ajustes app mínimos tipados:
   - `RegistrationErrorCode`: `LICENSE_NOT_ACCEPTED`, `AGE_INVALID`, `MINOR_AUTH_REQUIRED`;
   - `PublishedRulesVersion` incluye `configurationVersionId`.

**No** se usó `any`, ni se deshabilitó typecheck, ni se comentó funcionalidad jury/rules.

---

## Typecheck

Antes: ~71 errores (rules-lifecycle / rules-config / registration).  
Después: **0** errores (`pnpm --filter fotorank exec tsc --noEmit`).

---

## Política

- Fuente única: `packages/db` + `@repo/db`.  
- Migraciones existentes = verdad de tablas en Staging.  
- Nuevos cambios de schema → migración versionada + `prisma migrate deploy` (nunca `db push`).
