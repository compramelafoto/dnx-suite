# Git Provider

Provider de **solo lectura** para inspeccionar el estado de un repositorio Git local. Diseñado para que el Brain y los orquestadores conozcan el estado real del código antes de un release.

## Principios

- **Solo lectura**: no ejecuta `commit`, `push`, `pull`, `reset`, `checkout`, `merge` ni `rebase`
- **Spawn seguro**: usa `child_process.spawn` sin shell
- **Allowlist de subcomandos**: rechaza operaciones peligrosas en runtime
- **Tipado fuerte + Zod**: schemas para inputs y outputs

## Configuración

| Variable             | Descripción                  | Default                   |
| -------------------- | ---------------------------- | ------------------------- |
| `GIT_REPO_PATH`      | Ruta absoluta al repositorio | `process.cwd()`           |
| `GIT_BINARY`         | Binario de git               | `git`                     |
| `GIT_DEFAULT_BRANCH` | Rama por defecto esperada    | inferida de `origin/HEAD` |

```bash
GIT_REPO_PATH=/path/to/repo
GIT_DEFAULT_BRANCH=main
```

## Estructura

```
src/providers/git/
├── provider.ts              # GitProvider facade
├── config.ts                # Schema y resolución de config
├── errors.ts                # Errores tipados
├── parsers.ts               # Parsers de salida git
├── client/
│   └── git-executor.ts      # Ejecutor seguro (spawn)
├── services/
│   ├── status.service.ts    # Estado del repo
│   ├── compare.service.ts   # Diffs y comparación
│   └── security.service.ts  # Checks pre-release
├── helpers/
│   └── release-readiness.ts # assessReleaseReadiness
└── types/
    └── index.ts             # Schemas Zod
```

## API

### Estado del repo

| Método                  | Descripción                                   |
| ----------------------- | --------------------------------------------- |
| `getStatus()`           | Estado porcelain: staged, unstaged, untracked |
| `isDirty()`             | `true` si hay cambios locales                 |
| `getCurrentBranch()`    | Rama actual                                   |
| `getRemote(name?)`      | Remote `origin` por defecto                   |
| `getHeadCommit()`       | Último commit                                 |
| `getLastCommits(limit)` | Historial reciente                            |
| `getTags()`             | Lista de tags                                 |
| `getLatestTag()`        | Tag más reciente o `null`                     |

### Comparación

| Método                          | Descripción                |
| ------------------------------- | -------------------------- |
| `getDiffStat(ref?)`             | Estadísticas de diff       |
| `getChangedFiles(ref?)`         | Archivos cambiados vs ref  |
| `compareBranches(base, head)`   | Commits + diff entre ramas |
| `getCommitsBetween(base, head)` | Commits en `base..head`    |

### Seguridad release

| Método                    | Descripción              |
| ------------------------- | ------------------------ |
| `hasUncommittedChanges()` | Working tree sucio       |
| `hasUnpushedCommits()`    | Commits locales sin push |
| `isAheadBehindRemote()`   | Ahead/behind vs upstream |
| `getReleaseSummary()`     | Resumen consolidado      |

### Helper de alto nivel

```typescript
import { createGitProvider } from "./providers/git/index.js";

const git = createGitProvider({
  config: { repoPath: "/path/to/repo", defaultBranch: "main" },
});

const readiness = await git.assessReleaseReadiness();

console.log(readiness.riskLevel);
console.log(readiness.blockers);
console.log(readiness.recommendation);
```

## Tests

```bash
pnpm test src/providers/git
```

Los tests usan un `GitExecutor` mockeado — no requieren un repo git real.

## Integración con Release Orchestrator

Cuando el `ReleaseOrchestrator` recibe un `GitProvider`, cada fase de release llama a `assessReleaseReadiness()` y propaga el resultado al Brain y a `report.git`. Ver [release-orchestrator.md](../architecture/release-orchestrator.md).
