# 24 — Reporte Oleada 1: Auth/Login + layout base ComprameLaFoto

**Fecha:** 2026-07-05  
**Oleada:** 1 — Infra transversal auth (P0)  
**Fuente legacy:** `/Users/danielcuart/Desktop/compramelafoto`  
**Destino:** `apps/compramelafoto`  
**Plan:** [`22-code-import-execution-plan.md`](./22-code-import-execution-plan.md) · Oleada 0: [`23-code-import-wave0-report.md`](./23-code-import-wave0-report.md)

---

## Resumen ejecutivo

Oleada 1 **completada**. Auth/login, registro, recuperación de contraseña, verify-email, 13 rutas API auth, layout público base y assets mínimos migrados desde legacy con bridges monorepo.

| Validación | Resultado |
|------------|-----------|
| `pnpm install` | ✅ |
| `pnpm --filter compramelafoto lint` | ✅ (48 warnings legacy, 0 errors) |
| `pnpm --filter compramelafoto typecheck` | ✅ |
| `pnpm --filter compramelafoto build` | ✅ — 20 rutas app + 13 API auth |

**Listo para commit:** sí (incluye `packages/db/src/client.ts` enum reexports + `pnpm-lock.yaml`).

---

## Rutas migradas

### Páginas

| Ruta | Archivos |
|------|----------|
| `/login` | `app/login/page.tsx`, `LoginClient.tsx` |
| `/registro` | `app/registro/page.tsx` |
| `/registro/organizador` | `app/registro/organizador/page.tsx` |
| `/forgot-password` | `app/forgot-password/page.tsx` |
| `/reset-password` | `app/reset-password/page.tsx`, `ResetPasswordClient.tsx` |
| `/verify-email` | `app/verify-email/page.tsx`, `VerifyEmailClient.tsx` |
| `not-found` | `app/not-found.tsx` (nuevo, no existía en legacy) |

### API auth (`app/api/auth/`)

| Endpoint | Método |
|----------|--------|
| `/api/auth/login` | POST |
| `/api/auth/logout` | POST |
| `/api/auth/me` | GET |
| `/api/auth/register` | POST |
| `/api/auth/register-photographer` | POST |
| `/api/auth/register-organizer` | POST |
| `/api/auth/register-lab` | POST |
| `/api/auth/forgot-password` | POST |
| `/api/auth/reset-password` | POST |
| `/api/auth/verify-email` | POST |
| `/api/auth/change-password` | POST |
| `/api/auth/google` | GET |
| `/api/auth/google/callback` | GET |

---

## Archivos copiados (desde legacy)

### App / API

- `app/login/**`, `app/registro/**`, `app/forgot-password/**`, `app/reset-password/**`, `app/verify-email/**`
- `app/api/auth/**` (13 rutas)
- `app/globals.css` (completo con design-system)

### Componentes

- `components/ui/` — `Button`, `Input`, `Card`, `Select`, `Textarea`, `form-control-classes`
- `components/layout/` — `Header`, `Footer`, `SessionTransitionOverlay`

### Lib

- `lib/token-hash.ts`, `lib/public-site-url.ts`, `lib/utils.ts`, `lib/referral-cookie.ts`
- `lib/referral/referral-signup-attribution.ts`
- `lib/terms/labTerms.ts`, `lib/default-lab-products.ts`
- `lib/cuantocobro/constants.ts`, `lib/cuantocobro/user-access.ts`
- `lib/photographer-slugs.ts`, `lib/order-claims.ts`

### Emails

- `emails/send.ts`, `emails/types.ts`, `emails/signature.ts`, `emails/templates/auth.ts`

### Estilos / assets

- `styles/design-system/*.css` (14 archivos)
- `public/watermark.png`, `public/Ico/favicon-16x16.png`, `public/Ico/apple-touch-icon.png`

---

## Archivos adaptados (no copia directa)

