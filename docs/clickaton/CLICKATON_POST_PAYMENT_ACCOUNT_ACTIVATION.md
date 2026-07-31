# Clickatón — Activación Cuenta DNX post-pago (10C.1 / 10C.2)

**Fecha:** 2026-07-30  
**Estado:** Implementado en código · Staging E2E **bloqueado** hasta `CONFIRMED` post-pago TEST  
**10C.2:** preferencia MP creada; sin APPROVED → no se pudo ejercer `/activar` ni casos User nuevo/existente/Google en Staging.

---

## Principio

```text
CONFIRMED → vincular/crear User DNX → activar credencial (password o Google)
```

La reserva guest **no** crea User. La activación ocurre **después** de `CONFIRMED`.

---

## Escenarios

| Caso | Comportamiento |
| ---- | -------------- |
| User DNX existente con password/Google | Vincular `userId`; CTA **Iniciar sesión** / **Ver mi inscripción** |
| User nuevo o sin credencial | `resolveOrCreateUser` (sin password); `requestPasswordReset` (set-password); UI activación + Google |

Nunca: password temporal · password por email · segundo User.

---

## Rutas

| Ruta | Rol |
| ---- | --- |
| `/maratones/[slug]/inscripcion/pago/exito` | Confirmación + bloque activación si aplica |
| `/maratones/[slug]/inscripcion/activar/[registrationId]?t=` | Landing activación (auth-ui + Google + recuperar) |
| `/recuperar` / `/recuperar/[token]` | Set/reset password DNX canónico (`DnxForgotPanel` / `DnxResetPanel`) |
| `/api/auth/google?next=…` | Google post-pago → panel inscripción |

Token de inscripción: access token HMAC existente (`?t=`).  
Token de set-password: `PasswordResetToken` de `@repo/auth` (hash, TTL, single-use).

---

## Símbolos

- `ensurePostConfirmActivation` · `resolveActivationFlags` — `lib/registration/application/post-confirm-activation.ts`
- `linkRegistrationIdentity` — vínculo User
- `requestPasswordReset` / `resetPasswordWithToken` — `@repo/auth`

---

## Branding

`clickatonAuthBrand` + tokens `@repo/auth-ui`. Orden canónico DNX (ley Phase 3).
