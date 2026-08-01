# Auditoría de paridad — Ciclo de vida Cuenta DNX (10B.5)

**Fecha:** 2026-07-29  
**Método:** rutas, actions, `@repo/auth`, schema (sin asumir UI = canónico)

---

## Matriz

| Plataforma | Login email | Google | Registro email | Verificación email | Olvidé contraseña | Cambiar contraseña | Fuente User |
| ---------- | ----------: | -----: | -------------: | -----------------: | ----------------: | -----------------: | ----------- |
| ComprameLaFoto | IMPLEMENTED (`verifyUserPassword`) | LEGACY (callback local; deuda `resolveOrLinkGoogleUser`) | IMPLEMENTED (`registerDnxAccount` en `/api/auth/register`; role-specific LEGACY) | IMPLEMENTED (`EmailVerificationToken` + central) | IMPLEMENTED (adapter → `requestPasswordReset`) | IMPLEMENTED (local scrypt; migrar a `changeUserPassword`) | `@repo/db` User |
| Clickatón | IMPLEMENTED | IMPLEMENTED (`resolveOrLinkGoogleUser` + `resolveOrCreateUser`) | IMPLEMENTED (`/crear-cuenta` → `registerDnxAccount`) | IMPLEMENTED (`/verificar-email`) | IMPLEMENTED (`/recuperar`) | MISSING (perfil) | User — **runtime DB propia = bloqueo cross-app** |
| FotoRank | IMPLEMENTED | IMPLEMENTED (migrado a `resolveOrLinkGoogleUser`; createRole CUSTOMER) | IMPLEMENTED (`/crear-cuenta`) | IMPLEMENTED (`/verificar-email`) | IMPLEMENTED (`/recuperar`) | MISSING (perfil) | User (+ jurados paralelos N/A) |
| InfoSpot | IMPLEMENTED | IMPLEMENTED | NOT APPLICABLE — invite-only editorial (`DnxAppInvitation`) | NOT APPLICABLE (Google/invite) | IMPLEMENTED (`@repo/auth`) | MISSING (perfil) | User |
| FotoOffice | IMPLEMENTED | IMPLEMENTED | MISSING (cuenta vía Google; registro email pendiente producto) | NOT APPLICABLE (Google) | IMPLEMENTED (`/recuperar`) | MISSING (perfil) | User |

---

## Notas por funcionalidad

### Login email
Todas usan `verifyUserPassword` (rehash bcrypt→scrypt).

### Google
Clickatón / FotoRank / InfoSpot / FotoOffice: `resolveOrLinkGoogleUser`.  
CLF: aún LEGACY con `prisma.user.create` en callback.

### Registro email
Clickatón y FotoRank: nuevos en 10B.5.  
CLF customer: `registerDnxAccount`.  
InfoSpot: invite-only (correcto).  
FotoOffice: Google-first (registro email = deuda producto).

### Olvidé / reset
Canónico: `requestPasswordReset` / `resetPasswordWithToken`.  
Permite Google-only crear password.  
CLF reset page aún puede leer token legacy — dual-read temporal.

### Identidad paralela
`FotorankJudgeAccount` = NOT APPLICABLE a Cuenta DNX User (deuda ADR).

---

## Bloqueo runtime

Clickatón Staging/Production en Neon propia → mismo email ≠ mismo `User.id` hasta Estrategia A.
