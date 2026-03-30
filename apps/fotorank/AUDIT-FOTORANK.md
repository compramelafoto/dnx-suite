# Auditoría técnica — `apps/fotorank`

**Alcance:** aplicación Next.js (App Router) dentro del monorepo DNX Suite.  
**Paquetes relacionados:** `@repo/db` (Prisma), `@repo/auth` (sesión suite `UserSession`), `@repo/design-system`.  
**Fecha de auditoría:** revisión estática del código en repo (sin ejecución).

---

## Resumen ejecutivo

- **Autenticación organizador/admin:** cookie httpOnly `dnx_session` + filas en `UserSession` (token SHA-256), implementado en `app/lib/auth.ts` y `packages/auth/src/index.ts`. Login por email/contraseña sobre el modelo global `User` (`app/login/actions.ts`).
- **Autenticación jurado:** sistema **separado**: cookie `dnx_judge_session` + `FotorankJudgeSession` / `FotorankJudgeAccount` (`app/lib/judge-auth.ts`). No comparte cookie ni tabla con el login de organizador.
- **Autorización en panel:** no hay middleware global. La protección es **por layout/páginas RSC** (`requireAuth` / `requireJudgeAuth`) y **server actions** que vuelven a llamar a esos helpers. El rol a nivel organización (`FotorankOrganizationRole` en `ContestOrganizationMember`) se **expone** en `getUserOrganizations` pero el sidebar del dashboard **fija** roles UI como `["admin"]` (`DashboardLayout.tsx` L97–99), sin enlazar al rol real de BD.
- **Riesgos:** divergencia schema/código (`FotorankAdminSession` en Prisma sin uso en esta app); permisos de org no aplicados de forma uniforme en UI; cookies con distinto criterio de `domain` (organizador vs jurado vs org activa); dependencia fuerte de tablas Fotorank en el layout del dashboard (`bootstrapFotorankProfile`, `ContestOrganizationMember`).

---

## Arquitectura auth actual

### Organizador / “admin” Fotorank (modelo `User` + `UserSession`)

| Componente | Archivo | Líneas / notas |
|------------|---------|----------------|
| Lectura sesión | `app/lib/auth.ts` | L53–60: cookie `DNX_SESSION_COOKIE` (`dnx_session` desde `@repo/auth` L4); `getSessionUserByRawToken` |
| Fallback dev | `app/lib/auth.ts` | L67–78: cookie legada `dnx_auth` + `userId` en claro **solo** si `NODE_ENV !== "production"` |
| Exigir sesión | `app/lib/auth.ts` | L87–90: `requireAuth` → `redirect("/login")` |
| Crear sesión | `app/lib/auth.ts` | L96–103: `createUserSession` + `cookies().set` con `SESSION_COOKIE_OPTIONS` (incl. `COOKIE_DOMAIN` L20, L31–36) |
| Limpieza otras cookies suite | `app/lib/auth.ts` | L114–134: al logout también limpia `auth-token` (ComprameLaFoto) L130–134 |
| Paquete compartido | `packages/auth/src/index.ts` | L11–29 `createUserSession`; L32–49 `getSessionUserByRawToken` sobre `UserSession` |

### Jurado (modelo `FotorankJudgeAccount` + `FotorankJudgeSession`)

| Componente | Archivo | Líneas / notas |
|------------|---------|----------------|
| Cookie | `app/lib/judge-auth.ts` | L7: `dnx_judge_session`; L10 legado `dnx_judge_auth` |
| Lectura / expiración | `app/lib/judge-auth.ts` | L28–68: `findUnique` por `tokenHash`; borra sesión si expiró L51–52; si cuenta no `ACTIVE` limpia sesiones L58–60 |
| Exigir sesión | `app/lib/judge-auth.ts` | L71–75: `redirect("/jurado/login")` o `?blocked=1` |
| Set cookie | `app/lib/judge-auth.ts` | L96–102: **sin** `domain` (host-only); `secure: NODE_ENV === "production"` (L98) — distinto a organizador que usa `VERCEL`/`APP_URL` en `auth.ts` L26–29 |

