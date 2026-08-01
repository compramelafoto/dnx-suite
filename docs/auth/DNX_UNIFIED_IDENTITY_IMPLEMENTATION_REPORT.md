# Informe de implementación — Ley de Identidad Única DNX (10B.4)

**Fecha:** 2026-07-29  
**Commit/deploy:** no realizados (entrega de auditoría + núcleo primero)

---

## Estado final

```text
DNX IDENTITY CORE READY — MIGRATION PENDING
```

**Operacionalmente** el login cruzado Clickatón ↔ suite sigue **bloqueado a nivel de infraestructura** mientras Clickatón use Neon/DB propio (ver auditoría). El código de verificación de contraseña ya es compatible; falta Estrategia A (DB compartida) o B (servicio central).

No se declara `DNX UNIFIED IDENTITY LAW ENFORCED` porque:

- Staging cross-app no validado end-to-end en esta entrega.
- Clickatón DB separada.
- `FotorankJudgeAccount` sigue siendo identidad paralela.
- Varios `prisma.user.create` en apps aún son deuda (warnings del architecture check).

---

## 1. Estado anterior

- CLF: bcrypt only → rechazaba scrypt de otras apps.
- Clickatón/FotoRank: verify dual, pero DB Clickatón separada.
- Cookie legacy `auth-token` en CLF.
- Jurados FotoRank fuera de `User`.
- Sin `docs/auth/` ni ADR de identidad suite.
- Sin `pnpm auth:architecture:check`.

## 2. Fuentes de identidad encontradas

| Fuente | Uso |
| ------ | --- |
| `User` (`@repo/db`) | Canónica |
| `User.googleId` | Google |
| `FotorankJudgeAccount` | Paralela |
| Auth0 | N/A |
| Cookie `auth-token` | Legacy CLF |

## 3. Bases

Ver matriz en `DNX_SUITE_IDENTITY_CURRENT_STATE_AUDIT.md`. Clickatón Staging/Prod = Neon propio.

## 4. Hashes

Canónico: scrypt. Legacy: bcrypt con rehash en `verifyUserPassword`.

## 5. Sesiones

Contrato `dnx_session` + `UserSession`. Cookies locales por dominio.

## 6. Google

`resolveOrLinkGoogleUser` central; apps aún pasan `onCreate` con `prisma.user.create` (migrar a `resolveOrCreateUser`).

## 7. Auth0

No aplica. Si se introduce: autentica; DNX determina `User.id` vía `ExternalIdentity`.

## 8. Duplicados

Riesgo principal: mismos emails en DB suite vs Clickatón. Inventario cuantitativo pendiente de queries Staging.

## 9. Paquete central

`@repo/auth` ampliado:

- `normalizeIdentityEmail`, `findUserByIdentity`, `resolveOrCreateUser`
- `verifyUserPassword` (+ rehash)
- `linkExternalIdentity`, `createIdentitySession`, `resolveSession`, `destroySession`, `revokeUserSessions`
- `getUserApplicationAccess`
- `detectPasswordHashFormat`
- Scripts: `identity:selfcheck`, `architecture:check`

## 10. Cambios CLF

- Login → `verifyUserPassword`
- Register / reset / change-password / admin create → `hashPassword` scrypt
- Bridge `auth-token` conservado (deuda)

## 11. Cambios Clickatón

- Login → `verifyUserPassword` (rehash)
- DB consolidation **pendiente** (bloqueante para cross-app real)

## 12. Cambios FotoRank

- `password.ts` re-export `@repo/auth`
- Login organizador → `verifyUserPassword`
- Jurados: sin cambio (deuda documentada)

## 13. Cambios InfoSpot

- Login → `verifyUserPassword`

## 14. Cambios FotoOffice

- `password.ts` re-export `@repo/auth`
- Login → `verifyUserPassword`

## 15. Recuperación

API central existente: `requestPasswordReset` / `resetPasswordWithToken`. CLF aún tiene ruta legacy; debe converger. Test cross-app Staging pendiente.

## 16. Payment accounts

Modelo `DnxPaymentAccount` + bridge legacy CLF en `@repo/payments`. Tokens no deben copiarse en claro. Grants por app = fase 4.

## 17. Tests

