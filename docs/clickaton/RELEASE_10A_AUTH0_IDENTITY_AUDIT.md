# RELEASE 10A — Auditoría de identidad (Auth0 vs DNX)

**Fecha:** 2026-07-28  
**Veredicto Auth0:** **NOT APPLICABLE** — DNX Suite **no usa Auth0**.  
**Identidad real:** DNX Identity (`User` Prisma + cookie `dnx_session`) con **Google OAuth** y email/password.

Fuentes: `docs/clickaton/UNIFIED_LOGIN.md`, `GOOGLE_OAUTH_ADMIN.md`, `apps/fotoffice/docs/AUTH.md`, código `apps/clickaton`.

---

## 1. Arquitectura confirmada

| Pregunta etapa | Realidad en código |
|----------------|--------------------|
| Tenant Auth0 producción | **No existe** en Clickatón |
| App Auth0 / audience / issuer | N/A |
| Callback Auth0 | N/A |
| Mapping `sub` → `User.id` | N/A Auth0; Google usa `googleId` + email verificado |
| SSO entre apps | Cookie `dnx_session` (+ `COOKIE_DOMAIN` opcional) |
| Login Google | Sí — `/api/auth/google` → callback host |
| Login email/password | Sí — login unificado `/login` |

### Flujo Clickatón

1. Usuario → `/login` (o `/admin/login` → `/login?next=/admin`)
2. Google: `GET /api/auth/google` → Google → `GET /api/auth/google/callback`
3. `resolveOrLinkGoogleUser` enlaza/crea por email verificado (**anti-duplicado**)
4. Emite `dnx_session`
5. Autorización admin: allowlist `CLICKATON_ADMIN_EMAILS` o `SUPER_ADMIN`

### Callbacks Google documentados

| Entorno | Redirect URI |
|---------|--------------|
| Local | `http://localhost:3005/api/auth/google/callback` |
| Producción | `https://maratonfotografica.com/api/auth/google/callback` |
| Staging | `https://clickaton-staging.vercel.app/api/auth/google/callback` (**verificar en Google Cloud**) |

### Variables (nombres)

| Nombre | Rol | Staging Vercel | Production Vercel (`clickaton-dnxsuite`) |
|--------|-----|----------------|------------------------------------------|
| `GOOGLE_CLIENT_ID` | OAuth | **ausente** en listado | **presente** |
| `GOOGLE_CLIENT_SECRET` | OAuth | **ausente** en listado | **presente** |
| `GOOGLE_REDIRECT_URI` | override opcional | no listada | no listada |
| `COOKIE_DOMAIN` | SSO dominio | no listada | no listada |
| `DATABASE_URL` | User/sesión | presente | presente |
| `APP_URL` / `AUTH_URL` | bases | presentes (staging) | `APP_URL` presente |

**Bloqueo staging login:** sin `GOOGLE_CLIENT_*` en `clickaton-staging` el login Google del panel no puede completarse en ese proyecto.

---

## 2. Tammy (`tammyytamer@gmail.com`)

| Check | Estado 10A |
|-------|------------|
| En allowlist admin | **Sí** (`config/admin/admins.ts`) |
| Email finance seed | **Sí** (`FINANCE_SEED_EMAILS.tammy`) |
| Grant esperado seed AR 2026 | `PRODUCT_FINANCE_VIEWER` (si User existe) |
| Usuario único en DB | **NO VERIFICADO** — Neon unreachable; script listo |
| Auth0 identity | N/A |
| Duplicado Google vs password | Política: link por email — **no crear duplicado automático** |
| Permiso conectar MP | Admin allowlist + gates finance/OAuth (owner path distinto; ver MP audit) |

### Script seguro (no inventa password)

```bash
# Requiere DATABASE_URL alcanzable
pnpm --filter clickaton audit:admin-identity
```

Salidas esperadas por email (sin secrets):

- `exists: false` → `PENDIENTE_PRIMER_LOGIN_GOOGLE`
- `exists: true` + `authMethods` incluye `google`/`password`
- `hasClickatonAdminAccess: true|false`
- `isBlocked`, `emailVerified`

### Flujo de invitación / primer login (seguro)

1. Confirmar email en allowlist (ya está).
2. En Google Cloud (app DNX Suite): Tammy como test user si OAuth en Testing.
3. Tammy abre `https://…/login?next=/admin` y **Continuar con Google** con `tammyytamer@gmail.com`.
4. Callback crea o enlaza `User` — **no** generar contraseña manual.
5. Verificar con `audit:admin-identity` que hay **un** `id`.
6. Seed/grants: `seed:argentina-2026` asegura `PRODUCT_FINANCE_VIEWER` si el user existe.
7. Finanzas edición: `/admin/ediciones/[id]/finanzas` busca FI de Tammy; si no hay, UI indica crearla (sin inventar MP).

**No** crear identidad Auth0.  
**No** crear usuario SQL manual salvo incidente documentado.

---

## 3. Roles y permisos Clickatón

| Capa | Mecanismo |
|------|-----------|
| Admin panel | `hasClickatonAdminAccess` (allowlist + SUPER_ADMIN) |
| Finanzas ver | `PRODUCT_FINANCE_VIEWER` / manager via `DnxFinanceGrant` |
| Finanzas publicar | `PRODUCT_FINANCE_MANAGER` / `DNX_FINANCE_OWNER` |
| Owner MP OAuth (I1) | `DNX_FINANCE_OWNER` + flags manuales |

Tammy: admin allowlist + viewer finance (seed). **No** se asume `DNX_FINANCE_OWNER` para Tammy.

---

## 4. Señales READY / BLOCKED

| Ítem | Clasificación |
|------|---------------|
| Auth0 tenant/app/callbacks | **NOT APPLICABLE** |
| Login unificado DNX + Google | **READY** (código + selfchecks auth OK) |
| Staging Google env | **BLOCKED** (vars ausentes en listado Vercel staging) |
| Production Google env | **READY WITH WARNING** (presentes; validar redirect URIs + www) |
| Identidad Tammy en DB | **BLOCKED** (DB inaccesible; pendiente primer login / audit) |
| Anti-duplicados | **READY** (política link-by-email) |
| Permiso panel Tammy | **READY** (allowlist) |
| Permiso finance view Tammy | **READY WITH WARNING** (grant solo tras seed + User existente) |

---

## 5. Corrección semántica para Etapa 10B

Donde el brief diga “Auth0”, operar sobre:

- **DNX Identity + Google OAuth**
- Callbacks Google por host
- `User.id` central + `DnxFinancialIdentity` / `DnxPaymentAccount`

**Nota:** `inviteOrAssignAppAccess` del paquete auth **no** se usa en Clickatón; el alta admin es primer login Google + allowlist. Deuda: migrar a `WorkspaceAppAccess` / `appAccess CLICKATON`.

Detalle ampliado por [Audit Auth0 MP identity](739d33cf-0501-4d1d-b45e-3dbbc6345118).
