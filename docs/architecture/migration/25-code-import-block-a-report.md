# 25 — Reporte Bloque A: Álbumes + Fotos (galería pública)

**Fecha:** 2026-07-03  
**Bloque:** A — Dominio principal álbumes/fotos (sin checkout, sin dashboard admin, sin marketplace)  
**Fuente legacy:** `/Users/danielcuart/Desktop/compramelafoto`  
**Destino:** `apps/compramelafoto`  
**Plan:** [`22-code-import-execution-plan.md`](./22-code-import-execution-plan.md) · Oleada 0: [`23`](./23-code-import-wave0-report.md) · Oleada 1: [`24`](./24-code-import-wave1-auth-report.md)

---

## Resumen ejecutivo

Bloque A **completado** para el alcance acordado: galerías públicas (`/a/[id]`, `/album/[slug]`), APIs de álbum/fotos/descargas/zip, componentes de galería y libs de soporte (imágenes, caras, pricing de galería, packs visibles, videos públicos).

| Validación | Resultado |
|------------|-----------|
| `pnpm --filter compramelafoto typecheck` | ✅ |
| `pnpm --filter compramelafoto build` | ✅ |
| `pnpm --filter compramelafoto lint` | ✅ (257 warnings legacy, **0 errors**) |

**Listo para commit:** no solicitado en esta oleada.

---

## Alcance incluido

### Páginas app

| Ruta | Propósito |
|------|-----------|
| `/a/[id]` | Galería pública principal por ID |
| `/a/[id]/remover/[photoId]` | Flujo remover foto (solicitud) |
| `/album/[slug]` | Landing unificada álbum (galería + metadata + packs visibles) |
| `/album/layout.tsx` | Layout álbum |
| `/descargas/[token]` | Portal descarga digital por token |

### APIs nuevas en este bloque (19, además de 13 auth de Oleada 1)

| Endpoint | Área |
|----------|------|
| `api/a/[id]/notifications` | Notificaciones álbum |
| `api/a/[id]/photo/[photoId]` | Foto individual pública |
| `api/a/[id]/register-interest` | Registro interés + selfie Rekognition |
| `api/a/[id]/screenshot-log` | Auditoría capturas |
| `api/a/my-face-photos` | Fotos filtradas por rostro (token) |
| `api/albums/[id]/hidden/check-grant` | Álbum oculto — verificar grant |
| `api/albums/[id]/hidden/selfie` | Álbum oculto — selfie acceso |
| `api/albums/[id]/invite` | Invitaciones |
| `api/albums/[id]/search/face` | Búsqueda por rostro |
| `api/albums/[id]/search/text` | Búsqueda por texto |
| `api/descargas/[token]/fotos/[photoId]/vista` | Vista foto en descarga |
| `api/orders/[id]/digital-downloads` | Descargas digitales pedido |
| `api/orders/[id]/refresh-download-token` | Renovar token descarga |
| `api/orders/[id]/zip-status` | Estado ZIP pedido |
| `api/photos/[id]/view` | **Crítica** — thumb/watermark (sharp + R2) |
| `api/public/albums` | Listado álbumes públicos |
| `api/public/albums/[slug]/videos` | Videos públicos del álbum |
| `api/zip-jobs/[id]/download` | Descarga ZIP |
| `api/zip-jobs/[id]/status` | Estado job ZIP |

**Total APIs en app:** 32 (`route.ts`).

### Componentes (~45 `.tsx`)

Áreas principales:

- `components/photo/` — `ClientAlbumView`, `PhotoGrid`, `PhotoSlideViewer`, `PhotoCard`, banners, etc.
- `components/gallery/` — layout galería
- `components/album/` — piezas álbum público
- `components/album-purchase/` — sticky bar / contacto packs (UI sin checkout activo)
- `components/public/video/` — reproductor video público
- `components/checkout/` — mínimo (`PhotographerHeader`, `Footer`)
- `app/g/[shareSlug]/EventGalleryFolderChips.tsx` — chips filtro carpetas

### Lib (~189 `.ts`)

| Área | Contenido |
|------|-----------|
| `lib/images/` | watermark, resize, R2 |
| `lib/faces/` | Rekognition, indexación, búsqueda |
| `lib/hidden-album/` | grants, auditoría |
| `lib/videos/` | validación y URLs públicas |
| `lib/album-packs/` | packs visibles en galería (sin conversión a pedido) |
| `lib/pricing/` | snapshot galería, extensiones, fees digitales |
| `lib/albums/` | helpers álbum, fechas evento, content-type |
| `lib/digital-download/` | entrega digital |
| `lib/events/` | filtro carpetas galería pública |

### Assets / estilos

- `public/watermark.png`, `public/Ico/*`
- `styles/design-system/*.css` (set completo legacy)
- `app/globals.css` actualizado

### Dependencias nuevas (`package.json`)

