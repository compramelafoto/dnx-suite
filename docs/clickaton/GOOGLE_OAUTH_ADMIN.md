# Clickatón — Google OAuth para el panel administrativo (Etapa 10B2)

## Decisión

La pantalla oficial es el **login unificado** `/login` (Etapa 10B3). Ofrece:

1. **Continuar con Google** (OAuth unificado DNX Suite / `@repo/auth`)
2. **Email + contraseña** de DNX Identity

Ambos autenticán la misma identidad DNX (`dnx_session`). El acceso a `/admin` depende de la allowlist. Ver [UNIFIED_LOGIN.md](./UNIFIED_LOGIN.md).

## Autenticación vs autorización

| Capa | Qué hace |
|------|----------|
| **Autenticación (DNX Identity)** | Google OAuth → usuario DNX por email verificado → cookie `dnx_session` |
| **Autorización (Clickatón)** | `hasClickatonAdminAccess()` — allowlist + `SUPER_ADMIN` |

Un usuario puede autenticarse con Google y aun así ver `/admin/acceso-denegado` si su email no está autorizado.

## Administradores iniciales

Fuente: `apps/clickaton/config/admin/admins.ts`

- `dnxfotografia@gmail.com`
- `rodrigorincon40@gmail.com`
- `tammytamerph@gmail.com`

Comparación: trim + lowercase. No se muestran en la UI de login.

## Flujo

1. `/admin` → `/login?next=/admin…` (o `/admin/login` → mismo destino)
2. Botón **Continuar con Google** → `GET /api/auth/google?next=…`
3. Redirect a Google (`openid email profile`) con `state` + cookie HttpOnly `dnx_google_oauth` (host-only)
4. Callback `GET {origin}/api/auth/google/callback`
5. Valida `state` / cookie; exige `email_verified`
6. `resolveOrLinkGoogleUser` (crea o enlaza por email; no duplica)
7. Crea `dnx_session`
8. Destino: `next` seguro o `/mi-cuenta`; `/admin…` sin permiso → `/admin/acceso-denegado`

## Rutas

| Ruta | Rol |
|------|-----|
| `/login` | Login unificado |
| `/admin/login` | Redirect a `/login` |
| `/api/auth/google` | Inicio OAuth |
| `/api/auth/google/callback` | Callback por host de Clickatón |

El login email/contraseña de otras apps DNX no se modifica.

## Variables de entorno (nombres)

| Variable | Entorno | Notas |
|----------|---------|--------|
| `GOOGLE_CLIENT_ID` | local + Vercel | Compartido DNX Suite |
| `GOOGLE_CLIENT_SECRET` | local + Vercel | Server-only; nunca `NEXT_PUBLIC_*` |
| `GOOGLE_REDIRECT_URI` | opcional | Si se omite: `{base}/api/auth/google/callback` |
| `CLICKATON_PUBLIC_WEB_BASE_URL` | local + Vercel | Base pública; ayuda a resolver redirect |
| `DATABASE_URL` | local + Vercel | Sesión / usuario |
| `COOKIE_DOMAIN` | opcional | Alineado a la suite |
| `APP_URL` / `AUTH_URL` | fallback | Resolución de base URL |

## Google Cloud — tareas manuales

Aplicación visible recomendada: **DNX Suite**.

### URIs de redireccionamiento autorizados

Agregar (sin inventar secretos):

| Entorno | URL exacta |
|---------|------------|
| Local | `http://localhost:3005/api/auth/google/callback` |
| Producción (dominio documentado) | `https://maratonfotografica.com/api/auth/google/callback` |
| Preview Vercel | `https://<host-preview>/api/auth/google/callback` (cada host que se use) |

Orígenes JavaScript autorizados: solo si el cliente Google los exige; este flujo es redirect server-side (`/api/auth/google`), no GIS popup. En muchos casos basta con los redirect URIs.

### Consentimiento y testing

- Scopes mínimos: `openid`, `email`, `profile`
- Si la app OAuth está en **Testing**: agregar como usuarios de prueba a los tres administradores
- Publicación: no cambiar sin decisión de producto; en Testing solo entran test users

### Vercel (proyecto `clickaton-dnxsuite`)

Configurar las mismas variables `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (y opcionalmente `CLICKATON_PUBLIC_WEB_BASE_URL`, `GOOGLE_REDIRECT_URI` de producción). No commitear valores.

## Alta de un administrador nuevo

1. Agregar el email normalizado a `CLICKATON_ADMIN_EMAILS` en `config/admin/admins.ts`.
2. Deploy / release del cambio de código.
3. La persona inicia sesión con **su** Google (email verificado).
4. Si no existía en DNX Identity, el callback crea el usuario y asocia `googleId`.
5. Si ya existía (p. ej. con contraseña), se reutiliza y se enlaza Google si faltaba.

## Revocar acceso

1. Quitar el email de `CLICKATON_ADMIN_EMAILS` (o migrar a `appAccess` cuando exista).
2. Deploy.
3. Opcional: `revokeAllUserSessions` / bloquear usuario en Identity si corresponde a nivel suite.

La persona puede seguir autenticándose en otras apps DNX; Clickatón la enviará a acceso denegado.

## Compatibilidad

No se renombran `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.  
Cada app registra **su** callback por host; Clickatón no reemplaza los de Info Spot / FotoRank / FotoOffice / ComprameLaFoto.

## Scripts

```bash
pnpm --filter clickaton selfcheck:admin-auth
pnpm --filter clickaton selfcheck:admin-google-oauth
```
