# 11 — ETAPA 03: Cierre Auth CLF / eliminación dual-session

**Fecha:** 2026-07-29  
**Rama:** `migration-legacy-clf-to-monorepo`  
**HEAD preflight:** `e01abf398d51d35f5e0fba99292d627c480a11e5`  
**Commit/push/deploy:** no realizados  
**ACCIÓN LEGAL AHORA:** NO

---

## ESTADO

**DONE** — P0-06 **CLOSED** a nivel de código CLF.

Infra OAuth redirects / env Vercel → permanece en **P0-07** (no reabre P0-06).

---

## ROOT CAUSE (dual-session)

Coexistían dos mecanismos en `apps/compramelafoto/lib/auth.ts`:

| Mecanismo | Cookie | Seguridad | Uso |
|-----------|--------|-----------|-----|
| **DNX** | `dnx_session` | Token opaco + fila `UserSession` (@repo/auth) | Preferido |
| **Legacy** | `auth-token` | Base64 `{userId,role,timestamp}` **sin firma** | Fallback si no había DNX; también se escribía en cada login |

Problemas:

1. Login/OAuth escribían **ambas** cookies.  
2. `getAuthUser` leía DNX primero y si fallaba usaba `auth-token` (usuario distinto posible / sesión no revocable).  
3. Si `createUserSession` fallaba, el login **igual** emitía solo Legacy → identidad degradada.  
4. Post-cutover, cookies Legacy de prod podían autenticar sin `UserSession`.

---

## AUTH SOURCE OF TRUTH

**Canónico:** cookie `dnx_session` + `UserSession` vía `@repo/auth` (`createUserSession` / `getSessionUserByRawToken` / `destroyUserSessionByRawToken`).

**API CLF única:**

| Helper | Rol |
|--------|-----|
| `getAuthUser()` | Resolver identidad |
| `getCurrentUser()` / `getCurrentIdentity()` / `getCurrentSession()` | Aliases |
| `requireAuth` / `requireRole` | Autorización |
| `setAuthCookie` / `setAuthCookieOnResponse` | Emitir sesión (falla si no hay UserSession) |
| `clearAuthCookie` | Logout (destruye sesión + expira cookies) |
| `CLF_AUTH_SOT` | Metadatos SoT / cutover policy |

Shape `AuthUser`: `id`, `email`, `name`, `role` (effective, incl. LAB→LAB_PHOTOGRAPHER), `labId?`, `globalRole`, workspace/appAccess, `emailVerifiedAt`, flags.

---

## LEGACY AUTH

| Pieza | Acción |
|-------|--------|
| Lectura `auth-token` en `getAuthUser` | **Eliminada** |
| Escritura `auth-token` en login/OAuth | **Eliminada** |
| Fallback si falla `createUserSession` | **Eliminado** (login → 503 / OAuth → error redirect) |
| Expiración `auth-token` en login/logout | **Mantenida** (purge cutover) |
| `getAuthCookieHeaderValue` | Solo header Max-Age=0 (compat); no emite payload |
| Password bcrypt verify en login | **Mantenido** vía `@repo/auth` (scrypt + bcrypt legacy) — credencial, no sesión |
| UIs `/lab/login`, `/fotografo/login`, `/cliente/login`, `/admin/login` | Aliases → `/login?redirect=…` (mismo backend) |

**LEGACY_SESSION_AFTER_CUTOVER:** `RELOGIN_REQUIRED`

---

## ROLES

| Rol | Login | Destination | Guard | Estado |
|-----|-------|-------------|-------|--------|
| CUSTOMER | `/login` (+ alias `/cliente/login`) | `/cliente/dashboard` | `requireAuth([CUSTOMER])` | YES |
| PHOTOGRAPHER | `/login` (+ alias) | `/fotografo/dashboard` | PHOTOGRAPHER (+ LAB_PHOTOGRAPHER) | YES |
| ORGANIZER | `/login` | `/organizador/dashboard` | ORGANIZER | YES |
| LAB | `/login` (+ `/lab/login` → redirect) | `/lab/dashboard` | LAB (+ LAB_PHOTOGRAPHER) | YES |
| LAB_PHOTOGRAPHER | `/login` | `/lab/dashboard` | Cruza LAB+PHOTOGRAPHER | YES |
| ADMIN / SUPER_ADMIN | `/login` (+ `/admin/login`) | `/admin` | ADMIN | YES |
| SCHOOL_ORGANIZER | `/login` | `/escuela` | SCHOOL_ORGANIZER | YES |

