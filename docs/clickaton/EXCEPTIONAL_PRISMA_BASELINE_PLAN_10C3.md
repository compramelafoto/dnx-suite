# Exceptional Prisma reconciliation plan — Clickaton 10C3

**Date:** 2026-07-18  
**Status:** **PLAN APROBABLE** (validated on isolated Postgres; Neon shared untouched)  
**Depends on:** 10C (`0a2c26b`) · 10C1 (`f94ada2`) · 10C2 (`71fbe46`)

## 1. Context

Neon shared (`neondb`) has an applied migration **without** a recoverable local file:

| Field | Value |
|-------|--------|
| Name | `20260711160000_infospot_role_audit` |
| Checksum (OLD) | `6f8e61ef3427db1cb927bbdc751f8ea500963aa2de35831799446c1d693be83f` |
| `finished_at` | `2026-07-11T06:59:01.624Z` |
| Local directory | **ABSENT** |
| Exact SQL bytes | **Not recovered** (10C2 forensic NO-GO) |

Related migration that **is** present (applied later by wall-clock):

- `20260711070000_infospot_user_role_audit` — adds `assignedByUserId` / `lastChangedByUserId`.

Pending local migrations (not applied on Neon as of 10C3 audit):

1. `20260715060000_clf_referral_program_gap`
2. `20260715160000_fotorank_experience_type`
3. `20260715170000_dnx_payments_core_persistence`
4. `20260715180000_fotorank_public_registration_summary`
5. `20260718120000_clickaton_editions_and_venues`
6. `20260718140000_fotoffice_photographer_onboarding`

Volume `HD DNX 10` (historical apply cwd) was **not mounted** during 10C3.

## 2. Evidence — material effect of the orphan

| Object | Neon | Prisma schema | App code | Difference |
|--------|------|---------------|----------|------------|
| `InfoSpotUserRole.lastChangedAt` | Present: `timestamp`, nullable, default null | Absent | No reads/writes | Schema lag; column unused (6/6 rows NULL) |
| Table `*RoleAudit*` | None | None | None | Name `role_audit` ≠ extra table |
| Indexes/triggers on `lastChangedAt` | None | — | — | Plain column |
| Orphan row in `_prisma_migrations` | Present | File absent | — | Dirty history |

**Conclusion:** Material effect is adding nullable `lastChangedAt` on `InfoSpotUserRole`. No audit table. Safe to keep (idempotent `IF NOT EXISTS`) or later drop only with product decision. Prefer **keep** + optional schema alignment in a follow-up PR.

## 3. Strategies evaluated

### A — Exact forensic restore (preferred if bytes appear)

Remount backups / `HD DNX 10`, restore file with **exact** OLD checksum, commit, then `migrate deploy`. No `_prisma_migrations` mutation.

### B — Deploy with dirty status (emergency only)

Prisma 6.19 sim: `migrate deploy` can apply pending even when DB reports a migration “not found locally”. Leaves unclean history. Reject for shared Neon without explicit override.

### C — Semantic reconstruction + intentional checksum repair (**recommended if A fails**)

1. Commit reconstructed SQL under the **same** migration name (not claiming byte identity).
2. `UPDATE _prisma_migrations SET checksum = '<NEW>' WHERE migration_name = '…'` on target DB after review.
3. `migrate status` clean → `migrate deploy` pending chain.
4. Empty DBs get the reconstructed file as part of normal history.

Fixture (example only, **not** under `prisma/migrations/` until 10C4):  
`packages/db/scripts/fixtures/infospot_role_audit_reconstructed.example.sql`  
NEW checksum (sha256 of fixture): `59bc655d2789c5c5ee0cc3988caf2a61bb0d91cb0a2361c06eab4ef1c714ddb9`

### D — Full baseline / squash

Replace history with a single baseline of current Neon. High cost, poor traceability, risky on shared multi-app DB. Contingency last resort.

### E — Temporary split (Neon branch / separate DB for Clickaton)

Advance Clickaton on an isolated DB while shared Neon stays dirty. Speeds product, creates reintegration debt. Contingency if C cannot be authorized soon.

## 4. Decision matrix

| Strategy | Data risk | Prisma risk | Reversibility | Complexity | Unblocks Clickaton | Recommendation |
|----------|----------:|------------:|--------------:|-----------:|-------------------:|----------------|
| A Exact restore | Low | Lowest | High | Low | Yes | Prefer if file found |
| B Dirty deploy | Medium | Medium (tooling drift) | Medium | Low | Yes (unclean) | Emergency only |
| C Reconstruct + checksum UPDATE | Low–Med | Controlled | High (Neon branch + export) | Medium | Yes (clean) | **Primary if A fails** |
| D Full baseline | High | High | Low | High | Yes | Last resort |
| E Split DB/branch | Medium (divergence) | Low short-term | Medium | Medium | Yes temporary | Contingency |

**Recommended:** **C** (after final A attempt).  
**Contingency:** **E** (Neon branch / dedicated staging) while waiting for C authorization; **D** only if leadership accepts history loss.

## 5. Isolated simulation (executed 2026-07-18)

| Item | Value |
|------|--------|
| Type | Disposable Postgres 16 via Homebrew |
| Host | `127.0.0.1:55432` |
| Data dir | `/tmp/10c3-pgdata` (destroyed after) |
| Work copy | `/tmp/10c3-db-copy` (rsync of `packages/db`, no Neon `.env`) |
| Prisma | 6.19.2 |
| Neon shared | **Untouched** |

