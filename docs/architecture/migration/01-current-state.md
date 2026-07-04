# 01 — Estado actual (congelamiento pre-migración CLF)

**Fecha de auditoría:** 2026-07-04  
**Rama:** `migration-legacy-clf-to-monorepo`  
**HEAD:** `39860e5` — *feat: modulo evaluaciones + prisma migration + UI inicial* (2026-04-29)  
**Base:** idéntica a `main` (0 commits de divergencia en ambas direcciones)  
**Stashes:** ninguno  

> Documento de **congelamiento**. No se ejecutaron commits ni se modificaron aplicaciones durante esta auditoría.  
> Plan operativo ampliado: [`../migration-plan.md`](../migration-plan.md).

---

## Resumen ejecutivo

El monorepo tiene **~135 entradas** en `git status` sin commitear, repartidas en cuatro frentes de producto/infra más artefactos de raíz. Ningún commit adicional existe en la rama de migración respecto a `main`: todo el trabajo está **en working tree**.

| Grupo | Entradas `git status` | Tracked diff | Untracked |
|-------|----------------------:|-------------:|----------:|
| **Arquitectura** (`docs/`, `tools/`) | 2 (+ ~88 archivos dentro) | 0 | ~88 |
| **FotoOffice** | 103 | 59 (52 M + 7 D) | 44 |
| **ComprameLaFoto** | 10 | 6 | 4 dirs |
| **Packages** | 15 | 1 | 14 |
| **Raíz / otros** | 4 | 2 | 2 junk |
| **FotoRank** | 1 | 1 | 0 |

**Diff agregado vs HEAD (tracked):** 69 archivos, **+2 591 / −945** líneas.

---

## Estado git detallado

```text
## migration-legacy-clf-to-monorepo
 M .gitignore
 M apps/compramelafoto/... (6 archivos)
 M apps/fotoffice/... (52 archivos)
 D apps/fotoffice/app/(shell)/admin/... (7 archivos)
 M apps/fotorank/next-env.d.ts
 M packages/db/prisma/schema.prisma
 M pnpm-lock.yaml
?? ._docs
?? ._tools
?? docs/
?? tools/
?? apps/compramelafoto/... (4 directorios nuevos)
?? apps/fotoffice/... (44 paths nuevos)
?? packages/auth-guards/
?? packages/db/prisma/migrations/... (12 carpetas)
```

### Artefactos a excluir del commit

| Path | Motivo |
|------|--------|
| `._docs`, `._tools` | Resource forks macOS; no versionar |
| `packages/auth-guards/node_modules/` | Dependencias locales; debe ir en `.gitignore` del paquete o no añadirse |
| `tools/architecture-mcp/package-lock.json` | Evaluar si el monorepo usa solo `pnpm-lock.yaml` raíz |
| `apps/fotoffice/public/uploads/workspace-branding/.../logo.png` | Upload de desarrollo; **no commitear** (añadir patrón a `.gitignore`) |

### Cambio en `.gitignore` (pendiente)

```diff
+.env*.local
```

---

## WIP por grupo

### 1. Arquitectura

**Propósito:** mapa del monorepo, dominios, registry, knowledge graph y herramientas MCP para análisis de impacto — **preparación de la migración**, no producto en runtime.

| Sub-área | Archivos | Estado |
|----------|----------|--------|
| `docs/architecture/` | 59 | Untracked completo |
| `tools/architecture-mcp/` | 29 (sin `node_modules`) | Untracked completo |

**Contenido destacado en `docs/architecture/`:**

- `README.md`, `architecture-map.md`, `knowledge-graph.md`
- `migration-plan.md` (plan operativo previo)
- `registry/` — `domains.json`, `products.json`, `services.json`, `workers.json`, `cron-jobs.json`, `packages.json`, `knowledge-graph.json` (440 nodos / 830 relaciones)
- `domains/*/` — 30+ dominios documentados (`albums`, `album-packs`, `members`, `payments`, …)
- `products/*/` — compramelafoto, fotoffice, fotorank, cuanto-cobro, cam-of-duty, shared

