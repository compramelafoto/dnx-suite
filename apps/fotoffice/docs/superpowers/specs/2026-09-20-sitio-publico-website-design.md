# El sitio público de FOTOFFICE — diseño

**Fecha:** 2026-09-20
**Módulo:** `website` (`WEBSITE_MODULE_KEY`)
**Estado:** diseño aprobado, sin implementar
**Obra:** 1 de 3 (esta) → 2: secciones dinámicas de módulos → 3: blog / redactor

---

## Vocabulario

Hay tres interruptores distintos en juego y es fácil confundirlos al activar o desactivar
cosas. Se separan con tres pares de palabras que no se solapan:

| Qué es | Cómo se llama | Estados | Verbo | Dónde se toca |
|---|---|---|---|---|
| Función del workspace | **Módulo** | Habilitado / No habilitado | habilitar | Administración de módulos |
| Página del sitio | **Página** | En el menú / No listada | listar | Sitio web → Páginas |
| Parte de una página | **Sección** | Visible / Oculta | mostrar | Sitio web → Editor |

Un módulo se **habilita**, una página se **lista**, una sección se **muestra**. Nunca al revés.

**Esto ya es casi la convención vigente**: la pantalla del editor dice "Agregar sección",
"Ocultar sección", "Duplicar sección", y el panel de módulos dice "Habilitado / No
habilitado". Sólo queda un texto fuera de línea, en la portada del módulo —
*"Construí y publicá la Home de tu sitio público con bloques visuales"*— que hay que corregir.

**En el código se sigue llamando `block`** (`WebsiteBlock`, `WEBSITE_BLOCK_DEFINITIONS`,
`WEBSITE_BLOCK_REGISTRY`, `block-contract.ts`). No se renombra: es un cambio mecánico y masivo
que no arregla nada y ensucia el historial. La regla es **sección de cara al usuario, `block`
de cara al código**, y este documento usa "sección" salvo cuando nombra un identificador real.

### Qué significa "No listada"

Una página no listada **no aparece en el menú ni en el `sitemap.xml`, pero sigue abriéndose
por su dirección directa**. Sirve para una página de campaña que se comparte por WhatsApp sin
colgarla del menú.

Si preferís que una página no listada devuelva 404, es un cambio de una línea — pero entonces
hace falta otro estado para "existe pero no la muestro en el menú", y volvemos a tener tres
palabras para dos ideas.

---

## 1. Por qué

El módulo Website tiene un constructor visual completo: editor de secciones, vista previa en
vivo, panel de diseño, SEO, navegación, historial y publicación por versiones congeladas.
Nada de eso hay que rehacerlo.

**El problema es que lo publicado no lo ve nadie.** `WebsitePageRenderer` se usa únicamente
en `app/(shell)/website/preview/page.tsx` — dentro del panel, para el dueño. No existe
ninguna ruta pública que sirva la versión publicada. El fotógrafo publica hacia la nada.

Lo que sí es público hoy:

- `app/w/[workspaceSlug]/page.tsx` — una landing fija escrita a mano: logo, formulario de
  presupuesto y dos botones. No tiene relación con el sitio que el dueño armó.
- `app/w/[workspaceSlug]/cursos`, `/reservas`, `/asociarse`, `/xv` — cada una con su propia
  cabecera, sin menú común, sin pie, sin forma de navegar de una a otra.

Son páginas huérfanas, no un sitio. Esta obra las convierte en uno.

## 2. Alcance

### Entra

1. Armazón público único (encabezado, menú, pie) para todas las páginas de `/w/[slug]`.
2. Sitio de varias páginas: el dueño crea, nombra, ordena y quita del menú páginas.
3. Las páginas de módulos integradas al sitio, apareciendo y desapareciendo según el
   módulo esté habilitado en el workspace.
4. Pie de página (hoy no existe en ninguna forma).
5. Diez secciones nuevas, en dos tandas.
6. Diez plantillas, con paleta, pie y páginas semilla propias.
7. Lo que hace que sea un sitio real: SEO por página, Open Graph, `sitemap.xml`,
   `robots.txt`, favicon, 404 propio, datos estructurados, celular.
8. Vocabulario unificado de cara al usuario: módulo / página / sección (ver Vocabulario).

### No entra

