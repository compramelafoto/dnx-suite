# Sitio web PR 4 — Importador de Alboom Prosite y redirecciones — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** traer todo el contenido público de `www.dnxfotografia.com.ar` (Alboom Prosite) al sitio de DNX Estudio en FOTOFFICE, con fotos en R2 y las direcciones viejas redirigidas.

**Architecture:** tabla general `FotofficeSitioRedireccion` consultada antes de las rutas reales (proxy) y antes del 404 (catch-all). Importador en dos capas: `apps/fotoffice/lib/sitio-importar/alboom/` (lectores puros de HTML → objetos, probados con HTML guardado) y `lib/sitio-importar/cargar.ts` (escribe en blog, trabajos, testimonios, páginas, menú y redirecciones; idempotente por id externo). Se corre con un script de operaciones con simulación por omisión.

**Tech Stack:** Node + `node-html-parser` o `cheerio` (usar el que ya esté en el monorepo; no agregar dependencias si hay uno — ver memoria «dependencia nueva rompe otras apps»), Prisma, `@repo/content` (motor del blog: crear artículos con la API del repositorio, no SQL crudo), R2.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-26-sitio-dnx-desde-alboom-design.md` (PR 4 y sección 7 bis). Depende de PR 1–3.

## Global Constraints

- Workspace destino: `cmv5z6qxwwmmhf0q5gp8qja1j` (slug público `dnx-estudio`). Nunca el demo `cmocabxjg0063xpedb91k42xt`.
- Fuente: sólo `https://www.dnxfotografia.com.ar` público, ≤2 pedidos por segundo, User-Agent identificable `FOTOFFICE-importador/1.0`. Nada se escribe en Alboom.
- Artículos a traer (ids de Alboom, publicados, leídos del panel el 26/10): 476452, 446766, 394647, 367249, 367247, 320993, 305804, 195938, 146935, 122043, 116089, 111321, 100049, 92784, 92781, 89987, 89977, 89679, 89675, 89594, 89593, 75450, 71826, 65558, 65554, 45061, 37919, 37204, 35176, 25164, 25161 (31).
- Fecha Alboom `dd/mm/aaaa às hh:mm` = hora argentina → `publishedAt` y `createdAt` UTC (+3 h).
- Slugs limpios para títulos con restos de generador: 111321 → `celebra-a-lo-grande-con-invitaciones-virtuales-y-packs`, 146935 → `descubri-el-canal-de-youtube-de-dnx-estudio`, 195938 → `cuidar-nuestros-oidos-ear-clogs`, 89593 → `por-que-necesitas-tu-propia-pagina-web`, 89594 → `eleva-tu-fotografia-con-alboomcrm`, 446766 → `que-es-comprame-la-foto`; el resto: slug de Alboom sin el número.
- Fotos: pedir la original `https://storage.alboom.ninja/sites/8403/...` (quitar el prefijo `alfred.alboompro.com/(crop|resize)/.../url/`), copiar a `fotoffice-media` bajo `fotoffice/cmv5z6qxwwmmhf0q5gp8qja1j/sitio/<tipo>/...`. Lista blanca de origen ampliada a `storage.alboom.ninja`, `alfred.alboompro.com`, `cdn.alboompro.com` (también en `lib/blog/localize-images-core.ts`).
- Páginas propias migradas (slug FOTOFFICE ← Alboom): `quien-soy` ← `/sobre`; `agenda` ← `/agenda`; `capacitate` ← `/cursos`; `imprimi-tus-fotos` ← `/imprimir`; `curso-xv` ← `/cursoxv`; `curso-celular` ← `/celular`; `curso-lightroom` ← `/cursolightroom`; `fotografia-inicial` ← `/fotografia-inicial`; `workshop-xv` ← `/workshopxv`; `consultorias` ← `/consultorias`; landings de servicio en línea: `taller-presupuestos` ← `/tallerpresupuestos`, `curso-eventos` ← `/curso_eventos`, `mentoria-1a1` ← `/1a1`, `planilla-presupuesto` ← `/xlspresupuesto`, `visita-virtual` ← `/visitavirtual`, `calendario-360` ← `/calendario360`, `la-isla` ← `/laisla`.
- Redirecciones fijas: `/home`→`/`; `/sobre`→`/quien-soy`; `/contato`,`/contacto-2`→`/presupuesto`; `/depoimento`→`/testimonio`; `/cursos`→`/capacitate`; `/imprimir`→`/imprimi-tus-fotos`; `/agenda2024`,`/datos`,`/prueba`,`/prueba-sfpr`→`/`; `/portfolio`,`/galerias`,`/portfolio/trabalhos`→`/trabajos`; `/portfolio/<cat>`→`/trabajos/<cat>`; `/post/<id>-*` y `/post.php?id=<id>`→`/blog/<slug>`; `/portfolio/<cat>/<id>-*`→`/trabajos/<cat>/<slug>`; `/gallery/<id>-*`→`/trabajos/<cat>/<slug>`; `/album.php?id=<id>`→ trabajo con ese id; landings de eventos no migradas → `/trabajos`; `/proof/*` → `https://dnxfotografia.alboompro.com/proof/*` (302). Las demás 301.
- Todo se escribe en BORRADOR del sitio (no se publica la versión del sitio); artículos, trabajos y testimonios sí quedan publicados en sus tablas (no se ven en el sitio hasta publicar el sitio, salvo `/blog` que ya es público: por eso **los artículos se crean como borrador** y se publican en el mismo paso en que Daniel publica el sitio — botón «Publicar contenido importado» en el informe).

