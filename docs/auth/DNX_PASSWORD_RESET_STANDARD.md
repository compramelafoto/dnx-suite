# Estándar — Recuperación y cambio de contraseña DNX

## Forgot

`requestPasswordReset` — respuesta siempre neutra.

## Reset

`resetPasswordWithToken` — scrypt, un solo uso, revoca sesiones por defecto.

## Google-only

Permitido: reset para **crear** contraseña (no exigir password previo).

## Cambio en perfil

`changeUserPassword` — current password si existe; `allowCreateWithoutCurrent` solo con verificación previa.

## Apps

Prohibido inventar tokens locales. Solo adapters finos + UI.
