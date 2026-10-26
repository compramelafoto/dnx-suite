# Sitio web PR 1 — Páginas propias y bloques nuevos — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que el sitio público de FOTOFFICE tenga páginas propias además de la portada, y seis bloques nuevos (texto con formato, galería, video, contacto, formulario de presupuesto, iframe permitido), con el formulario creando la consulta en el circuito de FOTOFFICE.

**Architecture:** `sectionsJson.pages` ya es un mapa `clave → bloques[]`; se agrega una clave hermana `pageMeta` (`clave → {slug,title,seo}`) que los lectores viejos ignoran, así ninguna versión publicada cambia de forma. El catch-all `/w/[slug]/[...rest]` resuelve la página propia publicada por slug. Los bloques nuevos se suman a la unión de `lib/website/blocks.ts` y al registro visual `lib/website/block-registry.tsx`, como los existentes.

**Tech Stack:** Next.js (versión del repo, leer `node_modules/next/dist/docs/` antes de tocar rutas), Prisma `@repo/db`, zod, vitest, `@repo/content` (`sanitizeContentHtml`, editor TipTap del blog).

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-26-sitio-dnx-desde-alboom-design.md` (sección 6, PR 1). **Desvío consciente del spec:** en vez de `{version:2, pages:{home:{...}}}` se usa `pageMeta` hermano de `pages` — mismo resultado, cero riesgo para SFPR y Gus Barbers.

## Global Constraints

- Sin SQL en este PR.
- `parseWebsiteSections` debe seguir aceptando el JSON viejo (`{pages:{home:[...]}}`) y devolver los mismos bloques.
- Textos visibles en español rioplatense; «dinero», nunca «plata»; horas en hora argentina.
- Slug de página: `^[a-z0-9]+(?:-[a-z0-9]+)*$`, 1–60 caracteres, único en el sitio, nunca un segmento reservado.
- Bloques: un bloque inválido se descarta solo, nunca tira la página (patrón existente).
- Iframes sólo de: `compramelafoto.com`, `www.compramelafoto.com`, `www.youtube.com`, `youtube.com`, `player.vimeo.com`, `www.google.com` (ruta `/maps/embed`). Video: sólo YouTube y Vimeo.
- HTML de RICH_TEXT pasa siempre por `sanitizeContentHtml` de `@repo/content`, al guardar y al dibujar.
- El formulario nunca pierde una consulta por categoría: categoría elegida activa → esa; si no, `categoriaParaEventType` con archivadas; si no, la categoría activa cuyo nombre normalizado sea «otro»/«otros»/«otro evento»; si no, la primera activa.
- Comandos: tests `pnpm --filter fotoffice exec vitest run <ruta>`; tipos `pnpm --filter fotoffice exec tsc --noEmit -p .` (si muere por memoria con éxito falso, ver nota de memoria: correr con `NODE_OPTIONS=--max-old-space-size=8192` y mirar la salida, no sólo el código de salida).

## Review Focus

1. Sitio de SFPR/Gus Barbers publicado con `sectionsJson` viejo → se ve igual (test con su JSON real, Task 1).
2. Slug de página igual a una ruta existente (`blog`, `tienda`, `presupuesto`, `trabajos`…) → rechazado al guardar (Task 1).
3. Formulario enviado con una categoría que el dueño archivó después de publicar → la consulta entra igual (Task 9).
4. Página propia borrada que sigue en el menú publicado → el ítem no se dibuja, no hay enlace roto (Task 5).
5. Iframe/video con host fuera de la lista o `javascript:` → no se dibuja nada (Task 7).

---

### Task 1: Páginas propias en el contrato de `sectionsJson`

**Files:**
- Modify: `apps/fotoffice/lib/website/blocks.ts` (schema de secciones, `parseWebsiteSections`, `emptyWebsiteSections`)
- Create: `apps/fotoffice/lib/website/pages.ts`
- Modify: `apps/fotoffice/lib/website/reserved-slugs.ts` (de documentación a regla exportada)
- Test: `apps/fotoffice/lib/website/pages.test.ts`, `apps/fotoffice/lib/website/blocks.test.ts`

**Interfaces:**
- Produces:
  - `type WebsitePageMeta = { slug: string; title: string; seoTitle?: string; seoDescription?: string }`
  - `WebsiteSections = { pages: Record<string, WebsiteBlock[]>; pageMeta: Record<string, WebsitePageMeta> }` (`pageMeta` nunca tiene `home`)
  - `HOME_PAGE_KEY = "home"`
  - `listCustomPages(s: WebsiteSections): Array<{ key: string } & WebsitePageMeta>` (en orden de inserción)
  - `findPageBySlug(s: WebsiteSections, slug: string): { key: string; meta: WebsitePageMeta; blocks: WebsiteBlock[] } | null`
  - `validatePageSlug(slug: string, others: string[]): string | null` (mensaje de error o null)
  - `slugifyPageTitle(title: string): string`
  - `RESERVED_SITE_SEGMENTS: readonly string[]` en `reserved-slugs.ts`: debe contener cada carpeta bajo `app/w/[workspaceSlug]/` más `trabajos`, `testimonio`, `testimonios`, `presupuesto`, `insertar`, `api`, `w`.

- [ ] **Step 1: Tests** en `pages.test.ts`:
  - `parseWebsiteSections({pages:{home:[heroValido]}})` → `pageMeta` = `{}` y `pages.home` igual.
  - JSON real de SFPR (copiar `sectionsJson` de la versión publicada `cmuunbh6k0003kx042yg4gtxf` como fixture `__fixtures__/sfpr-sections.json`, leído con `psql` de sólo lectura) → mismos ids de bloques que hoy.
  - `pageMeta` con una clave sin `pages[clave]` → se descarta; `pages[clave]` sin meta (≠home) → se descarta.
  - `validatePageSlug("blog", [])` → error «Esa dirección ya la usa el sitio»; `"quien-soy"` con `others=["quien-soy"]` → «Ya hay otra página con esa dirección»; `"Quién Soy"` → error de formato; `"quien-soy"` → null.
  - `slugifyPageTitle("¿Quién soy?")` → `"quien-soy"`.
  - Test que recorre `fs.readdirSync("app/w/[workspaceSlug]")` y exige que cada carpeta (sin paréntesis ni corchetes) esté en `RESERVED_SITE_SEGMENTS`.
- [ ] **Step 2:** correr y ver fallar.
- [ ] **Step 3:** implementar. `parseWebsiteSections` lee `pageMeta` con `websitePageMetaSchema.safeParse` por entrada.
- [ ] **Step 4:** correr `pages.test.ts` y `blocks.test.ts`, todo verde.
- [ ] **Step 5:** commit «Sitio web: páginas propias en el contrato de secciones».

### Task 2: Guardar y publicar varias páginas

**Files:**
- Modify: `apps/fotoffice/app/actions/website.ts` (`saveWebsiteBlocksAction`)
- Create: `apps/fotoffice/lib/website/save-pages.ts`
- Test: `apps/fotoffice/lib/website/save-pages.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces: `mergePageSave(current: WebsiteSections, input: { pageKey: string; blocks?: WebsitePageContent; pageMeta?: Record<string, WebsitePageMeta> }): { sections: WebsiteSections } | { error: string }`. FormData nuevo: `pageKey` (opcional, por omisión `home`), `pagesMetaJson` (opcional, reemplaza el mapa entero de meta; claves que desaparecen borran también `pages[clave]`).

