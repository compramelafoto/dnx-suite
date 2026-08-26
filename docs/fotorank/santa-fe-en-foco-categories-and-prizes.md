# Santa Fe en Foco — Categorías y premios (presentación pública)

**ETAPA 02 · IMPLEMENTACIÓN 04**  
Rama de trabajo: `feat/fotorank-super-admin-09b` · Commit base: `43553fb`

## Estado

- **Categorías:** implementación visual pública lista (datos reales de DB).
- **Premios Santa Fe en Foco:** **cargados en producción** (2026-08-11) vía módulo `rulesData.premiosRecompensas` — 12 premios monetarios (4 categorías × 1.º/2.º/3.º). Ver `santa-fe-en-foco-premios-carga-result.md`.

## Fuente real de categorías

- Entidad: `FotorankContestCategory` (estado `ACTIVE`).
- Carga: `getPublicContestLandingBySlug` → `contest.categories`.
- Campos usados en UI: `id`, `name`, `slug`, `description`, `maxFiles`.
- Campos existentes no expuestos como badges estructurados (no hay device/docs en schema): `sortOrder`, `status`, mapeos a globales.
- **No se modifican** categorías en DB para acomodar el diseño.

## Diseño de categorías

Composición editorial reutilizable:

| Pieza | Detalle |
|-------|---------|
| Grid | 2 columnas desktop; 1 mobile; variante `--single` si hay una sola |
| Número | `01`, `02`… |
| Ícono | Lucide semántico vía resolver |
| Título + descripción | Descripción real; omitida si null |
| Badges | dispositivo / docs / máx. obras / especial |
| Nota | requisito (ARGRA, dron) sin datos privados |
| CTA | «Participar en esta categoría» → `/inscripcion` **sin** preselección |
| Secundario | «Consultar bases» → `#bases` |

Componentes: `ContestCategoriesSection`, `ContestCategoryCard`, `ContestInfoBadge`.

## Mapeo semántico

`app/lib/fotorank/contest-public-presentation/category-semantics.ts`

| Kind | Detección | Ícono | Badges / notas |
|------|-----------|-------|----------------|
| amateur | slug/name amateur | Smartphone | Celular o cámara + máx. |
| professional | profesional | Camera | Solo cámara + máx. |
| press | reportero / prensa | IdCard | ARGRA + verificación + máx. |
| aerial | aerea / dron | Plane | Dron + docs posibles + máx. |
| generic | resto | Layers | Solo máx. obras (sin inferir) |

## Badges

Tonos: `device`, `docs`, `limit`, `modality`, `special`.  
Compactos, wrap, ícono opcional, no parecen botones, no dependen solo del color.

## Fuente / situación de premios

| Fuente | Uso público |
|--------|-------------|
| `rulesData.premiosRecompensas` (`ContestPrizeItem`, `visiblePublic`) | Sí, si hay ítems públicos |
| `contest.prizesSummary` | Fallback texto libre (sección sin cards) |
| Rules-config `SFEF_PRIZE_*` en `santa-fe-en-foco-2026.ts` | **No** se publican solos |
| Preset `santa-fe-en-foco-prizes.ts` | Vacío a propósito |

Resolver: `resolvePublicContestPrizes` — módulo visible → preset SFEF vacío.

## Contrato visual `ContestPrizePresentation`

Campos: `id`, `title`, `shortDescription`, `type`, `status`, `scope`, `categoryId?`, `categoryName?`, `rank?`, `monetaryAmount?`, `currency?`, `benefitLabel?`, `sponsorName?`, `sponsorLogoUrl?`, `sponsorLogoAlt?`, `conditionsSummary?`, `rulesAnchor?`, `featured`, `order`.

**Tipos:** CASH, PRODUCT, VOUCHER, SERVICE, EXHIBITION, PUBLICATION, CERTIFICATE, TROPHY, MENTION, OTHER.

**Status (contrato):** DRAFT · PENDING_CONFIRMATION · CONFIRMED · PUBLIC.  
En runtime actual, solo llegan ítems con `visiblePublic` (tratados como PUBLIC).

**Scope:** GENERAL · CATEGORY · POSITION · MENTION.

## Diseño de premios

- Sección `#premios` solo si hay premios públicos o `prizesSummary`.
- Destacado (`featured` / `isPrimary`).
- Secundarios en grid, agrupados por categoría vs generales.
- Sponsor: «Aportado por» + logo solo si URL usable.
- Monetario: `Intl.NumberFormat` (`formatPrizeAmount`).
- Enlace a bases en cada card.
- Nav sticky «Premios» solo si la sección existe.

## Cómo anunciar un premio confirmado

1. Cargar en admin Premios/Recompensas del concurso.
2. Completar qué se entrega, a quién (scope/categoría/puesto), aportante, tipo, importe o beneficio.
3. Marcar `visiblePublic`.
4. Opcional temporal: agregar a `SANTA_FE_EN_FOCO_PUBLIC_PRIZES` (solo confirmados).
5. Verificar landing + `#bases`.

### Asociar a categoría

`scope: "CATEGORY"` + `categoryId` (y nombre se resuelve desde categorías públicas).

### Agregar sponsor

`sponsorName` + opcional `sponsorLogoUrl` válida. Sin logo → solo nombre (sin placeholder).

### Ocultar

`visiblePublic: false` o quitar del preset. La sección desaparece si no queda nada público ni summary.

### Reemplazar preset por persistencia

Cuando exista editor/persistencia, `resolvePublicContestPrizes` ya prioriza el módulo; el preset queda como fallback vacío o se elimina.

## Fixture visual (no productivo)

Ruta: `/dev/contest-prizes-visual-fixture`  
- Solo fuera de `production` (`notFound()` en prod).  
- Datos de ejemplo **solo** para validar layout.  
- Capturas marcadas `FIXTURE-prizes-*` en `.tmp/fotorank-etapa02-impl04-visual/`.

## Información que debe confirmar la organización

- Montos, puestos y alcance (general vs por categoría).
- Tipos de premio y redacción pública.
- Sponsors y logos oficiales.
- Condiciones resumidas e impuestos/retenciones si aplican.
- Autorización explícita para `visiblePublic`.

## Selfcheck

```bash
pnpm --filter fotorank test:contest-public-presentation:selfcheck
```

## Capturas

```bash
node apps/fotorank/scripts/visual-capture-etapa02-impl04.mjs
```

Salida: `.tmp/fotorank-etapa02-impl04-visual/`

## Pendiente siguiente etapa

- Confirmación organizacional de premios reales.
- Carga en módulo o preset (sin inventar).
- Assets oficiales (logos sponsors) vía pipeline de assets.
- Editor admin de premios (fuera de esta impl).
- Preselección de categoría en inscripción (solo si producto lo soporta de forma segura).
