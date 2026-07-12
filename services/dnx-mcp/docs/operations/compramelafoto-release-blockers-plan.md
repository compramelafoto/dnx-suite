# ComprameLaFoto — Plan de desbloqueo para `release_prepare`

**Fecha:** 2026-07-07 (actualizado tras desbloqueo Git + `allowedBranches`)  
**Base:** [`compramelafoto-release-prepare-monorepo.md`](./compramelafoto-release-prepare-monorepo.md)  
**Relacionado:** [`33-git-stash-plan-before-clf-staging.md`](../../dnx-suite/docs/architecture/migration/33-git-stash-plan-before-clf-staging.md) (monorepo)  
**Estado actual:** Brain **score 0**, `shouldBlock: true` — **solo Prisma** (Git desbloqueado)

---

## Resumen

`release_prepare { "platformId": "compramelafoto", "dryRun": true }` confirma que el **Platform Catalog monorepo** funciona (`vercelProject: compramelafoto-dnxsuite`). Tras stash Git + `allowedBranches`, los bloqueos Git están **resueltos**. Quedan **Prisma** y **PostgreSQL** (entorno MCP).

| Bloqueador                                                      | Severidad | Estado (2026-07-07)                 |
| --------------------------------------------------------------- | --------- | ----------------------------------- |
| Git — working tree sucio                                        | critical  | ✅ **Resuelto** (4 stashes)         |
| Git — rama `migration-legacy-clf-to-monorepo`                   | high      | ✅ **Resuelto** (`allowedBranches`) |
| Prisma — `schemaValid: false` (sin `DATABASE_URL`/`DIRECT_URL`) | critical  | ❌ **Bloquea**                      |
| PostgreSQL — `POSTGRES_READONLY_DATABASE_URL` vacío             | —         | ⚠️ Omitido (`postgres: null`)       |

**Último `release_prepare` (post-desbloqueo Git):**

| Campo                | Valor                                              |
| -------------------- | -------------------------------------------------- |
| `git.dirtyTree`      | `false`                                            |
| `git.blockers`       | `[]`                                               |
| `git.warnings`       | Rama ≠ `main`, sin upstream                        |
| `git.riskLevel`      | `medium`                                           |
| `prisma.schemaValid` | `false`                                            |
| `postgres`           | `null`                                             |
| `vercel`             | `dryRun: true`, proyecto `compramelafoto-dnxsuite` |
| `brain.shouldBlock`  | `true` (Prisma)                                    |

**Sin deploy · sin tocar Vercel/DNS en este run.**

---

## 1. Git blocker — ✅ RESUELTO (2026-07-07)

### Acciones ejecutadas

**A) Stash de cambios no CLF** — 4 stashes, working tree **0 entradas**, CLF/workers limpios.

| Stash                         | Archivos |
| ----------------------------- | -------- |
| `stash@{3}` fotoffice         | 191      |
| `stash@{2}` packages          | 16       |
| `stash@{1}` docs + tools      | 97       |
| `stash@{0}` AppleDouble `._*` | 61       |

**C) `allowedBranches`** en `src/platforms/platforms/compramelafoto.ts`:

```typescript
allowedBranches: ["main", "migration-legacy-clf-to-monorepo"],
// main → producción final
// migration-legacy-clf-to-monorepo → solo staging/preparación y dry-run
```

### Situación actual

| Señal           | Valor                                          |
| --------------- | ---------------------------------------------- |
| Working tree    | **Limpio**                                     |
| Rama            | `migration-legacy-clf-to-monorepo` (permitida) |
| `git.dirtyTree` | `false`                                        |
| `git.blockers`  | `[]`                                           |
| `git.warnings`  | Rama ≠ `main`, sin upstream (no bloquean)      |

### Opciones históricas (referencia)

<details>
<summary>Plan original A / B / C</summary>

### Situación inicial (pre-stash)

| Señal                  | Valor                    |
| ---------------------- | ------------------------ |
| Working tree           | **Sucio** — 308 entradas |
| Rama permitida (antes) | solo `main`              |

**Origen cambios no CLF:** FotoOffice 197, packages 16, docs 66, tools 29.

### Opción A — Stash

**Qué resuelve:** working tree sucio.  
**Qué NO resuelve:** rama incorrecta.

Plan detallado en el monorepo: **doc 33** — cuatro stashes por bloque:

