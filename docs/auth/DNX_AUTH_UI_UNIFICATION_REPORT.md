# Informe — Unificación UX/UI de autenticación DNX (10B.7)

**Fecha:** 2026-07-30  
**Estado final:**

```text
DNX AUTH UX UNIFIED IN STAGING — FULL SUITE
```

**Phase 2:** `docs/auth/DNX_AUTH_UI_PHASE2_ROLLOUT_REPORT.md`  
**Phase 3 (InfoSpot + FotoOffice):** `docs/auth/DNX_AUTH_UI_PHASE3_ROLLOUT_REPORT.md`

Production no tocada.

---

## 1. Auditoría inicial

Ver `DNX_AUTH_UI_CURRENT_STATE_AUDIT.md`.

Hallazgo inicial (Fase 1): ninguna app cumplía el orden canónico; Google mal ubicado; ojito casi solo en ComprameLaFoto; CTAs inconsistentes. Superado en rollout Phase 2 + 3.

## 2. Orden canónico

Documentado en `DNX_AUTH_INFORMATION_ARCHITECTURE.md` y codificado en `DNX_LOGIN_ORDER` / `DNX_REGISTER_ORDER` (`@repo/auth-ui`).

## 3. Componentes

Paquete nuevo `packages/auth-ui` (`@repo/auth-ui`):

- Shell, Header, Email, Password(+ojito), Primary CTA, Google, Divider, Error, Notice, Links, Requirements, Verification, SessionExpired, ProfileSwitcher  
- Paneles: Login, Register, Forgot, Reset  

Sin acoplamiento a Prisma.

## 4. Tokens

`packages/auth-ui/src/tokens.css` — variables `--auth-*` + `data-brand` por app.

## 5–9. Apps (estado rollout)

| App | Brand config | Migración UI |
| --- | ------------ | ------------ |
| Clickatón | `clickatonAuthBrand` | **Staging verde** Phase 2 |
| FotoRank | `fotorankAuthBrand` | **Staging verde** Phase 2 |
| ComprameLaFoto monorepo | `compramelafotoAuthBrand` | **Staging verde** Phase 2 |
| InfoSpot | `infospotAuthBrand` (invitation-only) | **Staging** Phase 3 |
| FotoOffice | `fotofficeAuthBrand` (Google emphasized) | **Staging** Phase 3 |

## 10. Roles

`DnxProfileSwitcher` post-login; login no lista perfiles como identidad.

## 11. Google

Contrato: después de CTA + divider, antes de crear cuenta.  
FotoOffice: énfasis visual sin cambiar orden.

## 12. Ojito

`DnxPasswordField` con `aria-label` Mostrar/Ocultar, posición derecha, hit target 44px.

## 13–15. Forgot / Reset / Registro

Paneles canónicos en las 5 apps principales. InfoSpot: invite-only (sin registro público). FotoOffice: registro de identidad no en login; estudio/onboarding post-Cuenta DNX.

## 16–17. Accesibilidad / Responsive

Estándar en `DNX_AUTH_ACCESSIBILITY_STANDARD.md`.  
Shell: una columna, `max-width: var(--auth-content-width)`, padding táctil.

## 18. Catálogo

`packages/auth-ui/src/catalog/stories.ts` — historias declarativas (Storybook-ready).  
Ver `packages/auth-ui/CATALOG.md`.

## 19. Tests

`pnpm auth:ui:selfcheck` — orden, anti-patrones Google, brands, stories.

## 20. CI

`pnpm auth:ui:architecture:check` — 0 errors; **warn** en deuda residual (registros rol ComprameLaFoto monorepo, jurado FotoRank).

## 21. Deuda legacy

- Registros de rol / CuantoCobro (ComprameLaFoto monorepo).  
- Jurado FotoRank login/register paralelo.  
- Warnings `prisma.user.create` fuera de `@repo/auth` (callbacks Google InfoSpot/FotoOffice, etc.).

## 22. Riesgos

- Confundir Google emphasized (FotoOffice) con reordenar el formulario.  
- Confundir Authn (Cuenta DNX) con Authz (membership InfoSpot/estudio).  
- Open redirects si `returnTo` no pasa por `sanitizeReturnTo`.

## 23. Estado de identidad

Identidad unificada en Staging (Phase 2 prerequisite): misma fuente, mismo `User.id`, forgot/reset central, Google unificado, fixtures cross-app PASS.

## 24. Estado final

`DNX AUTH UX UNIFIED IN STAGING — FULL SUITE`

### Criterios cumplidos

- [x] Auditoría + estándares + componentes  
- [x] Brand configs (5 apps)  
- [x] Phase 2: ComprameLaFoto monorepo + Clickatón + FotoRank  
- [x] Phase 3: InfoSpot + FotoOffice  
- [x] Selfcheck + architecture check (0 errors)  
- [x] Builds InfoSpot + FotoOffice  
- [x] Sin deploy productivo  
- [x] Ley arquitectónica documentada (Phase 3 report)  

### Deuda residual (no bloquea FULL SUITE)

- [ ] Migrar pantallas rol/jurado residuales  
- [ ] `resolveOrCreateUser` en callbacks Google restantes  
- [ ] Tests visuales / a11y cross-app ampliados 
