# Sitio web PR 2 — Trabajos (portfolio del estudio) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que un estudio publique en su sitio sus trabajos (álbumes por categoría con muchas fotos), administrados desde Sitio web → Trabajos, y mostrarlos en `/trabajos` y con el bloque PORTFOLIO.

**Architecture:** tres tablas nuevas `Fotoffice*` sin FK a tablas existentes; lógica en `apps/fotoffice/lib/trabajos/`; panel en `app/(shell)/website/trabajos/**`; páginas públicas en `app/w/[workspaceSlug]/trabajos/**`; subida directa a R2 con `createFotofficeUploadUrl`/`verifyUploadedImage` (mismo camino que el portfolio de socios).

**Tech Stack:** Next.js del repo, Prisma `@repo/db` (schema `packages/db/prisma/schema.prisma`), zod, vitest, R2 (`lib/images/r2-presign.ts`).

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-26-sitio-dnx-desde-alboom-design.md` (sección 6, PR 2). Depende del PR 1 (bloques, `RESERVED_SITE_SEGMENTS`, `WebsiteDynamicData`).

## Global Constraints

- SQL `packages/db/prisma/migrations/20261221120000_fotoffice_sitio_trabajos/migration.sql`: cabecera `-- FOTOFFICE · Trabajos del sitio`, `CREATE TABLE IF NOT EXISTS`, índices `IF NOT EXISTS`, sin FK a tablas existentes, estados como texto.
- El código tolera que las tablas falten (error de Prisma `P2021` → lista vacía en el sitio, aviso en el panel), porque el SQL se aplica a mano.
- Sólo dueño/admin del workspace edita (mismo guardián que el blog: `requireBlogEditor` o su equivalente del sitio — reusar, no copiar).
- Tope 300 fotos por trabajo; formatos JPG/PNG/WebP; 25 MB por foto.
- Slug de trabajo y de categoría: mismo formato que las páginas (`^[a-z0-9]+(?:-[a-z0-9]+)*$`, ≤80), único por workspace (trabajo) y por workspace (categoría).
- HTML de la descripción saneado con `sanitizeContentHtml` (`@repo/content`).
- Fechas: `fecha` es día calendario (columna `date`), se muestra «14 de marzo de 2025».

## Review Focus

1. Trabajo en BORRADOR → 404 en público y fuera del bloque PORTFOLIO (Task 3).
2. Categoría oculta → sus trabajos no se listan aunque estén publicados (Task 3).
3. Subida que el navegador declara JPG pero es otra cosa → se rechaza y se borra el objeto (Task 4).
4. Base sin las tablas (SQL no aplicado) → `/w/<slug>/trabajos` muestra vacío, no 500 (Task 2).
5. Trabajo con 300 fotos → la ficha pública carga liviana (miniaturas por recorte de ancho, carga diferida) (Task 3).

---

### Task 1: Tablas y modelos

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (al final del bloque FOTOFFICE)
- Create: `packages/db/prisma/migrations/20261221120000_fotoffice_sitio_trabajos/migration.sql`

**Interfaces:**
- Produces modelos:
  - `FotofficeTrabajoCategoria { id String @id @default(cuid()); workspaceId String; nombre String; slug String; orden Int @default(0); visible Boolean @default(true); portadaUrl String?; createdAt; updatedAt; @@unique([workspaceId, slug]); @@index([workspaceId, orden]) }`
  - `FotofficeTrabajo { id; workspaceId; categoriaId String?; titulo String; slug String; lugar String?; fecha DateTime? @db.Date; descripcionHtml String?; portadaUrl String?; estado String @default("BORRADOR") /* BORRADOR|PUBLICADO */; destacado Boolean @default(false); orden Int @default(0); vistas Int @default(0); seoTitle String?; seoDescription String?; origenExterno String?; origenExternoId String?; publicadoAt DateTime?; createdAt; updatedAt; @@unique([workspaceId, slug]); @@unique([workspaceId, origenExterno, origenExternoId]); @@index([workspaceId, estado, fecha]) }`
  - `FotofficeTrabajoFoto { id; trabajoId String; workspaceId String; tipo String @default("FOTO") /* FOTO|VIDEO_URL */; url String; r2Key String?; ancho Int?; alto Int?; alt String?; orden Int @default(0); origenUrl String?; createdAt; @@index([trabajoId, orden]) }`
- [ ] Escribir schema + SQL equivalente (verificar con `pnpm --filter @repo/db exec prisma validate` y `prisma migrate diff --from-schema-datasource ... ` NO: sin conexión; comparar a mano con `prisma migrate diff --from-empty --to-schema-datamodel` filtrando las tres tablas).
- [ ] `pnpm --filter @repo/db exec prisma generate`.
- [ ] Commit «FOTOFFICE: tablas de Trabajos del sitio».

### Task 2: Repositorio y reglas

**Files:**
- Create: `apps/fotoffice/lib/trabajos/{reglas.ts,repositorio.ts,publico.ts}` + tests `reglas.test.ts`, `publico.test.ts`

**Interfaces:**
- Produces:
  - `reglas.ts`: `validarSlugTrabajo(slug, otros: string[]): string|null`; `slugDeTitulo(titulo): string` (reusar `slugifyPageTitle` del PR 1 con tope 80); `fechaLarga(fecha: Date): string` («14 de marzo de 2025», hora argentina); `MAX_FOTOS_POR_TRABAJO = 300`.
  - `repositorio.ts` (panel): `listarTrabajos(workspaceId, filtro?: { categoriaId?: string; estado?: string })`, `crearTrabajo`, `editarTrabajo`, `publicarTrabajo`, `despublicarTrabajo`, `borrarTrabajo` (borra fotos de R2 con `assertFotofficeDeletableR2Key`), `agregarFotos(trabajoId, fotos[])`, `reordenarFotos(trabajoId, ids[])`, `elegirPortada(trabajoId, fotoId)`, CRUD de categorías con `reordenarCategorias`. Todo filtrado por `workspaceId`.
  - `publico.ts`: `listarTrabajosPublicos(workspaceId, { categoriaSlug?: string; limite?: number; pagina?: number; soloDestacados?: boolean })` → `{ trabajos: TrabajoTarjeta[]; total: number }`; `obtenerTrabajoPublico(workspaceId, categoriaSlug, slug)` → `TrabajoPublico | null` (incluye fotos ordenadas y 3 relacionados de la misma categoría); `listarCategoriasPublicas(workspaceId)`. Tipos `TrabajoTarjeta = { titulo, slug, categoriaSlug, categoriaNombre, lugar, fechaTexto, portadaUrl, href }`. Si Prisma tira `P2021`, devolver vacío.
- [ ] Tests (con el patrón de Prisma de prueba que use `lib/blog` o `lib/portfolio/repository.test.ts`): borrador no sale; categoría oculta no sale; orden por `fecha desc, orden asc`; relacionados excluyen el propio; `P2021` → vacío; otro workspace nunca aparece.
- [ ] Implementar, verde, commit «FOTOFFICE: reglas y consultas de Trabajos».

### Task 3: Páginas públicas y bloque PORTFOLIO

**Files:**
- Create: `apps/fotoffice/app/w/[workspaceSlug]/trabajos/page.tsx`, `trabajos/[categoria]/page.tsx`, `trabajos/[categoria]/[trabajo]/page.tsx`, `components/website/render/trabajos/{trabajos-grilla.tsx,trabajo-galeria.tsx,visor.tsx}`
- Modify: `lib/website/blocks.ts` + `block-registry.tsx` (bloque `PORTFOLIO`), `lib/website/dynamic-data(.server).ts`, `lib/website/public-modules.ts` (página `trabajos`, label «Trabajos», visible si el sitio tiene ≥1 trabajo publicado, como el blog)
- Test: `lib/website/public-modules.test.ts`, `lib/website/blocks.test.ts`

**Interfaces:**
- Produces bloque `PORTFOLIO` config `{ title?: string ("Trabajos recientes"); categoriaId?: string; count: 3|6|9|12 (6); layout: "grid"|"masonry"; showViewAll: boolean (true) }`, categoría COMERCIAL, label «Trabajos». `WebsiteDynamicData.portfolio?: { tarjetas: TrabajoTarjeta[]; verTodosHref: string }`.
- [ ] Tests: página `trabajos` aparece en el menú automático sólo con trabajos publicados; bloque PORTFOLIO sin datos no se dibuja (devuelve null).
- [ ] Implementar: `/trabajos` paginado de a 24 con filtro por categoría (chips); ficha con mosaico, visor a pantalla completa (flechas, Escape, deslizar en celular), «También vieron», botón «Pedir presupuesto» → `/presupuesto?categoria=<id>` si hay una categoría de consultas con el mismo nombre normalizado (función `categoriaConsultaParaTrabajo(workspaceId, nombreCategoriaTrabajo)` en `lib/trabajos/publico.ts`), si no `/presupuesto`. Miniaturas: `<img loading="lazy">` con ancho 600 vía el redimensionador que ya use el sitio (si no hay, la original). Metadatos SEO y JSON-LD `ImageGallery`. Contar vista (incremento simple, sin bloquear el render).
- [ ] Commit «Sitio web: Trabajos en el sitio público».

### Task 4: Panel Sitio web → Trabajos

**Files:**
- Create: `apps/fotoffice/app/(shell)/website/trabajos/page.tsx`, `trabajos/[id]/page.tsx`, `trabajos/categorias/page.tsx`, `app/actions/trabajos.ts`, `app/api/website/trabajos/[id]/upload-url/route.ts`, `components/website/trabajos/*`
- Modify: sub-navegación del sitio web (donde estén Blog/SEO/Dominio) para agregar «Trabajos»
- Test: `apps/fotoffice/lib/trabajos/subida.test.ts`

**Interfaces:**
- Produces `prepararSubida(workspaceId, trabajoId, archivos: {nombre, tipo, bytes}[])` (valida tope 300 y 25 MB, pide URL firmada por archivo, prefijo `fotoffice/<workspaceId>/sitio/trabajos/<trabajoId>/`) y `confirmarSubida(workspaceId, trabajoId, keys[])` (verifica con `verifyUploadedImage`, borra los inválidos, crea filas).
- [ ] Tests de `prepararSubida`/`confirmarSubida` con el cliente R2 simulado: pasar el tope → error «Cada trabajo admite hasta 300 fotos»; archivo inválido → se borra y no queda fila.
- [ ] UI: lista con filtro y estado; ficha con título, categoría, lugar, fecha, descripción (editor TipTap del PR 1), subida múltiple con barra de progreso, ordenar arrastrando, elegir portada, alt por foto, agregar video por URL (YouTube/Vimeo, reusar `toVideoEmbedUrl`), publicar/despublicar, borrar con confirmación. Categorías: crear, renombrar, ordenar, ocultar.
- [ ] Commit «Sitio web: panel de Trabajos».

### Task 5: Cierre

- [ ] Tipos, tests de `lib/trabajos` y `lib/website`, build local.
- [ ] Aplicar el SQL en la base de FOTOFFICE (rama Neon `development` del proyecto `compramelafoto`, la de producción de FOTOFFICE) y registrar con `prisma migrate resolve --applied 20261221120000_fotoffice_sitio_trabajos`; verificar en `_prisma_migrations`. **Antes de fusionar.**
- [ ] PR, CI verde, fusionar, verificar `/w/dnx-estudio/trabajos` (vacío, sin error) y el panel.