## Review Focus

1. Volver a correr el importador → no duplica nada (Task 5).
2. Una foto que da 404 en Alboom → el trabajo/artículo se crea igual y el informe la lista (Task 4).
3. Ruta vieja con mayúsculas o barra final (`/Portfolio/`, `/post/89987-x/`) → redirige igual (Task 1).
4. Redirección que apunta a otra redirección → se resuelve en un salto, sin bucles (Task 1).
5. Artículo con iframe de YouTube o enlaces a `dnxfotografia.com.ar/...` → el video queda (nodo YouTube) y los enlaces internos se reescriben a las rutas nuevas (Task 3).

---

### Task 1: Redirecciones

**Files:** schema + `packages/db/prisma/migrations/20261223120000_fotoffice_sitio_redirecciones/migration.sql`; `apps/fotoffice/lib/website/redirecciones.ts` + test; `apps/fotoffice/proxy.ts` / `lib/website/domain/routing.ts`; `app/w/[workspaceSlug]/[...rest]/page.tsx`; panel simple `app/(shell)/website/redirecciones/page.tsx` (lista, alta, baja).

**Interfaces:**
- `FotofficeSitioRedireccion { id; workspaceId; desde String; hacia String; codigo Int @default(301); origen String?; createdAt; @@unique([workspaceId, desde]) }`
- `normalizarRuta(ruta: string): string` (minúsculas, sin barra final salvo `/`, decodificada, con query sólo para `post.php`/`album.php` → `?id=<n>`); `buscarRedireccion(workspaceId, ruta): Promise<{ hacia: string; codigo: 301|302 } | null>` con caché en memoria 60 s por workspace; resuelve cadenas hasta 3 saltos y corta bucles.
- [ ] Tests: normalización; cadena A→B→C da C; bucle A→B→A → null; patrón `/proof/*` (comodín final `*` en `desde`, reemplaza `*` en `hacia`).
- [ ] Integración: en dominio propio el proxy consulta (vía la misma API interna que usa para dominio→slug) **antes** de reescribir; en `/w/<slug>/…` el catch-all consulta antes del 404 y la ruta real `cursos` no se toca salvo por el proxy de dominio propio (documentar en el código que en `/w/<slug>/cursos` manda el módulo).
- [ ] Commit «Sitio web: redirecciones».

### Task 2: Lectores de Alboom (HTML → datos)

**Files:** `apps/fotoffice/lib/sitio-importar/alboom/{articulo.ts,trabajo.ts,galeria.ts,testimonios.ts,pagina.ts,fotos.ts}` + tests con HTML guardado en `lib/sitio-importar/alboom/__fixtures__/` (guardar 1 artículo, 1 trabajo, 1 galería, la portada, `/sobre`, `/cursos`, `/agenda`, `/cursoxv` bajándolos con curl).

**Interfaces:**
- `leerArticulo(html, url) → { alboomId, titulo, fechaLocal: string /* yyyy-mm-ddThh:mm */, categorias: string[], portadaUrl: string|null, cuerpoHtml }` (cuerpo = `.post_content`).
- `leerTrabajo(html, url) → { alboomId, categoriaSlug, titulo, lugar, fecha: string|null, descripcionHtml, fotos: string[] /* originales */ }`.
- `leerGaleria(html, url) → { alboomId, titulo, fotos: string[], videos: string[] }`.
- `leerTestimonios(htmlPortada) → Array<{ nombre, texto, fotoUrl|null, enlace|null, trabajoAlboomUrl|null }>` (32 esperados; `cite` del blockquote apunta al trabajo si es del sitio).
- `leerPagina(html) → { titulo, secciones: Array<{ titulo?: string; html: string; imagenes: string[]; botones: Array<{ texto, url }> }>, iframes: string[] }`.
- `urlOriginal(urlAlfred: string): string`.
- [ ] Tests con las fixtures: el artículo 89987 da título «Nos mudamos a Funes!», fecha `2024-01-27T19:36`; portada da 32 testimonios, el primero «Gise y Fatu Broun» con foto `storage.alboom.ninja/sites/8403/testimonials/gyf.jpg`; `urlOriginal("https://alfred.alboompro.com/crop/width/600/height/400/mode/jpeg/url/storage.alboom.ninja/sites/8403/albuns/1465286/x.jpg")` → `https://storage.alboom.ninja/sites/8403/albuns/1465286/x.jpg`.
- [ ] Commit «Importador: lectores del sitio de Alboom».

