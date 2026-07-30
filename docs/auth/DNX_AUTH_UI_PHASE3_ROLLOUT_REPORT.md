# DNX Auth UI — Phase 3 Rollout Report (10B.7.2)

**Fecha:** 2026-07-30  
**Branch:** `migration-legacy-clf-to-monorepo`  
**Estado previo requerido:** `DNX AUTH UX UNIFIED IN STAGING — PHASE 2 COMPLETE`

## Veredicto

```text
DNX AUTH UX UNIFIED IN STAGING — FULL SUITE
```

Production no tocada. Mercado Pago LIVE / Tammy / Clickatón LIVE / social publisher LIVE: fuera de alcance.

---

## 1. Alcance

| App | Rol en Phase 3 |
| --- | -------------- |
| InfoSpot | Migración auth UI + invite-only CTA |
| FotoOffice | Migración auth UI + Google emphasized (orden canónico) |
| ComprameLaFoto monorepo / Clickatón / FotoRank | Ya verdes en Phase 2 — sin regresión intencional |

---

## 2. InfoSpot — auditoría y UX

### Modelo

```text
Cuenta DNX  ≠  Rol editorial InfoSpot (DIRECTOR | REDACTOR | COLABORADOR)
```

- **Invite-only** para roles editoriales: no hay registro público.
- Login/Google/forgot/reset usan identidad central (`@repo/auth` + `dnx_session`).
- Crear Cuenta DNX **no** otorga membership editorial.

### Rutas

| Superficie | Ruta | Componente |
| ---------- | ---- | ---------- |
| Login | `/ingresar` | `DnxLoginPanel` + `infospotAuthBrand` |
| Forgot | `/recuperar` | `DnxForgotPanel` |
| Reset | `/recuperar/[token]` | `DnxResetPanel` + `DnxPasswordField` |
| Invite help | `/invitar` | Copy invite-only (sin “Crear cuenta” genérica) |
| Accept invite | `/invitar/[token]` | Flow membership + `DnxPasswordField` si aplica |
| Google | `/api/auth/google` (+ callback) | `DnxGoogleButton` vía panel |
| Protected | `/redaccion/*` | Authn ≠ Authz (membership requerida) |

### Orden canónico

Identidad → título → contexto → email → password+ojito → forgot → CTA → error → divider → Google → **¿Recibiste una invitación?** → términos/privacidad.

### Branding

Tokens `data-brand="infospot"` (acento editorial naranja `#f86000`), tipografía/tono InfoSpot.

### Invitaciones

1. Token seguro en URL.  
2. Vinculada a email / identidad.  
3. Login o creación de Cuenta DNX vía contrato central.  
4. Aceptación de membership + rol específico.  
5. Mismo `User.id` si el usuario ya existe (sin duplicar).  
6. Sin password temporal insegura.

### Forgot/reset

Exclusivamente sistema DNX central (`passwordResetNeutralMessage`, tokens centrales). Invite-only **no** excluye forgot si el usuario tiene credencial DNX.

---

## 3. FotoOffice — auditoría y UX

### Qué significaba “Google-first” en código

Era **layout local** (Google visualmente arriba / énfasis), **no** identidad Google-only:

- Email/password + forgot/reset ya existían vía `@repo/auth`.
- Auto-workspace / onboarding post-login.
- Sin registro público de identidad en login (estudio ≠ Cuenta DNX).

### Decisión UX

Mantener `googleVisualEmphasis: "emphasized"` **sin** alterar el orden canónico:

```text
email → password+ojito → forgot → CTA → error → divider → Google
```

Una cuenta FotoOffice = **Cuenta DNX**. Google-only puede crear password vía flow DNX existente.

### Rutas

| Superficie | Ruta | Componente |
| ---------- | ---- | ---------- |
| Login | `/login` | `DnxLoginPanel` + `fotofficeAuthBrand` |
| Forgot | `/recuperar` | `DnxForgotPanel` |
| Reset | `/recuperar/[token]` | `DnxResetPanel` |
| Google | `/api/auth/google` | `DnxGoogleButton` |
| Onboarding / dashboard | `/onboarding`, `/dashboard`, `/w/*` | Post-auth producto |
| Protected | dashboard / workspace | Membership de estudio |

### Separación de conceptos