### Separación organizador vs jurado

- **Tablas distintas:** `User` / `UserSession` vs `FotorankJudgeAccount` / `FotorankJudgeSession`.
- **Cookies distintas:** `dnx_session` vs `dnx_judge_session`.
- **Landing:** `app/page.tsx` L16–17 resuelve **ambas** sesiones en paralelo para el header (`hasAdminSession`, `hasJudgeSession`).

---

## Modelos Prisma relevantes

Definidos en `packages/db/prisma/schema.prisma` (líneas aproximadas):

| Modelo / enum | Línea ~ | Uso en Fotorank |
|----------------|---------|------------------|
| `User` | L11+ | Login organizador; relaciones Fotorank (`fotorankProfile`, `frContestOrgMemberships`, etc.) L133–143 |
| `UserSession` | L147 | Sesión suite vía `@repo/auth` |
| `Role` (enum global user) | L2164+ | **No** filtrado en `loginAction` (solo `email` + `password`) — cualquier `User` con password puede entrar por `/login` |
| `Workspace` / `Membership` | L2727+ | Puente suite: `judges.ts` `resolveWorkspaceIdForUser` L77–83, `resolveWorkspaceIdForContestOrganization` L92–106 |
| `FotorankProfile` | L2749 | `bootstrapFotorankProfile` en `app/lib/fotorank/profile.ts` L10–17; layout onboarding L11 y dashboard L17 |
| `ContestOrganization` / `ContestOrganizationMember` | L2762, L2793 | `getUserOrganizations` L15–22; membresía ACTIVE solamente |
| `FotorankOrganizationRole` | L2639 | OWNER, ADMIN, EDITOR, JUDGE, VIEWER — devuelto en `organizations.ts` L29 pero poco usado en guards de UI |
| `FotorankJudgeAccount` / `Profile` / membresías / asignaciones | L2866+ | Flujo jurado + acciones en `app/actions/judges.ts` |
| `FotorankJudgeSession` | L3074 | `judge-auth.ts` |
| `FotorankAdminSession` | L3062 | **Relación en `User` L143; ninguna referencia en `apps/fotorank`** (grep vacío) — posible código muerto o uso futuro |

---

## Rutas sensibles

### Públicas (sin `requireAuth` / `requireJudgeAuth` en la página listada)

| Ruta | Archivo | Notas |
|------|---------|--------|
| `/` | `app/page.tsx` | L16–17: consulta sesiones solo para UI |
| `/login` | `app/login/page.tsx` | L8–9: si ya hay `getAuthUser` → `redirect("/dashboard")` |
| `/jurado/login` | `app/jurado/login/page.tsx` | Sin guard en página |
| `/jurado/register` (y alias `/jurado/registro`) | `app/jurado/register/page.tsx`, `app/jurado/registro/page.tsx` | Registro invitación |
| `/concursos/[slug]` | `app/concursos/[slug]/page.tsx` | L20–21: `notFound` si no hay landing pública |
| `/concursos/[slug]/jurados` | `app/concursos/[slug]/jurados/page.tsx` | Lista pública jurados vía `listPublicJudgesForContestBySlug` |
| `/jurados/publico/[publicSlug]` | `app/jurados/publico/[publicSlug]/page.tsx` | Perfil público jurado |
| `/design-system-test` | `app/design-system-test/page.tsx` | Cliente; **sin** auth aparente |
| `/wizard-demo` | `app/wizard-demo/page.tsx` | Demo; **sin** auth |

### Requieren `User` autenticado (`requireAuth`)

| Ruta / grupo | Archivo guard |
|--------------|---------------|
| Todo `(dashboard)/*` | `app/(dashboard)/layout.tsx` L16–20: `requireAuth`, `bootstrapFotorankProfile`, orgs; sin orgs → `redirect("/onboarding")` |
| `/onboarding` | `app/onboarding/page.tsx` L10–14 |
| Páginas sueltas bajo `(dashboard)/…` | Varias `page.tsx` con `requireAuth` adicional (p. ej. `dashboard/page.tsx` L6, `concursos/page.tsx` L12) |

