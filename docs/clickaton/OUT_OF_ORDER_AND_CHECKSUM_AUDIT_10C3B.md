# Clickatón 10C3B — Out-of-order migrations & checksum audit

**Date:** 2026-07-18  
**Status:** **PLAN APROBABLE — RECONCILIACIÓN AMPLIADA SIMULADA**  
**Neon writes in this stage:** **NONE** (read-only + local Postgres sims)  
**Depends on:** 10C3 plan · 10C4 abort · backup `br-spring-lake-adpsmkjo`

## 1. Context

10C4 aborted because Neon `ep-dawn-dew` (branch `development` / `br-old-rain-adwthzng`) showed:

1. `20260718140000_fotoffice_photographer_onboarding` applied while five earlier migrations looked pending.
2. Apparent checksum mismatches on `organizer_direct_mp_commission_ledger` and `infospot_photographer_call`.

10C3B investigates causes, material schema, Prisma 6.19.2 behaviour, and the exact authorization needed for a safe retry (**10C4B**).

## 2. Evidence from 10C4

| Item | Value |
|------|--------|
| Backup branch | `backup-10c4-20260718-134541` (`br-spring-lake-adpsmkjo`) |
| Parent | `br-old-rain-adwthzng` (development / dawn-dew) |
| Strategy C writes | **Not executed** (no orphan SQL restore, no checksum UPDATE, no `migrate deploy`, no commit) |
| `/tmp/10c4-exports/` | Purged by OS; reconstructed notes + fresh RO exports under `.local/audit-10c3b/` (gitignored) |

## 3. Chronology (name order vs `finished_at`)

Relevant successful applies (Neon, after Cuánto Cobro incident):

| migration_name | finished_at (UTC) | Notes |
|----------------|-------------------|--------|
| `…15050000_clf_event_interest_and_folder_gap` | 2026-07-15T05:20:45Z | Last common before FO jump |
| `…18140000_fotoffice_photographer_onboarding` | **2026-07-18T08:29:13Z** | Out-of-order; `applied_steps_count=0` |
| `…15060000_clf_referral_program_gap` | **2026-07-18T18:25:42Z** | Accidental deploy |
| `…15160000_fotorank_experience_type` | 2026-07-18T18:25:43Z | Accidental deploy |
| `…15170000_dnx_payments_core_persistence` | 2026-07-18T18:25:45Z | Accidental deploy |
| `…15180000_fotorank_public_registration_summary` | 2026-07-18T18:25:46Z | Accidental deploy |
| `…18120000_clickaton_editions_and_venues` | 2026-07-18T18:25:48Z | Accidental deploy |

Orphan (still present, file absent locally):

| migration_name | checksum (OLD) | finished_at |
|----------------|----------------|-------------|
| `20260711160000_infospot_role_audit` | `6f8e61ef…693be83f` | 2026-07-11T06:59:01Z |

## 4. FotoOffice out of order — cause

**Actor:** Cursor agent [FotOffice ETAPA 04](0a2d8f2d-6a2e-4b7e-a16a-525c9f203f4b) (~05:26–05:29 ART = `08:29Z`).

**Method (intentional):**

1. Saw ~6 pending migrations (incl. Clickaton).
2. **Did not** run `migrate deploy` (to avoid applying foreign migrations).
3. Applied only FO SQL via `psycopg2` against `apps/fotoffice/.env.local` → host `ep-dawn-dew`.
4. Marked history with `prisma migrate resolve --applied 20260718140000_fotoffice_photographer_onboarding`.

**Evidence in Neon:** objects exist; checksum matches local `ab544519…`; `applied_steps_count = 0` (typical of `resolve --applied`).

**Classification:** deliberate out-of-order apply on shared staging — not a Prisma filesystem ordering bug.

## 5. Five former “pending” gaps — current state

As of 10C3B re-audit, **all five are APPLIED** on dawn-dew (`finished_at` ~18:25Z).

**Cause:** Cursor agent [Cuánto Cobro / sales 20D](a5993dde-0341-4293-9881-7610d8e90e90) ran `prisma migrate deploy` while `packages/db/.env` still pointed at Neon. It reported applying exactly these five (not Cuánto Cobro, not FO).

