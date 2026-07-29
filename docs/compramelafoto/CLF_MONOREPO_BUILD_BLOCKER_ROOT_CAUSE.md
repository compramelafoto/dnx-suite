# ComprameLaFoto monorepo — causa raíz del bloqueo de build (10B.7.1.1)

**Fecha:** 2026-07-29  
**App:** ComprameLaFoto monorepo (`apps/compramelafoto`)  
**Deploy fallido de referencia:** `dpl_DBwdZrHh5ESV85xfARfypf7jiRH9`  
**Veredicto previo:** `DNX AUTH UI PARTIAL — COMPRAMELAFOTO BLOCKED`

## Comando de reproducción (igual que Vercel)

```bash
pnpm --filter compramelafoto exec next build --webpack
```

(equivalente al script `build` de la app: `next build --webpack`)

## Primer error real (no atribuible a `@repo/auth-ui`)

```
Module build failed: UnhandledSchemeError: Reading from "node:crypto" is not handled by plugins
```

### Cadena de import (client boundary)

```text
node:crypto
  → packages/db/src/clf-event-write.ts
  → packages/db/src/client.ts          (@repo/db barrel reexportaba clf-event-write)
  → apps/compramelafoto/lib/prisma.ts  (export { prisma } from "@repo/db")
  → apps/compramelafoto/lib/dnx-foto-basica-funes.ts
  → apps/compramelafoto/app/admin/marketing/cursos/fotografia-basica-funes/page.tsx
       ("use client" — solo necesitaba DNX_FOTO_BASICA_FUNES_SLUG)
```

| Dimensión | Valor |
|---|---|
| Módulo responsable | `packages/db/src/clf-event-write.ts` (`createHash` / `randomBytes` de `node:crypto`) |
| Package | `@repo/db` (barrel `.` / `client.ts`) |
| Boundary | Client Component admin importando módulo que arrastra Prisma + barrel completo |
| Route/page | `/admin/marketing/cursos/fotografia-basica-funes` |
| Relación con auth-ui | **Ninguna** — pantallas auth ya migradas; el fallo es bundling preexistente |

## Hallazgos secundarios (riesgo post-primer-error)

### `@repo/payments`

Único import app → `@repo/payments` (barrel) en ComprameLaFoto monorepo:

* `lib/mercadopago/financial-identity-dual-read.ts` — server-side dual-read (vault + Prisma ports).

El barrel `packages/payments/src/index.ts` reexporta Mercado Pago adapters, credential-vault (`node:crypto`), observe webhooks, etc. Aunque este módulo es server-only por uso, importar el barrel es frágil si algún Client Component lo toca.

**Clasificación del import:**

| Archivo | Tipo | Área |
|---|---|---|
| `financial-identity-dual-read.ts` | util server (usado por resolvers de checkout/órdenes) | payments / financial identity |
| Consumidores (`resolve-album-order-mp-credentials.ts`, APIs) | Route Handler / server util | checkout / admin finance |

### ESM / `ERR_REQUIRE_ESM`

Antecedente en FotoRank (`"type": "module"`). En este build el primer fallo fue `node:crypto` en client graph, no ESM mismatch. No se reintrodujo el patrón problemático.

## Corrección aplicada (estructural)

1. **Constantes client-safe** en `lib/dnx-foto-basica-funes-public.ts` (sin Prisma). Client Components y metadata pública importan solo ese módulo. Helpers con token MP / Prisma quedan en `lib/dnx-foto-basica-funes.ts`.
2. **`@repo/db/clf-event-write` subpath** — `createClfEvent` / `hashOperationalSnapshot` / etc. ya no se reexportan desde el barrel principal. Consumidores (InfoSpot provisioning, smokes E13) actualizados.
3. **Payments** — `financial-identity-dual-read.ts` importa subpaths (`credential-vault`, `infrastructure/prisma`, `dual-read`, `financial-identity`) en lugar del barrel `@repo/payments`.

## Qué no se hizo

* Polyfill de `node:crypto` en browser.
* Revertir `@repo/auth-ui`.
* Cambios en Production.
* Deuda Jury / CuantoCobro / InfoSpot UI / FotoOffice salvo dependencia estricta del build.

## Criterio de cierre de este doc

Build local `next build --webpack` de ComprameLaFoto monorepo en **PASS**, sin `node:crypto` en client bundle.

## Resultado 10B.7.1.1

| Check | Resultado |
| --- | --- |
| Webpack compile | PASS (`✓ Compiled successfully`) |
| TypeScript (Next) | PASS tras PageProps Promise + exports de página válidos |
| Static generation | PASS (187 páginas) |
| Auth CI | 0 errors (`auth:identity`, `auth:architecture`, `auth:ui:*`) |
| Attribution auth-ui | **Descartada** — auth-ui no estaba en la import chain del primer error |

### Errores secundarios encontrados solo después del primer fix

1. Next 16 `PageProps`: `params`/`searchParams` deben ser `Promise<…>` (typecheck).
2. Export inválido `LabConfigPageContent` desde `page.tsx`.
3. Import `@repo/payments/infrastructure/prisma` (barrel) → `persistence.ts` con literales `0n` bajo `target: ES2017` del app → resuelto con subpaths estrechos.

Ninguno de esos era la causa del deploy `dpl_DBwdZrHh5ESV85xfARfypf7jiRH9` (ese fallaba en bundling `node:crypto`).
