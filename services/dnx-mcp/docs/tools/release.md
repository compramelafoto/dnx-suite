# MCP Tools — Release

Herramientas MCP de alto nivel para el pipeline completo de release. Orquestan **Platform Catalog**, **Provider Registry**, **Release Orchestrator** y **DNX Brain** — sin deploy real por defecto.

## Principios

- Resuelven la plataforma desde el **Platform Catalog** (`platformId`)
- Usan **Release Orchestrator** con **Provider Registry** (Vercel, Git, Prisma, PostgreSQL)
- Consultan **DNX Brain** en cada fase
- **dryRun: true** por defecto — no hay efectos en producción sin confirmación explícita
- Validación con **Zod**
- Auditoría en cada invocación (`[AUDIT]` en logs)

## Flujo recomendado

```
release_prepare
    ↓
release_validate   → GO / NO-GO
    ↓
release_execute    (dryRun: false, confirm: true)
    ↓
(release_rollback si incidente)
```

## Parámetros comunes

| Parámetro    | Tipo    | Default | Descripción                                      |
| ------------ | ------- | ------- | ------------------------------------------------ |
| `platformId` | string  | —       | ID en Platform Catalog (`fotorank`, etc.)        |
| `dryRun`     | boolean | `true`  | Simula sin efectos en producción                 |
| `confirm`    | boolean | `false` | Requerido con `dryRun: false` para ejecutar real |

### Plataformas disponibles

`compramelafoto`, `fotooffice`, `fotorank`, `camofduty`, `cuantocobro`

---

## 1. `release_prepare`

Audita readiness antes del release: Vercel status/staging, Git, Prisma, PostgreSQL y DNX Brain.

### Input

```json
{
  "platformId": "fotorank",
  "dryRun": true
}
```

### Output

- `plan` — pasos del pipeline y `readyForValidation`
- `risks` — riesgos detectados
- `checklist` — items de preparación
- `vercel` — `status` + `staging`
- `git`, `prisma`, `postgres` — readiness de cada provider
- `brain` — score, verdict, `shouldBlock`, recommendation
- `blocked` — si Brain o providers bloquean continuar

### Ejemplo

```json
{
  "platformId": "fotorank"
}
```

Respuesta resumida:

```json
{
  "success": true,
  "dryRun": true,
  "readyForValidation": true,
  "blocked": false,
  "brain": { "score": 85, "verdict": "approve", "shouldBlock": false },
  "summary": "Plataforma lista para validateRelease"
}
```

---

## 2. `release_validate`

Valida staging y readiness. Devuelve **GO** o **NO-GO**.

### Input

```json
{
  "platformId": "fotorank",
  "dryRun": true
}
```

### Output

- `decision` — `"GO"` | `"NO-GO"`
- `blocked` — `true` si Brain bloquea
- `canExecute` — `true` solo con GO y sin bloqueos
- `issues` — problemas de validación Vercel
- `git`, `prisma`, `postgres`, `brain`

### Bloqueos (NO-GO)

- Validación Vercel fallida o issues abiertos
- Modo mantenimiento activo
- DNX Brain `shouldBlock: true`
- Git: dirty tree, unpushed commits, rama no permitida
- Prisma: schema inválido, migraciones pendientes, drift
- PostgreSQL: sin conexión, locks, queries largas, tabla migraciones ausente

### Ejemplo GO

```json
{
  "platformId": "fotorank",
  "dryRun": true
}
```

```json
{
  "decision": "GO",
  "blocked": false,
  "canExecute": true,
  "summary": "GO — release aprobado (Brain score: 85)"
}
```

---

## 3. `release_execute`

Ejecuta el deploy de producción vía Release Orchestrator.

### Comportamiento

| `dryRun` | `confirm` | Efecto                                |
| -------- | --------- | ------------------------------------- |
| `true`   | `false`   | Simula deploy (default)               |
| `false`  | `false`   | **No ejecuta** — devuelve mensaje     |
| `false`  | `true`    | **Ejecuta** deploy real en producción |

### Input — simulación (default)

```json
{
  "platformId": "fotorank"
}
```

### Input — ejecución real

```json
{
  "platformId": "fotorank",
  "dryRun": false,
  "confirm": true
}
```

### Bloqueos en ejecución real

Si `dryRun: false` y `confirm: true`, el orchestrator bloquea si:

- DNX Brain `shouldBlock: true`
- Git, Prisma o PostgreSQL tienen bloqueos críticos
- Fase no es `validated` con decisión GO previa

### Output

- `executed` — si el deploy corrió
- `deployment` — resultado del deploy
- `git`, `prisma`, `postgres`, `brain`
- `report` — artefacto consolidado

---

## 4. `release_rollback`

Revierte al deployment anterior en producción.

### Comportamiento

Igual que `release_execute`: simula por defecto; ejecuta solo con `dryRun: false` y `confirm: true`.

### Input — simulación

```json
{
  "platformId": "fotorank"
}
```

### Input — rollback real

```json
{
  "platformId": "fotorank",
  "dryRun": false,
  "confirm": true
}
```

---

## Arquitectura

```
MCP Client
    ↓
release_* tools
    ↓
Platform Catalog (platformId → PlatformDefinition)
    ↓
Release Orchestrator
    ├── Provider Registry (vercel, git, prisma, postgres)
    ├── MCP tools Vercel (in-process)
    └── DNX Brain
```

Las tools **no importan providers directamente** — todo pasa por el orchestrator y el registry.

## Auditoría

Cada invocación registra:

```json
{
  "tool": "release_prepare",
  "action": "prepare",
  "project": "fotorank",
  "dryRun": true,
  "confirmed": false,
  "outcome": "dry_run",
  "durationMs": 3200
}
```

## Tests

```bash
pnpm test src/tools/release
```

## Relación con tools Vercel

Las tools `release_*` son el **punto de entrada recomendado** para releases completos. Las tools `vercel_*` siguen disponibles para operaciones granulares sobre Vercel.

Ver también:

- [Release Orchestrator](../architecture/release-orchestrator.md)
- [DNX Brain](../architecture/dnx-brain.md)
- [Platform Catalog](../architecture/platform-catalog.md)
- [Vercel tools](./vercel.md)