| Migración | Objetos | Neon material | Aplicable vía deploy hoy |
|-----------|---------|---------------|---------------------------|
| `…15060000_clf_referral_program_gap` | enum + columns + indexes (idempotent SQL) | Present | Would re-run safely if pending; **already applied** |
| `…15160000_fotorank_experience_type` | enum + column + index (**not** IF NOT EXISTS) | Present | **Would FAIL** if re-applied (`type already exists`) |
| `…15170000_dnx_payments_core_persistence` | many CREATE TYPE/TABLE | Present | **Would FAIL** if re-applied |
| `…15180000_fotorank_public_registration_summary` | enum + columns | Present | **Would FAIL** if re-applied |
| `…18120000_clickaton_editions_and_venues` | enum + tables + FK | Present (0 rows) | **Would FAIL** if re-applied |

**Verdict on “apply five after FO”:**

- On empty schema (sim S2): **safe** — Prisma applies name-order gaps after FO resolve.
- On Neon-like schema with objects already present but history missing (sim S3): **`migrate deploy` is unsafe** — fails mid-chain and leaves a failed row.
- On **current** Neon: history rows already exist → **no gap deploy needed**.

## 6–8. Checksum mismatches (organizer + photographer_call)

Both names have **two rows** in `_prisma_migrations`:

1. Failed attempt (`finished_at` NULL, `rolled_back_at` set, old checksum).
2. Successful apply (`finished_at` set, checksum **matches local file**).

| Migración | Tipo | Evidencia | Riesgo | Acción |
|-----------|------|-----------|--------|--------|
| `20260708150000_organizer_direct_mp_commission_ledger` | **False positive / Tipo 2 historical repair** | Failed v1 `79fe0945…` rolled back; success `f609ab9c…` = local repaired SQL (`ca1c87ea`); docs `infospot-migration-chain-repair.md` | Low if audit ignores rolled_back | **Leave intact** — do not UPDATE |
| `20260712210000_infospot_photographer_call` | **False positive / failed-then-retry** | Failed `a3945191…` (log: `EventStatus` missing) rolled back; success `ba25eb03…` = local file | Low | **Leave intact** — do not UPDATE |

The 10C3/10C4 audit script used `rows.find(name)` and picked the **rolled_back** row first → false mismatches. Fixed in `audit-migration-state.mts` (compare `finished_at IS NOT NULL` only).

## 9. Simulations (Postgres 16 local, port 55433)

| Escenario | Resultado | Evidencia |
|-----------|----------|-----------|
| S1 Full clean chain + reconstructed orphan | PASS — 60 migrations, Clickaton+FO present | `.local/audit-10c3b/sim_s1_*` |
| S2 FO resolve first, then five gaps | PASS — deploy applies five; status up to date | `sim_s2_*` |
| S3 Objects exist, five history rows deleted, orphan missing | `migrate deploy` **FAILS** on `FotorankExperienceType already exists` (P3018); leaves failed migration | `sim_s3_deploy_no_orphan.txt` |
| S3b Same + `migrate resolve --applied` ×5 + orphan checksum align | PASS — status up to date; deploy no-op | `sim_s3b_*` |

## 10. Prisma 6.19.2 behaviour (observed)

| Situation | `migrate status` | `migrate deploy` |
|-----------|------------------|------------------|
| Later migration applied; earlier local pending | Lists earlier as pending | **Applies** earlier migrations (S2) |
| Objects already exist; history missing | Lists as pending | **Fails** on non-idempotent SQL; can leave failed row (S3) |
| Orphan in DB, file missing, **and** local pendings | Dirty (“not found locally”) | May still apply other pending (10C3) |
| Orphan in DB, file missing, **no** local pendings | Can report **“up to date”** (observed 10C3B) | No-op deploy; history still unreproducible on empty DB |
| Checksum mismatch on **finished** row | Not hard-blocked in practice | Deploy proceeds (10C3) |
| Rolled_back + finished duplicate names | Tooling may confuse naive audits | Prisma uses successful history |
| `resolve --applied` | Marks applied (`applied_steps_count` often 0) | Skips SQL |

**Hidden risk:** status/deploy can look “dirty” while material schema is already ahead; blind deploy is dangerous.

## 11. Material schema vs Prisma

- Clickaton editions/venues: **present** (empty tables).
- FO onboarding columns/table: **present**.
- Gap objects (referral / experience / payments / registration): **present**.
- `InfoSpotUserRole.lastChangedAt`: **present** on Neon; still **absent** from `schema.prisma` (optional follow-up PR, not required for 10C4B).

## 12. Blocking matrix