**Contenido en `tools/architecture-mcp/`:**

- CLI y registradores MCP: `analyze_domain`, `architecture_index`, `find_impact`, `dependency_graph`
- Generadores: `generate-architecture-registry.ts`, `generate-knowledge-graph.ts`
- Scripts npm: `index`, `graph`, `registry`, `knowledge-graph`

**Madurez:** documentación y tooling **listos para commit**; no bloquean migración CLF.

---

### 2. FotoOffice

**Propósito:** gran lote de features en progreso — workspaces por slug, módulo members, carnets v2, auth ampliada, admin de plataforma reubicado.

| Métrica | Valor |
|---------|------:|
| Modificados | 52 |
| Eliminados | 7 |
| Nuevos (directorios/archivos) | 44 paths |
| `package.json` | modificado |

#### Eliminados — admin bajo `(shell)/`

Movimiento conceptual hacia `app/(admin)/`:

- `apps/fotoffice/app/(shell)/admin/layout.tsx`
- `apps/fotoffice/app/(shell)/admin/page.tsx`
- `apps/fotoffice/app/(shell)/admin/owners/page.tsx`
- `apps/fotoffice/app/(shell)/admin/settings/page.tsx`
- `apps/fotoffice/app/(shell)/admin/users/page.tsx`
- `apps/fotoffice/app/(shell)/admin/workspace-modules/page.tsx`
- `apps/fotoffice/app/(shell)/admin/workspaces/page.tsx`

#### Nuevos — por sub-sistema

| Sub-sistema | Paths |
|-------------|-------|
| Admin plataforma | `app/(admin)/` |
| Auth / onboarding | `app/register/`, `app/forgot-password/`, `app/reset-password/`, `app/api/auth/` |
| Members | `app/(shell)/members/`, `app/w/[workspaceSlug]/members/`, `app/actions/member-*.ts`, `app/actions/members.ts`, `app/actions/card-requests.ts`, `components/members/`, `lib/members/` |
| Carnets v2 | `app/api/card-template-v2/`, `components/card-template-v2/`, `lib/card-template-v2/` |
| Workspaces slug | `app/w/[workspaceSlug]/courses/`, `dashboard/`, `evaluaciones/`, `settings/`, `(public)/` |
| Módulos / billing | `app/actions/module-activation.ts`, `workspace-plans.ts`, `module-locked/`, `lib/billing/`, `lib/onboarding.ts`, `lib/money.ts` |
| Branding | `lib/workspace-branding.ts`, `lib/workspace-branding/` |
| Shell | `components/shell/shell-app-layout.tsx`, `workspace-slug-shell-layout.tsx` |
| Otros | `teacher-applications`, `evaluation-contexts-view`, `public/uploads/` (1 PNG dev) |

#### Modificados — áreas tocadas

- Cursos presenciales y teachers (`app/(shell)/courses/*`, actions, forms)
- Dashboard shell (`layout`, `dashboard/*`, `evaluaciones`)
- Login y home (`app/login/*`, `app/page.tsx`)
- Cursos públicos workspace (`app/w/[workspaceSlug]/cursos/*`)
- Lib core: `auth.ts`, `workspace.ts`, `platform-admin.ts`, `fotoffice-roles.ts`
- Shell nav/header/sidebar, super-admin forms

**Madurez:** **WIP grande**, acoplado a migraciones en `packages/db`. No mezclar con import legacy CLF hasta estabilizar schema y rutas.

---

### 3. ComprameLaFoto

**Propósito:** experimentación local sobre **album packs** y **album mode** — paralela al schema unificado en `packages/db`, **no** al código legacy en producción (`~/Desktop/compramelafoto`, ~170 migraciones).

| Tipo | Archivos |
|------|----------|
| **Modificados** | `app/a/[id]/page.tsx`, `app/api/dashboard/albums/[albumId]/route.ts`, `app/dashboard/albums/[albumId]/page.tsx`, `components/photo/ClientAlbumView.tsx`, `prisma/schema.prisma`, `next-env.d.ts` |
| **Nuevos** | `app/api/dashboard/albums/[albumId]/packs/` (route + `[packId]/route`), `components/dashboard/album-packs/AlbumPacksSection.tsx`, `lib/album-packs/*` (4 archivos), `lib/albums/album-mode-options.ts` |

