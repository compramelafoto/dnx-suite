# DNX Partners — ETAPA 01 / IMPLEMENTACIÓN 02 — Resultado

**Fecha:** 2026-08-01  
**Estado:** `DONE` (assets de marca + materiales por participación; sin deploy, sin commit)

---

## Resumen

Biblioteca central de archivos para DNX Partners:

| Clase | Modelo | Uso |
|-------|--------|-----|
| A. Identidad permanente | `DnxPartnerAsset` | Logos, isotipo, manual, fotos institucionales |
| B. Materiales de participación | `DnxPartnerParticipationAsset` | Stories, banners, videos, premio, beneficio, flyers |

Compatibilidad: `DnxPartner.logoUrl` **no eliminado**. Resolución canónica en `@repo/partners`.

---

## Storage reutilizado

- Mismo stack R2/S3 que Clickatón (`R2_*` / local / key-only).
- Helper: `apps/clickaton/lib/admin/partners/partner-asset-storage.ts`
- Proxy público ampliado: `/api/media/partners/...`
- Soft-link opcional a `DnxMediaAsset` vía `mediaAssetId`
- **No** Vercel Blob, **no** storage paralelo

Claves:

```text
partners/{partnerId}/brand/{assetId}/{filename}
partners/{partnerId}/participations/{participationId}/{assetId}/{filename}
```

SVG: **rechazado** (sin sanitización segura en el monorepo).

---

## Formatos y límites

| Tipo | MIME | Límite default |
|------|------|----------------|
| Imagen | PNG, JPEG, WEBP | 20 MB |
| PDF | application/pdf | 30 MB |
| Video | MP4, WEBM | 250 MB |
| SVG | — | no aceptado |

Override env: `DNX_PARTNER_ASSET_*_MAX_BYTES` (`resolvePartnerAssetLimits`).

---

## Flujo de upload

1. Permisos (`PARTNER_ASSETS_UPLOAD` + manage brand/participation)
2. Magic bytes (`assertPartnerUploadAllowed`)
3. Destino seguro (sin path traversal)
4. Put storage
5. Registro dominio con `storageKey` + `fileUrl` (no activo sin archivo)
6. Aprobación posterior (approve ≠ publicar)

---

## Resolución de logo

Orden: tipo solicitado usable → primary usable → `LOGO_PRIMARY` → `logoUrl` → placeholder.

APIs: `resolvePartnerPrimaryLogo`, `resolvePartnerLogoVariant`, `resolvePartnerDisplayImage`.

Futuro: depreciar `logoUrl` tras migración de datos (no en esta etapa).

---

## UI

- `/admin/sponsors/[partnerId]` — **Identidad de marca**
- `/admin/ediciones/[editionId]/sponsors/[participationId]` — **Materiales**
- Listado edición: logo resuelto + conteo materiales
- Componente `PartnerAssetPicker` (reutilizable; no cableado a todas las apps)

---

## Permisos nuevos

`PARTNER_ASSETS_VIEW|UPLOAD|UPDATE|ARCHIVE|APPROVE|MANAGE_BRAND|MANAGE_PARTICIPATION`

v1 Clickatón: bundle ops admin.

---

## Migración

`packages/db/prisma/migrations/20260802160000_dnx_partner_assets/`

Aditiva. Rollback: drop tablas/enums/valores capability (manual). **No aplicada en producción.**

---

## Tests / calidad

- `@repo/partners`: `partners.test.ts` + `partners-assets.test.ts`
- Typecheck partners + Clickatón
- Lint archivos tocados

---

## Riesgos y deuda

- Metadata de video limitada (sin ffprobe obligatorio)
- SVG pendiente de sanitizer
- Sin variantes automáticas / resize / transcode
- Sin publicación social ni frontend público
- Limpieza de huérfanos storage: best-effort (crear registro solo post-put)

**Próxima implementación recomendada:** elegibilidad de beneficios (Etapa 02 Imp. 02) o publicación pública controlada con checklist legal.

---

## Acción legal

Antes de materiales reales: autorización de marca, derechos de imagen/video/música/fuentes, plazo y plataformas. No publicar sin aprobación humana.