- [ ] **Step 1: Tests**: guardar bloques de `home` no toca otras páginas; guardar bloques de una clave sin meta → error; `pagesMetaJson` con dos slugs iguales → error; con slug reservado → error; quitar una clave de meta borra sus bloques; nunca se puede borrar `home`; tope 50 páginas.
- [ ] **Step 2:** ver fallar.
- [ ] **Step 3:** implementar; la acción lee el `sectionsJson` actual del borrador, llama a `mergePageSave` y escribe. `publishWebsiteAction` ya copia `sectionsJson` entero: no cambia (verificarlo leyendo).
- [ ] **Step 4:** verde.
- [ ] **Step 5:** commit «Sitio web: guardar cada página por separado».

### Task 3: Página propia en el sitio público

**Files:**
- Modify: `apps/fotoffice/lib/website/public-site.ts` (exponer `sections: WebsiteSections` de la versión publicada además de `homeBlocks`)
- Modify: `apps/fotoffice/app/w/[workspaceSlug]/[...rest]/page.tsx`
- Modify: `apps/fotoffice/lib/website/dynamic-data.server.ts` (la firma ya recibe `blocks`; usarla también para páginas)
- Test: `apps/fotoffice/lib/website/public-site.test.ts`

**Interfaces:**
- Produces: `resolvePublicCustomPage(site: PublicSite, rest: string[]): { meta: WebsitePageMeta; blocks: WebsiteBlock[] } | null` (sólo un segmento; sitio sin publicar → null).