### Jurado autenticado (`requireJudgeAuth`)

| Ruta | Archivo |
|------|---------|
| `/jurado/panel` | `app/jurado/panel/page.tsx` L7 |
| `/jurado/asignaciones/[assignmentId]/evaluar` | `app/jurado/asignaciones/[assignmentId]/evaluar/page.tsx` L14 |

### Server actions (muestra representativa)

- `app/actions/judges.ts`: mezcla `requireOrganizationScope` → `requireAuth` + org activa (L109–114) y `requireJudgeAuth` (p. ej. L916, L972, L1018, L1187); login jurado `redirect("/jurado/panel")` L859, L908.
- `app/actions/contests.ts`, `organizations.ts`, `organization-institutional.ts`, `fotorank-contest-entries.ts`, `fotorank-active-org.ts`: `requireAuth` en operaciones mutativas.

---

## Middleware y guards

- **Middleware Next.js:** no existe `apps/fotorank/middleware.ts` (búsqueda en repo: 0 archivos).
- **Guards principales:** funciones async en `app/lib/auth.ts` y `app/lib/judge-auth.ts` + uso en layouts/páginas/actions.
- **Organización activa:** `app/lib/fotorank/dashboard-org-context.ts` L21–48: cookie `fotorank_active_org_id` (sin `domain` en `fotorank-active-org.ts` L24–30). Con varias orgs y sin cookie válida → `NEEDS_CHOICE` (no redirige el layout; muestra error en UI vía `activeOrgError` en `(dashboard)/layout.tsx` L31).

---

## Flujo de login actual (organizador)

1. `app/login/page.tsx` L8–9: si sesión admin existente → `/dashboard`.
2. Formulario → `app/login/actions.ts` `loginAction` L27–30: `prisma.user.findUnique` por email (select `id`, `password` L9–12).
3. Verificación password L41–42; `createAdminSessionForUser` L46; `redirect("/dashboard")` L51.
4. **No** se comprueba `User.role` ni membresía en organización antes de crear sesión.

---

## Flujo de jurado actual

1. UI `/jurado/login` → formulario cliente (`JudgeLoginForm`) que llama acciones en `app/actions/judges.ts` (login: ver mismo archivo hacia L859–908 en auditoría previa: `createJudgeSessionForJudge`, `redirect("/jurado/panel")`).
2. Sesión: `createJudgeSessionForJudge` en `judge-auth.ts` L81–103.
3. Páginas jurado protegidas con `requireJudgeAuth` (panel, evaluación).

---

## Posibles causas de falla de usuarios

1. **BD / migraciones:** layout dashboard ejecuta `bootstrapFotorankProfile` (`FotorankProfile.upsert`) y `getUserOrganizations` (`ContestOrganizationMember`) inmediatamente tras `requireAuth` (`(dashboard)/layout.tsx` L17–19). Si faltan tablas o columnas → error servidor aunque login haya creado `UserSession`.
2. **Sin organización:** `orgs.length === 0` → `redirect("/onboarding")` L20 — usuario ve onboarding, no dashboard.
3. **Varias organizaciones sin cookie activa:** `resolveActiveOrganizationForUser` devuelve `NEEDS_CHOICE` (`dashboard-org-context.ts` L45–48): dashboard carga con mensaje de error en sidebar (`activeOrgError`), no redirección automática al selector (depende de que el usuario use `JuradosOrganizationSwitcher`).
4. **Cookie domain / secure:** organizador usa `COOKIE_DOMAIN` y reglas `IS_SECURE_CONTEXT` (`auth.ts` L26–36); jurado usa criterio distinto (`judge-auth.ts` L98). Entornos mixtos (HTTP vs HTTPS, dominio incorrecto) pueden romper una de las dos sesiones.
5. **Usuario `User` sin `password`:** `loginAction` devuelve error L38–39 — no es 500, pero bloquea login.
6. **Creación de jurado sin `Membership` / workspace:** `createJudgeAccount` puede lanzar `throw new Error("No workspace linked to current admin user.")` si `resolveWorkspaceIdForUser` retorna null (`judges.ts` L238) — fallo duro en server action.