1. `apps/fotoffice`
2. `packages/auth-guards` + migraciones `202605*`
3. `docs`
4. `tools`

```bash
cd "/Volumes/HD DNX 10/PROGRAMACIONES/dnx-suite"
# Ver doc 33 para comandos exactos con -u y mensajes
```

**Verificación post-stash:**

```bash
git status --porcelain=v1 -uall | wc -l                    # → 0
git status --porcelain=v1 apps/compramelafoto apps/compramelafoto-workers  # → vacío
```

| Pros                       | Contras                                     |
| -------------------------- | ------------------------------------------- |
| No toca CLF ni workers     | No cambia la rama                           |
| Reversible (`stash apply`) | 4 comandos secuenciales                     |
| Sin commits mezclados      | Trabajo FotoOffice queda congelado en stash |

**Riesgo:** bajo — paths explícitos excluyen CLF.

---

### Opción B — Rama temporal para FotoOffice

**Qué resuelve:** dirty tree + aislamiento de trabajo FotoOffice/docs en otra rama.

**Flujo propuesto (cuando se apruebe ejecutar):**

```bash
cd "/Volumes/HD DNX 10/PROGRAMACIONES/dnx-suite"

# 1. Crear rama wip desde el estado actual (con cambios pendientes)
git checkout -b wip/fotoffice-workspace-members

# 2. Commitear solo bloques no CLF (o todo el wip en commits temáticos)
#    NO incluir apps/compramelafoto ni apps/compramelafoto-workers
git add apps/fotoffice packages/auth-guards packages/db/prisma/migrations/202605* docs tools
git commit -m "wip(fotoffice): workspace members feature (off mainline)"

# 3. Volver a rama de migración CLF con árbol limpio
git checkout migration-legacy-clf-to-monorepo
```

| Pros                                 | Contras                                          |
| ------------------------------------ | ------------------------------------------------ |
| Trabajo FotoOffice preservado en Git | Requiere commit(s) wip                           |
| Árbol limpio en rama CLF             | Más pasos que stash                              |
| Historial recuperable                | Mezcla productos si el commit no es disciplinado |

**Riesgo:** medio — requiere cuidado en `git add` (solo paths no CLF).

**Para CLF staging:** seguir en `migration-legacy-clf-to-monorepo` o mergear a `main` cuando la migración esté lista — ver opción C.

---

### Opción C — Permitir rama actual solo para staging

**Qué resuelve:** bloqueo por rama sin cambiar de branch.

**Mecanismo:** `releasePolicy.allowedBranches` en Platform Catalog (`src/platforms/platforms/compramelafoto.ts`):

```typescript
releasePolicy: {
  // ...
  allowedBranches: ["main", "migration-legacy-clf-to-monorepo"],
}
```

| Pros                                       | Contras                                             |
| ------------------------------------------ | --------------------------------------------------- |
| Staging CLF desde rama de migración activa | **Cambio de código** en catalog (fuera de este doc) |
| No fuerza merge prematuro a `main`         | Relaja policy — documentar alcance solo staging     |
| Combinable con opción A                    | No apto para producción sin revisión                |

**Riesgo:** bajo si se limita a `dryRun` / preview; medio si se usa en `release_execute` real.

**Recomendación:** usar solo mientras dure la migración monorepo; revertir cuando CLF esté en `main`.

---

### Matriz Git

| Opción                  | Dirty tree | Rama    | Toca CLF     | Esfuerzo       |
| ----------------------- | ---------- | ------- | ------------ | -------------- |
| **A — Stash**           | ✅         | ❌      | No           | Bajo           |
| **B — Rama wip**        | ✅         | Parcial | No           | Medio          |
| **C — allowedBranches** | ❌         | ✅      | No (catalog) | Bajo (1 línea) |

**Combinación aplicada:** **A + C** (stash + `allowedBranches`).

</details>

---

## 2. Prisma blocker

### Situación detectada

| Campo                | Valor                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------- |
| `schemaPath`         | `.../packages/db/prisma/schema.prisma`                                                 |
| `schemaValid`        | **false**                                                                              |
| Causa raíz           | `prisma validate` requiere `DATABASE_URL` y `DIRECT_URL` en el entorno del proceso MCP |
| `migrate status`     | No verificable sin conexión DB                                                         |
| Migraciones en disco | 19 en HEAD (FotoOffice `202605*` en stash)                                             |

