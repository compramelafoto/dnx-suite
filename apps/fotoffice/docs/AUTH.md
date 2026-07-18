# FotOffice — autenticación unificada (DNX Identity)

## Decisión de arquitectura

**No se usa Auth0** en DNX Suite. La identidad unificada es:

1. **Google OAuth** (mismo `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` que FotoRank / ComprameLaFoto / Info Spot).
2. Usuario interno `User` en `@repo/db` (campo estable `googleId` + `email`).
3. Sesión opaca `UserSession` + cookie HttpOnly `dnx_session` (`@repo/auth`).
4. Workspace FotOffice: `Workspace` + `WorkspaceMembership` + `FotofficeWorkspaceBranding`.

SSO entre apps en el mismo dominio padre: cookie `COOKIE_DOMAIN` (p. ej. `.dnxsuite.com`). En hosts distintos, Google SSO + mismo `User` por email/`googleId`.

## Flujo de login

1. `/login` → «Continuar con Google» → `GET /api/auth/google`
2. Cookie CSRF `dnx_google_oauth` + `state`
3. Callback `GET /api/auth/google/callback`
4. `resolveOrLinkGoogleUser` (no duplica por email; vincula `googleId`)
5. `ensureFotofficeWorkspaceForUser` (idempotente)
6. Redirect a `/onboarding` o `/workspace` (SUPER_ADMIN → `/admin`)

## Variables de entorno

Ver `.env.example`. Nombres alineados a la suite (sin prefijos Auth0).

## Google Cloud Console (manual)

Agregar Authorized redirect URIs:

- Local: `http://localhost:3010/api/auth/google/callback`
- Preview: `https://<preview-host>/api/auth/google/callback`
- Producción: `https://fotoffice.com/api/auth/google/callback` (y `https://www.fotoffice.com/...` si aplica)

Authorized JavaScript origins: mismos hosts sin path.

## Migración Prisma (no aplicada remotamente)

`packages/db/prisma/migrations/20260718140000_fotoffice_photographer_onboarding/`

Añade columnas de onboarding en `FotofficeWorkspaceBranding` y tabla `FotofficePhotographerProfile`.

Aplicar solo con autorización: `pnpm --filter @repo/db exec prisma migrate deploy`
