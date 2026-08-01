# 10 — ETAPA 02: Migración Panel Lab + APIs Lab

**Fecha:** 2026-07-29  
**Rama:** `migration-legacy-clf-to-monorepo`  
**HEAD al inicio:** `c1801c44b83f4de2de9ffee7c835079fabfb5e6b`  
**Fuente Legacy:** `/Users/danielcuart/Desktop/compramelafoto`  
**Destino:** `apps/compramelafoto`  
**Commit/push/deploy:** no realizados

---

## ESTADO

**DONE** — P0-01 cerrado a nivel de código (paridad estructural + auth landing + APIs Lab).

Smoke E2E con usuario LAB real en staging queda para checklist humano (no producción).

---

## Preflight working tree

| Bucket | Nota |
|--------|------|
| LAB_RELATED | Cambios de esta etapa (abajo) |
| SHARED_DEPENDENCY | Ninguno tocado fuera de `post-login-destination` (CLF app) |
| UNRELATED | WIP auth/Clickaton/FotoRank preexistente — **no modificado** |
| UNKNOWN | — |

No reset / stash / revert / clean.

---

## Causa del redirect LAB → `/`

En `lib/auth/post-login-destination.ts` el destino estaba hardcodeado a `/` con comentario *“Lab no migrado todavía; evitar 404”*.

**Fix:** `LAB` y `LAB_PHOTOGRAPHER` → `/lab/dashboard` (paridad Legacy `/lab/login` y Google OAuth `role=LAB`).

Consumidores: `app/login/LoginClient.tsx`, `app/api/auth/google/callback/route.ts`.

---

## Rutas migradas (`app/lab/**`)

Copiadas 1:1 desde Legacy (sin `*.code-search`):

| Ruta | Ops |
|------|-----|
| `/lab/layout` | Layout + `LabLayoutClient` |
| `/lab/login` | Login dedicado LAB |
| `/lab/registro` | Redirect → `/registro` (+ form legacy) |
| `/lab/dashboard` | KPIs + pedidos pendientes |
| `/lab/pedidos` | Listado + bulk status |
| `/lab/clientes` | Histórico clientes print |
| `/lab/albumes` | Álbumes + interesados |
| `/lab/productos` | Catálogo / pricing / Excel |
| `/lab/configuracion` (+ `[section]`) | Datos, diseño, MP, descuentos, referidos, upselling |
| `/lab/comunidad` | Directorio |
| `/lab/soporte` | Tickets |
| `/lab/referrals` | ReferralCenter |
| `/lab/catalogo` | Redirect → productos |
| `/lab/precios` | Redirect → config descuentos |
| `/lab/negocio` | Redirect → dashboard |

Componentes/libs ya existían en mono (`LabLayoutClient`, `LabSidebar`, `lab-session-client`, `default-lab-products`, `labTerms`).

---

## APIs migradas / presentes

| API | Estado |
|-----|--------|
| `GET/PATCH /api/lab/[id]` | EXISTS_IDENTICAL (previo) |
| `GET /api/lab/by-user/[userId]` | EXISTS_IDENTICAL (previo) |
| `GET/PUT /api/lab/products` | EXISTS_IDENTICAL (previo) |
| `GET/PUT /api/lab/pricing` | EXISTS_IDENTICAL (previo) |
| `GET /api/lab/status` | **MIGRADA** |
| `GET /api/lab/dashboard` | **MIGRADA** |
| `GET /api/lab/clientes` | **MIGRADA** |
| `PATCH/DELETE /api/lab/clientes/[email]` | **MIGRADA** |
| `GET /api/lab/interesados` | **MIGRADA** |
| `POST /api/lab/upload-logo` | **MIGRADA** |
| `POST /api/lab/create` | **MIGRADA** |
| `GET /api/lab/catalog/template` | **MIGRADA** |
| `GET /api/lab/catalog/export` | **MIGRADA** |
| `POST /api/lab/catalog/import` | **MIGRADA** |
| `GET /api/lab/catalog/variants` | **MIGRADA** |
| `POST /api/terms/accept` | **MIGRADA** (mecanismo técnico T&C LAB/fotógrafo) |

Total lab APIs: **15/15** (= Legacy).

Colaterales ya en mono: `/api/print-orders*`, support, directory, mercadopago OAuth.

---

## Template-v2

**POST_LAB_PARITY** — el Panel Lab **no** llama `/api/template-v2/*`. No migrado en esta etapa.

