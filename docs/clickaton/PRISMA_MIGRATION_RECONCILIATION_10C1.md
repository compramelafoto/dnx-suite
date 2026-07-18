# Prisma migration reconciliation — Clickaton 10C1

**Date:** 2026-07-18  
**Scope:** Neon shared history vs `packages/db/prisma/migrations`  
**Deploy:** **NO-GO** until the 11th orphan is resolved

## Summary

Ten FotoOffice migrations were applied on Neon but missing from the repo. They were recovered from `stash@{2}` and verified locally with **sha256 checksums identical** to `_prisma_migrations.checksum` on Neon.

`20260711160000_infospot_role_audit` remains applied on Neon but **absent locally**. That orphan still blocks a clean `prisma migrate deploy` / status reconciliation.

Clickaton migration `20260718120000_clickaton_editions_and_venues` is present in the repo and **has NOT been applied** to Neon shared.

## Recovered migrations (10) — checksum match

| migration_name | sha256 (local = Neon) |
|---|---|
| `20260501110000_add_teacher_applications` | `4be29d1dfb73d722b52cbf0885737960e3e3d35fd4d908a4a892f7965c3d993b` |
| `20260501114500_add_workspace_branding_colors` | `3949b51b8a0744a66523c27669773ef1a1b3c17bbdc97161b34dabb20cb321f5` |
| `20260501130000_add_members_registry` | `6d896f5b77d0f7916275b43b4b44b451b3732fe3f2a21048a0b04751a1f95323` |
| `20260501141000_add_membership_fees` | `fca801cfcb0582cc6c9612a5714390db6fac73bb547f7365e73c6b9c89edae42` |
| `20260501143000_add_member_charges_payments` | `bd418226510eaefed01fbb4d1033797cd30af788ea0cd2829305ee2515d9c715` |
| `20260501152000_add_member_cards` | `64f957a14b2874f16d38b2506798d36825bc68f9160f82d14c4ce20adaa57cea` |
| `20260501170500_add_card_template_v2` | `a544e6e5173a7df1e0b14432601413a59e7431f9f07aecdd05b6faf09423bebe` |
| `20260501181000_add_card_requests` | `cf1c02083e72458a92607fe916a3fac1c23a79d80b5ed9ee048e2c36acb8c2b8` |
| `20260501184500_add_member_card_validity` | `02a1f574676010b10eaae3215d9d95db00c9d35c3528c5eb72d6454b455ef0e3` |
| `20260502090000_card_templates_by_category` | `fbca1a4dd444099b78cc87ccd0c3e2bc228f398a9a507b62a027aa262f1cdbd7` |

Source: git `stash@{2}` recovery; Prisma checksum = sha256 of `migration.sql` bytes.

## Missing locally (still on Neon)

| migration_name | Neon checksum |
|---|---|
| `20260711160000_infospot_role_audit` | `6f8e61ef3427db1cb927bbdc751f8ea500963aa2de35831799446c1d693be83f` |

**Material effect (likely):** columns on `InfoSpotUserRole` related to audit / last change — especially `lastChangedAt` (and related change metadata). Exact SQL is not in the repo; do not invent or `migrate resolve` until the original file is recovered or an intentional checksum-aligned replacement is approved.

## Clickaton migration status

- Repo has `20260718120000_clickaton_editions_and_venues`.
- **Not applied** on Neon shared in this reconciliation window.
- UI/admin may show “migración pendiente” until deploy is unblocked and this migration is applied intentionally.

## Pending chain (repo ahead of Neon once orphans are fixed)

After history reconciliation, expected pending deploy candidates include at least:

1. `20260715150000_fotorank_public_event_channel`
2. `20260715160000_fotorank_experience_type`
3. `20260715170000_dnx_payments_core_persistence`
4. `20260715180000_fotorank_public_registration_summary`
5. `20260718120000_clickaton_editions_and_venues`
6. `20260718140000_fotoffice_photographer_onboarding` (if present in chain and not yet applied)

Exact pending set must be re-confirmed with `pnpm --filter @repo/db exec prisma migrate status` after the Infospot orphan is resolved. Status remains blocked while `20260711160000_infospot_role_audit` exists only in Neon.

## Gate

| Action | Allowed now? |
|---|---|
| Commit recovered 10 migrations + this doc | Yes |
| `migrate deploy` | **NO-GO** |
| `migrate resolve` | **NO-GO** |
| `db push` / `migrate reset` | **NO-GO** |

**NO-GO for deploy** until `20260711160000_infospot_role_audit` is restored (or otherwise intentionally reconciled) so Prisma history matches Neon.
