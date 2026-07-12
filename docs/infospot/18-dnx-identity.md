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
| Logout | `destroyUserSessionByRawToken` | Redacción / admin |
| Reset password | `requestPasswordReset` / `resetPasswordWithToken` | `/recuperar` |

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