---

## Riesgos técnicos

| Riesgo | Detalle |
|--------|---------|
| Permisos UI vs BD | `DashboardLayout.tsx` L97–99: `userRoles = ["admin"]` fijo; ítems con `roles: ["admin","manager"]` en sidebar L46–48 nunca filtran por `FotorankOrganizationRole` real |
| Modelo `User.role` ignorado en login Fotorank | Cualquier usuario con password en `User` puede autenticarse por `/login` |
| `FotorankAdminSession` sin uso | Schema presente; sesión real usa `UserSession` — confusión para mantenimiento |
| Dos sistemas de sesión | Complejidad operativa (logout: `landing-session.ts` cierra ambas L9–10) |
| Server actions públicas | Algunas funciones en `judges.ts` son públicas (p. ej. perfiles `getJudgePublicProfile` L1244+) — revisar rate limiting / abuso fuera de alcance aquí |
| Rutas demo sin auth | `/design-system-test`, `/wizard-demo` expuestas si el deploy es público |

---

## Lista priorizada de correcciones

1. **Alta — Alinear BD con `schema.prisma`** en cada entorno donde corre Fotorank; verificar existencia de `FotorankProfile`, `ContestOrganizationMember`, etc., antes de depurar “fallos de auth”.
2. **Alta — Unificar criterio de cookies jurado vs organizador** (`secure`, opcionalmente `domain`) si se requiere SSO consistente en subdominios (`judge-auth.ts` vs `auth.ts`).
3. **Media — Enlazar roles de sidebar a datos reales** (`ContestOrganizationMember.role` o política explícita por ruta) en lugar de `["admin"]` fijo (`DashboardLayout.tsx` L97–99).
4. **Media — Documentar o eliminar `FotorankAdminSession`** si no hay roadmap (evitar drift schema).
5. **Media — Login organizador:** decidir si se debe restringir por `User.role` o por membresía en `ContestOrganizationMember` antes de emitir sesión.
6. **Baja — Proteger o despublicar rutas demo** en producción (`design-system-test`, `wizard-demo`).
7. **Baja — Sustituir `throw new Error` en `createJudgeAccount`** (`judges.ts` L238) por `JudgeActionResult` para UX predecible.

---

## Qué no conviene tocar todavía

- **Renombrar cookies** (`dnx_session`, `dnx_judge_session`): rompe sesiones existentes y SSO con ComprameLaFoto si comparten dominio.
- **Fusionar jurado y `User`** sin plan de migración de datos y de invitaciones.
- **Cambiar `packages/auth` (`UserSession`)** sin coordinar ComprameLaFoto y otros consumidores del monorepo.
- **Eliminar `bootstrapFotorankProfile`** sin alternativa: el layout del dashboard depende de ello hoy.

---

## Referencia rápida de archivos clave

| Tema | Ruta |
|------|------|
| Auth organizador | `app/lib/auth.ts`, `packages/auth/src/index.ts` |
| Auth jurado | `app/lib/judge-auth.ts` |
| Login organizador | `app/login/actions.ts`, `app/login/page.tsx` |
| Layout dashboard | `app/(dashboard)/layout.tsx` |
| Org / cookie activa | `app/lib/fotorank/organizations.ts`, `app/lib/fotorank/dashboard-org-context.ts`, `app/actions/fotorank-active-org.ts` |
| Acciones jurados / admin | `app/actions/judges.ts` |
| UI shell dashboard | `app/components/DashboardLayout.tsx` |
| Logout conjunto | `app/actions/landing-session.ts` |
| Metadata / URL base | `app/layout.tsx` L4–16 |
| Schema | `packages/db/prisma/schema.prisma` (modelos Fotorank ~L2633+) |

---

*Fin del informe. Solo documentación; sin cambios funcionales en el código de aplicación.*
