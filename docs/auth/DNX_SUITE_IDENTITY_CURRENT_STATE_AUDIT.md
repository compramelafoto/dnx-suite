# Auditoría — Estado actual de identidad DNX Suite

**Etapa:** 10B.4 — Ley de Identidad Única DNX  
**Fecha:** 2026-07-29  
**Método:** auditoría de código + schema Prisma + docs de release (sin deploy productivo)

---

## Tabla resumen

| Aplicación | Fuente User | DB | Login | Hash | Google/Auth0 | Cookie | Sesión |
| ---------- | ----------- | -- | ----- | ---- | ------------ | ------ | ------ |
| **ComprameLaFoto** | `User` (`packages/db`) | `@repo/db` → `DATABASE_URL` (suite) | Email/password + Google | **Antes:** bcrypt only. **Ahora:** verify dual + write scrypt vía `@repo/auth` | Google sí / Auth0 no | `dnx_session` + legacy `auth-token` | `UserSession` + fallback cookie |
| **Clickatón** | mismo `User` | `@repo/db` → Neon **propio** (`clickaton_staging` / `clickaton_production`) | Email/password + Google | scrypt + verify dual (`@repo/auth`) + rehash | Google sí / Auth0 **N/A** | `dnx_session` | `UserSession` |
| **FotoRank** (organizador) | mismo `User` | `@repo/db` → `DATABASE_URL` | Email/password + Google | scrypt (`@repo/auth` re-export) + rehash | Google sí / Auth0 no | `dnx_session` | `UserSession` |
| **FotoRank Jurados** | **`FotorankJudgeAccount`** (paralelo) | misma instancia Prisma | Email/password propio | scrypt en `passwordHash` | No | `dnx_judge_session` | `FotorankJudgeSession` |
| **InfoSpot** | mismo `User` + `InfoSpotUserRole` | `@repo/db` | Email/password + Google + invitaciones | scrypt + rehash (`@repo/auth`) | Google sí / Auth0 no | `dnx_session` | `UserSession` |
| **FotoOffice** | mismo `User` + `WorkspaceMembership` | `@repo/db` | Email/password + Google | scrypt + rehash (`@repo/auth`) | Google sí / Auth0 no | `dnx_session` | `UserSession` |
| **DNX Payments** | no login propio; `DnxFinancialIdentity.ownerUserId` → `User` | mismos modelos en `@repo/db` | N/A | N/A | N/A | N/A | N/A |

---

## Respuestas a las preguntas de ley

### ¿Qué aplicaciones comparten realmente `User`?

**A nivel schema/código:** CLF, Clickatón, FotoRank (organizador), InfoSpot, FotoOffice y Payments usan el mismo modelo `User` de `packages/db/prisma/schema.prisma`.

**A nivel runtime:** Clickatón Staging/Production apuntan a Neon/DB **separados** documentados en `docs/clickaton/RELEASE_10B2_*.md`. Eso rompe la identidad cruzada aunque el código sea correcto.

### ¿Cuáles solo comparten el modelo Prisma pero no la DB?

**Clickatón** (evidencia fuerte). El resto asume `DATABASE_URL` de suite; no hay segundo `schema.prisma` productivo.

### ¿Cuáles crean usuarios independientes?

1. **`FotorankJudgeAccount`** — identidad completa separada (email, hash, sesión).
2. Cualquier app con `DATABASE_URL` distinta al crear `User` (Clickatón).
3. Flujos Google/register con `prisma.user.create` local (deuda: migrar a `resolveOrCreateUser`).

### ¿Cuáles usan sesiones propias?

| Sesión | Quién |
| ------ | ----- |
| `UserSession` + `dnx_session` | Canónica (todas las apps de producto) |
| `auth-token` (base64 JSON) | Solo CLF (bridge legacy) |
| `FotorankJudgeSession` + `dnx_judge_session` | Jurados FotoRank |

### ¿Hashes incompatibles?

| Emisor | Formato |
| ------ | ------- |
| Histórico CLF | bcrypt cost 10 en `User.password` |
| Canónico suite | scrypt `salt:digest` hex |
| Verify | `@repo/auth.verifyPassword` acepta ambos; `verifyUserPassword` rehashea bcrypt → scrypt |

**Causa raíz del fallo manual pre-10B.4:** CLF login usaba `bcrypt.compare` **solo** → rechazaba hashes scrypt de otras apps. Corregido en esta etapa.

### ¿Dónde se pueden duplicar usuarios?

- Misma DB: `User.email @unique` previene duplicados.
- DBs distintas (Clickatón vs suite): mismo email → dos `User.id`.
- Jurado vs User: mismo email sin FK.
- Conflicto Google: `googleId` unique; linking por email con rechazo de mismatch.

### ¿Vinculación por email vs ID?

| Flujo | Clave |
| ----- | ----- |
| Google (`resolveOrLinkGoogleUser`) | Email → luego `googleId` |
| Sesión | `User.id` vía `UserSession` |
| Payments FI | `ownerUserId` = `User.id` |
| Admin Clickatón | allowlist por email post-auth |
| Jurado | `judgeAccountId` (cuid), no `User.id` |

### ¿Auth legacy conservado?

- Cookie `auth-token` en CLF (lectura/escritura bridge).
- `User.role` enum CLF + `globalRole` aditivo.
- `User.mpAccessToken/Refresh/UserId` (legacy → `DnxPaymentAccount` + vault).
- `User.passwordResetToken` en User coexiste con `PasswordResetToken`.
- `FotorankJudgeAccount` identidad paralela.
- Auth0: **nunca adoptado** (N/A).

---

## Matriz de bases (runtime documentado)

| Aplicación | Entorno | Proyecto DB | DB | Fuente identidad | Estado |
| ---------- | ------- | ----------- | -- | ---------------- | ------ |
| ComprameLaFoto | Staging/Prod | Suite Neon/Postgres | `DATABASE_URL` suite | `User` compartido | Operativo |
| Clickatón | Staging | Neon `clickaton-staging` | `clickaton_staging` | `User` en DB **propia** | **Bloquea SSO real** |
| Clickatón | Production | Neon Clickatón | `clickaton_production` | `User` en DB **propia** | **Bloquea SSO real** |
| FotoRank | Staging/Prod | Suite | `DATABASE_URL` | `User` + jueces paralelos | Parcial |
| InfoSpot | Staging/Prod | Suite | `DATABASE_URL` | `User` | Operativo |
| FotoOffice | Staging/Prod | Suite | `DATABASE_URL` | `User` | Operativo |

---

## Evidencia ancla

- Schema: `packages/db/prisma/schema.prisma` (`User`, `UserSession`, `FotorankJudgeAccount`, `DnxPaymentAccount`)
- Paquete: `packages/auth/src/{identity,password,sessions,google-oauth,password-reset}.ts`
- CLF bridge: `apps/compramelafoto/lib/auth.ts`
- Clickatón DB: `docs/clickaton/RELEASE_10B2_PRODUCTION_INFRA_REPORT.md`
- Auth0 N/A: `docs/clickaton/RELEASE_10A_AUTH0_IDENTITY_AUDIT.md`