**Schema local:** `apps/compramelafoto/prisma/schema.prisma` **+46 líneas** (duplicación parcial respecto a `packages/db`).

**Madurez:** **stale / experimental**. La copia en monorepo (~67 migraciones locales históricas) ya delega runtime en `@repo/db` vía `lib/prisma.ts`, pero mantiene `prisma/` local. **Riesgo de divergencia** con legacy real y con FotoOffice (migraciones `album_pack` / `album_mode` en `packages/db`).

---

### 4. Packages

| Paquete | Cambio |
|---------|--------|
| `@repo/db` | `schema.prisma` **+340 líneas**; 12 migraciones nuevas |
| `@repo/auth-guards` | Paquete nuevo (`package.json`, `tsconfig.json`, `src/index.ts`) |

#### Migraciones nuevas en `packages/db/prisma/migrations/`

| Migración | Dominio |
|-----------|---------|
| `20260501110000_add_teacher_applications` | FotoOffice |
| `20260501114500_add_workspace_branding_colors` | FotoOffice |
| `20260501130000_add_members_registry` | FotoOffice / members |
| `20260501141000_add_membership_fees` | FotoOffice / members |
| `20260501143000_add_member_charges_payments` | FotoOffice / members |
| `20260501152000_add_member_cards` | FotoOffice / carnets |
| `20260501170500_add_card_template_v2` | FotoOffice / carnets |
| `20260501181000_add_card_requests` | FotoOffice / carnets |
| `20260501184500_add_member_card_validity` | FotoOffice / carnets |
| `20260502090000_card_templates_by_category` | FotoOffice / carnets |
| `20260502170000_add_album_pack_entity` | ComprameLaFoto |
| `20260502173500_album_pack_enums_and_constraints` | ComprameLaFoto |
| `20260502201000_add_album_mode` | ComprameLaFoto |

**Madurez:** migraciones **deben commitearse antes o junto con** FotoOffice WIP; las de album packs/mode anticipan CLF pero están en schema compartido suite-wide.

---

### 5. Raíz y FotoRank

| Archivo | Cambio |
|---------|--------|
| `.gitignore` | `+.env*.local` |
| `pnpm-lock.yaml` | +154 líneas (nuevas deps, p. ej. `auth-guards`) |
| `apps/fotorank/next-env.d.ts` | Ajuste generado Next (ruido; commit separado o omitir) |

---

## Riesgos

| # | Riesgo | Severidad | Mitigación |
|---|--------|-----------|------------|
| R1 | **Working tree masivo sin commits** — pérdida o mezcla accidental | Alta | Ejecutar commits propuestos (abajo) antes de import legacy |
| R2 | **Doble fuente Prisma** — `apps/compramelafoto/prisma/` vs `packages/db` vs legacy Desktop | Alta | Archivar copia stale; import legacy limpio; una sola fuente `@repo/db` |
| R3 | **FotoOffice WIP + 12 migraciones** — deploy parcial rompe DB | Alta | Commitear schema+migrations como unidad; no deployar app sin migrar |
| R4 | **Album packs en monorepo ≠ producción CLF** | Media | Tratar WIP CLF como descartable o rebase sobre import legacy |
| R5 | **Upload dev en `public/uploads/`** | Media | Excluir del commit; gitignore |
| R6 | **Resource forks `._*`** | Baja | Ignorar / limpiar localmente |
| R7 | **`auth-guards/node_modules` untracked** | Baja | No `git add`; usar workspace pnpm |
| R8 | **Sin tag de pre-migración** | Media | Crear tag anotado tras commits de congelamiento (paso 02) |

### Dependencias cruzadas (auditoría)

- FotoOffice y FotoRank **no importan** código de `apps/compramelafoto`.
- Acoplamientos indirectos: scripts E2E raíz (`pnpm --filter compramelafoto`), tema CLF en `@repo/design-system`, schema unificado `packages/db`.

