# Informe — Cuenta DNX Universal (ETAPA 10B.5)

**Fecha:** 2026-07-29  
**Commit / deploy Production:** no realizados

---

## Estado final

```text
DNX UNIVERSAL ACCOUNT CORE READY — INFRA MIGRATION PENDING
```

**No** se declara `DNX UNIVERSAL ACCOUNT READY IN STAGING` porque:

- Clickatón sigue en Neon propia (ADR-002 cutover pendiente de ejecución operativa);
- fixtures cross-app A–F no corridos end-to-end en Staging compartido;
- cambio de contraseña en perfil aún incompleto en varias apps;
- Google callback CLF sigue LEGACY.

---

## 1. Estrategia de runtime

**Estrategia A — DB de identidad compartida** (`ADR-DNX-002`, ACCEPTED).  
Cutover Clickatón: `docs/clickaton/STAGING_IDENTITY_DB_CUTOVER.md`.

## 2. Matriz de plataformas

Ver `DNX_ACCOUNT_LIFECYCLE_PARITY_AUDIT.md`.

## 3. Fuente central

`@repo/auth` + `User` en `@repo/db`.

Nuevas APIs 10B.5:

- `registerDnxAccount`
- `requestEmailVerification` / `verifyEmailWithToken`
- `validatePasswordPolicy` / `changeUserPassword`
- `sanitizeReturnTo` / `DNX_AUTH_MESSAGES`
- reset permite Google-only (crear password)

## 4. Registro por email

| App | Estado |
| --- | ------ |
| Clickatón | `/crear-cuenta` → `registerDnxAccount` |
| FotoRank | `/crear-cuenta` → `registerDnxAccount` (CUSTOMER; sin rol org/jurado) |
| CLF | `/api/auth/register` → `registerDnxAccount` |
| InfoSpot | Invite-only (OK producto) |
| FotoOffice | Pendiente registro email (Google + forgot OK) |

## 5. Google

Clickatón + FotoRank migrados a `resolveOrLinkGoogleUser` + `resolveOrCreateUser`.  
CLF: deuda LEGACY.

## 6. Auth0

N/A.

## 7. Verificación

Central sobre `EmailVerificationToken`. Páginas `/verificar-email` en Clickatón y FotoRank.

## 8–10. Forgot / reset / cambio

Forgot/reset canónico en Clickatón, FotoRank, FotoOffice, InfoSpot, CLF (adapter).  
Cambio en perfil: CLF tiene UI; resto MISSING (API `changeUserPassword` lista).

## 11. Emails

Templates DNX en `@repo/auth` (verify, reset, set password, changed) con mención Cuenta DNX.

## 12. returnTo

`sanitizeReturnTo` central; Clickatón mantiene sanitizer propio alineado.

## 13. Hashes

Todas las apps de login usan `verifyUserPassword`; escrituras scrypt; rehash al login.

## 14–15. Migración / duplicados

Inventario documentado; ejecución Staging pendiente del cutover DB.

## 16–17. Tests / CI

- `pnpm auth:identity:selfcheck` — policy, returnTo, mensajes, hashes
- `pnpm auth:architecture:check` — bloquea reset/register local + user create no autorizado

## 18–22. Apps

| App | Highlight 10B.5 |
| --- | --------------- |
| Clickatón | crear-cuenta, recuperar, verificar; Google vía resolveOrCreateUser |
| FotoRank | idem; Google ya no crea ORGANIZER automático |
| CLF | register + forgot canónicos |
| InfoSpot | reset ya canónico; invite-only |
| FotoOffice | recuperar canónico |

## 23. Staging

Pendiente cutover Clickatón + fixtures:

1. CLF histórico cross-login  
2. Crear desde Clickatón → CLF/FR  
3. Crear desde FotoRank → Clickatón/CLF  
4. Reset desde Clickatón cross-app  
5. Google link  
6. Google-only + crear password  

## 24. Riesgos

1. Cutover Clickatón con usuarios duplicados.  
2. Registers role-specific CLF aún locales.  
3. Jurados paralelos.  
4. RESEND no configurado → emails skipped en algunos envs.

## 25. Rollback

- Revertir adapters UI/rutas.  
- Restaurar `DATABASE_URL` Clickatón al Neon propio.  
- No DELETE usuarios.  
- Hashes scrypt siguen verificables.

## 26. Estado final (reiterado)

`DNX UNIVERSAL ACCOUNT CORE READY — INFRA MIGRATION PENDING`

### Próximo paso

1. Ejecutar cutover Staging Clickatón (ADR-002).  
2. Correr fixtures 1–6.  
3. Completar change-password UI + Google CLF.  
4. Production solo con Staging verde.
