# FOTOFFICE — Roles, etapa 2b: todos los módulos por nivel — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que ningún módulo del panel deje entrar a alguien "por ser del equipo": Caja, Clientes, Coberturas, Sitio web y Blog, Cursos, Evaluaciones, Captación, Portfolio y el diseñador y los permisos de carnets pasan a decidir por **nivel de módulo** y por **acción sensible**. Así la grilla de roles dice la verdad, y se quita el aviso provisorio de la etapa 2.

**Architecture:** Se amplía la tabla de compatibilidad de STAFF (para que el personal sin roles quede exactamente igual) y se agrega un catálogo de acciones sensibles (`cash.project_money`, `cash.configure`, `coverages.coordinate`) con una función `hasModuleAction`. Cada guarda pasa de "tiene rol" / "es dueño o admin" a `getModuleLevel` / `hasModuleAction`. Configuración, Integraciones, Cobros (Mercado Pago), Palabras y Comisión directiva **siguen** siendo sólo de dueño y admins.

**Tech Stack:** Next.js 16.2 (leer `apps/fotoffice/node_modules/next/dist/docs/`), Prisma 6, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-02-fotoffice-roles-comision-directiva-design.md` (§4, §9, §12.1.2, §12.5). Inventario de guardas del 03/10 en este plan (Task 0).

## Global Constraints

- Rama `feat/fotoffice-roles-etapa-2b`, apilada sobre `feat/fotoffice-roles-etapa-2` (PR 327). Worktree `/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite-wt-roles-2b`. PR con base `feat/fotoffice-roles-etapa-2`.
- **Nadie que no tenga roles cambia de acceso**: dueño/admin → todo (niveles y acciones); STAFF sin roles → la tabla de compatibilidad reproduce lo de hoy, guarda por guarda.
- Quien tuvo roles ve sólo lo que su grilla dice (regla §12.3, ya vigente).
- Sólo dueño y admins, siempre: datos de la institución, palabras, integraciones, Mercado Pago (`canManageWorkspaceCollection`), Comisión directiva, configuración de Cursos (`updateCoursesSalesSettingsAction`).
- Las acciones sensibles sólo valen con nivel `MANAGE` en su módulo.
- Sin migración de base en esta etapa.
- Build con `NODE_OPTIONS=--max-old-space-size=8192`; chequea tipos de tests. Archivos `"use server"` sólo exportan funciones async.
- Commits en español terminados con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Task 0 (hecho por el controlador): inventario

Guardas que hoy dejan pasar a cualquiera del equipo (o sin rol) y su compatibilidad para STAFF sin roles:

| Módulo | Hoy STAFF | Hoy sólo dueño/admin | Compatibilidad STAFF | Acción sensible |
|---|---|---|---|---|
| `cash` | ver libro, movimientos, anular, pases, turnos, reportes | cuentas, categorías, activar Caja, `/caja/configuracion` | `MANAGE` | `cash.configure` (cuentas, categorías, activar) · `cash.project_money` (Gobierno, sin uso aún) |
| `clients` | listar, crear, editar, desactivar | — | `MANAGE` | — |
| `coverages` | bandeja, notas, pedir info, pasar a evaluación | aprobar, rechazar, cerrar, ajustes, colaboradores, generar, asignar equipo, convocatoria | `MANAGE` | `coverages.coordinate` |
| `website` | ver pantallas del CMS (sin editar) | publicar, guardar bloques/SEO/colores, blog, subir imágenes | `VIEW` | — |
| `courses-sales` | todo (no había control de rol) | configuración de cursos (sigue dueño/admin) | `MANAGE` | — |
| `evaluaciones` | todo (no había control de rol) | — | `MANAGE` | — |
| `service-leads` | todo (no había control de rol **ni de módulo**) | contador de pedidos en el inicio | `MANAGE` | — |
| `portfolio` | — | ocultar o publicar portfolios | `NONE` | — |
| `members` (carnets) | según `MemberCardOperator` | diseñador, emitir, todas las capacidades | ya `VIEW` | — (el diseñador y las capacidades completas pasan a `MANAGE`) |

**Dato de producción (sólo lectura, 03/10):** "DNX Estudio" tiene 2 formularios de Captación con el módulo `service-leads` **apagado**. Al agregar el control de módulo dejarían de verse. El PR incluye el SQL para encenderlo (Task 7).

---

### Task 1: Compatibilidad ampliada, catálogo de acciones y `hasModuleAction`

**Files:**
- Modify: `apps/fotoffice/lib/permissions/levels.ts` (+ test), `apps/fotoffice/lib/permissions/module-access.ts` (+ test)
- Create: `apps/fotoffice/lib/permissions/actions.ts` (+ test)
- Modify: `apps/fotoffice/lib/commission/templates.ts` (+ test), `apps/fotoffice/lib/commission/validation.ts` (+ test)

**Interfaces — Produces:**
- `MODULE_ACTIONS: Readonly<Record<string, readonly { key: string; label: string; description: string }[]>>` en `actions.ts`:
  - `cash`: `cash.configure` ("Configurar Caja": cuentas, categorías y encender el módulo) y `cash.project_money` ("Plata de proyectos": reservar, gastar e ingresar plata de proyectos de Gobierno). La constante `CASH_PROJECT_MONEY_ACTION` se mueve acá y `templates.ts` la reexporta.
  - `coverages`: `coverages.coordinate` ("Coordinar coberturas": aprobar, rechazar, cerrar, asignar equipo, convocatorias y ajustes).
- `isKnownAction(moduleKey: string, action: string): boolean`
- `resolveModuleAction(input: { moduleKey: string; action: string; moduleEnabled: boolean; workspaceRole: string | null; assignments: readonly RoleAssignmentForLevels[]; now: Date }): boolean` (pura, en `levels.ts`): módulo apagado o sin rol → false; dueño/admin → true; con asignaciones (cualquiera) → true si alguna **vigente** tiene ese módulo en `MANAGE` con la acción en `actions`; sin asignaciones nunca → false (STAFF sin roles no tiene acciones sensibles, igual que hoy).
- `RoleAssignmentForLevels.permissions[]` suma `actions: readonly string[]` (ya viene de la base: `select` de `actions` en `loadAssignments`).
- `hasModuleAction(userId: number, workspaceId: string, moduleKey: string, action: string): Promise<boolean>` en `module-access.ts`, sobre el mismo `loadLevelInputs` cacheado.
- `LEGACY_STAFF_LEVELS` suma: `cash: "MANAGE"`, `clients: "MANAGE"`, `coverages: "MANAGE"`, `website: "VIEW"`, `courses-sales: "MANAGE"`, `evaluaciones: "MANAGE"`, `service-leads: "MANAGE"`, `portfolio: "NONE"` (con un comentario por línea diciendo de qué guarda sale).
- `manageFlagFor` deja de necesitar `adminFallback` para estos módulos (siguen en la tabla); conservar la firma.
- `parsePermissionGrid` descarta acciones que no estén en el catálogo de su módulo (`isKnownAction`).
- Plantilla Tesorería: `cash` `MANAGE` con `[CASH_PROJECT_MONEY_ACTION, "cash.configure"]`.

- [ ] **Step 1:** Pruebas (RED) para: compatibilidad nueva (un `it.each` por módulo con el valor de la tabla de Task 0); `resolveModuleAction` (dueño/admin true; STAFF sin roles false; rol vigente con `MANAGE` + acción true; con `VIEW` + acción false; acción en rol vencido false; módulo apagado false); `hasModuleAction` con base simulada; `parsePermissionGrid` descarta `action:cash:inventada`; plantilla Tesorería trae las dos acciones; `isKnownAction`.
- [ ] **Step 2:** Implementar. Correr `pnpm --filter fotoffice exec vitest run lib/permissions lib/commission` → PASS.
- [ ] **Step 3:** Commit — `Catálogo de acciones sensibles y compatibilidad de personal para todos los módulos`.

---

### Task 2: Caja y Clientes

**Files:** `apps/fotoffice/lib/cash/access.ts`, `apps/fotoffice/lib/clients/access.ts` (+ tests nuevos), sus llamadores en `apps/fotoffice/app/(shell)/caja/**` y `apps/fotoffice/app/(shell)/clientes/**` (o donde estén las acciones de clientes).

**Interfaces — Produces:**
- Caja: `requireCashViewer()` (VIEW; layout y páginas de consulta), `requireCashOperator()` (MANAGE; abrir/cerrar turno, cargar y anular movimientos, pases), `requireCashConfigurer()` (MANAGE + `cash.configure`; cuentas, categorías, activar Caja, `/caja/configuracion`). Devuelven `{ user, workspace, level, canOperate, canConfigure }`. Se borran `requireCashStaff`/`requireCashAdmin`.
- Clientes: `requireClientsViewer()` (VIEW; listado y ficha) y `requireClientsEditor()` (MANAGE; crear, editar, desactivar). Se borran `requireClientsStaff`/`requireClientsAdmin`.
- Redirecciones: sin workspace → `/workspace`; sin nivel → `/dashboard`; con nivel insuficiente → la portada del módulo (`/caja`, `/clientes`).

- [ ] **Step 1:** Tests de guardas al estilo de `lib/raffles/access.test.ts` (mockear `getModuleLevel` y `hasModuleAction`): NONE afuera, VIEW ve y no opera, MANAGE opera y no configura sin la acción, MANAGE + `cash.configure` configura.
- [ ] **Step 2:** Implementar y reemplazar cada llamador según su operación (tabla de Task 0). En las páginas de consulta, ocultar formularios y botones de operación cuando `!canOperate`, y el enlace a configuración cuando `!canConfigure` (`caja/page.tsx` hoy usa `canManageWorkspaceSettings(role)`: pasa a `canConfigure`).
- [ ] **Step 3:** `pnpm --filter fotoffice test` → PASS. Commit — `Caja y Clientes deciden por nivel y por acción`.

---

### Task 3: Coberturas

**Files:** `apps/fotoffice/lib/coverages/access.ts`, `apps/fotoffice/lib/coverages/access-policy.ts` (+ tests), `apps/fotoffice/app/(shell)/coberturas/**`.

**Interfaces — Produces:** `requireCoveragesViewer()` (VIEW: bandeja y fichas), `requireCoveragesReviewer()` (MANAGE: notas, pedir información, pasar a evaluación), `requireCoveragesCoordinator()` (MANAGE + `coverages.coordinate`). Devuelven `{ user, workspace, level, canReview, canCoordinate }`. `canCoordinateCoverages(role)` y `canReviewCoverages(role)` dejan de usarse para decidir acceso (borrar si quedan sin uso; conservar `transitionNeedsCoordinator`). Las pantallas `coberturas/[id]` y `coberturas/c/[coverageId]` usan `canCoordinate`/`canReview` del contexto.

- [ ] **Step 1:** Tests de guardas (NONE / VIEW / MANAGE / MANAGE + coordinate).
- [ ] **Step 2:** Implementar; las páginas de consulta usan Viewer y esconden lo que no corresponde.
- [ ] **Step 3:** Tests completos → PASS. Commit — `Coberturas deciden por nivel y por acción de coordinación`.

---

### Task 4: Sitio web, Blog e imágenes

**Files:** `apps/fotoffice/lib/website/page-context.ts`, `apps/fotoffice/app/actions/website.ts` (+ test existente), `apps/fotoffice/lib/blog/access.ts`, `apps/fotoffice/lib/images/access.ts` (+ test), `apps/fotoffice/lib/workspace.ts` (`requireWebsiteContext`).

**Reglas:** pantallas del CMS → `website` VIEW (sin nivel: `/dashboard`); `canEdit` = `website` MANAGE; `assertCanManageWebsite` = `website` MANAGE; blog (páginas y las 23 rutas API vía `requireBlogEditor`/`requireBlogEditorApi`) = `website` MANAGE; `requireImageUploadContext` = dueño/admin **o** `website` MANAGE (el logo de la institución sigue funcionando para dueño/admin).

- [ ] **Step 1:** Ajustar/crear tests: `website.test.ts` con nivel en vez de rol; imágenes: STAFF sin roles sigue sin subir (compatibilidad `VIEW`), rol con `website` MANAGE sube.
- [ ] **Step 2:** Implementar. Tests completos → PASS. Commit — `Sitio web, blog e imágenes deciden por nivel`.

---

### Task 5: Cursos, Evaluaciones, Captación, Portfolio y carnets

**Files:** `apps/fotoffice/lib/workspace.ts` (`requireModuleContext`, `requireCoursesSalesContext`, `requireEvaluacionesContext`), los archivos de acciones de cursos y evaluaciones, `apps/fotoffice/app/dashboard/service-leads/**`, `apps/fotoffice/lib/portfolio/admin-access.ts`, `apps/fotoffice/lib/template-v2/access.ts` + `server.ts`, `apps/fotoffice/app/(shell)/members/disenador/page.tsx`, `apps/fotoffice/app/(editor)/members/disenador/[templateId]/[versionId]/page.tsx`, `apps/fotoffice/app/actions/carnet-template.ts`, `apps/fotoffice/lib/carnet/operators.ts`.

**Reglas:**
- `requireModuleContext(moduleKey, minimum: "VIEW" | "MANAGE" = "VIEW")`: además del módulo encendido, exige el nivel (sin nivel → `/dashboard`). Las **páginas** usan VIEW; **cada acción** de cursos y evaluaciones (archivos `"use server"`) llama con `"MANAGE"` (agregar el parámetro o una variante `requireCoursesSalesManager()` / `requireEvaluacionesManager()`).
- `updateCoursesSalesSettingsAction` sigue sólo dueño/admin (no tocar).
- Captación: crear `requireServiceLeadsContext(minimum)` sobre `requireModuleContext("service-leads", …)`; páginas VIEW, acciones MANAGE.
- Portfolio: `resolvePortfolioAdminContext` = `portfolio` MANAGE.
- Diseñador de carnets y `createCarnetTemplateAction` y `setTemplateV2Runtime.requireUser`: `members` MANAGE (reemplaza `canDesignTemplates(role)`).
- `resolveCardCapabilities`: las tres capacidades para `members` MANAGE (en vez de dueño/admin); el resto sigue por `MemberCardOperator`. Quitar la lectura de la tabla legacy `Membership`.

- [ ] **Step 1:** Tests: `requireModuleContext` con VIEW/MANAGE y módulo apagado; una acción de cursos con nivel VIEW es rechazada; Captación con módulo apagado → afuera; portfolio y diseñador por nivel; capacidades de carnet con `members` MANAGE.
- [ ] **Step 2:** Implementar. Tests completos → PASS. Commit — `Cursos, evaluaciones, captación, portfolio y carnets deciden por nivel`.

---

### Task 6: Menú, inicio y quitar el aviso provisorio

**Files:** `apps/fotoffice/components/shell/admin-shell.tsx`, `shell-sidebar.tsx`, `shell-nav.tsx`, `apps/fotoffice/app/workspace/page.tsx`, `apps/fotoffice/lib/workspace-home/load.ts`, `apps/fotoffice/app/workspace/configuracion/comision/**` (aviso), `apps/fotoffice/app/workspace/configuracion/comision/roles/[roleId]` (grilla), `apps/fotoffice/lib/workspace-role-consistency.test.ts`.

**Reglas:**
- `ShellNav` recibe los niveles (`levels: ModuleLevels`) en vez de banderas sueltas por módulo: un módulo aparece si está encendido **y** su nivel es al menos `VIEW`; sus subítems de gestión, si es `MANAGE` (y, para Coberturas, la acción de coordinar cuando el subítem es de coordinación; para Caja, `cash.configure` en "Configuración"). "Blog" con `website` MANAGE. La sección "Institución" sigue con `canManageWorkspaceSettings`. Pasar también un `Set` de acciones vigentes que el menú necesite (`cash.configure`, `coverages.coordinate`), calculado en el servidor.
- `app/workspace/page.tsx`: tarjetas sólo de módulos con nivel ≥ `VIEW`; `canManage` por `levels[m.key] === "MANAGE"`.
- `workspace-home/load.ts`: cada widget por nivel ≥ `VIEW` de su módulo (hoy usa `role` truthy, incluido Reservas y Sorteos ya migrados); el contador de pedidos de Captación con `service-leads` ≥ `VIEW`.
- Grilla del editor de roles: por cada módulo con acciones en `MODULE_ACTIONS`, una casilla por acción (etiqueta y descripción del catálogo), visibles sólo con Gestionar. Reemplaza la casilla suelta de "Plata de proyectos".
- Quitar el aviso provisorio de la etapa 2 (`aviso-acceso.tsx` y sus usos).
- Invariantes en `workspace-role-consistency.test.ts`: el menú recibe niveles de `getModuleLevels`; y un test nuevo que lista los archivos fuera de Configuración/Comisión/Mercado Pago que todavía llaman a `canManageWorkspaceSettings`, `canManageMembers`, `canDesignTemplates` o `canCoordinateCoverages`: la lista permitida es sólo `app/workspace/configuracion/**`, `app/api/integrations/**`, `lib/payments/connect/authz.ts`, `lib/commission/access.ts`, `app/actions/settings.ts`, `app/onboarding/**`, `components/shell/admin-shell.tsx` (para la sección Institución) y las propias definiciones.

- [ ] **Step 1:** Tests de invariantes (RED).
- [ ] **Step 2:** Implementar. `pnpm --filter fotoffice test` y build → PASS. Commit — `El menú y el inicio muestran sólo lo que cada rol puede ver`.

---

### Task 7: Verificación y PR apilado

- [ ] Tests, build (`NODE_OPTIONS=--max-old-space-size=8192 … pnpm --filter fotoffice build`), eslint de archivos tocados.
- [ ] Push y PR con base `feat/fotoffice-roles-etapa-2`. En el cuerpo: tabla de Task 0; que el aviso provisorio se fue; **SQL previo a fusionar** (no hay migración, sólo un dato):

```sql
-- DNX Estudio usa Captación con el módulo apagado: sin esto, sus 2 formularios dejan de verse.
INSERT INTO "WorkspaceFeatureModule" ("id", "workspaceId", "moduleKey", "enabled", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, w.id, 'service-leads', true, now(), now()
FROM "Workspace" w WHERE w.name = 'DNX Estudio'
ON CONFLICT ("workspaceId", "moduleKey") DO UPDATE SET "enabled" = true, "updatedAt" = now();
```

(verificar antes los nombres de columnas de `WorkspaceFeatureModule` en `schema.prisma` y ajustar el SQL a ellos).
- [ ] Prueba sugerida tras desplegar: con una cuenta de prueba con sólo el rol "Comunicación", confirmar que no ve Caja, Clientes, Cursos ni Captación.