---

## Commits propuestos (orden exacto, NO ejecutados)

Cada bloque lista el mensaje y los paths para `git add`. Ejecutar en orden; revisar `git status` entre commits.

---

### Commit 1 — Arquitectura: documentación

```text
docs(architecture): mapa de dominios, registry y knowledge graph

Inventario del monorepo y grafo de conocimiento para guiar la migración
CLF legacy sin tocar runtime de aplicaciones.
```

```bash
git add docs/architecture/
# Incluye este archivo tras crearlo:
git add docs/architecture/migration/01-current-state.md
```

**Excluir:** nada dentro de `docs/` fuera de `architecture/` (no existe aún).

---

### Commit 2 — Arquitectura: herramientas MCP

```text
feat(tools): architecture-mcp para análisis de dominios e impacto

CLI y registradores MCP (analyze_domain, architecture_index, find_impact,
dependency_graph) más generadores de registry y knowledge graph.
```

```bash
git add tools/architecture-mcp/
# NO añadir: tools/architecture-mcp/package-lock.json si el repo estandariza solo pnpm-lock.yaml
```

---

### Commit 3 — Packages: auth-guards

```text
feat(packages): add @repo/auth-guards shared guards package
```

```bash
git add packages/auth-guards/package.json \
        packages/auth-guards/tsconfig.json \
        packages/auth-guards/src/
# NO: packages/auth-guards/node_modules/
```

---

### Commit 4 — Packages: schema y migraciones suite

```text
feat(db): schema unificado y migraciones members, carnets y album packs

Añade migraciones FotoOffice (members, fees, charges, card v2) y
anticipo CLF (album_pack, album_mode) en packages/db.
```

```bash
git add packages/db/prisma/schema.prisma \
        packages/db/prisma/migrations/20260501110000_add_teacher_applications/ \
        packages/db/prisma/migrations/20260501114500_add_workspace_branding_colors/ \
        packages/db/prisma/migrations/20260501130000_add_members_registry/ \
        packages/db/prisma/migrations/20260501141000_add_membership_fees/ \
        packages/db/prisma/migrations/20260501143000_add_member_charges_payments/ \
        packages/db/prisma/migrations/20260501152000_add_member_cards/ \
        packages/db/prisma/migrations/20260501170500_add_card_template_v2/ \
        packages/db/prisma/migrations/20260501181000_add_card_requests/ \
        packages/db/prisma/migrations/20260501184500_add_member_card_validity/ \
        packages/db/prisma/migrations/20260502090000_card_templates_by_category/ \
        packages/db/prisma/migrations/20260502170000_add_album_pack_entity/ \
        packages/db/prisma/migrations/20260502173500_album_pack_enums_and_constraints/ \
        packages/db/prisma/migrations/20260502201000_add_album_mode/
```

---

### Commit 5 — FotoOffice: reubicación admin

```text
refactor(fotoffice): mover admin de plataforma a app/(admin)

Elimina rutas bajo (shell)/admin y añade grupo (admin) dedicado.
```

```bash
git add apps/fotoffice/app/\(shell\)/admin/ \
        apps/fotoffice/app/\(admin\)/
```

---

### Commit 6 — FotoOffice: auth y registro

```text
feat(fotoffice): registro, recuperación de contraseña y OAuth Google
```

```bash
git add apps/fotoffice/app/register/ \
        apps/fotoffice/app/forgot-password/ \
        apps/fotoffice/app/reset-password/ \
        apps/fotoffice/app/api/auth/ \
        apps/fotoffice/lib/google-oauth.ts \
        apps/fotoffice/lib/security/ \
        apps/fotoffice/app/login/
```

---

### Commit 7 — FotoOffice: módulo members y carnets

```text
feat(fotoffice): members registry, fees, charges y card template v2
```