- Dominio propio del workspace.
- Quitar el `/w/` de la dirección (`fotoffice.com/{slug}`).
- Blog y redactor — obra 3.
- Secciones de módulo dentro de la portada (ej. franja "Próximos cursos" en el Inicio) —
  obra 2, vía `lib/website/block-contract.ts`.
- Varios idiomas.
- Estadísticas de visitas.
- Tienda / venta directa desde el sitio.

### Precisión sobre "cada módulo con su parte visible"

En esta obra los módulos entran al sitio **como páginas**: con el mismo aspecto que el resto
del sitio, dentro del menú, apareciendo según estén habilitados. Los módulos **como secciones
dentro de la portada** son la obra 2 y dependen de que ésta exista primero. Son cosas
distintas y conviene no confundirlas.

---

## 3. Rutas

Se mantiene `/w/[workspaceSlug]` como base.

```
/w/mi-estudio                → Inicio del sitio publicado
/w/mi-estudio/nosotros       → página creada por el dueño
/w/mi-estudio/cursos         → página de módulo (ya existe)
/w/mi-estudio/reservas       → página de módulo (ya existe)
/w/mi-estudio/asociarse      → página de módulo (ya existe)
```

No se toca `fotoffice.com/{slug}` ni los dominios propios. `lib/website/reserved-slugs.ts`
documenta que esa decisión de producto está tomada, pero exige antes derivar del filesystem
las rutas de primer nivel reales de la app. Es otra obra.

### Choque de nombres

Las páginas del dueño y las de módulos comparten nivel, así que una página llamada `cursos`
taparía la del módulo Cursos.

**Se resuelve al crear la página**, no al servirla: una lista de slugs reservados **de sitio**
(los que usan las páginas de módulos y las rutas internas del sitio) valida el alta y devuelve
un mensaje concreto — *"'cursos' ya lo usa el módulo Cursos"*.

Esta lista es distinta de `FOTOFFICE_RESERVED_SLUGS`, que protege el slug del **workspace**.
Vive en el mismo archivo, con nombre propio, y se deriva del registro de módulos
(`lib/modules/registry.ts`) más las rutas fijas del sitio — nunca escrita a mano, para que no
se desactualice cuando se agregue un módulo.

Un test verifica que toda página de módulo existente bajo `app/w/[workspaceSlug]/` esté
cubierta por la lista.

---

## 4. El armazón público

Un layout en `app/w/[workspaceSlug]/layout.tsx` envuelve **todas** las páginas de `/w/[slug]`
— las del dueño y las de módulos. Resuelve una sola vez por request: branding, versión
publicada, presets de diseño y menú, y los pasa hacia abajo.

### Encabezado

`WebsiteHeaderView` ya existe con sus cinco variantes (`logo-left`, `centered`, `minimal`,
`transparent-hero`, `floating`). Se le agrega:

- **Menú desplegable en celular.** Hoy no tiene: en pantalla chica los items se amontonan.
- **Submenús** para las páginas agrupadas.
- **Estado activo**: la página en la que estás se marca en el menú.

### Pie de página

Nuevo. `WebsiteFooterView`, con tres variantes:

| Variante | Contenido |
|---|---|
| `simple` | Nombre, año, enlaces legales |
| `columns` | Menú secundario + contacto + redes, en columnas |
| `full` | Lo anterior + nota legal institucional + logo |

**Todos los datos ya están cargados** en `FotofficeWorkspaceBranding`: `contactEmail`,
`phone`, `whatsapp`, `instagram`, `city`, `province`, `country` y `emailSignatureNote` (la
nota legal, que hoy sólo usan los emails). Una sola fuente de verdad entre los correos y el
sitio, que es lo que ese campo ya declara en su comentario.

Se agrega `footerPreset` a `WebsiteDesignPresets`, con el mismo criterio de los demás: enum
cerrado, `.catch(default)` en el schema, traducción preset→CSS en un solo lugar.

### Cuando no hay sitio

Regla explícita, porque acá es fácil romper lo que hoy funciona:

| Situación | `/w/[slug]` | `/w/[slug]/cursos` y demás módulos |
|---|---|---|
| Módulo Sitio web **habilitado** y versión publicada | Sitio armado | Armazón completo |
| Módulo Sitio web **habilitado**, sin publicar nunca | Landing de presupuesto actual | Armazón mínimo |
| Módulo Sitio web **no habilitado** | Landing de presupuesto actual | Armazón mínimo |