- [ ] **Step 1: Tests** de `resolvePublicCustomPage`: `["quien-soy"]` encuentra; `["quien-soy","x"]` → null; sitio no publicado → null; slug sólo en borrador (no en publicada) → null.
- [ ] **Step 2:** ver fallar.
- [ ] **Step 3:** implementar. El catch-all: `loadPublicSite` → `resolvePublicCustomPage` → si null `notFound()`; si no, `WebsitePageRenderer` con `loadWebsiteDynamicData(site, blocks)`. `generateMetadata`: `seoTitle ?? title` + nombre comercial, `seoDescription`. La vista previa del panel (`/website/preview`) acepta `?pagina=<clave>` y dibuja esa página del borrador.
- [ ] **Step 4:** verde.
- [ ] **Step 5:** commit «Sitio web: las páginas propias se ven en el sitio».

### Task 4: Panel — elegir, crear, renombrar y borrar páginas

**Files:**
- Modify: `apps/fotoffice/components/website/builder/website-builder.tsx`, `section-list.tsx`, `live-preview.tsx`, `lib/website/use-draft-autosave.ts`
- Create: `apps/fotoffice/components/website/builder/page-switcher.tsx`

**Interfaces:**
- Consumes: Tasks 1–2 (`pageKey`, `pagesMetaJson`).

- [ ] **Step 1:** test de componente (vitest + testing-library, como los existentes del builder si los hay; si no, test de la función pura `nextPageKey(existing: string[]): string` que genera `p_<n>`).
- [ ] **Step 2–4:** implementar el selector arriba de la lista de secciones: «Portada», cada página, «+ Nueva página» (pide título, propone slug con `slugifyPageTitle`, valida con `validatePageSlug` en vivo), menú «⋯» con Renombrar / Cambiar dirección / Borrar (confirmación; Portada sin borrar). Al cambiar de página, el autosave guarda la anterior antes de cambiar. La vista previa sigue a la página activa.
- [ ] **Step 5:** commit «Sitio web: páginas en el constructor».

### Task 5: Menú — enlazar una página propia

**Files:**
- Modify: `apps/fotoffice/lib/website/site-menu.ts`, `components/website/builder/menu-panel.tsx`, `lib/website/site-nav.ts`
- Test: `apps/fotoffice/lib/website/site-menu.test.ts`

**Interfaces:**
- Produces: entrada nueva del menú `{ id, kind: "custom", pageKey: string, label: string|null, hidden: boolean }`; `resolveSiteMenu` (o la función que hoy arma los ítems) recibe `sections` y devuelve `href = /w/<slug>/<pageSlug>` (o `/<pageSlug>` en dominio propio, como los demás).

- [ ] **Step 1: Tests:** ítem `custom` con página existente → href correcto y label por omisión = título; con `pageKey` inexistente → no aparece; menú automático (navJson null) agrega las páginas propias después de los módulos.
- [ ] **Step 2–4:** implementar; en el panel de menú, «Agregar» ofrece «Página propia» con la lista.
- [ ] **Step 5:** commit «Sitio web: páginas propias en el menú».

### Task 6: Bloque RICH_TEXT

**Files:**
- Modify: `apps/fotoffice/lib/website/blocks.ts`, `lib/website/block-registry.tsx`
- Create: `apps/fotoffice/components/website/render/blocks/rich-text-block-view.tsx`, `components/website/inspector/rich-text-field.tsx`
- Test: `apps/fotoffice/lib/website/blocks.test.ts`

**Interfaces:**
- Produces: `RICH_TEXT` con config `{ title?: string(≤200); html: string(≤100000); align: "left"|"center"; width: "narrow"|"normal"|"wide" }`, categoría BASICAS, label «Texto con formato».

