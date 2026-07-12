# ComprameLaFoto — Release dry-run seguro

**Fecha:** 2026-07-06T16:57:07Z (UTC)  
**Plataforma:** `compramelafoto`  
**Modo:** seguro — sin deploy real, sin rollback real, sin llamadas HTTP a Vercel

## Metodología

Se invocaron los handlers de las MCP tools `release_prepare`, `release_validate` y `release_execute` con solo `platformId` (defaults de Zod).

| Control de seguridad            | Valor                                                         |
| ------------------------------- | ------------------------------------------------------------- |
| `dryRun` por defecto            | `true` en las 3 tools                                         |
| `confirm` por defecto (execute) | `false`                                                       |
| Vercel                          | **Mock invoker** — sin `VERCEL_TOKEN`, sin HTTP               |
| Git / Prisma / PostgreSQL       | Providers reales contra repo local `~/Desktop/compramelafoto` |
| Deploy producción               | **No ejecutado**                                              |

### Inputs parseados (defaults confirmados)

```json
{
  "prepareInput": { "platformId": "compramelafoto", "dryRun": true },
  "validateInput": { "platformId": "compramelafoto", "dryRun": true },
  "executeInput": { "platformId": "compramelafoto", "confirm": false, "dryRun": true }
}
```

---

## 1. `release_prepare`

### Resumen

| Campo                | Valor                                                            |
| -------------------- | ---------------------------------------------------------------- |
| `success`            | `true`                                                           |
| `dryRun`             | `true`                                                           |
| `phase`              | `prepared`                                                       |
| `readyForValidation` | `false`                                                          |
| `blocked`            | `true`                                                           |
| `summary`            | Preparación completada con bloqueos — PostgreSQL bloquea release |

### Plan

```json
{
  "platformId": "compramelafoto",
  "vercelProject": "compramelafoto",
  "candidateTarget": "production",
  "readyForValidation": false,
  "steps": [
    "1. prepareRelease — status + staging audit",
    "2. validateRelease — GO/NO-GO",
    "3. executeRelease — deploy con confirm: true",
    "4. (opcional) rollbackRelease — si hay incidente"
  ]
}
```

### Vercel (simulado)

- `vercel.status.dryRun`: `true`
- `vercel.staging.dryRun`: `true`
- Proyecto: `compramelafoto`, health `healthy`, staging `stagingReady: true`
- **Nota:** datos de preview local; no se consultó la API de Vercel

### Git (real)

| Campo             | Valor                                                                          |
| ----------------- | ------------------------------------------------------------------------------ |
| `branch`          | `main`                                                                         |
| `dirtyTree`       | `false`                                                                        |
| `unpushedCommits` | `0`                                                                            |
| `riskLevel`       | `medium`                                                                       |
| `blockers`        | ninguno                                                                        |
| `warnings`        | No hay upstream configurado para la rama actual                                |
| Último commit     | `6e6fd6d4` — feat(admin): panel Salud de la Plataforma con métricas y acciones |

### Prisma (real)

| Campo               | Valor                                            |
| ------------------- | ------------------------------------------------ |
| `schemaValid`       | `true`                                           |
| `migrationCount`    | `169`                                            |
| `latestMigration`   | `20260702120000_exif_device_scan_state`          |
| `pendingMigrations` | `[]`                                             |
| `formatDrift`       | `true`                                           |
| `riskLevel`         | `medium`                                         |
| `blockers`          | ninguno                                          |
| `warnings`          | El schema no está formateado según prisma format |

### PostgreSQL (real — lectura)

| Campo                  | Valor                                    |
| ---------------------- | ---------------------------------------- |
| `connected`            | `false`                                  |
| `migrationTableExists` | `false`                                  |
| `riskLevel`            | `high`                                   |
| `blockers`             | No se pudo conectar o evaluar PostgreSQL |

### DNX Brain

| Campo            | Valor                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| `score`          | `0`                                                                                                          |
| `verdict`        | `reject`                                                                                                     |
| `shouldBlock`    | `true`                                                                                                       |
| `recommendation` | PostgreSQL bloquea release: No se pudo conectar o evaluar PostgreSQL; Tabla _prisma_migrations no encontrada |

**Riesgos principales detectados:**

1. PostgreSQL no conectado (critical)
2. Tabla `_prisma_migrations` no encontrada (high)
3. Prisma format drift (high)
4. Git sin upstream (medium)
5. 169 migraciones locales (medium — informativo)

---

## 2. `release_validate`

### Resumen

| Campo        | Valor                                   |
| ------------ | --------------------------------------- |
| `dryRun`     | `true`                                  |
| `decision`   | **NO-GO**                               |
| `blocked`    | `true`                                  |
| `canExecute` | `false`                                 |
| `phase`      | `failed`                                |
| `summary`    | NO-GO — release bloqueado por DNX Brain |

### Validación Vercel (simulada)

```json
{
  "dryRun": true,
  "passed": true,
  "issues": []
}
```

La validación técnica de staging **pasó en simulación**, pero la decisión final es **NO-GO** por bloqueos de providers/Brain.

### Por qué NO-GO

1. **PostgreSQL** — bloqueo crítico: no conecta + `_prisma_migrations` ausente
2. **DNX Brain** — `shouldBlock: true`, score 0 (mínimo requerido: 60)
3. **Prisma** — `formatDrift: true` eleva riesgo (warning en validate, bloqueo en execute real)

