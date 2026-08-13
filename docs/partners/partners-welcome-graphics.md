# DNX Partners — Gráficas welcome responsivas (Etapa 10C)

Sin migración de schema. Las variantes se modelan con assets existentes (`BRAND_PHOTO` / `OTHER` como carrier) + metadata tipada `welcomeGraphic`.

## Slots

| Slot | Device | Motion |
|------|--------|--------|
| `WELCOME_GRAPHIC_DESKTOP` | DESKTOP | PRIMARY |
| `WELCOME_GRAPHIC_MOBILE` | MOBILE | PRIMARY |
| `WELCOME_GRAPHIC_DESKTOP_STATIC_FALLBACK` | DESKTOP | STATIC_FALLBACK |
| `WELCOME_GRAPHIC_MOBILE_STATIC_FALLBACK` | MOBILE | STATIC_FALLBACK |

Metadata cerrada (`v: 1`, `purpose: WELCOME_GRAPHIC`). No strings arbitrarios.

## Panel

Sección **Gráfica para ventana destacada** (campañas del sponsor):

- Escritorio: pieza horizontal para pantallas amplias.
- Celular: pieza vertical/adaptada.
- Ambos opcionales; el sistema aplica fallbacks.
- Área segura + CTA copy (sin botones dibujados).

## Formatos

PNG, WebP, JPG/JPEG, GIF. SVG rechazado (sin sanitizado verificable).

## Medidas sugeridas

- Desktop: ~16:9–1.91:1 · 1200×630.
- Mobile: ~4:5–9:16 · 1080×1350 o 1080×1920.

## Límites de peso (default)

| Variante | Máximo |
|----------|--------|
| Desktop estático | 2 MB |
| Mobile estático | 1 MB |
| Desktop GIF | 1.5 MB |
| Mobile GIF | 768 KB |

Dimensiones mín/máx en `DEFAULT_WELCOME_GRAPHIC_LIMITS`.

## Breakpoint

`WELCOME_GRAPHIC_MEDIA_MIN_DESKTOP_PX = 768` (Tailwind / DS `md`, alineado a `PublicMarketingHeader`).

Render: `<picture>` + `source media="(min-width: 768px)"` → el navegador descarga solo la variante aplicable (sin leer `window` en SSR; sin hydration mismatch).

## Prioridad

### Desktop

1. Gráfica desktop aprobada seleccionada/default  
2. Mobile aprobada (cross, `contain`)  
3. Logo aprobado  
4. Sin asset → bloquear

### Mobile

1. Gráfica mobile aprobada  
2. Desktop aprobada (`contain`)  
3. Logo  
4. Bloquear

Pending/archivadas nunca como fallback.

## GIF + reduced motion

- Desktop GIF → desktop static fallback → logo.
- Mobile GIF → mobile static fallback → logo.
- Sin fallback estático ni logo → bloquear publicación.
- Con logo solamente → advertencia + logo en reduced motion.

## Snapshot público

`WelcomeResponsiveMediaSnapshot`: `imageUrl` (compat), `desktop`, `mobile`, `logoFallback`, `mediaMinDesktopPx`.

Campos por pieza: URL, MIME, dims, alt, animated, reducedMotionFallbackUrl, source.

`imageUrl` legacy = pieza universal/logo; campos device tienen prioridad cuando existen.

## Componente

`PartnerWelcomeResponsiveMedia` + `PartnerWelcomeInterstitial` / `PartnerAdCreative` (`media` prop).

- `object-fit: contain`, altura acotada, X/CTA visibles.
- Una impresión por apertura (sin re-fire por resize/orientación/fallback).
- Preview: desktop/mobile, reduced motion, simular error, usar logo; tracking OFF.

## Campaña

Creatives con `deviceTarget` DESKTOP/MOBILE/ALL. Tabla de resolución en admin. FotoOffice excluido.

## Schema futuro (opcional)

Enum Prisma `WELCOME_GRAPHIC_*` sería aditivo; **no requerido** mientras la metadata tipada sea la fuente de verdad. No ejecutar migraciones en esta etapa.

## Código

- Dominio: `packages/partners/src/welcome-graphic-assets.ts`
- UI: `PartnerWelcomeResponsiveMedia.tsx`, preview admin Clickatón
- Registro: `welcome-admin-mutations.ts` (`welcomeSlot`)
