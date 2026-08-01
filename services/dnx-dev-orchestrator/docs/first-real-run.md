# First real supervised run — ETAPA 06

**Date:** 2026-07-30  
**Status:** `BLOCKED_BY_SETUP`  
**Pilot executed:** NO

## Objective of this document

Record the first attempt to run a supervised **real** autonomous pipeline:

OpenAI Planner REAL → Cursor REAL → validations → OpenAI Reviewer REAL

on a tiny local task over `@dnx/dev-orchestrator` (CLI `version`).

## Preflight result (2026-07-30)

| Check | Result |
|---|---|
| ETAPA 05 AutonomousTaskRunner present | YES |
| Mock multi-stage E2E | PASS |
| OPENAI_API_KEY | **REQUIRED** |
| Planner provider (effective) | **MOCK** (shell env `DNX_ORCH_PLANNER_PROVIDER=mock`) |
| Reviewer provider (effective) | OPENAI (but key missing → not usable) |
| Cursor provider | REAL |
| Cursor binary | FOUND (`~/.local/bin/agent`) |
| Cursor version | `2026.01.23-916f423` |
| Cursor auth | **REQUIRED** |
| Write env | DISABLED |
| `.env` in package / repo root | NOT FOUND |

## Why the pilot was not started

Per ETAPA 06 policy:

1. If any provider is MOCK for the real pilot → **BLOCKED** (`REAL_PROVIDER_REQUIRED`).
2. If OPENAI_API_KEY missing → **SETUP_REQUIRED** (do not improvise).
3. If Cursor login missing → **STOP** and show manual login hint (do not auto-login).

Therefore **no Task was created**, **no worktree was prepared**, and **no Cursor/OpenAI calls were made**.

## Manual setup required before retry

Run these steps in a clean shell (do not leave mock env vars from tests):

```sh
# 1) Unset test leftovers
unset DNX_ORCH_PLANNER_PROVIDER
unset DNX_ORCH_REVIEWER_PROVIDER
unset DNX_ORCH_CURSOR_PROVIDER
unset DNX_ORCH_MOCK_AUTONOMOUS_SCENARIO
unset DNX_ORCH_DATA_DIR

# 2) OpenAI
export OPENAI_API_KEY="..."   # never commit
export DNX_ORCH_PLANNER_PROVIDER=openai
export DNX_ORCH_REVIEWER_PROVIDER=openai
export DNX_ORCH_CURSOR_PROVIDER=real
# optional: export DNX_ORCH_OPENAI_MODEL=gpt-4.1-mini

# 3) Cursor auth (manual)
/Users/danielcuart/.local/bin/agent login

# 4) Confirm
pnpm --filter @dnx/dev-orchestrator dnx-orch cursor status
pnpm --filter @dnx/dev-orchestrator dnx-orch doctor

# 5) Pilot (conservative limits)
export DNX_ORCH_ALLOW_WRITE=true
export DNX_ORCH_MAX_TASK_ITERATIONS=5
export DNX_ORCH_MAX_STAGE_ITERATIONS=2
export DNX_ORCH_MAX_NO_PROGRESS_CYCLES=2
export DNX_ORCH_MAX_FILES_CHANGED_PER_STAGE=10
export DNX_ORCH_MAX_TOTAL_FILES_CHANGED_PER_TASK=20

pnpm --filter @dnx/dev-orchestrator dnx-orch task create \
  --project dnx-dev-orchestrator \
  --objective "Agregar comando CLI version que muestre versión del paquete y current stage, con tests y documentación, sin modificar productos DNX ni operaciones remotas."

pnpm --filter @dnx/dev-orchestrator dnx-orch run <taskId> --prepare --confirm-write --verbose
```

## Pilot task (planned, not created)

- **Project:** `dnx-dev-orchestrator`
- **Objective:** Add CLI `dnx-orch version` showing package version + current stage, with tests and docs; no product apps, no remote ops.
- **Scope:** `services/dnx-dev-orchestrator/**` only

## Security posture for the pilot (unchanged)

- Auto commit: DISABLED  
- Push / deploy / production / MCP infra: DISABLED  
- Concurrent agents: 1  
- Write double gate: ACTIVE  
- Control-plane Cursor execution: FORBIDDEN  

## Tokens / Cursor usage

Not applicable — pilot not started.

## Follow-up

After credentials are configured, re-run ETAPA 06 from step 4 above and update this file with:

- taskId / runId  
- models  
- stages / CursorRuns / ReviewRuns  
- tokens  
- final status  
- manual prompt transfer: expected **NO**