| Tema | Estado | ¿Bloquea deploy limpio? | ¿Bloquea reconciliación limpia? | Acción |
|------|--------|-------------------------|----------------------------------|--------|
| Orphan `infospot_role_audit` | Applied in DB; file absent | Yes (dirty status) | Yes | Strategy C: restore file + UPDATE **only** that checksum |
| FotoOffice out of order | Applied; material OK | No | No (historical debt) | Document only |
| Mismatch organizer | False positive | No | No | Leave; fixed audit |
| Mismatch photographer_call | False positive | No | No | Leave; fixed audit |
| Five gaps | **Already applied** 18:25Z | No | No | Do not re-deploy / do not resolve again |
| WIP `20260718180000_cuanto_cobro_financial_profile` | Local only (untracked) | **Yes if present during deploy** | Yes | **Move aside** before any Neon deploy |
| `lastChangedAt` in schema.prisma | Lag | No | No | Optional later PR |

## 13. Recommended strategy

**Option B′ (orphan-only on current Neon)** — preferred:

1. Keep backup `br-spring-lake-adpsmkjo` (or create a fresh one).
2. Move WIP Cuánto Cobro migration **out** of `prisma/migrations/` before any Prisma CLI against Neon.
3. Commit reconstructed orphan SQL under `20260711160000_infospot_role_audit/`.
4. `UPDATE` **only** that migration’s checksum → `59bc655d2789c5c5ee0cc3988caf2a61bb0d91cb0a2361c06eab4ef1c714ddb9`.
5. `prisma migrate status` → expect **no pending** (and orphan no longer “missing”).
6. `prisma migrate deploy` → expect **no pending migrations to apply**.
7. Re-run `audit:migration-state`, `audit:gap-objects`, `audit:schema-baseline`, Clickaton selfchecks.

**Do not** UPDATE organizer/photographer checksums.  
**Do not** `resolve --applied` the five gaps again (already finished).  
**Do not** apply Cuánto Cobro on shared Neon in 10C4B.

## 14. Contingency

- **Option C:** execute orphan repair on a new Neon branch cloned from development, validate, then promote.
- If a failed migration row appears: stop; `migrate resolve` only after dual review.
- Empty-DB reproducibility requires the reconstructed orphan file in git (already proven S1).

## 15. Exact future authorization (do not execute here)

```text
AUTORIZO CLICKATÓN 10C4B SOBRE NEON ep-dawn-dew (br-old-rain-adwthzng):
usar backup existente backup-10c4-20260718-134541 (br-spring-lake-adpsmkjo) o crear uno nuevo;
apartar WIP 20260718180000_cuanto_cobro_financial_profile del árbol de migraciones;
restaurar SOLO 20260711160000_infospot_role_audit desde el fixture reconstruido;
UPDATE ÚNICAMENTE 1 fila de _prisma_migrations (checksum de esa migración → 59bc655d…);
NO modificar checksums de organizer_direct_mp_commission_ledger ni infospot_photographer_call;
NO resolve/re-deploy de las cinco migraciones ya aplicadas el 2026-07-18T18:25Z;
ejecutar migrate status y migrate deploy esperando 0 pendientes;
abortar ante failed migration, pending inesperado (incl. Cuánto Cobro), DROP, u objetos Clickaton ausentes.
```

## 16. Backup & rollback

- Primary rollback: restore/promote Neon branch `br-spring-lake-adpsmkjo`.
- Secondary: reverse orphan checksum to `6f8e61ef…` if UPDATE done and deploy not yet run.
- Do not delete the backup until 10C4B verified.

## 17. Scripts

| Script | Role |
|--------|------|
| `packages/db/scripts/audit-migration-state.mts` | RO audit; finished-row checksums; rolled_back false-positive report |
| `packages/db/scripts/verify-gap-objects.mts` | RO material checklist |
| `packages/db/scripts/verify-schema-baseline.mts` | Existing baseline checks |
| `pnpm --filter @repo/db audit:gap-objects` | npm alias |

## 18. Residual risks

- Shared staging remains multi-app; agents must not point WIP migrates at `packages/db/.env`.
- FO `applied_steps_count=0` is cosmetic debt.
- `schema.prisma` lag on `lastChangedAt`.
- WIP Cuánto Cobro must never ride along a Clickaton DB authorize.

## 19. Verdict

**PLAN APROBABLE — RECONCILIACIÓN AMPLIADA SIMULADA**

Next authorized stage (only after user paste of §15): **10C4B**.  
Do not start 10D from this document alone.
