# Estándar — Verificación de email DNX

## API

- `requestEmailVerification`
- `verifyEmailWithToken`

## Persistencia

`EmailVerificationToken` — solo hash del token, purpose `VERIFY_EMAIL`, expiración 24h, un solo uso, invalida pendientes previos.

## Efecto

Setea `User.emailVerifiedAt` — válido en toda la suite.

## Branding

URL y copy pueden llevar marca de la app origen; el mensaje debe aclarar **Cuenta DNX**.