---

## Consent

| Aspecto | Estado |
|---------|--------|
| Técnico A (status `needsTermsAcceptance`, registro `register-lab`, `POST /api/terms/accept`) | **Migrado** |
| Texto jurídico B (`lib/terms/labTerms.ts`) | **Sin cambios** — IDENTICAL Legacy↔Mono (`LAB_TERMS_VERSION = v2`) |
| LEGAL_REVISAR | Ningún divergencia Lab terms en esta etapa |

UI de configuración muestra banner de T&C pendientes (igual Legacy); aceptación en registro vía `register-lab`.

---

## Escolar / SchoolStudent

**N/A para Panel Lab** — sin dependencias directas de roster/`SchoolStudent` en `app/lab` ni APIs lab migradas.

P0-02 / P0-03 **no tocados**. Sin migraciones SQL.

---

## Auth / seguridad (paridad Legacy)

- Layout `/lab` protege en **cliente** (`ensureLabSession` + redirects a `/lab/login`) — igual Legacy.  
- APIs sensibles: `requireAuth([LAB, LAB_PHOTOGRAPHER])` en status/dashboard/catalog export-import/interesados/upload-logo/terms.  
- Algunas APIs Legacy quedan sin auth cookie (`products` PUT, `pricing` PUT, `clientes*`, `[id]` PATCH) — **paridad intencional**, no hardening en esta etapa.  
- Post-login unificado ya no manda LAB a `/`.  
- P0-06 Auth dual: **no resuelto aquí** (solo landing LAB).

---

## Tests ejecutados

```bash
./packages/db/node_modules/.bin/tsx apps/compramelafoto/lib/auth/post-login-destination.test.ts  # ok
./packages/db/node_modules/.bin/tsx apps/compramelafoto/lib/lab/lab-parity.selfcheck.ts         # ok
./packages/db/node_modules/.bin/tsx apps/compramelafoto/lib/lab/lab-auth-guards.test.ts         # ok
```

---

## Typecheck / Lint

| Check | Resultado | Notas |
|-------|-----------|-------|
| `tsc --noEmit` app | FAIL global | **PRE_EXISTING**: ~173 errores en `.next/types` (params Promise). **0** errores en `app/lab/**` / `app/api/lab/**` fuentes |
| eslint scope LAB | PASS (0 errors) | 182 **warnings** legacy (`any`, use-before-define) — PRE_EXISTING del código copiado |

---

## Database / Storage / Emails

- No migraciones productivas.  
- No modificación datos prod.  
- Upload logo: mismo cliente R2 (`upload-logo` Legacy).  
- Emails Lab: sin cambios de templates; tickets usan APIs support existentes.

---

## Matriz paridad LAB

| Función LAB | Legacy | Monorepo | Paridad |
|-------------|--------|----------|---------|
| Login dedicado `/lab/login` | Sí | Sí | YES |
| Post-login → `/lab/dashboard` | Sí | Sí | YES |
| Dashboard KPIs / pedidos | Sí | Sí | YES |
| Pedidos + bulk status | Sí | Sí | YES |
| Clientes | Sí | Sí | YES |
| Álbumes / interesados | Sí | Sí | YES |
| Productos + Excel catálogo | Sí | Sí | YES |
| Configuración (datos/MP/etc.) | Sí | Sí | YES |
| Comunidad / soporte / referidos | Sí | Sí | YES |
| Redirects catalogo/precios/negocio | Sí | Sí | YES |
| APIs lab 15/15 | Sí | Sí | YES |
| Terms accept API | Sí | Sí | YES |
| Template-v2 | No usa | No usa | N/A |
| Escolar roster | No usa | No usa | N/A |

---

## P0-01

**CLOSED**

---

## ACCIÓN LEGAL

**AHORA: NO**

LEGAL_REVISAR: ninguno nuevo en Lab terms (idénticos).

---

## ACCIÓN HUMANA

Sí, opcional para validación staging (no prod):

1. Login usuario LAB → verificar `/lab/dashboard`.  
2. Smoke: pedidos, productos export/import, upload logo, config MP.  
3. Confirmar Google OAuth `role=LAB` aterriza en dashboard.

---

## NEXT

**ETAPA 03 — CIERRE AUTH CLF** (P0-06), en paralelo posible con gaps API P1 no-Lab (template-v2 fotógrafo, consent marketing, escolar público) según plan 08.