- [ ] **Step 1: Test:** bloque con `<script>` en `html` → al parsear y sanear queda sin script (`sanitizeRichTextConfig(config)` exportada desde `blocks.ts`, la usa la acción de guardar y la vista).
- [ ] **Step 2–4:** implementar. El inspector reusa el editor TipTap del blog (`components/website/blog/blog-editor-client.tsx` o la pieza de edición que exponga; si está acoplado al formulario del artículo, extraer el editor a `components/website/inspector/rich-text-field.tsx` sin cambiar su comportamiento en el blog). La vista usa las mismas clases tipográficas que `blog-article-body.tsx`.
- [ ] **Step 5:** commit «Sitio web: bloque de texto con formato».

### Task 7: Bloques GALLERY, VIDEO y EMBED

**Files:**
- Modify: `blocks.ts`, `block-registry.tsx`
- Create: `apps/fotoffice/lib/website/embed-hosts.ts`, `components/website/render/blocks/gallery-block-view.tsx`, `video-block-view.tsx`, `embed-block-view.tsx`
- Test: `apps/fotoffice/lib/website/embed-hosts.test.ts`, `blocks.test.ts`

**Interfaces:**
- Produces:
  - `GALLERY`: `{ title?: string; photos: Array<{ id: string; url: string; alt?: string }> (≤200); layout: "grid"|"masonry"; columns: 2|3|4; lightbox: boolean }`, label «Galería de fotos».
  - `VIDEO`: `{ title?: string; url: string }`, label «Video».
  - `EMBED`: `{ title?: string; url: string; heightPx: 400..2000 }`, label «Contenido insertado».
  - `toVideoEmbedUrl(url: string): string | null` (YouTube watch/shorts/youtu.be y Vimeo → URL de reproductor; cualquier otra → null).
  - `isAllowedEmbedUrl(url: string): boolean` (https y host de la lista de Global Constraints).
- [ ] **Step 1: Tests:** `toVideoEmbedUrl("https://youtu.be/abc123")` → `https://www.youtube.com/embed/abc123`; `"https://vimeo.com/76979871"` → `https://player.vimeo.com/video/76979871`; `"javascript:alert(1)"` → null; `isAllowedEmbedUrl("https://www.compramelafoto.com/dnxestudio2?embed=1")` → true; `"http://compramelafoto.com"` → false; `"https://evil.com/compramelafoto.com"` → false; `"https://www.google.com/maps/embed?pb=x"` → true; `"https://www.google.com/search"` → false.
- [ ] **Step 2–4:** implementar. Galería: subida múltiple con el mismo componente de subida del sitio (`ImageUploadField` en modo múltiple o varias llamadas), ordenar arrastrando, visor a pantalla completa con flechas y teclado. Las vistas devuelven `null` si la URL no pasa.
- [ ] **Step 5:** commit «Sitio web: galería, video y contenido insertado».

### Task 8: Bloque CONTACT

**Files:**
- Modify: `blocks.ts`, `block-registry.tsx`, `lib/website/dynamic-data.ts`, `dynamic-data.server.ts`
- Create: `components/website/render/blocks/contact-block-view.tsx`
- Test: `apps/fotoffice/lib/website/contact-block.test.ts`

**Interfaces:**
- Produces: `CONTACT` config `{ title?: string; useWorkspaceData: boolean; email?: string; phone?: string; whatsapp?: string; whatsappText?: string; address?: string; mapsUrl?: string; socials: Array<{ network: "instagram"|"facebook"|"youtube"|"vimeo"|"tiktok"|"linkedin"|"pinterest"|"x"; url: string }> }`; `whatsappHref(numero: string, texto?: string): string | null` (normaliza a `https://wa.me/549...` para números argentinos sin el 9; deja pasar si ya trae código de país).
- [ ] **Step 1: Tests:** `whatsappHref("341 341-9869")` → `https://wa.me/5493413419869`; `whatsappHref("+54 9 341 374-8324","Hola")` → `https://wa.me/5493413748324?text=Hola`; `mapsUrl` que no sea `https://maps.app.goo.gl/…` o `https://www.google.com/maps…` se descarta al parsear.
- [ ] **Step 2–4:** implementar; con `useWorkspaceData`, los campos vacíos se completan con `PublicSiteContact`.
- [ ] **Step 5:** commit «Sitio web: bloque de contacto».

