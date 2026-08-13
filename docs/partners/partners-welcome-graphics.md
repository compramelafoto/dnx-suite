# DNX Partners — Gráficas welcome responsivas

Sin migración de schema. Las variantes se modelan con assets existentes (`BRAND_PHOTO` / `OTHER` como carrier) + metadata tipada `welcomeGraphic`.

## Administración desde el perfil

Ruta: `/admin/sponsors/[partnerId]` · sección **Gráficas para ventana destacada**.

- Biblioteca visual **del sponsor** (reutilizable entre campañas autorizadas).
- No hace falta crear una campaña para cargar piezas.
- Carga por **archivo** (no URL externa en ficha).
- Cuatro slots: principal desktop, principal mobile, fallback estático desktop, fallback estático mobile.
- Predeterminadas por `device` + `motion` (`metadata.welcomeGraphic.isDefault`); solo APPROVED / no archivadas; unicidad vía servicio `setWelcomeGraphicDefault`.
- Reemplazar archiva la pieza activa del slot, crea PENDING nueva; **no** muta creatives de campañas publicadas.
- Preview con `PartnerWelcomeInterstitial` (tracking OFF, impresión 0, frecuencia 0).
- GIF: no se descarga en el listado de la ficha hasta preview/interacción.
- Tener gráfica cargada **no** publica sola: siguen campaña, app, placement, vigencia, flags. FotoOffice excluido.

## Slots

| Slot | Device | Motion |
|------|--------|--------|
| `WELCOME_GRAPHIC_DESKTOP` | DESKTOP | PRIMARY |
| `WELCOME_GRAPHIC_MOBILE` | MOBILE | PRIMARY |
| `WELCOME_GRAPHIC_DESKTOP_STATIC_FALLBACK` | DESKTOP | STATIC_FALLBACK |
| `WELCOME_GRAPHIC_MOBILE_STATIC_FALLBACK` | MOBILE | STATIC_FALLBACK |

Metadata cerrada (`v: 1`, `purpose: WELCOME_GRAPHIC`). No strings arbitrarios.

## Campañas

En `/admin/sponsors/[partnerId]/campanas`:

- Enlace **Administrar gráficas del sponsor** → ficha.
- Si no hay gráficas: «No hay gráficas específicas; se utilizará el logo aprobado.»
- Selector de creative: gráfica aprobada, logo («Usar logo»), o sin creative de device → **predeterminadas** de la ficha (`inferWelcomeCampaignSelection`).
- Carga rápida por URL (opcional) guarda en la **biblioteca del sponsor**, no como archivo aislado; `isDefault: false` hasta set explícito.

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

`WELCOME_GRAPHIC_MEDIA_MIN_DESKTOP_PX = 768` (Tailwind / DS `md`).

Render: `<picture>` + `source media="(min-width: 768px)"` + `prefers-reduced-motion: reduce` para GIFs. El navegador descarga solo la variante aplicable (sin leer `window` en SSR; sin hydration mismatch).

## Snapshot de publicación

`PartnerCampaignPublicationSnapshot.welcomeMedia` opcional (prioridad sobre `imageUrl` legacy). Hash incluye URLs/MIME/dims públicas; no PII. Metadata de assets: solo `welcomeGraphic`. Publisher replica `metadata` JSON existente (sin migración).

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

## Componente

`PartnerWelcomeResponsiveMedia` + `PartnerWelcomeInterstitial` / `PartnerAdCreative` (`media` prop).

Preview: desktop/mobile, reduced motion, simular error; tracking OFF.

## Aprobación

Flujo existente (`approvePartnerAsset`). Solo APPROVED pueden ser predeterminadas o usarse en publicación efectiva. Piezas PENDING no se afirman visibles.

## Schema futuro (opcional)

Enum Prisma `WELCOME_GRAPHIC_*` sería aditivo; **no requerido**. No ejecutar migraciones en esta etapa.

## Código

- Dominio: `packages/partners/src/welcome-graphic-assets.ts` + `welcome-graphic-constants.ts`
- API: `listWelcomeGraphicAssets`, `registerWelcomeGraphicAsset`, `replaceWelcomeGraphicAsset`, `setWelcomeGraphicDefault`
- Ficha: `WelcomeGraphicsProfileSection` + `welcome-graphic-profile-mutations.ts`
- Campañas: `WelcomeGraphicAssetsPanel`
- Doc UI DS: `PartnerWelcomeInterstitial`
