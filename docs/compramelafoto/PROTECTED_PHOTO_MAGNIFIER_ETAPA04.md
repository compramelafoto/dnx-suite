# ETAPA 04 — IMPLEMENTACIÓN 01 — Visor protegido con desenfoque y lupa

**Proyecto:** CLF Monorepo (`apps/compramelafoto`)  
**Rama:** `feat/protected-photo-magnifier-etapa04`  
**Estado técnico:** PARTIAL → validación visual staging pendiente  
**Legacy:** no modificado  
**Deploy producción:** no

## Auditoría (Fase 1)

| Elemento | Hallazgo |
|----------|----------|
| Ruta álbum | `/album/[slug]` (`app/album/[slug]/page.tsx`); `/a/[id]` redirige |
| Grilla | `components/photo/PhotoGrid.tsx` |
| Thumbnail | `components/photo/PhotoCard.tsx` → `mode=thumb` |
| Visor | `components/photo/PhotoSlideViewer.tsx` vía `ClientAlbumView` |
| Endpoint | `GET /api/photos/[id]/view?albumId=&mode=preview` |
| Variante | JPEG watermarked, max side ~640 (`photo-variant-config`) |
| Marca de agua | Incrustada server-side (Sharp / variantes R2 `preview_wm_*`) |
| Original limpio | No se entrega como bytes de imagen en el lightbox |
| Caché | Pregenerada: `public, max-age=31536000, immutable`; dinámica: `private, no-store` |

**Confirmación:** no BLOCKED. La vista ampliada usa preview protegida con marca incrustada.

**Nota:** las páginas públicas aún serializan `originalKey` como metadato RSC (no URL firmada). Queda como riesgo documentado; fuera del alcance de esta etapa (cero cambios de modelo/API).

## Implementación

- Componente: `components/photo/ProtectedPhotoMagnifier.tsx`
- Métricas: `lib/images/contained-image-metrics.ts`
- Integración: `PhotoSlideViewer` prop `enableProtectedMagnifier`
- Activado en: `ClientAlbumView`, `EventGalleryGrid`, `ComprarClient`

### Capas visuales (misma URL)

1. Base: `<img src=mode=preview>` + `filter: blur(28px)` + `scale(1.04)`
2. Lupa circular: `background-image` con la misma URL, zoom 1.5×, rAF + transform
3. Refuerzo watermark CSS (patrón diagonal + texto), `pointer-events: none`

### Cero procesamiento servidor

No se agregaron: Sharp jobs, workers, cron, R2 keys, migraciones, endpoints, tiles ni recortes.

### Network (esperado)

| Escenario | Antes | Después |
|-----------|-------|---------|
| Abrir modal (caché normal) | 1 GET `mode=preview` (+ thumbs strip si aplica) | 1 GET `mode=preview` (lupa reutiliza caché vía `background-image`) |
| Disable cache | 1 GET principal | Hasta 2 GET misma URL (img + background); sin URL original |
| Mover lupa | 0 requests | 0 requests |

## Touch / a11y

- Desktop: lupa al hover (crosshair)
- Móvil: botón “Activar lupa” para no romper gestos prev/next/cerrar
- `prefers-reduced-motion`: solo blur, sin lupa
- Controles del lightbox intactos; lupa `aria-hidden`

## Pruebas

```bash
pnpm --filter compramelafoto run test:protected-magnifier
```

## Limitaciones

- Zoom lupa sobre preview 640px: detalle limitado (intencional, protege original)
- No se regeneró marca incrustada (requeriría derivados masivos); refuerzo solo frontend
- Validación visual staging / capturas desktop-móvil pendientes de entorno