El **armazón mínimo** es logo, nombre del workspace y un pie simple con los datos de contacto.

Dos cosas importantes:

1. **Las páginas de módulos nunca dependen del módulo website.** Un workspace que vende
   cursos y no quiere sitio sigue teniendo `/w/[slug]/cursos` funcionando.
2. **El sitio público no requiere sesión.** `requireWebsiteContext()` es para el panel y
   redirige a `/dashboard` — no se usa en ninguna ruta pública. La lectura pública consulta
   `WorkspaceFeatureModule` directamente, sin `requireAuth`.

---

## 5. Páginas

### Dónde se guardan: sin migración

`FotofficeWorkspaceWebsite.sectionsJson` ya guarda `{ pages: { home: [...] } }` — un registro
de páginas del que sólo se usa una entrada. Se extiende para que cada página guarde también su
metadata:

```
{ pages: { home: { meta: {...}, blocks: [...] }, nosotros: { meta: {...}, blocks: [...] } } }
```

`meta` contiene: `title`, `slug`, `visible`, `order`, `seoTitle`, `seoDescription`,
`ogImageUrl`, `isHome`.

**Compatibilidad hacia atrás:** si `pages[key]` es una lista pelada de secciones (la forma
actual), `parseWebsiteSections` la envuelve al leerla, derivando `meta` por defecto. El parseo
tolerante que ya existe hace esto natural: una sección inválida se descarta sin tumbar la página,
y una página con forma vieja se migra en memoria sin tocar la base.

**Consecuencia deliberada: cero migraciones de Prisma para las páginas.** Esto importa acá más
que en otras apps — las migraciones de FOTOFFICE se aplican a mano y hay que registrarlas en
`_prisma_migrations` con `resolve`, y el schema es compartido por cinco bases Neon. Cada
migración evitada es riesgo evitado.

**Consecuencia buena adicional:** la publicación por versiones congeladas
(`FotofficeWorkspaceWebsiteVersion`) sigue funcionando exactamente igual. Una versión guarda el
sitio entero, con todas sus páginas, en un solo JSON inmutable. No hay que versionar páginas
por separado.

### Pantalla "Páginas" en el panel

Nueva pestaña junto a Editor / Diseño / Navegación / SEO / Historial / Preview. Permite:
crear, renombrar, cambiar la dirección, quitar del menú, reordenar, duplicar y borrar.

El editor de secciones actual pasa a trabajar sobre la página seleccionada. El contexto
compartido (`loadWebsiteCmsContext`) se extiende con la página activa.

**Reglas:**

- Siempre existe exactamente una página marcada como Inicio, y no se puede borrar.
- Cambiar la dirección de una página publicada avisa que los enlaces viejos dejan de andar.
  No se implementa redirección automática en esta obra.
- Borrar una página pide confirmación y dice cuántas secciones se pierden.
- Una página **no listada** sale del menú y del `sitemap.xml`, pero sigue abriéndose por su
  dirección directa (ver Vocabulario).
- Un límite de 20 páginas por sitio, para que `sectionsJson` no crezca sin control.

---

## 6. El menú

Hoy `deriveHomeNavItems` arma el menú solo, con los títulos de las secciones de la portada
convertidos en anclas. Con varias páginas eso ya no alcanza.

**Regla nueva: el menú se arma solo, pero se puede corregir.**

Por defecto: una entrada por página listada (en su orden) más una por cada módulo habilitado
con página pública. Dentro del Inicio se siguen ofreciendo las anclas de sus secciones, como
submenú.

El dueño puede: renombrar, quitar del menú, reordenar, agrupar en submenús y agregar enlaces
externos.
Se guarda en `navJson` — campo que **ya existe en la base y hoy está sin usar**.

**El menú derivado es el que manda cuando `navJson` está vacío.** Si el dueño nunca tocó el
menú, agregar una página o habilitar un módulo lo actualiza solo. Una vez que lo editó a mano,
las páginas nuevas se agregan al final y los módulos no habilitados desaparecen, pero no se
reordena nada de lo que él decidió.

### Módulos habilitados y el menú

