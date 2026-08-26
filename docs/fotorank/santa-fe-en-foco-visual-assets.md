# Santa Fe en Foco — Inventario de assets visuales

Documento ETAPA 02 IMPLEMENTACIÓN 01 + **02**.  
**No se utilizaron imágenes de stock ni generadas por IA.**  
**No se descargaron recursos externos.**

## Ruta canónica

```text
apps/fotorank/public/contest-assets/santa-fe-en-foco/
```

Manifiesto tipado:

```text
apps/fotorank/app/lib/fotorank/contest-assets/santa-fe-en-foco-assets.ts
```

Ingestión operativa: `docs/fotorank/santa-fe-en-foco-asset-ingestion.md`.

## Recursos encontrados en el repositorio (auditoría)

| Path | Dimensiones / formato | Propósito posible | Decisión |
|------|------------------------|-------------------|----------|
| `apps/fotorank/public/fotorank-logo.png` | PNG wordmark | Plataforma FotoRank | **Usar** solo topbar/footer plataforma |
| `apps/fotorank/public/fotorank-isologo.png` | PNG isologo | Plataforma | No como hero del concurso |
| `apps/fotorank/public/logo-fotorank.png` | PNG | Duplicado marca | Descartado para concurso |
| `apps/fotorank/public/og-image.png` | PNG OG genérico | SEO plataforma | No como hero / social Santa Fe |
| `apps/fotorank/public/growla/*` | JPG | Otro producto | **Descartado** |
| `apps/fotorank/public/uploads/**` | Varios | Diplomas / jurados | **Descartado** — no institucionales SFEF |
| `.tmp/fotorank-etapa0*/*` | Capturas QA | Validación | **Descartado** |

## Búsqueda institucional

No se encontraron binarios oficiales de:

- Santa Fe en Foco (marca del concurso);
- Sociedad de Fotógrafos Profesionales de Rosario;
- Cámara de Senadores de la Provincia de Santa Fe;
- Provincia de Santa Fe (para este concurso).

## Tabla de slots (estado actual)

| ID | Ruta canónica | Archivo actual | Dims reales | Peso | Formato | Propósito | Alt (manifiesto) | Crédito | Focal | Estado | Warnings | Incorporación |
|----|---------------|----------------|-------------|------|---------|-----------|------------------|---------|-------|--------|----------|---------------|
| `hero.desktop` | `hero/hero-desktop.webp` | — | — | — | JPEG/WebP | Hero | Fotografía representativa del concurso Santa Fe en Foco | — | 50, 42 | **pendiente** | — | — |
| `hero.mobile` | `hero/hero-mobile.webp` | — | — | — | JPEG/WebP | Hero mobile | … (versión móvil) | — | 50, 40 | **pendiente** | — | — |
| `identity.contestLogo` | `identity/contest-logo.png` | — | — | — | PNG/WebP | Logo concurso | Logo del concurso Santa Fe en Foco | — | — | **pendiente** | — | — |
| `identity.organizerLogo` | `identity/organizer-logo.png` | — | — | — | PNG/WebP | Logo SFPR | Logo de la Sociedad de Fotógrafos Profesionales de Rosario | — | — | **pendiente** | — | — |
| `identity.secondary.senado` | `identity/logos-secondary/senado.png` | — | — | — | PNG/WebP | Logo Senado | Logo de la Cámara de Senadores… | — | — | **pendiente** | — | — |
| `editorial.overview` | `editorial/overview.webp` | — | — | — | JPEG/WebP | Presentación | Imagen editorial de presentación… | — | 50, 50 | **pendiente** | — | — |
| `editorial.categories` | `editorial/categories.webp` | — | — | — | JPEG/WebP | Categorías | … | — | — | **pendiente** | — | — |
| `editorial.participation` | `editorial/participation.webp` | — | — | — | JPEG/WebP | Cómo participar | … | — | — | **pendiente** | — | — |
| `editorial.organizer` | `editorial/organizer.webp` | — | — | — | JPEG/WebP | Organización | … | — | — | **pendiente** | — | — |
| `editorial.prizes` | `editorial/prizes.webp` | — | — | — | JPEG/WebP | Premios | … | — | — | **pendiente** | — | — |
| `gallery[1..3]` | `gallery/gallery-0N.webp` | — | — | — | JPEG/WebP | Galería | Piezas institucionales | — | — | **pendiente** | — | — |
| `social` | `social/social-cover.webp` | — | — | — | JPEG/WebP | Open Graph | Imagen para compartir… | — | — | **pendiente** | — | — |

## Configuración en código

- Preset: `SANTA_FE_EN_FOCO_VISUAL_THEME.presentation = buildSantaFeEnFocoPresentation()`
- Todos los `file` del manifiesto: **null**
- Fallback hero / logos tipográficos intactos
- Galería no se renderiza vacía
- Metadata social: solo si `presentation.social` está conectado
- Runtime DB (`coverImageUrl` / `logoUrl`) sigue como complemento vía `applyRuntimeMedia` sin inventar archivos

## Recomendaciones de dimensiones (no bloqueos absolutos)

Ver validador y `santa-fe-en-foco-asset-ingestion.md` (hero ~2400×1100 / mobile ~1200×1500 / social 1200×630 / editorial ≥1400 px ancho / galería lado mayor ≥1600).
