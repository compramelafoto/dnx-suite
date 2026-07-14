# DNX Identity — invitaciones y gestión de usuarios

Módulo reutilizable de identidad en `@repo/auth` + persistencia en `@repo/db`.

Info Spot es el **primer consumidor**. No hay login exclusivo de Info Spot: la cookie sigue siendo `dnx_session`.

## Capacidades

| Capacidad | API (`@repo/auth`) | UI Info Spot |
|-----------|-------------------|--------------|
| Invitar / asignar | `inviteOrAssignAppAccess` | `/admin/usuarios` |
| Reenviar / revocar | `resendAppInvitation` / `revokeAppInvitation` | tarjetas pendientes |
| Aceptar invitación | `acceptAppInvitation` | `/invitar/[token]` |
| Login + remember-me | `createUserSession({ rememberMe })` | `/ingresar` |
| Login con Google | `resolveOrLinkGoogleUser` + helpers OAuth | `/ingresar` → `/api/auth/google` |
| Logout | `destroyUserSessionByRawToken` | Redacción / admin |
| Reset password | `requestPasswordReset` / `resetPasswordWithToken` | `/recuperar` |
| Bootstrap primer Director | `bootstrapInfoSpotDirector` | CLI `pnpm dnx:create-director` |

## Google OAuth (DNX compartido)

Info Spot **reutiliza** el mismo `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` de la suite (FotoRank / CLF). No hay OAuth exclusivo ni cookie distinta: la sesión sigue siendo `dnx_session`.

| Ruta | Rol |
|------|-----|
| `GET /api/auth/google` | Inicia OAuth (`state` + cookie CSRF `dnx_google_oauth`) |
| `GET /api/auth/google/callback` | Token + userinfo (exige `verified_email`), linkea User por email |

Política Info Spot:

- Usuario **existente**: inicia sesión (vincula `googleId` si faltaba). No cambia contraseña.
- Usuario **nuevo**: crea `User` (nombre, email, avatar en `logoUrl`, `emailVerifiedAt`, rol suite `CUSTOMER`). **Sin** rol editorial ni `DnxUserProfile` hasta onboarding.
- Invitación **PENDING** con el mismo email: se activa `InfoSpotUserRole` y la invitación queda `ACCEPTED` (sin duplicar User).
- Google **no** asigna permisos editoriales; eso vive en `/admin/usuarios`.

Redirects post-login (ver [`57`](./57-public-profile-onboarding-and-editorial-access.md)):

1. Sin onboarding / sin perfiles públicos ACTIVE → `/completar-perfil`
2. Con perfiles públicos → `/` (o `next` seguro)
3. Destino editorial sin `InfoSpotUserRole` → `/ingresar/acceso-pendiente` (cuenta pública no bloqueada)
4. Con rol editorial → `/redaccion` (o `next`)

Variables requeridas:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Opcionales / base URL:

- `GOOGLE_REDIRECT_URI` (si no, `{baseUrl}/api/auth/google/callback`)
- `NEXT_PUBLIC_INFOSPOT_URL` o `APP_URL` o `AUTH_URL`

`AUTH_TRUST_HOST` no aplica: Info Spot no usa Auth.js / NextAuth; el OAuth es custom en `@repo/auth`.


## Bootstrap del primer Director

Las invitaciones requieren un Director ACTIVE para operar `/admin/usuarios`. En DB vacía (o sin Directores), usá el CLI oficial:

```bash
pnpm dnx:create-director
```

Solicita nombre, email y contraseña. Crea el `User` solo si no existe; si ya existe (p. ej. `SUPER_ADMIN`), **reutiliza ese registro** y **no modifica** `User.role`.

Asigna / actualiza `InfoSpotUserRole` con:

- `INFOSPOT_DIRECTOR` · `ACTIVE` · `DIRECT_PUBLISH` · `canPublish=true`

Usa las mismas validaciones y `hashPassword` que `acceptAppInvitation`. En usuarios existentes, la contraseña es opcional (vacía = conservar). **No** reemplaza el flujo de invitaciones para el resto del equipo.

No interactivo:

```bash
DNX_DIRECTOR_NAME="…" DNX_DIRECTOR_EMAIL="…" pnpm dnx:create-director
# opcional: DNX_DIRECTOR_PASSWORD=…
```


## Roles Info Spot

- `INFOSPOT_DIRECTOR` — admin + publicar
- `INFOSPOT_REDACTOR` — redacción; publicar según `canPublish`
- `INFOSPOT_COLABORADOR` — borradores; no publica ni admin

## Email

Si `RESEND_API_KEY` (+ opcional `EMAIL_FROM`) está configurada, se envían invitaciones y resets vía Resend. Si no, el flujo queda listo y la UI muestra el enlace / aviso de “no enviado”.

## Seguridad

- Tokens opacos hex + hash SHA-256 en DB
- Contraseñas scrypt (`salt:hex`); verify también acepta bcrypt legacy
- Nunca se almacenan ni envían contraseñas temporales
- Invitación: TTL 7 días; reset: TTL 1 hora, un solo uso

## Uso desde otra app

```ts
import {
  inviteOrAssignAppAccess,
  DNX_APP_INFOSPOT, // o tu constante de app
} from "@repo/auth";

await inviteOrAssignAppAccess({
  email,
  app: "fotorank", // identificador estable
  appRole: "…",
  invitedByUserId,
  appBaseUrl: "https://…",
  appLabel: "FotoRank",
  roleLabel: "…",
  onAssignExistingUser: async (userId) => {
    // upsert del rol específico de la app
  },
});
```

Tabla: `DnxAppInvitation` (`packages/db`).