Acá se habla del módulo **propio de cada página** (Cursos, Reservas, Socios), no del módulo
Sitio web — son dos interruptores distintos y no hay que confundirlos:

- Cursos no habilitado → "Cursos" sale del menú **y** `/w/[slug]/cursos` devuelve 404.
  Ojo: esto NO es lo mismo que una página no listada, que sí se abre por su dirección.
- Cursos habilitado → aparece solo, sin que nadie toque el menú.
- **Sitio web** no habilitado → no afecta a ninguna página de módulo: sólo cambia el armazón
  de completo a mínimo, según la tabla de la sección 4.

Esto se resuelve en un solo lugar (el layout público, que ya consulta los módulos
habilitados), no repartido por cada página.

---

## 7. Secciones nuevas

Hoy hay cinco, todas en la categoría `BASICAS`: `HERO`, `TEXT`, `IMAGE`, `CTA`, `SPACER`. Con
ese vocabulario todas las plantillas terminan siendo la misma página con otra tipografía.

Se suman diez, en dos tandas. Todas `source: "static"` — las dinámicas son la obra 2.

### Primera tanda

| Sección | Qué hace |
|---|---|
| `GALLERY` | Grilla de imágenes con visor ampliado. Columnas y proporción por preset. |
| `SERVICES` | Tarjetas: imagen o ícono, título, texto, precio opcional, botón. |
| `CONTACT` | Datos de contacto + formulario. **Reusa `ServiceLeadForm`**, que ya existe y funciona. |
| `TEAM` | Personas: foto, nombre, rol, texto breve. |
| `LOGOS` | Auspiciantes, marcas, aliados. Grilla de logos con enlace opcional. |
| `FAQ` | Preguntas y respuestas en acordeón. |

### Segunda tanda

| Sección | Qué hace |
|---|---|
| `VIDEO` | YouTube o Vimeo embebido. Sólo se acepta la dirección, nunca HTML pegado. |
| `MAP` | Mapa embebido sin clave de API. |
| `TESTIMONIALS` | Citas con nombre y foto opcional. |
| `STATS` | Números destacados: "12 años", "300 eventos". |

### Reglas que se mantienen

- Presets cerrados, **nunca CSS libre** — el criterio que ya está escrito y es correcto.
- Cada sección se agrega en un solo lugar: `WEBSITE_BLOCK_DEFINITIONS` (metadata) +
  `WEBSITE_BLOCK_REGISTRY` (vista e inspector). No hay `switch` repartido por tres archivos.
- Schema de zod por sección, dentro de la unión discriminada. Una sección con tipo desconocido se
  descarta sin romper la página.
- `previewLabel` nunca lleva texto de administración: alimenta también el menú.

---

## 8. Plantillas

De tres a diez. Y con tres capacidades que hoy no tienen:

### 8.1 Paleta propia

Hoy los colores salen de `FotofficeWorkspaceBranding` y la plantilla no los toca — por eso
todas se ven parecidas. Se agrega `colorPreset` a `WebsiteTemplate`.

**Regla:** aplicar una plantilla en un sitio vacío escribe la paleta directamente. En un sitio
que ya tiene colores cargados, **pregunta antes de pisarlos**, con vista previa de los dos
estados. Nunca los cambia en silencio.

Los colores siguen viviendo en `FotofficeWorkspaceBranding` (decisión ya tomada y correcta:
son identidad del workspace, no del sitio). La plantilla los *sugiere*, no los *posee*.

### 8.2 Pie propio

Cada plantilla trae su `footerPreset`.

### 8.3 Páginas semilla

Hoy `seedSections()` devuelve secciones de una sola página. Pasa a `seedPages()`, que devuelve
un sitio completo: Inicio + Nosotros + Servicios + Contacto, ya armados.

### Las diez

| Plantilla | Para quién |
|---|---|
| Institucional | Clubes, cámaras, asociaciones |
| Fotográfica | Estudios, foco visual |
| Minimal | Lo esencial |
| Portfolio oscuro | Fondo negro, galería grande |
| Estudio con servicios | Foco en vender paquetes |
| Escuela | Formación, cursos |
| Agencia | Equipo, clientes, trabajos |
| Comunidad fotográfica | Socios, actividades, muestras |
| Cobertura de evento | Una sola página potente |
| Editorial clásica | Serif, mucho texto — queda lista para el blog de la obra 3 |