`sharp`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `@aws-sdk/client-rekognition`, `archiver`, `jszip`, `lucide-react`, `zod`, `qrcode`, `@prisma/client`, tipos `@types/archiver`, `@types/qrcode`.

### Bridge Prisma

```ts
// lib/prisma.ts
export { prisma } from "@repo/db";
export type { PrismaClient } from "@repo/db";
export * from "@prisma/client";
```

~51 imports `@prisma/client` → `@/lib/prisma` en la app.

---

## Alcance excluido (explícito)

- Rutas `comprar/`, `precompra/`, `preventa/` (salvo stub `PreventaPage` → `null`)
- `app/api/orders/[id]/redeem` (preventa + MP)
- Dashboard fotógrafo, marketplace, blog, workers, deploy
- `packages/db/prisma/schema.prisma` y migraciones
- FotoOffice, FotoRank, `apps/_archive`

---

## Stubs y recortes aplicados

| Archivo | Motivo |
|---------|--------|
| `lib/preventa-canjeable/pack-service.ts` | Solo `listActivePacksForPublicCatalog` → `[]`; resto del directorio preventa **eliminado** (oleada comercial) |
| `app/album/[slug]/preventa/PreventaPage.tsx` | Retorna `null`; acepta `testClientPreview` |
| `components/photo/PendingOrderAlbumBanner.tsx` | Stub checkout |
| `lib/funnel-track-client.ts` | No-op + `FUNNEL_EVENTS` vacío |
| `lib/album-packs/convert-*.ts`, `build-album-pack-print-mirror-items.ts` | **Eliminados** — requieren `@/lib/orders/*` |
| `lib/preventa-canjeable/*` (36 archivos) | **Eliminados** — catálogo/MP/redeem fuera de bloque |
| `lib/checkout/use-mp-payment-retry.ts` | **Eliminado** |
| `lib/pricing/pricing-engine.ts`, `checkout-fee-financial-close.ts` | **Eliminados** |
| `lib/sales/album-sales-policy-readiness.ts`, `album-sales-capability-readiness.ts` | **Eliminados** |
| `lib/photo-exif.ts` | **Eliminado** (cron EXIF fuera de bloque) |
| `FloatingUploadBar.tsx`, `UploadZone.tsx` | No copiados (dashboard upload) |

---

## Errores corregidos durante la oleada

| Problema | Resolución |
|----------|------------|
| Stub `pack-service` sin `hasPhotos` en opts | Firma ampliada |
| Stub `PreventaPage` sin props | Acepta `testClientPreview` |
| Stub `event-public-gallery-folder-filter` incompatible | Restaurado desde legacy |
| Stub `EventGalleryFolderChips` sin props | Restaurado desde legacy |
| ~111 errores TS (módulos checkout/preventa) | Eliminación de libs fuera de alcance + fixes strict-null |
| `InputJsonValue` en `zip-job-queue` | `Prisma.InputJsonValue` |
| `PhotoSlideViewer` refs durante render (lint error) | Sync refs en `useEffect` |
| `export *` Prisma + CJS warning | Aceptado como warning Turbopack (no bloqueante) |
| NFT trace `watermark-render` → `next.config.ts` | Warning conocido; no bloquea build |

---

## Warnings conocidos (no bloqueantes)

- Turbopack: `export *` desde `@prisma/client` (CJS)
- NFT: `lib/images/watermark-render.ts` traza `next.config.ts` (path dinámico)
- ESLint: 257 warnings legacy (`any`, `no-img-element`, etc.)
- Middleware convention deprecated → proxy (Next 16)

---

## Pendientes para oleadas posteriores

1. **Checkout / Mercado Pago** — `checkout-prepare`, banners pedido pendiente, `use-mp-payment-retry`, rutas `comprar/`
2. **Preventa / precompra** — restaurar `lib/preventa-canjeable/**` completo + `PreventaPage` real
3. **Conversión packs → pedido** — `lib/album-packs/convert-*.ts` + `lib/orders/**`
4. **Pricing engine completo** — `lib/pricing/pricing-engine.ts`
5. **Dashboard fotógrafo** — upload, packs editor, diagnósticos ventas
6. **Eventos colaborativos** — `app/g/[shareSlug]/page.tsx` y rutas beta
7. **EXIF / cron** — `lib/photo-exif.ts` + `exifr` dependency
8. **Watermark NFT** — acotar imports estáticos en `watermark-render.ts`

---

## Conteos finales

| Métrica | Valor |
|---------|-------|
| APIs `route.ts` | 32 |
| Páginas `page.tsx` (total app) | 11 |
| Componentes `.tsx` | 45 |
| Lib `.ts` | 189 |
| Errores TS al cierre | 0 |
| Errores lint al cierre | 0 |

---

## Verificación reproducible

```bash
pnpm --filter compramelafoto typecheck
pnpm --filter compramelafoto lint
pnpm --filter compramelafoto build
```
