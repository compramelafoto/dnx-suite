# DNX Auth UI — Phase 2 Rollout Report (10B.7.1 + 10B.7.1.1)

**Fecha:** 2026-07-29  
**Branch:** `migration-legacy-clf-to-monorepo`  
**Estado previo requerido:** `DNX UNIVERSAL ACCOUNT READY IN STAGING` (confirmado 10B.6.3)

## Veredicto

```text
DNX AUTH UX UNIFIED IN STAGING — PHASE 2 COMPLETE
```

### Qué quedó unificado (UX)

Las tres apps adoptaron `@repo/auth-ui` en login/registro/forgot/reset/verify principales, con mismo orden, Google post-CTA, ojito canónico y branding propio.

### Desbloqueo 10B.7.1.1

- **ComprameLaFoto monorepo** — `next build --webpack` local **PASS**; causa raíz documentada en `docs/compramelafoto/CLF_MONOREPO_BUILD_BLOCKER_ROOT_CAUSE.md`.
- **No atribuible a `@repo/auth-ui`**: primer fallo = Client Component admin → barrel `@repo/db` → `clf-event-write` → `node:crypto`.
- Clickatón / FotoRank Staging: sin regresión intencional en este cierre (no se tocó su runtime salvo consumidores InfoSpot de `@repo/db/clf-event-write`).

Production no tocada. InfoSpot / FotoOffice fuera de alcance de UX Phase 2.

---

## 1. Causa raíz build (ComprameLaFoto monorepo)

| Ítem | Detalle |
| ---- | ------- |
| Comando | `pnpm --filter compramelafoto exec next build --webpack` |
| Primer error | `UnhandledSchemeError: node:crypto` |
| Cadena | `admin/.../fotografia-basica-funes/page.tsx` (`"use client"`) → `dnx-foto-basica-funes.ts` → `@/lib/prisma` → `@repo/db` barrel → `clf-event-write.ts` |
| Package | `@repo/db` (no `@repo/auth-ui`) |
| Secundario | Barrel `@repo/payments` en dual-read (riesgo si llegaba a client); acotado a subpaths |

### Cambios estructurales

1. `lib/dnx-foto-basica-funes-public.ts` — constantes/helpers client-safe.
2. `@repo/db/clf-event-write` — subpath; **no** reexportado desde barrel principal.
3. Dual-read CLF → `@repo/payments/credential-vault` + `infrastructure/prisma/credential-store` + `financial-identity-ports` + `dual-read` (sin barrel ni `persistence` / BigInt ES2020).
4. PageProps Next 16: `params`/`searchParams` como `Promise<…>` (requerido por typecheck de producción).
5. `LabConfigPageContent` extraído fuera de `page.tsx` (export inválido en Page).

---

## 2. ComprameLaFoto monorepo — auth-ui

| Ítem | Detalle |
| ---- | ------- |
| Brand | `compramelafotoAuthBrand` + tokens light (`#c27b3d`) |
| Login | `/login` → `DnxLoginPanel` |
| Register | `/registro` → `DnxRegisterPanel` |
| Forgot / Reset / Verify | Paneles `@repo/auth-ui` |
| returnTo | Query `redirect` preservado |
| Auth-ui revert | **No** |

### No migradas (deuda clasificada)

- Registros de rol + CuantoCobro login  
- ComprameLaFoto **legacy** (fuera de monorepo)

---

## 3. Clickatón / 4. FotoRank

Sin cambios de UX en este cierre 10B.7.1.1. Deploys Staging previos (`07bff77` / auth-ui) permanecen la base visual.  
Consumidor InfoSpot de escritura CLF actualizado a `@repo/db/clf-event-write` (dependencia estricta del fix de barrel).

---

## 5. Contrato UX

| Tema | Estado |
| ---- | ------ |
| Orden canónico login | Email → password+ojito → forgot → CTA → error → divider → Google → crear cuenta |
| Auth-ui | Conservado en las 3 apps |
| Mensajes | `DNX_AUTH_MESSAGES` / `@repo/auth/messages` client-safe |

---

## 6. CI (post-fix)

| Comando | Resultado |
| ------- | --------- |
| `pnpm auth:ui:selfcheck` | PASS — 0 errors |
| `pnpm auth:ui:architecture:check` | PASS — 0 errors, 14 warnings legacy (sin nuevos en pantallas migradas) |
| `pnpm auth:identity:selfcheck` | PASS |
| `pnpm auth:architecture:check` | PASS — 0 errors, 7 warnings `prisma.user.create` preexistentes |

---

## 7. Builds

| App | Build |
| --- | ----- |
| FotoRank | PASS (previo) |
| Clickatón | PASS (previo) |
| ComprameLaFoto monorepo | **`next build --webpack` PASS** (local, NODE_OPTIONS 8GB; heap OOM local mitigado) |

Payments smoke (no destructivo): imports dual-read por subpath; compile checkout/webhook no roto por el cambio de barrel; sin MP LIVE.

---

## 8. Deploys Staging

| App | Commit | Deploy ID | Alias / nota |
| --- | ------ | --------- | ------------ |
| FotoRank | `07bff77` / posteriores | `dpl_5bAmzho2C9yoMB8xVMxxTJTmr1hm` (base UI) | `fotorank.staging.dnxsuite.com` |
| Clickatón Staging | `07bff77` / posteriores | `dpl_9EbctZjN7KheeA9artrKsmf83BVn` | `clickaton-staging.vercel.app` |
| ComprameLaFoto monorepo | *(este cierre)* | ver §8.1 post-push | Preview/Staging — **no Production** |

### 8.1 ComprameLaFoto monorepo post-10B.7.1.1

Rellenar tras push/deploy:

| Campo | Valor |
| ----- | ----- |
| Commit | _(pending push)_ |
| Deploy ID | _(pending)_ |
| Alias | `compramelafoto.staging.dnxsuite.com` / preview Vercel |
| Health | _(pending validate)_ |

---

## 9. Smoke remoto / cross-app

Tras Preview READY:

- HTTP: home, login, register, forgot, reset, Google CTA, redirect protegido, admin curso Funes, ruta payments admin relevante (sin mutaciones financieras).
- Cross-app reducido: User A CLF → Clickatón → FotoRank mismo `User.id`; forgot desde CLF; Google una sola ExternalIdentity (fixtures 10B.6.3 como baseline).

---

## 10. Deuda no bloqueante (backlog)

1. Jury FotoRank (sesión/jurado separada)  
2. CuantoCobro login  
3. Registros role-specific ComprameLaFoto monorepo  
4. InfoSpot / FotoOffice auth-ui  
5. Slim adicional `@/lib/prisma` para Client Components que importan enums por valor (no bloquea build tras sacar `clf-event-write` del barrel)

---

## 11. No hecho (correcto)

- Production  
- Mercado Pago LIVE  
- Revert auth-ui  
- Polyfill `node:crypto` en browser  
- Textos legales  