```bash
git add apps/fotoffice/app/\(shell\)/members/ \
        apps/fotoffice/app/w/\[workspaceSlug\]/members/ \
        apps/fotoffice/app/w/\[workspaceSlug\]/\(public\)/ \
        apps/fotoffice/app/actions/members.ts \
        apps/fotoffice/app/actions/member-cards.ts \
        apps/fotoffice/app/actions/member-charges.ts \
        apps/fotoffice/app/actions/member-fees.ts \
        apps/fotoffice/app/actions/card-requests.ts \
        apps/fotoffice/app/api/card-template-v2/ \
        apps/fotoffice/components/members/ \
        apps/fotoffice/components/card-template-v2/ \
        apps/fotoffice/components/admin/ \
        apps/fotoffice/lib/members/ \
        apps/fotoffice/lib/card-template-v2/ \
        apps/fotoffice/lib/money.ts
```

---

### Commit 8 — FotoOffice: workspaces, módulos y shell

```text
feat(fotoffice): rutas por workspace slug, módulos y shell layouts
```

```bash
git add apps/fotoffice/app/w/\[workspaceSlug\]/courses/ \
        apps/fotoffice/app/w/\[workspaceSlug\]/dashboard/ \
        apps/fotoffice/app/w/\[workspaceSlug\]/evaluaciones/ \
        apps/fotoffice/app/w/\[workspaceSlug\]/settings/ \
        apps/fotoffice/app/w/\[workspaceSlug\]/page.tsx \
        apps/fotoffice/app/w/\[workspaceSlug\]/cursos/ \
        apps/fotoffice/app/\(shell\)/dashboard/module-locked/ \
        apps/fotoffice/app/actions/module-activation.ts \
        apps/fotoffice/app/actions/workspace-plans.ts \
        apps/fotoffice/app/actions/teacher-applications.ts \
        apps/fotoffice/components/module-activation-request-form.tsx \
        apps/fotoffice/components/module-locked-screen.tsx \
        apps/fotoffice/components/workspace-plan-apply.tsx \
        apps/fotoffice/components/public-teacher-application-form.tsx \
        apps/fotoffice/components/shell/ \
        apps/fotoffice/lib/billing/ \
        apps/fotoffice/lib/onboarding.ts \
        apps/fotoffice/lib/workspace-branding.ts \
        apps/fotoffice/lib/workspace-branding/ \
        apps/fotoffice/lib/teacher-applications/ \
        apps/fotoffice/lib/courses-sales/slug-context.ts
```

---

### Commit 9 — FotoOffice: cursos, evaluaciones y ajustes restantes

```text
feat(fotoffice): cursos, evaluaciones, settings y integración workspace
```

```bash
git add apps/fotoffice/app/\(shell\)/ \
        apps/fotoffice/app/actions/ \
        apps/fotoffice/app/dashboard/ \
        apps/fotoffice/app/page.tsx \
        apps/fotoffice/components/course-form-wizard.tsx \
        apps/fotoffice/components/fotoffice-home-entry.tsx \
        apps/fotoffice/components/module-settings-form.tsx \
        apps/fotoffice/components/page-header.tsx \
        apps/fotoffice/components/presential-courses/ \
        apps/fotoffice/components/super-admin-forms.tsx \
        apps/fotoffice/components/teacher-form.tsx \
        apps/fotoffice/components/workspace-module-toggle.tsx \
        apps/fotoffice/components/evaluaciones/ \
        apps/fotoffice/lib/auth.ts \
        apps/fotoffice/lib/fotoffice-roles.ts \
        apps/fotoffice/lib/platform-admin.ts \
        apps/fotoffice/lib/workspace.ts \
        apps/fotoffice/package.json
# NO: apps/fotoffice/public/uploads/
```

> **Nota:** el `git add` del commit 9 puede solaparse con paths ya añadidos en 5–8; Git deduplica. Alternativa más simple: un único commit `feat(fotoffice): workspace members and platform WIP` con `git add apps/fotoffice/` excluyendo `public/uploads/`.

---

### Commit 10 — ComprameLaFoto: WIP album packs (marcar como experimental)

```text
wip(compramelafoto): album packs y album mode (experimental, pre-legacy)

Cambios locales sobre copia stale del monorepo; no refleja producción legacy.
Revisar o descartar tras import desde ~/Desktop/compramelafoto.
```

