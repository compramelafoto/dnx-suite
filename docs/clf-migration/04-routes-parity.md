# 04 — Paridad de rutas

**Fecha:** 2026-07-29  
**Método:** `comm` sobre `page.tsx` / `route.ts` (route groups normalizados)

| | Legacy | Monorepo | Delta |
|--|-------:|---------:|------:|
| Páginas | 264 | 230 | −34 |
| API routes | 564 | 521 | −43 |
| APIs solo mono | — | 0 | — |

---

## 1. Páginas solo en Legacy (faltan en Mono)

### P0 — Panel Lab → **RESUELTO (ETAPA 02)**

Todas las rutas `/lab/**` Legacy están en Monorepo con las mismas URLs.  
Post-login LAB → `/lab/dashboard`. Detalle: `10-stage-02-lab-migration-report.md`.

### P2 — Demos / showroom / tests (no bloquean cutover)

| Dominio | Ruta Legacy | Estado | Prioridad |
|---------|-------------|--------|-----------|
| Demo | `/demo-home`, `/demo-ui/*` | Omitido | P2 |
| DS | `/design-system/*` (12) | Omitido | P2 |
| Test | `/fotocarnet-test`, `/fotolibros-test`, `/polaroids-test`, `/test/*` | Omitido | P2 |
| Auth | `/cuenta/cambiar-contraseña` (duplicado ñ) | Omitido (queda sin ñ) | P3 |

### Páginas solo en Mono

| Ruta | Nota |
|------|------|
| `/fotografo/notificaciones` | FUNCIONALIDAD_NUEVA_MONOREPO / mejora |
| `/fotografo/configuracion/notificaciones` | Idem |

---

## 2. APIs solo en Legacy (43)

### Lab APIs → **15/15 presentes (ETAPA 02)**

Incluye catalog/*, clientes*, create, dashboard, status, interesados, upload-logo + las 4 previas.

### Template-v2 fotógrafo (P1)

| Ruta Legacy | Nota |
|-------------|------|
| `/api/template-v2/preview` | Ausente |
| `/api/template-v2/public` | Ausente |
| `/api/template-v2/templates/create` | Ausente |
| `/api/template-v2/templates/[templateId]` (+ clone, versions, save, image-upload, submit-for-review, save-as-new-version) | Ausente |

Admin template-v2 (`/api/admin/template-v2/*`) **sí** existe en mono.

### Público / consentimiento / misc (P1–P2)

| Ruta | Prioridad | Notas |
|------|-----------|-------|
| `/api/public/album/[slug]/student-roster` (+ search) | P1 | Escolar |
| `/api/public/community-categories` | P1 | |
| `/api/public/community-upload-logo` | P1 | |
| `/api/public/cuantocobro/quotes/[token]` | P1 | |
| `/api/public/referral-ambassador/signup` | P1 | |
| `/api/terms/accept` | P1→CLOSED ETAPA 02 | Migrada con Panel Lab |
| `/api/users/me/marketing-opt-in` | P1 | |
| `/api/users/me/revoke-face-consent` | P1 | Privacidad |
| `/api/prints/upload-final` | P1 | Print flow |
| `/api/upsells/applicable` | P1 | |
| `/api/recommend-lab` | P2 | |
| `/api/system-settings`, `/api/config`, `/api/banner` | P2 | |
| `/api/tutorials`, `/api/analytics/funnel` | P2 | |
| `/api/interested/[id]/delete-biometric` | P1 | |
| `/api/debug-env`, `/api/test/*`, `/api/fotolibros-test/*` | P3 | Dev/test |

---

## 3. Rutas críticas con paridad YES

| Dominio | Legacy | Monorepo | Estado |
|---------|--------|----------|--------|
| Auth API | `/api/auth/*` (13) | Igual | YES |
| Google OAuth | `/api/auth/google*` | Igual | YES |
| MP create/webhook | `/api/payments/mp/*` | Igual | YES |
| MP OAuth | `/api/mercadopago/oauth/*` | Igual | YES |
| Pago retorno | `/pago/{success,pending,failure}` | Igual | YES |
| Galería | `/a/[id]`, `/album/[slug]` | Igual | YES |
| Descargas | `/descargas/[token]` | Igual | YES |
| Crons Vercel (17) | `vercel.json` | Igual set | YES |
| Admin | `/admin/**` | Presente | YES |
| Fotógrafo | `/fotografo/**`, `/dashboard/**` | Presente | YES |
| Organizador | `/organizador/**` | Presente | YES |
| Cliente | `/cliente/**` | Presente | YES |

---

## 4. Callbacks / webhooks

| Tipo | Legacy | Monorepo | Estado |
|------|--------|----------|--------|
| Google callback | `/api/auth/google/callback` | Igual | YES |
| MP OAuth callback | `/api/mercadopago/oauth/callback` | Igual | YES |
| MP webhook | `POST /api/payments/mp/webhook` | Igual | YES |

---

## 5. Middleware

Ambos: referral cookies + blog visitor — **no** gate global de sesión. Protección en layouts/API guards.

---

## 6. Conclusión rutas

**Update ETAPA 02:** panel Lab + APIs lab + `/api/terms/accept` migrados. Delta restante: demos/DS, template-v2 fotógrafo, APIs público/escolar/consent marketing, tests omitidos.