**Mensaje Brain:** `Schema Prisma inválido — ejecutar prisma validate localmente`

---

### Opción A — Usar staging DB (recomendada para assess real)

**Qué hacer:** copiar URLs de solo lectura del entorno staging al `.env.local` de DNX-MCP (sin commitear):

```bash
# dnx-mcp/.env.local (ejemplo — valores reales fuera del repo)
DATABASE_URL="postgresql://readonly:****@staging-host:5432/dnx_staging?sslmode=require"
DIRECT_URL="postgresql://readonly:****@staging-host:5432/dnx_staging?sslmode=require"
```

| Pros                                                  | Contras                       |
| ----------------------------------------------------- | ----------------------------- |
| `prisma validate` pasa con schema real                | Requiere credenciales staging |
| `migrate status` verificable                          | Acceso de red a DB            |
| PostgreSQL assess también usable (misma URL readonly) | No usar URL de producción     |

**Riesgo:** bajo con usuario **readonly** y DB **staging**.

---

### Opción B — Dummy URL solo para `validate`

**Qué hacer:** URLs sintácticamente válidas para satisfacer `env()` del schema:

```bash
DATABASE_URL="postgresql://validate:validate@127.0.0.1:5432/validate?schema=public"
DIRECT_URL="postgresql://validate:validate@127.0.0.1:5432/validate?schema=public"
```

| Pros                                           | Contras                                         |
| ---------------------------------------------- | ----------------------------------------------- |
| Desbloquea `prisma validate` (sintaxis schema) | **`migrate status` sigue fallando** sin DB real |
| Sin credenciales staging                       | Brain puede seguir marcando drift high          |
| Rápido para smoke local                        | No valida migraciones aplicadas                 |

**Riesgo:** bajo para validate puntual; **insuficiente** para `release_validate` real.

**Cuándo usar:** solo para confirmar que el schema parsea tras desbloquear Git — paso intermedio.

---

### Opción C — Ajustar Prisma Provider (futuro)

**Idea:** `validate` sin DB cuando Prisma lo permita (p. ej. flag `--no-engine` o validación AST sin conexión).

| Pros                         | Contras                                                  |
| ---------------------------- | -------------------------------------------------------- |
| Mejor DX en MCP sin secretos | **Requiere cambio de código** en `src/providers/prisma/` |
| Menos dependencia de env     | `migrate status` siempre necesitará DB                   |

**Estado:** no implementado. Documentar como mejora — **no hacer en esta fase**.

---

### Matriz Prisma

| Opción             | `schemaValid` | `migrate status` | Credenciales     | Listo para validate real |
| ------------------ | ------------- | ---------------- | ---------------- | ------------------------ |
| **A — Staging DB** | ✅            | ✅               | Staging readonly | ✅                       |
| **B — Dummy URL**  | ✅            | ❌               | Ninguna          | Parcial                  |
| **C — Provider**   | ⚠️ futuro     | ❌ sin DB        | —                | Futuro                   |

---

## 3. PostgreSQL

### Situación detectada

| Variable                         | Estado                               |
| -------------------------------- | ------------------------------------ |
| `POSTGRES_READONLY_DATABASE_URL` | **Vacío**                            |
| `result.postgres` en prepare     | **`null`** (provider no configurado) |
| Bloqueo Brain directo PG         | No en este run                       |

**Impacto indirecto:**

- Prisma `migrate status` no puede comparar migraciones vs DB
- Cuando se configure PG, el assess añadirá señales de salud (conexión, lag, locks, etc.)

### Plan para staging real

1. Obtener URL **readonly** de la misma DB staging usada en opción Prisma A.
2. Añadir a `dnx-mcp/.env.local`:

   ```bash
   POSTGRES_READONLY_DATABASE_URL="postgresql://readonly:****@staging-host:5432/dnx_staging?sslmode=require"
   ```

3. Reiniciar / re-ejecutar MCP para recargar env.
4. Re-ejecutar `release_prepare` dry-run.

| Fase                                 | PostgreSQL necesario              |
| ------------------------------------ | --------------------------------- |
| Desbloquear dirty tree (Git)         | No                                |
| `prisma validate` mínimo             | No (solo `DATABASE_URL` en env)   |
| `release_prepare` sin warnings drift | **Sí** (recomendado)              |
| `release_validate` staging real      | **Sí**                            |
| `release_execute`                    | **Sí** + permisos según operación |