Git no bloqueó (`blockers: []`), pero contribuye warnings.

---

## 3. `release_execute` (dry-run)

### Resumen

| Campo      | Valor                                   |
| ---------- | --------------------------------------- |
| `dryRun`   | `true`                                  |
| `confirm`  | `false` (default)                       |
| `executed` | **`false`** — no hubo deploy            |
| `phase`    | `validated` (simulación)                |
| `summary`  | Simulación de executeRelease completada |

### Deploy

```json
{
  "deployment": {
    "id": "dpl_simulated",
    "url": "compramelafoto.com",
    "success": true,
    "simulated": true
  },
  "message": "Simulación — no se desplegó en Vercel"
}
```

**Confirmado:** no se ejecutó deploy real. El orchestrator corrió en `dryRun: true` y el invoker mock devolvió `executed: false`.

En ejecución real (`dryRun: false`, `confirm: true`), el mismo estado actual **bloquearía** antes del deploy por PostgreSQL + Brain.

---

## Bloqueos encontrados

| Severidad   | Fuente                    | Motivo                                                     |
| ----------- | ------------------------- | ---------------------------------------------------------- |
| **Crítico** | PostgreSQL                | No se pudo conectar o evaluar la base (desde este entorno) |
| **Crítico** | PostgreSQL / Orchestrator | `migrationTableExists: false`                              |
| **Alto**    | DNX Brain                 | `shouldBlock: true` — score 0, veredicto `reject`          |
| **Medio**   | Prisma                    | Schema no cumple `prisma format --check`                   |
| **Medio**   | Git                       | Rama `main` sin upstream remoto configurado                |
| **Info**    | Orchestrator              | Modo dryRun — checklist limitado a simulación              |

### Cadena de bloqueo

```
release_validate
  → vercel_validate_staging: passed (simulado)
  → postgres.assessReleaseReadiness(): connected=false, migrationTableExists=false
  → mergeBrainWithPostgresGate(): shouldBlock=true
  → decision: NO-GO
```

---

## Qué falta configurar para staging real

Para pasar de dry-run simulado a **staging real** (sin deploy a producción aún):

### Vercel

| Requisito                                         | Estado actual                                                                       |
| ------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `VERCEL_TOKEN` en entorno MCP                     | No configurado                                                                      |
| `VERCEL_TEAM_ID` / `VERCEL_TEAM_SLUG` (si aplica) | No verificado                                                                       |
| Invoker real (sin mock)                           | Requerido para `vercel_status`, `vercel_prepare_staging`, `vercel_validate_staging` |

### PostgreSQL

| Requisito                                                                      | Estado actual                                                      |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `DATABASE_URL` o `POSTGRES_READONLY_DATABASE_URL` alcanzable desde el host MCP | Presente en `.env` del repo, pero **conexión falló** desde dnx-mcp |
| URL de solo lectura recomendada para assess                                    | Configurar `POSTGRES_READONLY_DATABASE_URL`                        |
| Red / SSL / firewall hacia la BD                                               | Revisar (warning SSL de `pg` en el runner)                         |
| Tabla `_prisma_migrations` en `public`                                         | No visible (o BD inaccesible)                                      |

### Prisma

| Requisito                               | Estado actual                                |
| --------------------------------------- | -------------------------------------------- |
| `prisma` CLI en PATH o `PRISMA_BINARY`  | Usar `node_modules/.bin/prisma` del repo     |
| `prisma format` / resolver format drift | Pendiente — schema válido pero no formateado |

### Git

| Requisito                             | Estado actual                                      |
| ------------------------------------- | -------------------------------------------------- |
| `GIT_REPO_PATH` → repo compramelafoto | OK                                                 |
| Upstream remoto en `main`             | Configurar `git push -u origin main` o equivalente |

### Pipeline sugerido (cuando esté listo)

```bash
# 1. Preparar con Vercel real pero sin deploy
release_prepare { "platformId": "compramelafoto", "dryRun": false }

# 2. Validar staging real
release_validate { "platformId": "compramelafoto", "dryRun": false }

# 3. Solo si GO — simular deploy
release_execute { "platformId": "compramelafoto", "dryRun": true }

# 4. Producción — solo con confirm explícito
release_execute { "platformId": "compramelafoto", "dryRun": false, "confirm": true }
```

---

## Verificaciones cumplidas

| Verificación                 | Resultado                                     |
| ---------------------------- | --------------------------------------------- |
| `dryRun` default `true`      | Sí                                            |
| No deploy real               | Sí (`executed: false`)                        |
| No rollback real             | No se invocó                                  |
| No HTTP Vercel               | Sí (mock invoker)                             |
| Respuesta incluye Git        | Sí                                            |
| Respuesta incluye Prisma     | Sí                                            |
| Respuesta incluye PostgreSQL | Sí                                            |
| Respuesta incluye Vercel     | Sí (simulado)                                 |
| Respuesta incluye Brain      | Sí                                            |
| Explica bloqueos             | Sí — PostgreSQL + Brain + warnings Git/Prisma |

---

## Artefacto completo

Resultado JSON completo del runner (local, no versionado):

`/tmp/compramelafoto-release-dry-run.json`