- `pnpm auth:identity:selfcheck` — normalización, scrypt, bcrypt legacy, apps list
- Architecture check — ver §18
- Tests DB/cross-app Staging — pendientes (fixtures A–D)

## 18. Architecture checks

```bash
pnpm auth:architecture:check
```

Detecta: password local, User create directo, cookies no autorizadas, modelos User duplicados, exposición de hash.

## 19. Staging

No se ejecutó validación cross-app end-to-end en esta entrega (sin deploy / sin consolidar Clickatón DB).

Plan fixtures:

| Usuario | Origen | Validar |
| ------- | ------ | ------- |
| A | CLF bcrypt legacy | login CLF → Clickatón → FotoRank, mismo id, rehash |
| B | Google | mismo User + una external identity |
| C | Alta Clickatón | login CLF + FotoRank |
| D | FotoRank existente | login CLF + Clickatón |

## 20. Riesgos

1. **Clickatón DB separada** — duplicados al unificar.
2. Fusión ambigua Google/email — no auto-merge.
3. Jurados paralelos — confusión de producto.
4. Cookie `auth-token` — sesión fantasma si no se limpia.
5. `WorkspaceAppAccess` fuera del schema activo — allowlists temporales.

## 21. Rollback

| Cambio | Rollback |
| ------ | -------- |
| verify dual + rehash | Revert código; hashes scrypt siguen verificables en apps dual |
| Escritura scrypt en CLF | Apps dual siguen OK; no borrar usuarios |
| Alias / fusión | No DELETE; reactivar oldUserId vía alias |
| Architecture check | Desactivar script CI si bloquea emergencia |

No revertir eliminando usuarios.

## 22. Deuda legacy

- `auth-token` CLF
- `FotorankJudgeAccount`
- `User.mp*` plaintext columns
- `prisma.user.create` en Google callbacks / registers
- Tabla `ExternalIdentity` / `UserIdentityAlias` no creadas aún
- SSO central no implementado

## 23. Plan SSO

Ver `DNX_SSO_CENTRAL_DESIGN.md` — Fase 5.

## 24. Plan de despliegue

| Fase | Contenido | Estado |
| ---- | --------- | ------ |
| 1 | Paquete central, verify dual, tests, architecture check | **Hecho (código)** |
| 2 | CLF + Clickatón + FotoRank login unificado | Código hecho; Clickatón DB pendiente |
| 3 | InfoSpot + FotoOffice | Código login hecho |
| 4 | ExternalIdentity, reset 100% central, payment grants | Pendiente |
| 5 | SSO + logout global + retiro legacy | Pendiente |

## Archivos clave modificados / creados

### Docs

- `docs/auth/DNX_SUITE_IDENTITY_CURRENT_STATE_AUDIT.md`
- `docs/auth/DNX_IDENTITY_SOURCE_OF_TRUTH.md`
- `docs/auth/DNX_PASSWORD_MIGRATION_STRATEGY.md`
- `docs/auth/DNX_IDENTITY_MIGRATION_INVENTORY.md`
- `docs/auth/HOW_TO_INTEGRATE_A_DNX_APP.md`
- `docs/auth/DNX_SSO_CENTRAL_DESIGN.md`
- `docs/auth/DNX_IDENTITY_PROPOSED_SCHEMA.md`
- `docs/auth/DNX_UNIFIED_IDENTITY_IMPLEMENTATION_REPORT.md`
- `docs/architecture/ADR-DNX-001-UNIFIED-IDENTITY.md`

### Código

- `packages/auth/src/identity.ts` (+ email, password-format, selfcheck)
- `packages/auth/scripts/architecture-check.ts`
- `packages/auth/src/index.ts`, `package.json`, root `package.json`
- Logins: CLF, Clickatón, FotoRank, InfoSpot, FotoOffice
- Hashes CLF register/reset/change/admin → scrypt
- Re-exports password FotoRank / FotoOffice

## Próximo paso recomendado (antes de Production)

1. Apuntar Clickatón Staging a la misma `DATABASE_URL` de identidad suite **o** desplegar servicio central.
2. Correr inventario de emails/IDs.
3. Validar fixtures A–D en Staging.
4. Solo entonces considerar Production.