### Task 3: Transformaciones (HTML de Alboom → contenido FOTOFFICE)

**Files:** `lib/sitio-importar/transformar.ts` + test

- [ ] `htmlArticuloAContenido(html, mapaEnlaces) → JSONContent` (TipTap del blog: usar el parser de `@repo/content` si existe `htmlToContent`; si no, `generateJSON` de `@tiptap/html` con las extensiones de `packages/content/src/tiptap/extensions.ts`), reescribe enlaces `dnxfotografia.com.ar/...` con `mapaEnlaces`, iframes de YouTube → nodo `youtube`.
- [ ] `paginaABloques(pagina) → WebsiteBlock[]` (RICH_TEXT por sección, GALLERY si hay ≥3 imágenes, EMBED para iframes permitidos, CTA por botón; formularios de Alboom → INQUIRY_FORM).
- [ ] Tests de ambos con las fixtures.
- [ ] Commit «Importador: transformar artículos y páginas».

### Task 4: Copia de fotos a R2

**Files:** `lib/sitio-importar/fotos-r2.ts` + test

- [ ] `copiarFoto(urlOrigen, destinoPrefijo) → { url, key, ancho, alto } | { error }` con reintento 2 veces, tope 25 MB, verificación de firma (reusar `sniffImageFormat`), memo por `urlOrigen` en una tabla en memoria + chequeo de existencia en R2 por key derivada del hash del origen (idempotente entre corridas).
- [ ] Test con fetch y cliente R2 simulados: 404 → `{ error: "respondió 404" }`; misma URL dos veces → una sola subida.
- [ ] Commit «Importador: copia de fotos a R2».

### Task 5: Carga e informe

**Files:** `lib/sitio-importar/cargar.ts` + test; `packages/db/prisma/scripts/ops-sitio-importar-alboom-prosite.ts`

- [ ] `importarSitioAlboom({ workspaceId, base: "https://www.dnxfotografia.com.ar", aplicar: boolean }) → Informe` con: categorías y artículos del blog (borrador, `createdAt` = fecha), autor «Daniel Cuart»; categorías de trabajos (Books, Fiestas de XV, Bodas, Arquitectura, Graduaciones, Videos) y 45 trabajos (40 + 5 galerías) PUBLICADOS con `origenExterno="alboom-prosite"`; 32 testimonios PUBLICADOS, origen IMPORTADO, consentimiento con texto «Publicado por el autor en el sitio anterior (Alboom)», atados al trabajo si el `cite` apunta a uno; páginas propias y portada (spec PR 4) en el borrador del sitio; menú editado (Inicio, Trabajos, Blog, Quién soy, Pedí tu presupuesto, Imprimí tus fotos, Agendá un turno, Capacitate, Testimonios, Tienda Online → `https://www.dnxshop.com.ar/`); redirecciones. Logo: `https://storage.alboom.ninja/sites/8403/img/log.png` a R2 si el workspace no tiene logo.
- [ ] Idempotencia: se busca por `origenExternoId` / slug antes de crear; segunda corrida = 0 creados.
- [ ] Informe JSON + resumen en español en `apps/fotoffice/docs/alboom/sitio-importacion-<fecha>.md` (contadores, fotos fallidas por artículo/trabajo, landings no migradas con su URL para que Daniel marque).
- [ ] Botón «Publicar contenido importado» (artículos en borrador con `origenExterno` → publicados) en el panel del blog, visible sólo si hay borradores importados.
- [ ] Script: `--workspace`, `--aplicar` (sin él, simulación: lee y transforma todo, no escribe ni sube).
- [ ] Commit «Importador de Alboom Prosite».

### Task 6: Cierre y corrida real

- [ ] Tipos, tests, build. SQL de redirecciones aplicado + resolve **antes de fusionar**. PR, CI, fusionar.
- [ ] Simulación contra producción → revisar el informe → `--aplicar`.
- [ ] Verificar la vista previa del borrador de DNX (`/website/preview` y cada página propia con `?pagina=`), contar artículos, trabajos, fotos y testimonios contra el informe.