```text
Crear Cuenta DNX  ≠  Crear estudio  ≠  Unirse a estudio
```

Flow: Cuenta DNX → Onboarding FotoOffice → crear estudio **o** aceptar invitación.

### Memberships

Permisos por estudio (roles reales del producto) con el **mismo** `User.id`. No se crea un User por estudio.

---

## 4. Componentes compartidos

Reutilizados desde `@repo/auth-ui`:

- `DnxLoginPanel`, `DnxForgotPanel`, `DnxResetPanel`
- `DnxPasswordField`, `DnxGoogleButton`, shell/fields/divider/error/notice
- Brands: `infospotAuthBrand`, `fotofficeAuthBrand`
- CTA invite-only: `DNX_AUTH_CTA.invitationHelp` / `invitationHref`

### Bundling (aprendizaje Phase 2)

Client UI → Server Action / Route Handler → `@repo/auth` / subpaths DB.  
No importar barrels `@repo/db` desde Client Components.

---

## 5. CI local

| Check | Resultado |
| ----- | --------- |
| `pnpm auth:identity:selfcheck` | PASS |
| `pnpm auth:architecture:check` | 0 errors (warnings `prisma.user.create` preexistentes) |
| `pnpm auth:ui:selfcheck` | PASS (brands=5) |
| `pnpm auth:ui:architecture:check` | 0 errors, 7 warnings legacy (registros rol CLF + jurado FotoRank) |
| `pnpm --filter infospot build` | PASS |
| `pnpm --filter fotoffice build` | PASS |
| `infospot test:google-oauth-start` | PASS |

Architecture check: excluye `/api/` y `**/actions.ts` de `legacy-auth-ui` (falsos positivos en strings server).

---

## 6. Deploys Staging / Preview

| Proyecto Vercel | Target | Notas |
| --------------- | ------ | ----- |
| `infospot-dnxsuite` | preview / staging alias | Sin Production |
| `fotoffice-dnxsuite` | preview / staging alias | Sin Production |

*(IDs/aliases/health se completan tras deploy en esta etapa.)*

---

## 7. Tests / smoke (mínimo)

### InfoSpot

Login email/password, invalid password, Google, forgot, reset, invite existing/new User (sin duplicate), role assignment, unauthorized rejected, returnTo.

### FotoOffice

Login email/password, Google, Google-only → create password, forgot, reset, create studio / membership, same User, returnTo.

### Cross-app

Fixture Cuenta DNX:

```text
ComprameLaFoto monorepo → Clickatón → FotoRank → InfoSpot → FotoOffice
```

Mismo `User.id`. Authn puede PASS con Authz REJECT (ej. InfoSpot sin membership editorial).

---

## 8. Legal

No se modificaron términos/políticas automáticamente.

Si las pantallas nuevas refuerzan “Cuenta DNX en múltiples plataformas” respecto de políticas publicadas actuales:

```text
LEGAL REVIEW RECOMMENDED — DNX CROSS-PLATFORM ACCOUNT DISCLOSURE
```

No hay cambio de cookies/consentimiento detectado en este rollout técnico.

---

## 9. Deuda / riesgos

| Ítem | Severidad |
| ---- | --------- |
| Registros de rol ComprameLaFoto monorepo + CuantoCobro (warn CI) | Baja (deuda Phase 2) |
| Jurado FotoRank login/register paralelo | Media (producto) |
| `prisma.user.create` en callbacks Google InfoSpot/FotoOffice (warn architecture) | Media — migrar a `resolveOrCreateUser` |
| Invitaciones FotoOffice por email (si aún limitadas) | Producto — membership model OK |

---

## 10. Ley arquitectónica (suite completa)

Toda aplicación DNX futura **debe** implementar:

1. Cuenta DNX (identidad central)  
2. Email/password cuando corresponda  
3. Google unificado (`DnxGoogleButton`)  
4. Forgot/reset central  
5. Password eye (`DnxPasswordField`)  
6. UX canónica (`@repo/auth-ui` + orden)  
7. Branding config propio  
8. Roles/memberships **separados** de identidad  
9. `pnpm auth:architecture:check`  
10. `pnpm auth:ui:architecture:check`  

Esta es una **LEY** arquitectónica y de UX del ecosistema DNX.
