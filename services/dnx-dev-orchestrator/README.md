# DNX Dev Orchestrator (`@dnx/dev-orchestrator`)

Internal tool for AI-assisted development orchestration inside the DNX suite.

## CURRENT STAGE

**ETAPA 06** (first real supervised run — blocked until OpenAI key + Cursor login)

## CURRENT CAPABILITY

**AUTONOMOUS SINGLE-TASK LOOP**

Scope: **LOCAL WORKTREE ONLY**

Pilot log: [`docs/first-real-run.md`](./docs/first-real-run.md)

## DISABLED

- Auto commit
- Push
- Merge
- Deploy
- Production
- MCP infra
- Concurrent agents > 1

## Autonomous flow

```sh
export OPENAI_API_KEY=...   # or use mock providers
export DNX_ORCH_ALLOW_WRITE=true

pnpm --filter @dnx/dev-orchestrator dnx-orch task create --project clickaton --objective "..."
pnpm --filter @dnx/dev-orchestrator dnx-orch run <taskId> --prepare --confirm-write
```

Mock autonomous E2E (no OpenAI / no real Cursor):

```sh
export DNX_ORCH_PLANNER_PROVIDER=mock
export DNX_ORCH_REVIEWER_PROVIDER=mock
export DNX_ORCH_CURSOR_PROVIDER=mock
export DNX_ORCH_ALLOW_WRITE=true
export DNX_ORCH_MOCK_AUTONOMOUS_SCENARIO=two-stage-complete

pnpm --filter @dnx/dev-orchestrator dnx-orch task create --project clickaton --objective "demo"
pnpm --filter @dnx/dev-orchestrator dnx-orch run <taskId> --prepare --confirm-write
```

## Commands

| Command | Purpose |
|---|---|
| `task create` | Create task |
| `run <taskId> --prepare --confirm-write` | Autonomous loop |
| `run <taskId> --dry-run` | Simulate (plan only, no write) |
| `resume <taskId>` | Continue from persisted state |
| `task cancel <taskId>` | Cancel / request cancel |
| `task-run show <runId>` | TaskRun + events |
| `plan` / `stage execute` / `review` | Manual steps still available |

## Architecture

```
AutonomousTaskRunner
  → Planner → Stage → Executor → CursorRun → (safe validation) → Reviewer → decision → ...
```

Stop reasons include: `TASK_COMPLETED`, `HUMAN_REQUIRED`, `BLOCKED`, `BUDGET_EXCEEDED`, `TASK_ITERATION_LIMIT`, `NO_PROGRESS_DETECTED`, `WRITE_AUTHORIZATION_REQUIRED`, …

## Write double gate

1. `DNX_ORCH_ALLOW_WRITE=true`
2. `--confirm-write`

Missing either → no local write autonomy.

## Env (selected)

| Variable | Default |
|---|---|
| `DNX_ORCH_MAX_TASK_ITERATIONS` | 20 |
| `DNX_ORCH_MAX_STAGE_ITERATIONS` | 5 |
| `DNX_ORCH_MAX_NO_PROGRESS_CYCLES` | 3 |
| `DNX_ORCH_MAX_FILES_CHANGED_PER_STAGE` | 30 |
| `DNX_ORCH_MAX_TOTAL_FILES_CHANGED_PER_TASK` | 100 |
| `DNX_ORCH_MAX_CHANGED_LINES_PER_STAGE` | 5000 |
| `DNX_ORCH_MAX_OPENAI_TOKENS_PER_TASK` | 500000 |
| `DNX_ORCH_MOCK_AUTONOMOUS_SCENARIO` | unset / `two-stage-complete` etc. |

## Scripts

```sh
pnpm --filter @dnx/dev-orchestrator typecheck
pnpm --filter @dnx/dev-orchestrator test
pnpm --filter @dnx/dev-orchestrator lint
pnpm --filter @dnx/dev-orchestrator dnx-orch doctor
```