| Archivo | Cambio |
|---------|--------|
| `lib/auth.ts` | Híbrido `dnx_session` + fallback/emisión `auth-token` legacy; `getAuthCookieHeaderValue` para OAuth |
| `lib/prisma.ts` | Reexports enums Prisma vía `@repo/db` |
| `components/layout/MainLayout.tsx` | Nuevo: sin `LandHeader`, sin `/api/config`; shell auth sin Header/Footer |
| `app/layout.tsx` | Metadata legacy + `MainLayout` + `ComprameLaFotoDesignProvider` |
| `app/not-found.tsx` | Creado para monorepo |
| `app/api/auth/login/route.ts` | `await setAuthCookieOnResponse` |
| `app/api/auth/google/callback/route.ts` | `await setAuthCookieOnResponse`; imports `@/lib/prisma`; fix TS `allowedRoles` |
| Rutas API auth | `@prisma/client` → `@/lib/prisma` |
| `lib/referral-cookie.ts` | Guard TS `match?.[1]` |
| `package.json` | `bcryptjs`, `resend`, `@types/bcryptjs` |
| `packages/db/src/client.ts` | Reexport `TokenPurpose`, `ReferralProgram`, `LabApprovalStatus`, `TalkStatus` |

---

## Bridges mantenidos

| Bridge | Estado |
|--------|--------|
| `lib/prisma.ts` → `@repo/db` | ✅ |
| `lib/auth.ts` — `dnx_session` + `auth-token` | ✅ |
| `lib/auth-guards.ts` → `@repo/auth-guards` | ✅ (sin cambios) |
| `middleware.ts` | ✅ (Oleada 0, sin cambios auth) |

### Estrategia auth híbrida

1. **Login/OAuth nuevos:** emiten `dnx_session` (canonical) + `auth-token` (compat transición).
2. **`getAuthUser`:** intenta `dnx_session` → fallback `auth-token` → Prisma.
3. **`clearAuthCookie`:** destruye ambas cookies.

---

## Dependencias agregadas

```json
{
  "dependencies": {
    "bcryptjs": "^3.0.3",
    "resend": "^6.9.1"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6"
  }
}
```

---

## Validaciones ejecutadas

```bash
pnpm install
pnpm --filter compramelafoto lint      # 0 errors, 48 warnings (código legacy)
pnpm --filter compramelafoto typecheck # OK
pnpm --filter compramelafoto build     # OK
```

### Build — rutas generadas

```
/login, /registro, /registro/organizador, /forgot-password, /reset-password, /verify-email
/api/auth/* (13 handlers)
```

---

## Errores corregidos

| Error | Resolución |
|-------|------------|
| Rutas anidadas `app/login/login/` por rsync | Aplanado a `app/login/` |
| `app/api/auth/auth/` duplicado | Movido a `app/api/auth/` |
| `next` eliminado accidentalmente de `package.json` | Restaurado `next@16.2.1` |
| CSS faltante `clf-wizard-layout.css` | Copiado set completo `styles/design-system/` |
| `@prisma/client` en app | Reexports en `@repo/db` + `@/lib/prisma` |
| `allowedRoles` possibly undefined (google callback) | Tipado explícito + fallback array |
| `referral-cookie.ts` match[1] | Optional chaining |

---

## Pendientes Oleada 2 (core revenue)

- Dashboards destino post-login (`/fotografo/dashboard`, `/lab/dashboard`, etc.) — rutas rotas hasta import
- `/api/public/directory/counts` — Header muestra directorio con counts null (degradación OK)
- `/api/contact` — formulario Footer falla silenciosamente sin API
- `/api/config` — maintenance mode no implementado (MainLayout omite check)
- Álbumes, checkout, orders, payments, Mercado Pago
- `public/` restante (sin `uploads/`)
- Redirects post-login a paneles según rol
- Reducir warnings ESLint legacy (`any`, unused vars) en oleada de limpieza

---

## Checklist commit sugerido

```
feat(clf): wave 1 auth login and base layout import

- apps/compramelafoto: login, registro, password reset, verify-email, api/auth
- lib/auth hybrid dnx_session + auth-token
- packages/db: export auth-related Prisma enums
- docs: 24-code-import-wave1-auth-report.md
```

**Incluir:** `apps/compramelafoto/**`, `packages/db/src/client.ts`, `pnpm-lock.yaml`, `docs/architecture/migration/24-code-import-wave1-auth-report.md`

**Excluir:** fotoffice, fotorank, migraciones, `.next`, `node_modules`, `._*`