**Pendiente para staging real:** configuración de URL readonly — **puede esperar** hasta después de desbloquear Git + Prisma validate básico.

---

## 4. Recomendación concreta

### Qué hacer primero (orden actualizado)

| #     | Acción                                                                      | Estado       |
| ----- | --------------------------------------------------------------------------- | ------------ |
| **1** | Stash plan doc 33 (4 stashes)                                               | ✅ Hecho     |
| **2** | `allowedBranches: ["main", "migration-legacy-clf-to-monorepo"]`             | ✅ Hecho     |
| **3** | Añadir `DATABASE_URL` + `DIRECT_URL` (staging readonly) en `.env.local` MCP | ⏳ Pendiente |
| **4** | Re-ejecutar `release_prepare { dryRun: true }`                              | ✅ Git OK    |
| **5** | Añadir `POSTGRES_READONLY_DATABASE_URL` (misma DB staging)                  | ⏳ Pendiente |
| **6** | Re-ejecutar `release_prepare` → objetivo: score ≥ 40, `shouldBlock: false`  | ⏳ Pendiente |

### Qué puede esperar

| Item                               | Esperar hasta…                                           |
| ---------------------------------- | -------------------------------------------------------- |
| PostgreSQL assess completo         | Paso 5 (después de Git + Prisma env)                     |
| `release_validate` real            | `release_prepare` verde en dry-run                       |
| `release_execute` / deploy preview | `release_validate` GO + confirm explícito                |
| Cambio Prisma Provider (opción C)  | Post-staging, si sigue fricción operativa                |
| Commits FotoOffice / packages      | Rama wip o post-staging (opción B)                       |
| Vercel API real en prepare         | `dryRun: false` cuando se quiera audit real (sin deploy) |

### Qué NO tocar

| Item                                         | Motivo                                                 |
| -------------------------------------------- | ------------------------------------------------------ |
| `apps/compramelafoto/**`                     | Código CLF listo en HEAD                               |
| `apps/compramelafoto-workers/**`             | Idem                                                   |
| Proyecto Vercel legacy `compramelafoto`      | Catalog apunta a `compramelafoto-dnxsuite`             |
| Dominios productivos (`compramelafoto.com`)  | Legacy / NO TOCAR                                      |
| Variables de entorno en Vercel               | Fuera de alcance staging prep                          |
| DNS / Cloudflare                             | Fuera de alcance                                       |
| Deploy producción o preview real             | Requiere GO explícito posterior                        |
| Migraciones FotoOffice `202605*` en packages | Stashear, no aplicar a DB staging CLF sin coordinación |
| `schema.prisma`                              | Sin cambios pendientes en working tree                 |

---

## 5. Criterios de éxito (`release_prepare`)

| Métrica                  | Objetivo                               | Estado actual |
| ------------------------ | -------------------------------------- | ------------- |
| `git.dirtyTree`          | `false`                                | ✅            |
| `git.blockers`           | `[]`                                   | ✅            |
| `prisma.schemaValid`     | `true`                                 | ❌            |
| `postgres`               | objeto con `connected: true` (staging) | ❌ null       |
| `brain.score`            | ≥ 40                                   | ❌ 0          |
| `brain.shouldBlock`      | `false`                                | ❌ true       |
| `readyForValidation`     | `true`                                 | ❌ false      |
| `platform.vercelProject` | `compramelafoto-dnxsuite`              | ✅            |

---

## 6. Referencias

| Documento                                                                                    | Contenido                  |
| -------------------------------------------------------------------------------------------- | -------------------------- |
| [`compramelafoto-release-prepare-monorepo.md`](./compramelafoto-release-prepare-monorepo.md) | Resultado del dry-run base |
| [`compramelafoto-platform-catalog-update.md`](./compramelafoto-platform-catalog-update.md)   | `vercelProject` → dnxsuite |
| [`compramelafoto-staging-setup-checklist.md`](./compramelafoto-staging-setup-checklist.md)   | Env MCP completo           |
| Monorepo doc **33**                                                                          | Comandos stash exactos     |

---

_Plan de desbloqueo — actualizado tras stash Git + `allowedBranches`. Sin commit. Próximo paso: Prisma/PostgreSQL env._
