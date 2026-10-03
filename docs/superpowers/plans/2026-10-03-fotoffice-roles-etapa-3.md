# FOTOFFICE — Roles, etapa 3: selector "Portal ⇄ Administración" — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Un socio que además integra el equipo de SU MISMA institución (por ejemplo, la tesorera) entra al portal como siempre y pasa al panel con un botón "Administración" en el encabezado; desde el panel vuelve con "Portal del socio". Al iniciar sesión no se le pregunta nada si todos sus perfiles son de una sola institución.

**Architecture:** Lógica pura en `lib/portal/profiles.ts` (a dónde entra y cuál es la "contraparte" de un perfil en la misma institución) + dos acciones de servidor que recalculan los perfiles reales antes de cambiar. El cambio a Administración además fija la institución activa del panel (cookie `FOTOFFICE_WORKSPACE_COOKIE`). La elección se recuerda con la cookie existente `fotoffice_perfil`. Ninguna cookie da permisos: cada ruta sigue autorizando sola.

**Spec:** `docs/superpowers/specs/2026-10-02-fotoffice-roles-comision-directiva-design.md` §7 y §12.5 (etapa 3).

## Global Constraints

- Worktree `/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite-wt-roles-3`, rama `feat/fotoffice-roles-etapa-3` desde `origin/main` (1bcaa65d). PR contra `main`.
- Next.js 16.2: leer `apps/fotoffice/node_modules/next/dist/docs/` antes de tocar acciones, cookies o layouts. Archivos `"use server"` sólo exportan funciones async.
- No cambiar permisos: elegir perfil decide A DÓNDE se entra, no QUÉ se puede hacer.
- La puerta de institución (`/w/<slug>/entrar`), las invitaciones y la continuidad de invitación siguen teniendo prioridad sobre el selector, como hoy.
- `/elegir-perfil` sigue existiendo para quien tiene perfiles en **más de una** institución.
- Textos en español rioplatense; "socio" sale del vocabulario configurable (`loadPersonVocabulary`).
- Build con `NODE_OPTIONS=--max-old-space-size=8192`; chequea tipos de tests.
- Commits en español terminados con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: La lógica de entrada y de cambio

**Files:** `apps/fotoffice/lib/portal/profiles.ts` (+ `profiles.test.ts`), `apps/fotoffice/lib/post-login.ts` (+ tests), `apps/fotoffice/app/actions/profile-choice.ts` (+ test nuevo), nuevo `apps/fotoffice/lib/workspace-cookie.ts` (helper `setActiveWorkspaceCookie(workspaceId)` extraído de `app/actions/workspace.ts`, que pasa a usarlo).

**Interfaces — Produces:**
- `resolveEntryProfile(profiles: UserProfile[], rememberedKey: string | null): { kind: "none" } | { kind: "ask" } | { kind: "go"; profile: UserProfile }` (pura):
  - sin perfiles → `none`;
  - todos los perfiles de UNA sola institución → `go` con el recordado si sigue siendo válido; si no, el de socio (`MEMBER`) si existe; si no, el de equipo (`TEAM`);
  - perfiles en más de una institución → `go` con el recordado válido; si no, `ask`.
- `counterpartProfile(profiles: UserProfile[], current: { kind: "TEAM" | "MEMBER"; workspaceId: string }): UserProfile | null` (pura): el perfil del otro tipo en la misma institución.
- `hasProfilesInSeveralWorkspaces(profiles): boolean` (pura), para decidir si se muestra el selector general.
- `switchToAdminAction(formData)` y `switchToPortalAction(formData)` en `app/actions/profile-choice.ts`: leen `workspaceId` del formulario, recalculan `listUserProfiles(user.id)`, buscan el perfil del tipo pedido en ESA institución (si no existe → `redirect` a la portada del perfil actual sin cambiar nada), guardan `setProfileChoice(profileKey(perfil))` y redirigen: a Administración → `setActiveWorkspaceCookie(workspaceId)` + `/workspace`; al portal → `PORTAL_HOME`.
- `lib/post-login.ts`: reemplazar el bloque de `needsProfileChoice` por `resolveEntryProfile`: `ask` → `/elegir-perfil`; `go` MEMBER → portal; `go` TEAM → sigue el camino normal pero fijando la institución elegida como activa (devolver `workspaceId` del perfil para que el login fije la cookie, como ya hace con `ensured.workspaceId`). `needsProfileChoice` se borra si queda sin uso.

- [ ] **Step 1:** Pruebas (RED): `resolveEntryProfile` (0 perfiles; sólo MEMBER; sólo TEAM; TEAM+MEMBER misma institución sin recordado → MEMBER; con recordado TEAM válido → TEAM; recordado de otra institución que ya no tiene → MEMBER; dos instituciones sin recordado → ask; dos instituciones con recordado válido → go); `counterpartProfile`; las dos acciones (perfil ajeno → no cambia nada; cambio a Administración fija las dos cookies y redirige a `/workspace`; al portal fija la de perfil y va a `PORTAL_HOME`); `post-login` con TEAM+MEMBER misma institución ya no va a `/elegir-perfil`.
- [ ] **Step 2:** Implementar. `pnpm --filter fotoffice test` → PASS.
- [ ] **Step 3:** Commit — `Entrar sin preguntar cuando todos los perfiles son de una institución, y cambiar entre portal y panel`.

---

### Task 2: Los botones en los dos encabezados

**Files:** `apps/fotoffice/app/portal/layout.tsx`, `apps/fotoffice/components/portal/portal-shell.tsx`, `apps/fotoffice/components/shell/admin-shell.tsx`, `apps/fotoffice/components/shell/shell-header.tsx`.

**Reglas:**
- Portal: si `counterpartProfile(perfiles, { kind: "MEMBER", workspaceId: context.workspace.id })` existe, el encabezado muestra el botón **"Administración"** (ícono + texto; en teléfono, el ícono con `aria-label`), un `<form action={switchToAdminAction}>` con `workspaceId` oculto.
- Panel: si existe la contraparte `MEMBER` de la institución activa, el encabezado muestra **"Portal del {socio}"** (vocabulario) con `<form action={switchToPortalAction}>`.
- El botón general "Cambiar de perfil" (ícono `Repeat`) sólo aparece si `hasProfilesInSeveralWorkspaces(perfiles)`.
- Sin colores ni dependencias nuevas; mismas clases `fo-*` / `--fo-*` del encabezado; usable a ancho de teléfono.

- [ ] **Step 1:** Implementar. Si hay tests de los encabezados o del layout, ajustarlos; agregar un test de la decisión (función pura que devuelva qué botones mostrar a partir de perfiles + institución activa, en `lib/portal/profiles.ts`) para no probar componentes.
- [ ] **Step 2:** Tests + build → PASS. Commit — `Botones Administración y Portal del socio en los encabezados`.

---

### Task 3: Publicar

- [ ] Tests, build y eslint de lo tocado.
- [ ] Push, PR contra `main`, fusionar (pedido explícito de Daniel: "aplicá todo directamente en producción") y verificar el deploy de producción en Vercel (`vercel ls fotoffice-dnxsuite --scope compramelafotos-projects`) hasta `Ready`, y que `https://fotoffice.com/login` responda 200.
- [ ] Sin SQL en esta etapa.