| Step | Result | Evidence |
|------|--------|----------|
| Empty DB + reconstructed orphan → `migrate deploy` | PASS | 60 migrations; column present |
| Neon-like: orphan row, file absent, 6 pending → status | DIRTY | “not found locally” |
| `migrate deploy` without orphan file | Applies pending | Prisma 6.19 does not hard-fail |
| Checksum mismatch OLD vs NEW file | Not enforced by CLI | Status/deploy ignore mismatch |
| Strategy C: file + UPDATE checksum + deploy | PASS | Status up to date |
| Main repo `prisma/migrations/` orphan dir | Untouched | Confirmed |

**Implication:** Dirty status is the governance risk; Strategy C restores hygiene. Empty-DB path is reproducible once the reconstructed file is in git.

## 6. Reproducibility from empty database

Proven in isolation: with reconstructed orphan present in the migrations tree, `migrate deploy` on empty Postgres applies the full chain including Clickaton tables. A strategy that only patches Neon without committing the reconstructed file **fails** empty-DB reproducibility — therefore 10C4 must commit the migration file **before** or **with** the checksum UPDATE.

## 7. Info Spot validation (isolated)

- `lastChangedAt` exists after deploy of reconstructed SQL.
- Type `TIMESTAMP(3)`, nullable.
- No unexpected RoleAudit table.
- Product code today does not require the field; optional later: add to `schema.prisma` in a separate intentional PR.
- Neon data: all NULL today → no data loss expected from `IF NOT EXISTS`.

## 8. Clickaton validation (isolated empty deploy)

After full chain: `ClickatonEditionStatus`, `ClickatonEdition`, `ClickatonVenue`, indexes, FK `ON DELETE RESTRICT` created. CRUD/smoke against isolated DB is ready for 10C4; not started on Neon.

## 9. Backup & rollback (before any Neon write in 10C4)

1. Create Neon **branch** / snapshot; record id + timestamp.  
2. Export `_prisma_migrations` (CSV/SQL).  
3. Export schema DDL (`pg_dump --schema-only` or Neon export).  
4. Row counts for critical tables (`InfoSpotUserRole`, etc.).  
5. Record local migration checksums + Git HEAD.  
6. Maintenance window + dual review.  
7. **Rollback:** restore Neon branch/snapshot (not “git revert” alone). Optionally reverse checksum UPDATE using exported OLD value if only that row changed and deploy not yet run.

## 10. Abort criteria (immediate)

Abort Neon execution if:

- Prisma plans unexpected DROP;
- Additional unknown orphan migrations appear;
- Pending migration fails mid-chain;
- Final schema ≠ expected checklist;
- Empty-DB rehearsal fails;
- Unexplained row-count changes;
- Critical app regression;
- No verifiable backup/branch;
- Procedure requires multi-row history edits without audit trail.

## 11. Runbook — Strategy C (execution = future 10C4 only)

```text
# 0) Branch Neon + exports (backup)
# 1) Final A search on HD DNX 10 — if MATCH, abort C and use A
# 2) Copy fixture → packages/db/prisma/migrations/20260711160000_infospot_role_audit/migration.sql
# 3) shasum -a 256 … → NEW_CHECKSUM; commit migration file
# 4) On Neon (write role, reviewed):
UPDATE "_prisma_migrations"
SET checksum = '<NEW_CHECKSUM>'
WHERE migration_name = '20260711160000_infospot_role_audit';
# 5) prisma migrate status  → clean / pending-only
# 6) prisma migrate deploy
# 7) verify-schema-baseline + Clickaton smoke
# 8) Destroy temp branches when done
```

**Forbidden in 10C3:** steps 4–6 against shared Neon.

## 12. Read-only tooling

| Script | Purpose |
|--------|---------|
| `packages/db/scripts/audit-migration-state.mts` | Local dirs vs `_prisma_migrations` (SELECT) |
| `packages/db/scripts/verify-schema-baseline.mts` | Expected columns / Clickaton objects (SELECT) |
| `packages/db/scripts/fixtures/infospot_role_audit_reconstructed.example.sql` | Example reconstruction |

Usage (URL explicit; does not load `.env` by design):

```bash
cd packages/db
DATABASE_URL='postgresql://…' pnpm exec tsx scripts/audit-migration-state.mts
DATABASE_URL='postgresql://…' pnpm exec tsx scripts/verify-schema-baseline.mts
```

Refuse `--allow-write`. Prefer read-only DB roles. Sanitize host in output.

## 13. Impact by app

| App | Impact of delay | Impact of Strategy C |
|-----|-----------------|----------------------|
| Clickaton | Editions/Venues tables missing on Neon | Unblocked after deploy |
| FotoRank | experienceType / registration summary pending | Applied with chain |
| DNX Payments | Core persistence pending | Applied with chain |
| FotoOffice | Onboarding migration pending | Applied with chain |
| Info Spot | Unused `lastChangedAt` already on Neon | History cleaned; optional schema sync |

## 14. Residual risks

- Reconstructed SQL ≠ original comments/constraints (semantic only).  
- Prisma may change checksum enforcement in future versions.  
- WIP foreign (Cuánto Cobro) must stay out of reconcile PRs.  
- `migrate deploy` without C may “work” but leave unclean audits.

## 15. Verdict

**PLAN APROBABLE — SIMULACIÓN EXITOSA, EJECUCIÓN REAL PENDIENTE DE AUTORIZACIÓN**

Next authorized stage: **10C4 — ejecución de reconciliación y migrate deploy** (not started).