### Task 9: Bloque INQUIRY_FORM y alta de consulta desde el sitio

**Files:**
- Modify: `blocks.ts`, `block-registry.tsx`, `dynamic-data.ts`, `dynamic-data.server.ts`
- Create: `apps/fotoffice/app/actions/site-inquiry.ts`, `apps/fotoffice/lib/website/inquiry.ts`, `components/website/render/blocks/inquiry-form-block-view.tsx` (cliente)
- Modify: `apps/fotoffice/app/actions/service-lead.ts` (exportar validación/freno compartidos, no duplicar) y el formulario general (`public-dynamic-service-lead-form.tsx`, `xv/public-service-lead-form.tsx`) para pedir «¿Cómo nos conociste?»
- Test: `apps/fotoffice/lib/website/inquiry.test.ts`

**Interfaces:**
- Produces:
  - `INQUIRY_FORM` config `{ title?: string; intro?: string; categoryIds: string[] (vacío = todas las activas); askOrigin: boolean (true); askEventDate: boolean (true); askEventLocation: boolean (true); buttonLabel: string ("Pedir presupuesto"); thanksMessage: string ("¡Gracias! Te escribimos dentro de las 24 horas.") }`, categoría COMERCIAL, label «Formulario de presupuesto».
  - `WebsiteDynamicData.inquiry?: { categorias: Array<{ id: string; nombre: string }>; origenes: Array<{ id: string; nombre: string }> }` — se lee sólo si la página tiene el bloque.
  - `resolverCategoriaDelSitio(db, workspaceId, categoriaId: string | null, eventType: string | null): Promise<CategoriaElegida | null>` en `lib/website/inquiry.ts` con el orden de Global Constraints.
  - `createSiteInquiry(prev, formData)` (server action): campos `workspaceSlug, categoriaId, origenId?, name, email, phone, eventDate?, eventLocation?, message?` + campo trampa; exige email o teléfono; llama `altaDeConsulta(..., { origenDelAlta: "WEB" })` con `categoriaId` resuelto y `origenId` sólo si pertenece al workspace y está activo.
- [ ] **Step 1: Tests** de `resolverCategoriaDelSitio` con Prisma de prueba (patrón de `lib/consultas/alta.test.ts`): activa → esa; archivada → por eventType; sin nada → «Otro evento»; sin «otro» → primera activa; workspace sin categorías → null (y la acción devuelve el mensaje de error común, no 500). Test de que `origenId` de otro workspace se ignora.
- [ ] **Step 2–4:** implementar. El bloque en la vista previa del panel muestra el formulario deshabilitado con categorías de ejemplo.
- [ ] **Step 5:** commit «Sitio web: formulario de presupuesto como sección».

### Task 10: Página de módulo «Presupuesto»

**Files:**
- Create: `apps/fotoffice/app/w/[workspaceSlug]/presupuesto/page.tsx` (convive con `presupuesto/[token]` existente: verificar en los docs de Next del repo que una `page.tsx` índice y un segmento dinámico hijo conviven)
- Modify: `apps/fotoffice/lib/website/public-modules.ts` (página `presupuesto` ligada a `service-leads`, label «Pedí tu presupuesto»), `site-nav.ts`
- Test: `apps/fotoffice/lib/website/public-modules.test.ts`

- [ ] **Step 1: Test:** con `service-leads` encendido la página aparece en el menú automático; apagado, no; la ruta devuelve 404 con el módulo apagado.
- [ ] **Step 2–4:** implementar: dibuja un INQUIRY_FORM a página completa (config por omisión) dentro del armazón del sitio; acepta `?categoria=<id>` para preelegir.
- [ ] **Step 5:** commit «Sitio web: página Pedí tu presupuesto».

### Task 11: Cierre

- [ ] Tipos (`tsc`), todos los tests de `lib/website`, `lib/consultas`, `app/actions` y `pnpm --filter fotoffice build` local en verde.
- [ ] Abrir PR, esperar CI verde, fusionar (decisión permanente de Daniel), y verificar en producción: `/w/sfpr` y `/w/gusbarbers` iguales; crear en DNX (borrador, sin publicar) una página de prueba y verla en la vista previa; luego borrarla.