```bash
git add apps/compramelafoto/app/a/\[id\]/page.tsx \
        apps/compramelafoto/app/api/dashboard/albums/\[albumId\]/route.ts \
        apps/compramelafoto/app/api/dashboard/albums/\[albumId\]/packs/ \
        apps/compramelafoto/app/dashboard/albums/\[albumId\]/page.tsx \
        apps/compramelafoto/components/photo/ClientAlbumView.tsx \
        apps/compramelafoto/components/dashboard/ \
        apps/compramelafoto/lib/album-packs/ \
        apps/compramelafoto/lib/albums/ \
        apps/compramelafoto/prisma/schema.prisma
# Opcional omitir: apps/compramelafoto/next-env.d.ts
```

---

### Commit 11 — Raíz: ignore y lockfile

```text
chore: gitignore env local y actualizar pnpm-lock.yaml
```

```bash
git add .gitignore pnpm-lock.yaml
```

---

### Commit 12 (opcional) — FotoRank: ruido Next

```text
chore(fotorank): sync next-env.d.ts
```

```bash
git add apps/fotorank/next-env.d.ts
```

---

## Estrategia recomendada

### Fase A — Congelar (este documento)

1. ✅ Auditar rama `migration-legacy-clf-to-monorepo` (hecho).
2. ⬜ Ejecutar commits 1–11 en orden (usuario decide cuándo).
3. ⬜ Tag anotado: `clf/monorepo-pre-legacy-import` en HEAD post-commits.
4. ⬜ Añadir a `.gitignore`: `._*`, `apps/fotoffice/public/uploads/`, `packages/*/node_modules/` si aplica.

### Fase B — Archivar copia stale CLF

```bash
# Después de congelar commits; NO ejecutado aún
git mv apps/compramelafoto apps/_archive/compramelafoto-monorepo-stale-2026-07
# Placeholder mínimo en apps/compramelafoto para import posterior
```

### Fase C — Import legacy real

1. Copiar árbol desde `~/Desktop/compramelafoto` (fuente de verdad producción).
2. Reemplazar/adaptar `lib/prisma.ts` → `@repo/db` exclusivamente.
3. **No** reutilizar `prisma/` local del archive salvo para diff de migraciones.
4. Fusionar migraciones legacy (~170) en `packages/db` con estrategia de squash o baseline documentada en `02-legacy-import.md` (por crear).

### Fase D — Orden de prioridad entre productos

| Prioridad | Producto | Razón |
|-----------|----------|-------|
| 1 | `packages/db` | Bloquea todo |
| 2 | Arquitectura + tools | Sin riesgo runtime |
| 3 | FotoOffice WIP | Ya acoplado al schema nuevo |
| 4 | ComprameLaFoto | Reemplazar por legacy import; WIP actual probablemente descartable |

### Principios

- **Un schema:** `packages/db` es la única fuente de verdad post-migración.
- **Commits atómicos por dominio** facilitan revert y review.
- **No mezclar** import legacy CLF con FotoOffice WIP en un solo commit.
- **Congelar antes de mover** — este documento es la línea base.

---

## Checklist post-congelamiento

- [ ] `git status` limpio (salvo archivos ignorados)
- [ ] Tag `clf/monorepo-pre-legacy-import` creado
- [ ] CI verde en rama de migración
- [ ] `02-legacy-import.md` con plan de merge Prisma
- [ ] Confirmación: legacy Desktop accesible y versionado (tag/commit conocido)
- [ ] Decisión explícita: conservar o descartar WIP album packs del monorepo

---

## Referencias

| Recurso | Ubicación |
|---------|-----------|
| Plan operativo completo | [`docs/architecture/migration-plan.md`](../migration-plan.md) |
| Legacy producción | `~/Desktop/compramelafoto` |
| Schema suite | `packages/db/prisma/schema.prisma` |
| Copia stale monorepo | `apps/compramelafoto/` (pre-archivo) |
| Herramientas auditoría | `tools/architecture-mcp/` |

---

*Generado como paso 01 de la serie `docs/architecture/migration/`. Sin modificaciones a aplicaciones ni commits ejecutados.*