`recommendedFor` sigue usando los tipos de organización reales de `onboarding-constants`, y
sigue siendo una recomendación, nunca una restricción.

### Regla que se mantiene

**Aplicar una plantilla sobre un sitio con contenido cambia sólo el diseño, nunca borra
textos ni imágenes.** Ya está escrita en `templates.ts` y es correcta. Se extiende a las
páginas: cambiar de plantilla no borra páginas creadas.

---

## 9. Lo que lo hace un sitio de verdad

| Qué | Cómo |
|---|---|
| Título y descripción por página | `meta.seoTitle` / `meta.seoDescription`, con `generateMetadata` |
| Vista previa al compartir | Open Graph + Twitter Card, con `meta.ogImageUrl` o la portada del hero |
| `sitemap.xml` | Por workspace, sólo páginas visibles del sitio publicado y módulos habilitados |
| `robots.txt` | Por workspace. Sitio sin publicar → `noindex` |
| Favicon | `branding.faviconUrl`, que ya existe |
| 404 | `not-found.tsx` dentro del armazón, con el aspecto del sitio |
| Datos estructurados | JSON-LD `Organization` o `LocalBusiness` según `activityType` |
| Imágenes | `next/image` donde la fuente lo permita; medidas explícitas para evitar saltos |
| Celular | Todo el armazón verificado en ancho de teléfono |
| Idioma | `lang="es"` en el armazón público |

---

## 10. Riesgos y cómo se cubren

| Riesgo | Cobertura |
|---|---|
| Romper `/w/[slug]/cursos` y las demás landings que hoy funcionan | El armazón nunca exige módulo website ni sesión. Test por cada combinación de la tabla de la sección 4 |
| Un sitio guardado con la forma vieja deja de cargar | `parseWebsiteSections` envuelve la forma vieja. Test con el JSON exacto que hay hoy en producción |
| Una página del dueño tapa la de un módulo | Lista de reservados derivada del registro de módulos + test que la verifica contra el filesystem |
| `sectionsJson` crece sin control | Límite de 20 páginas y de secciones por página |
| Filtrar datos privados al público | Las secciones de esta obra son todas estáticas: su contenido vive en `config`, no consultan otros módulos. El contrato de `block-contract.ts` recién aplica en la obra 2 |
| El menú editado a mano se pisa al agregar una página | Las páginas nuevas se agregan al final; nunca se reordena lo que el dueño decidió |

---

## 11. Verificación

**Pruebas automáticas** sobre lo que se rompe en silencio:

- Resolución de página por dirección, incluida la página de Inicio.
- Choque con nombres reservados, y que la lista cubra las páginas de módulos reales.
- Menú derivado: orden, páginas no listadas, submenús, `navJson` vacío vs. editado.
- Módulo no habilitado: fuera del menú y 404 en su ruta.
- Página no listada: fuera del menú y del sitemap, pero abriéndose por su dirección.
- Las cuatro combinaciones de la tabla "cuando no hay sitio".
- Lectura de `sectionsJson` con la forma vieja.
- Plantillas: sembrar en sitio vacío vs. aplicar sobre sitio con contenido.
- Presets de pie: cada variante con datos de branding completos y vacíos.

**Verificación en el navegador**, con el servidor de desarrollo y capturas: Inicio publicado,
una página del dueño, una de módulo, el menú en celular, y el 404. Nada se declara terminado
sin haberlo visto andar.

---

## 12. Etapas

1. Armazón público: layout, encabezado con menú en celular, pie con sus tres variantes, y la
   tabla de comportamiento cuando no hay sitio.
2. Servir el Inicio publicado en `/w/[slug]`.
3. Páginas: forma nueva de `sectionsJson` con lectura de la vieja, más la pantalla del panel.
4. Menú: derivado + editable, con encendido y apagado por módulo.
5. Integrar las páginas de módulos al armazón.
6. Secciones, primera tanda.
7. Secciones, segunda tanda.
8. Plantillas: paleta, pie y páginas semilla.
9. Las diez plantillas.
10. SEO, sitemap, robots, 404, datos estructurados y verificación final en el navegador.
11. Vocabulario: corregir el texto de la portada del módulo que todavía dice "bloques
    visuales", y un test que verifique que ningún texto visible del módulo use "bloque".