---

## MULTIROLE

- Primary role = `User.role` en DB; LAB con `lab.soyFotografo` → effective `LAB_PHOTOGRAPHER`.  
- Destination determinístico por effective role (`getPostLoginDestination`).  
- `requireAuth` mantiene expansión Legacy LAB ↔ LAB_PHOTOGRAPHER ↔ PHOTOGRAPHER.  
- No se inventó switcher de contexto nuevo.

---

## GOOGLE OAUTH

| Capa | Estado |
|------|--------|
| Código callback | **PASS** — solo `setAuthCookieOnResponse` (dnx_session); sin append auth-token |
| Account link / create | Sin cambios de negocio |
| Infra redirects | **P0-07** |

Redirect URIs documentadas (configurar en Google Console / P0-07):

| Env | Redirect URI |
|-----|----------------|
| LOCAL | `{APP_URL}/api/auth/google/callback` (ej. `http://localhost:3002/api/auth/google/callback`) |
| STAGING | `https://<staging-host>/api/auth/google/callback` |
| PRODUCTION | `https://<prod-host>/api/auth/google/callback` |

Env requeridas (sin valores): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL` / `NEXT_PUBLIC_APP_URL`, `AUTH_SECRET`, `DATABASE_URL`.

**STAGING_HUMAN_SMOKE:** login Google por rol (CUSTOMER/LAB/PHOTOGRAPHER/ORGANIZER).

---

## MIDDLEWARE

Sin gate de sesión (igual Legacy): referrals + blog visitor.  
Protección en layouts/API vía `getAuthUser` / `requireAuth`.  
Sin redirect loops introducidos.

---

## API AUTHORIZATION

Sin auditoría masiva de 500 endpoints. Cambio transversal:

- Todas las APIs que usan `getAuthUser`/`requireAuth` ahora dependen **solo** de `dnx_session`.  
- Login/OAuth fallan si no pueden crear `UserSession` (no sesión “soft” Legacy).

---

## LOGOUT

`POST /api/auth/logout` → `clearAuthCookie()`:

1. `destroyUserSessionByRawToken`  
2. Expira `dnx_session`  
3. Expira `auth-token` residual  

Tras logout no hay fallback Legacy activo.

---

## TESTS

```text
tsx lib/auth/auth-sot.selfcheck.ts           → ok
tsx lib/auth/auth-role-matrix.test.ts        → ok
tsx lib/auth/post-login-destination.test.ts  → ok
tsx lib/lab/lab-auth-guards.test.ts          → ok
tsx lib/lab/lab-parity.selfcheck.ts          → ok
```

---

## TYPECHECK

Tras `rm -rf .next`:

| Clase | Resultado |
|-------|-----------|
| AUTH_REGRESSION | **0** (fix Role typing en `AuthCookieInput`) |
| PRE_EXISTING_SOURCE | ~31 (p.ej. `@repo/payments` BigInt / dual-read exports) |
| PRE_EXISTING_GENERATED | Evitado limpiando `.next` |

Scope auth (`lib/auth*`, `app/api/auth/*`): **PASS**.

---

## LINT

Scope auth: **0 errors**, warnings PRE_EXISTING en login/google (`any`, unused).

---

## Working tree classification (esta etapa)

| Bucket | Archivos |
|--------|----------|
| AUTH_RELATED | `lib/auth.ts`, `lib/auth/*`, `app/api/auth/login`, `google/callback` |
| SHARED_AUTH | Ningún cambio en `packages/auth` |
| UNRELATED | WIP Clickaton/FotoRank/docs auth suite — no tocados |
| DOCS | `docs/clf-migration/11-*` + updates 02/07/08 |

---

## NEXT

**ETAPA 04 — PLAN FORWARD DATABASE Student → SchoolStudent + historiales Prisma** (P0-02 / P0-03).

P0-07 (env/OAuth redirects Vercel) puede correr en paralelo con staging smoke Auth.
