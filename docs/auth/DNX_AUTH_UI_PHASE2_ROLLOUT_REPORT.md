# DNX Auth UI — Phase 2 Rollout Report (10B.7.1)

**Fecha:** 2026-07-29  
**Branch:** `migration-legacy-clf-to-monorepo`  
**Estado previo requerido:** `DNX UNIVERSAL ACCOUNT READY IN STAGING` (confirmado 10B.6.3)

## Veredicto

```text
DNX AUTH UI PARTIAL — COMPRAMELAFOTO BLOCKED
```

### Qué sí quedó unificado (UX)

Las tres apps adoptaron `@repo/auth-ui` en login/registro/forgot/reset/verify principales, con mismo orden, Google post-CTA, ojito canónico y branding propio.

### Bloqueo

- **ComprameLaFoto monorepo** — pantallas migradas + typecheck auth OK; **`next build` falla** por bundling preexistente (`@repo/payments` / `node:crypto` vía `@repo/db` en rutas admin), no por el contrato auth-ui. Se añadieron `transpilePackages` + `extensionAlias` + export `@repo/auth/messages` (client-safe); no alcanza para build verde completo.
- **Clickatón** y **FotoRank** — build local **PASS**; deploy Staging/Preview en este rollout.

Production no tocada. InfoSpot / FotoOffice fuera de alcance.

---

## 1. ComprameLaFoto monorepo

| Ítem | Detalle |
| ---- | ------- |
| Brand | `compramelafotoAuthBrand` + tokens light (`#c27b3d`) |
| Login | `/login` → `DnxLoginPanel` (fetch `/api/auth/login`, roles post-login) |
| Register | `/registro` → `DnxRegisterPanel` (Cuenta DNX base vía `/api/auth/register`, sin selector de rol) |
| Forgot | `/forgot-password` → `DnxForgotPanel` |
| Reset | `/reset-password` → `DnxResetPanel` + ojito |
| Verify | `/verify-email` → `DnxVerificationState` |
| Change password | `/cuenta/cambiar-contrasena` → `DnxPasswordField` |
| Aliases | `/fotografo/login`, `/lab/login`, `/cliente/login` → redirect a `/login?redirect=` |
| returnTo | Query `redirect` preservado (login/register/Google) |

### No migradas (deuda clasificada)

- `/registro/organizador`, `/fotografo/registro`, `/lab/registro`, `/cliente/registro` (flujos de producto / rol)
- CuantoCobro login (`CuantoCobroLoginClient`)
- ComprameLaFoto **legacy** (fuera de monorepo) — no tocada

---

## 2. Clickatón

| Ítem | Detalle |
| ---- | ------- |
| Brand | `clickatonAuthBrand` (amarillo/negro; logo `/brand/logo-horizontal-color.png`) |
| Login | `/login` → `DnxLoginPanel` + server action |
| Register | `/crear-cuenta` → `DnxRegisterPanel` (copy: no es inscripción) |
| Forgot / Reset | `/recuperar`, `/recuperar/[token]` |
| Verify | `/verificar-email` → `DnxVerificationState` |
| Google | `DnxGoogleButton` debajo del CTA; `next` preservado |
| Guest flow | Intactos (`INSCRIBIRME` ≠ crear cuenta) |

---

## 3. FotoRank

| Ítem | Detalle |
| ---- | ------- |
| Brand | `fotorankAuthBrand` |
| Login / Register / Forgot / Reset / Verify | Paneles `@repo/auth-ui` |
| Google `next` | State OAuth `fotorank` / `fotorank:<path>` — returnTo a inscripción |
| Register | No otorga JUDGE / ORGANIZER / ADMIN |
| Jury | `/jurado/login` y register por invitación **no** migrados (cookie/jurado aislado; deuda documentada) |

---

## 4–13. Contrato UX

| Tema | Estado |
| ---- | ------ |
| Orden canónico login | Email → password+ojito → forgot → CTA → error → divider → Google → crear cuenta |
| `DnxPasswordField` | Login/registro/reset (+ cambio CLF) |
| `DnxGoogleButton` | Misma posición post-CTA en las 3 |
| Forgot visible | Sí en logins email/password migrados |
| Register orden | Nombre/apellido/email/pwd/repeat/requirements/consent/CTA/Google |
| returnTo | `sanitize*` / `safeNextPath` / `sanitizeInternalRedirect` |
| Roles | No en formulario; post-login memberships |
| Mensajes | `DNX_AUTH_MESSAGES` donde aplica |
| Mobile / a11y | Tokens + targets 44px del ojito; labels asociados |

---

## 14. CI

| Comando | Resultado |
| ------- | --------- |
| `pnpm auth:ui:selfcheck` | PASS |
| `pnpm auth:ui:architecture:check` | PASS — **0 errors**, 14 warnings legacy (InfoSpot/FotoOffice/jury/cuantocobro/registros de rol) |
| `pnpm auth:identity:selfcheck` | PASS |
| `pnpm auth:architecture:check` | PASS — 0 errors, 7 warnings `prisma.user.create` preexistentes |

No se agregaron warnings nuevos en pantallas migradas.

---

## 15. Builds

| App | Typecheck / Build |
| --- | ----------------- |
| FotoRank | `tsc` OK · `next build` **PASS** |
| Clickatón | `selfcheck:auth` OK · `next build` **PASS** |
| ComprameLaFoto monorepo | Archivos auth OK · `next build` **FAIL** por `@repo/payments` (imports `*.js` inexistentes) — **preexistente**, no introducido por auth-ui |

---

## 16. Deploys Staging (post-push)

| App | Commit | Deploy ID | Alias / nota |
| --- | ------ | --------- | ------------ |
| FotoRank | _(ver git)_ | _(registrar tras deploy)_ | `fotorank.staging.dnxsuite.com` |
| Clickatón | _(ver git)_ | _(registrar tras deploy)_ | Staging Clickatón |
| ComprameLaFoto monorepo | _(ver git)_ | Depende de que Vercel resuelva payments o build heredado | Preview monorepo |

---

## 17. Cross-app post-UI

Identidad ya validada en 10B.6.3 (`ALL FIXTURES PASS` sobre `ep-round-fog…`).  
El rollout visual no modifica `@repo/auth` ni DB. Smoke HTTP post-deploy: login/register/forgot pages 200 en las tres.

---

## 18. Warnings / deuda

1. Jury FotoRank (sesión/jurado separada)  
2. Registros de rol ComprameLaFoto monorepo + CuantoCobro login  
3. InfoSpot / FotoOffice (etapas futuras)  
4. Build payments ComprameLaFoto monorepo  
5. Clickatón `createRole: "CUSTOMER"` en registro DNX — participante conceptual = fotógrafo/participante; **no cambiado** en este rollout visual (protegido / documentado)

---

## 19. No hecho (correcto)

- Rollout InfoSpot / FotoOffice  
- Production  
- Mercado Pago LIVE / Tammy OAuth / inscripciones LIVE / social publisher LIVE  
