# Fuente de verdad única — Identidad DNX

**Estado:** ACCEPTED — MANDATORY (ETAPA 10B.4)  
**ADR:** `docs/architecture/ADR-DNX-001-UNIFIED-IDENTITY.md`

---

## Decisión

```text
DnxIdentity (lógico)
└── User                          ← packages/db (ÚNICA fuente de autenticación)
    ├── User.password             ← credencial central (scrypt canónico)
    ├── User.googleId             ← external identity GOOGLE (fase 1)
    ├── UserSession[]             ← sesiones opacas (cookie dnx_session)
    ├── PasswordResetToken[]      ← recuperación central
    ├── DnxUserProfile            ← perfiles públicos multi-app
    ├── InfoSpotUserRole / …      ← roles por aplicación
    ├── WorkspaceMembership[]     ← membresías workspace
    ├── DnxFinancialIdentity      ← identidad financiera
    │   └── DnxPaymentAccount[]
    └── (futuro) ExternalIdentity[] / UserIdentityAlias[] / ApplicationMembership[]
```

## Paquete canónico

**`packages/auth` (`@repo/auth`)** es el único lugar autorizado para:

| Operación | API |
| --------- | --- |
| Normalizar email | `normalizeIdentityEmail` |
| Buscar usuario | `findUserByIdentity` |
| Resolver/crear | `resolveOrCreateUser` |
| Verificar password | `verifyUserPassword` (rehash incluido) |
| Hash/verify bajo nivel | `hashPassword` / `verifyPassword` |
| Vincular Google | `linkExternalIdentity` / `resolveOrLinkGoogleUser` |
| Sesión | `createUserSession` / `createIdentitySession` / `resolveSession` / `destroySession` / `revokeUserSessions` |
| Acceso por app | `getUserApplicationAccess` |
| Reset | `requestPasswordReset` / `resetPasswordWithToken` |

## Prohibiciones

1. Ninguna app importa un Prisma local para autenticación.
2. Ninguna app mantiene tabla `*User` como fuente de login.
3. Ninguna app implementa bcrypt/scrypt/argon propios para login.
4. Ninguna app guarda contraseñas, Google IDs o tokens OAuth fuera del modelo central / vault.
5. Roles no se confían desde el frontend; se resuelven server-side.

## Estrategia de bases

### Estrategia A — DB compartida (preferida corto plazo)

Todas las apps (incluida Clickatón) apuntan a la misma instancia con el mismo `User`.

### Estrategia B — servicio central (largo plazo / SSO)

Apps con DB operativa propia consumen identidad vía servicio (`auth.dnxsuite.com`) y guardan solo `dnxUserId` + perfiles/memberships.

### Estrategia C — copiar usuarios — **PROHIBIDA**

No sincronizar hashes, emails, Google IDs ni sesiones entre bases.

## Perfiles vs identidad

| Concepto | Alcance | Ejemplo |
| -------- | ------- | ------- |
| Identidad | Global | `User.id`, email, password, googleId |
| Rol/perfil app | Por aplicación | CLF `Role.PHOTOGRAPHER`, InfoSpot `DIRECTOR`, FotoRank organizer |
| Sesión | Por dominio (cookie local) | Representa el mismo `User.id` |
| Payment account | Global al User | Grants por aplicación |

## Cookies

Nombre canónico de sesión: **`dnx_session`**.

Dominios distintos no comparten cookie. Cada app emite su cookie local con el mismo contrato (`UserSession` + token opaco). No usar cookie de otro dominio como integración.
