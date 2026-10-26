# Sitio web PR 5 — Plantillas de verdad — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que elegir una plantilla arme un sitio completo y creíble (diseño + páginas + bloques con textos y fotos de muestra), con vista previa real.

**Architecture:** una plantilla pasa a ser `SiteTemplate = { id, nombre, descripcion, paraQuien, design: WebsiteDesignPresets, coloresSugeridos, paginas: Array<{ clave, meta?, bloques }> , menu }` en `apps/fotoffice/lib/website/templates/<id>.ts`, una por archivo; `templates.ts` queda como índice. La vista previa reusa `WebsitePageRenderer` con datos de muestra en un iframe escalado.

**Tech Stack:** Next.js del repo, React, vitest, R2 (fotos de muestra).

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-26-sitio-dnx-desde-alboom-design.md` (PR 5 y 7 bis punto 3). Depende de PR 1–3.

## Global Constraints

- Cinco plantillas: `eventos`, `estudio`, `retrato-editorial`, `oscura`, `institucion`. Las tres viejas (`institucional`, `fotografica`, `minimal`) siguen resolviendo (alias → `institucion`, `eventos`, `retrato-editorial`) porque hay sitios que las guardaron.
- Fotos de muestra: sólo de Unsplash/Pexels con licencia libre comercial, ~6 por plantilla, subidas a `fotoffice-media` bajo `fotoffice/plantillas/<id>/`, con `apps/fotoffice/lib/website/templates/CREDITOS.md` (autor, URL, licencia). Nunca fotos de clientes.
- Aplicar a sitio vacío: diseño + todas las páginas + menú. Aplicar a sitio con contenido: dos opciones — «Sólo el diseño» (como hoy) o «Diseño y páginas de muestra que falten» (agrega páginas cuya clave/slug no exista; nunca pisa ni borra).
- Textos de muestra en rioplatense, marcados para reemplazar («Contá acá quién sos…»).

## Review Focus

1. Aplicar «diseño y páginas» a un sitio que ya tiene `quien-soy` → no se duplica ni se pisa (Task 2).
2. Sitio guardado con plantilla vieja `fotografica` → abre el selector marcando `eventos` (Task 1).
3. Vista previa en celular del selector → miniaturas legibles, sin scroll horizontal (Task 3).
4. Plantilla con bloque TESTIMONIALS/PORTFOLIO en un sitio sin datos → en la vista previa se ven datos de muestra; en el sitio real el bloque no se dibuja hasta tener datos (Task 3).
5. Colores sugeridos → sólo se aplican si el usuario lo confirma (no pisan su branding) (Task 2).

---

### Task 1: Contrato y las cinco plantillas
**Files:** `lib/website/templates.ts`, `lib/website/templates/{eventos,estudio,retrato-editorial,oscura,institucion}.ts`, `templates.test.ts`
- [ ] Tests: cada plantilla parsea con `websiteBlockSchema` (todos sus bloques válidos), slugs de páginas pasan `validatePageSlug`, alias viejos resuelven.
- [ ] Contenido por plantilla (páginas): eventos = Inicio (HERO pantalla completa, PORTFOLIO, RICH_TEXT, TESTIMONIALS, INQUIRY_FORM), Quién soy, Pedí tu presupuesto; estudio = Inicio (HERO, servicios en RICH_TEXT, GALLERY, CONTACT con mapa, TESTIMONIALS), Servicios, Visitanos; retrato-editorial = Inicio minimal serif, Portfolio, Sobre mí; oscura = Inicio con HERO oscuro y PORTFOLIO masonry, Contacto; institucion = la institucional actual + BLOG_LATEST + CONTACT.
- [ ] Commit «Sitio web: cinco plantillas completas».

### Task 2: Aplicar plantilla
**Files:** `app/actions/website.ts` (acción de aplicar que hoy exista o `applyWebsiteTemplateAction`), `lib/website/apply-template.ts` + test
- [ ] `aplicarPlantilla(actual: { sections, design, menu }, plantilla, modo: "solo-diseno" | "diseno-y-paginas" | "todo") → { sections, design, menu }` puro. Tests de los cinco puntos de Review Focus que tocan lógica.
- [ ] Commit «Sitio web: aplicar plantilla sin pisar contenido».

### Task 3: Selector con vista previa real
**Files:** `components/website/builder/template-picker-panel.tsx`, `app/(shell)/website/plantillas/[id]/preview/page.tsx` (dibuja la plantilla con datos de muestra: 6 trabajos y 3 testimonios ficticios con fotos de muestra), `lib/website/dynamic-data.ts` (datos de muestra)
- [ ] Miniatura = iframe de la vista previa escalado (`transform: scale`), carga diferida; botón «Ver en grande»; en el celular, una por fila.
- [ ] Commit «Sitio web: selector de plantillas con vista previa».

### Task 4: Fotos de muestra y cierre
- [ ] Elegir y subir ~30 fotos (eventos, estudio, retrato, paisaje urbano) desde Unsplash/Pexels con `npx wrangler r2 object put fotoffice-media/fotoffice/plantillas/... --remote`; completar `CREDITOS.md`.
- [ ] Tipos, tests, build, PR, CI, fusionar, verificar el selector en producción con el sitio de DNX (sin aplicar).
