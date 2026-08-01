# Cómo integrar una nueva aplicación DNX

Toda aplicación nueva de DNX Suite **debe** cumplir la Ley de Identidad Única (ADR-DNX-001).

---

## Checklist obligatorio

1. **Registrar Application ID** (string estable, p. ej. `my-app`) en docs + `DNX_APPLICATIONS` si aplica.
2. **Depender de `@repo/auth` y `@repo/db`** — no crear Prisma schema de User propio.
3. Usar **`User.id`** como identificador de persona.
4. Crear **memberships / perfiles de app** vinculados a `User.id` (nunca un segundo User).
5. Emitir sesión con **`createUserSession` / `createIdentitySession`** y cookie **`dnx_session`**.
6. Login password con **`verifyUserPassword`** (rehash incluido).
7. Registro con **`registerDnxAccount`** (o `resolveOrCreateUser`) + verificación email.
8. Google con **`resolveOrLinkGoogleUser`**.
9. Forgot/reset con **`requestPasswordReset` / `resetPasswordWithToken`**.
10. Cambio de password con **`changeUserPassword`**.
11. `returnTo` con **`sanitizeReturnTo`**.
12. **No** guardar passwords fuera de `User.password`.
13. **No** guardar OAuth tokens de identidad en la app.
14. Payments: usar **`DnxPaymentAccount` + grants** — no columnas MP locales.
15. Pasar **`pnpm auth:architecture:check`** y **`pnpm auth:identity:selfcheck`**.
16. Cumplir `DNX_ACCOUNT_LIFECYCLE_STANDARD.md` antes de Production.
17. Apuntar a la **DB de identidad compartida** (ADR-DNX-002).
18. **UX (10B.7):** usar **`@repo/auth-ui`** (`DnxLoginPanel` / brand config). Orden canónico obligatorio. Pasar **`pnpm auth:ui:architecture:check`** y **`pnpm auth:ui:selfcheck`**. Ver `DNX_AUTH_UI_SYSTEM.md` y `DNX_AUTH_NEW_APP_CHECKLIST.md`.

---

## Ejemplo mínimo (login)

```ts
import { verifyUserPassword, createUserSession, DNX_SESSION_COOKIE } from "@repo/auth";

const verified = await verifyUserPassword({ email, password });
if (!verified.ok) throw new Error("Credenciales inválidas");

const session = await createUserSession(verified.user.id, { rememberMe });
// Set-Cookie: dnx_session=<session.rawToken>; HttpOnly; Secure; SameSite=Lax
```

## Ejemplo mínimo (registro)

```ts
import { resolveOrCreateUser, hashPassword } from "@repo/auth";

const { user, created } = await resolveOrCreateUser({
  email,
  password,
  name,
  createRole: "CUSTOMER",
  sourceApplication: "my-app",
});
// Luego: crear MyAppProfile { userId: user.id, ... } si hace falta
```

---

## Prohibido

- `model MyAppUser` con password/googleId.
- `bcrypt.hash` / `scryptSync` locales para login.
- Cookies de sesión nuevas no listadas en el architecture check.
- Copiar usuarios desde otra DB.
- Confiar roles enviados por el cliente.

---

## Template de nueva app

Al generar una app en el monorepo:

- Añadir dependencia `workspace:*` a `@repo/auth`, `@repo/db` y `@repo/auth-ui`.
- Incluir scripts CI: `pnpm auth:architecture:check`, `pnpm auth:ui:architecture:check`.
- Copiar este checklist y `DNX_AUTH_NEW_APP_CHECKLIST.md` al README de la app.
