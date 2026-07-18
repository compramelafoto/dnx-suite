# Forensic search: 20260711160000_infospot_role_audit (10C2)

**Verdict: NO-GO FORENSE** — exact `migration.sql` bytes matching Neon checksum were not recovered.

## Identity

| Field | Value |
|---|---|
| HEAD | `f94ada28702b607efbe280947e75036a9dce61d7` |
| Branch | `migration-legacy-clf-to-monorepo` |
| Migration | `20260711160000_infospot_role_audit` |
| Neon checksum (EXPECTED) | `6f8e61ef3427db1cb927bbdc751f8ea500963aa2de35831799446c1d693be83f` |
| Neon finished_at | `2026-07-11T06:59:01.624Z` |
| Local dir | **ABSENT** (`ORPHAN_DIR_ABSENT=yes`) |
| Related local migration | `20260711070000_infospot_user_role_audit` present; checksum `da6152dc0538c07449a8255c7aed6da73a5666e905062f305cc880e922cc1183` (different name/SQL) |

## Neon context (read-only)

- Orphan row exists in `_prisma_migrations` with checksum above; `logs=null`; `applied_steps_count=1`.
- `InfoSpotUserRole` has column `lastChangedAt` (timestamp, nullable) **not** present in current `schema.prisma`.
- Also has `assignedByUserId` / `lastChangedByUserId` from later migration `20260711070000_infospot_user_role_audit` (applied after orphan by wall clock).

## Evidence the file once existed

1. Terminal log `729192.txt` (cwd `/Volumes/HD DNX 10/PROGRAMACIONES/dnx-suite`, ended `2026-07-11T06:59:02Z`): Prisma applied `20260711160000_infospot_role_audit` successfully (21 migrations found).
2. Cursor retrieval index `embeddable_files.txt` (mtime Jul 11 13:32) lists AppleDouble remnant `packages/db/prisma/migrations/._20260711160000_infospot_role_audit` (not the SQL itself).

## Sources searched (read-only)

| Source | Result |
|---|---|
| Git history `--full-history` on migration path | Empty — path never committed |
| `git log -S` pickaxe | Only docs mention in `f94ada2` (10C1 reconciliation) |
| `git rev-list --objects --all` | No path blob |
| Reflog / tags / branches | No hit |
| Stashes 0–3 (+ scan 0–30) | No path; no content hit |
| `git fsck --unreachable` (299 blobs, 15 commits, trees) | No `infospot_role_audit` / no promising lastChangedAt+InfoSpot SQL blobs |
| Duplicate `dnx-suite` under Desktop/Documents/Downloads/Projects/Volumes | Only Desktop copy; **HD DNX 10 not mounted** |
| `dnx-suite-recovery-backup-20260717` | No role_audit migration |
| `/tmp/orphan_migrations_recovered` | 10 FotoOffice migrations only; orphan missing |
| Cursor User History `*.sql` | False positives (print pricing); no orphan SQL |
| Cursor History schema | Historical `lastChangedAt` on model (Jul 11) — not migration.sql |
| Cursor workspaceStorage / checkpoints | Name index / chat text only; no exact SQL file |
| Agent transcripts / agent-tools | Mentions + prior invented-candidate hashing; **no Write/heredoc with exact bytes** |
| Shell history | No hit |
| Trash / private tmp | No hit |
| Time Machine | `No machine directory found`; local APFS snapshot is OS update only — **manual TM UI / remount external disk required** |
| Archives (zip/tar under Desktop/Downloads) | No matching migration |
| VS Code History | No hit |

## Candidates

| File | sha256 | Class |
|---|---|---|
| Cursor History print-pricing SQL (6 identical copies) | `33e8057b65667b46c17710ddfd7bde35b41f4c0fa892128c9e411cbdcc09b310` | NO RELACIONADO |

No PROMETEDOR SQL recovered. No MATCH EXACTO.

## Constraints observed

- No migrate deploy/resolve, db push, reset, git gc/prune, Neon writes, invented SQL in repo, WIP discarded.
- WIP on branch left untouched.

## Next recovery options (manual)

1. **Remount `HD DNX 10`** and search `/Volumes/HD DNX 10/PROGRAMACIONES/dnx-suite/packages/db/prisma/migrations/20260711160000_infospot_role_audit/migration.sql` (apply cwd was on that volume).
2. Time Machine / other disk backups for that path around **2026-07-11**.
3. Until exact bytes are restored, keep **NO-GO** for `prisma migrate deploy` reconciliation (do not invent SQL to match checksum).
