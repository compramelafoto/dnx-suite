# Sitio de DNX Fotografía: de Alboom Prosite a FOTOFFICE

Fecha: 26/10/2026 · Pedido de Daniel Cuart · Workspace real `cmv5z6qxwwmmhf0q5gp8qja1j` ("DNX Estudio", slug público `dnx-estudio`).

## 1. Intención

Daniel quiere dar de baja el sitio `www.dnxfotografia.com.ar` (Alboom Prosite) y que su sitio viva
en FOTOFFICE, con **todo** el contenido: artículos, trabajos, galerías, testimonios y páginas. La
diferencia con Alboom: el formulario de presupuesto ya no alimenta el CRM de Alboom sino el circuito
de FOTOFFICE (Consultas → propuesta modelo/presupuesto → pedido). También pidió:

- sacar «Acceso a clientes»; arriba a la derecha queda el botón **Ingresar**, que en el futuro
  llevará al panel del cliente (ese panel **no** se habilita ahora);
- un espacio de **testimonios** con los que ya tiene, y un **sistema para conseguir testimonios
  nuevos** (Clickatón tiene uno parecido);
- mejorar las **plantillas** del sitio, que están crudas.

Lo que se construye sirve a **cualquier** fotógrafo de FOTOFFICE (no es un sitio a medida de DNX):
DNX es el primer caso y el que fija el nivel.

## 2. Qué hay hoy

**Sitio viejo (relevado el 26/10 desde el sitio público y el panel de Prosite, sólo lectura):**

| Contenido | Cantidad | Dónde |
|---|---|---|
| Artículos del blog | 31 publicados (2018–2026), 9 categorías; + 9 borradores | `/post/<id>-<slug>` |
| Trabajos (portfolio) | 40 publicados, categorías Books, Fiestas, Bodas, Arquitectura | `/portfolio/<cat>/<id>-<slug>` |
| Galerías | 5: Books, Bodas, Graduaciones (cumple 15), Videos, Fiestas de XV | `/gallery/<id>-<slug>` |
| Testimonios | 32 con foto (clientes, alumnos, colegas) | portada; envío en `/depoimento` |
| Páginas del menú | Quién soy, Solicitud de presupuesto (17 tipos + «¿cómo supo de nosotros?» 8 opciones), Imprimí tus fotos (iframe de ComprameLaFoto), Agendá un turno (4 tipos de cita), Capacitate (cursos y asesoramiento) | `/sobre`, `/contato`, `/imprimir`, `/agenda`, `/cursos` |
| Páginas propias | 14: imprimir, cursos, agenda, cursoxv, celular, cursolightroom, fotografia-inicial, workshopxv, consultorias, agenda2024, contacto-2, datos, prueba, prueba-sfpr | `/<slug>` |
| Landing pages | ~130 (≈60 en línea): casi todas de un evento puntual («completá tus datos para ver los videos 360 de los 15 de Cami»); unas pocas de cursos/talleres (tallerpresupuestos, curso_eventos, 1a1, xlspresupuesto, visitavirtual, calendario360, fdf2025, laisla, farmall, correa) | `/<slug>` |
| Menú externo | Tienda Online (`dnxshop.com.ar`), Soluciones Alboom, Acceso a clientes | — |
| Redes | Instagram, Facebook, YouTube, Vimeo, Pinterest, Twitter, LinkedIn, WhatsApp | pie |
| Datos | dnxfotografia@gmail.com · +54 9 341 374-8324 · WhatsApp 341 341-9869 · San José 1672 Local 5, Funes | `/contato` |

Las fotos están en `storage.alboom.ninja/sites/8403/...` y `cdn.alboompro.com`; se sirven por
`alfred.alboompro.com` (recorte). Cuando Alboom se dé de baja, dejan de existir.

**FOTOFFICE (main 5af32ca81):**

- Sitio público en `/w/<slug>` con borrador/versiones, menú `navJson` v2, encabezado con
  **Ingresar siempre visible** (lleva a `/w/<slug>/entrar`), dominio propio con ruteo.
- **Una sola página editable** (`sectionsJson.pages.home`); el resto son páginas de módulo.
- 7 bloques: HERO, TEXT (texto plano), IMAGE, CTA, SPACER, BLOG_LATEST, MEMBER_OF_WEEK.
- 3 plantillas abstractas (institucional, fotográfica, minimal).
- Blog por institución completo (`@repo/content`) con localizador de imágenes de Alboom
  (sólo admite `cdn.alboompro.com`). Sin importador de artículos.
- Formulario de consulta público (`createServiceLead` → `altaDeConsulta`) que ya dispara la
  propuesta modelo; **no** es un bloque del sitio, y **no** pide «¿cómo nos conociste?» aunque el
  alta acepta `origenId` y `categoriaId`.
- Sin portfolio de trabajos del estudio (el de socios es 1 galería de 20 fotos por socio).
- Sin testimonios.
- El sitio de DNX está publicado pero vacío (carrusel sin fotos, imagen vacía, un CTA).

## 3. Objetivos

1. Todo el contenido público de Alboom queda en FOTOFFICE, con las fotos copiadas a nuestro R2
   (`fotoffice-media`), sin depender de Alboom.
2. Las direcciones viejas siguen funcionando (redirección 301 a la nueva), para no perder Google
   ni los enlaces compartidos.
3. El formulario de presupuesto del sitio crea la consulta en FOTOFFICE con la **categoría** y el
   **origen** elegidos, y de ahí sigue el circuito existente (propuesta modelo, aviso, presupuesto).
4. Testimonios: los ~20 actuales publicados + forma de pedir y recibir nuevos, con moderación.
5. El sitio pasa a tener **páginas propias** (Quién soy, Agenda, Cursos, Imprimí…) y bloques
   suficientes para armarlas sin código.
6. Plantillas reales: elegir una arma un sitio completo y creíble de fotógrafo, no tres franjas.

## 4. No objetivos

- Portal de clientes (el botón Ingresar queda como está: lleva a la puerta de la institución).
- Reserva pública de turnos con calendario (la página Agenda se migra como texto + botones a
  consulta/WhatsApp). Queda anotado como siguiente paso: abrir la Agenda (Etapa 4B) al público.
- Migrar las galerías privadas de clientes de Alboom Proof (decisión del 10/10: no se migran).
  Sí se redirige `/proof/*` a `dnxfotografia.alboompro.com/proof/*` mientras Alboom exista.
- Cambiar el DNS de `dnxfotografia.com.ar`: lo hace Daniel desde `/website/dominio` cuando
  revise el sitio (paso suyo, fuera del código).
- Comentarios y «me gusta» de Alboom (contadores de vistas y likes no se migran).

## 5. Antimetas (sale mal aunque «funcione»)

- Que el sitio nuevo se vea peor que el de Alboom.
- Que una consulta del sitio se pierda o caiga sin categoría (hoy el alta WEB tira error
  `SIN_CATEGORIA` si no resuelve una).
- Que un testimonio se publique sin consentimiento o sin pasar por moderación.
- Que se rompa el sitio de SFPR o Gus Barbers (los cambios de motor tienen que leer los
  `sectionsJson` viejos tal cual).
- Que queden imágenes apuntando a Alboom sin avisar.

## 6. Diseño

Se entrega en **cinco PR**, en este orden (cada uno se fusiona en verde y va a producción):

### PR 1 — Motor del sitio: páginas propias y bloques nuevos (sin SQL)

**Páginas propias.** `sectionsJson.pages` ya es un mapa; se usa de verdad:

- Cada página: `{ slug, title, seoTitle?, seoDescription?, blocks[] }`. `home` sigue siendo la
  portada. Forma nueva guardada como `sectionsJson = { version: 2, pages: { home: {...}, "<id>": {...} } }`;
  el lector acepta la forma vieja (`pages.home` = arreglo de bloques) sin migrar datos.
- Slug: minúsculas, guiones, ≤60, único, y que **no choque** con segmentos reservados del sitio
  (`blog`, `cursos`, `tienda`, `trabajos`, `testimonio`, `presupuesto`, `entrar`, `galeria`, etc.;
  la lista vive en `reserved-slugs.ts`, que pasa de documentación a regla).
- Ruta pública: el catch-all `app/w/[workspaceSlug]/[...rest]` (hoy 404) resuelve una página
  propia publicada por slug de un segmento; si no hay, 404 como hoy.
- Panel: en SECCIONES, selector de página arriba (Portada + páginas + «Nueva página»), renombrar,
  cambiar slug, borrar (no la portada). El autosave guarda la página activa.
- Menú: nuevo tipo de ítem `page` con `pageId` de página propia (además de los existentes).
- Publicar copia todas las páginas a la versión.

**Bloques nuevos** (se suman a la unión de `blocks.ts`, con vista, inspector y metadatos):

| Bloque | Para qué | Config |
|---|---|---|
| `RICH_TEXT` | Quién soy, cursos, agenda | título, HTML saneado (mismo editor TipTap del blog), alineación, ancho |
| `GALLERY` | grilla de fotos sueltas | fotos subidas (url, alt), estilo grilla/mosaico, columnas, lightbox |
| `VIDEO` | YouTube / Vimeo | url (sólo esos hosts, como el blog), título |
| `INQUIRY_FORM` | **formulario de presupuesto** | título, texto, categorías a mostrar (las activas del workspace, todas por omisión), pedir «¿cómo nos conociste?» (sí por omisión), pedir fecha/lugar del evento, texto del botón, mensaje de gracias |
| `CONTACT` | datos de contacto | correo, teléfonos, WhatsApp con texto, dirección, mapa (enlace a Google Maps, sin iframe de API paga), redes — por omisión toma los datos de contacto del workspace |
| `PORTFOLIO` | trabajos recientes / por categoría | categoría o todas, cantidad (3/6/9/12), estilo — lee del PR 2; si el módulo no tiene datos, no se dibuja |
| `TESTIMONIALS` | testimonios publicados | cantidad, estilo carrusel/grilla, botón «Dejá tu testimonio» — lee del PR 3; necesita ≥1 publicado para dibujarse |
| `EMBED` | «Imprimí tus fotos» | url de iframe sólo de una lista blanca (`compramelafoto.com`, `www.compramelafoto.com`, `youtube`, `vimeo`, `google.com/maps`), alto |

PORTFOLIO y TESTIMONIALS se declaran en el PR 1 pero se habilitan en el selector recién cuando sus
PR existan (el registro del bloque es lo que los agrega).

**Formulario de presupuesto (INQUIRY_FORM).** Envía por una acción nueva `createSiteInquiry`
que reutiliza la validación, trampa y freno por IP de `createServiceLead` y llama a
`altaDeConsulta(..., { origenDelAlta: "WEB", categoriaId, origenId })`. Las categorías salen de
las categorías activas del workspace (DNX tiene 21 importadas de Alboom); los orígenes, de
`FotofficeOrigen` activos. Si la categoría elegida dejó de estar activa, cae al flujo actual por
`eventType` con archivadas, y si aun así no hay, a la categoría «Otro» del workspace (no se pierde
la consulta). El aviso al equipo, la propuesta modelo y la autorespuesta siguen como están.
También se agrega «¿cómo nos conociste?» al formulario general existente (`/xv`, insertado), mismo
campo.

**Página de presupuesto.** Página de módulo nueva `presupuesto` (`/w/<slug>/presupuesto`) visible
si `service-leads` está encendido: un INQUIRY_FORM a página completa con el texto del workspace.
Ojo: `/w/<slug>/presupuesto/<token>` ya existe (enlace del cliente); la página índice no choca.

### PR 2 — Trabajos (portfolio del estudio)

Tablas nuevas (SQL `fotoffice_sitio_trabajos`):

- `FotofficeTrabajoCategoria` (workspaceId, nombre, slug, orden, portada?, visible).
- `FotofficeTrabajo` (workspaceId, categoriaId, titulo, slug, lugar, fecha, descripcion HTML
  saneado, portadaFotoId, estado BORRADOR/PUBLICADO, destacado, orden, vistas, seoTitle/Description,
  `origenExterno` + `origenExternoId` para la importación, timestamps). Único (workspaceId, slug).
- `FotofficeTrabajoFoto` (trabajoId, url R2, ancho, alto, alt, orden, tipo FOTO/VIDEO_URL).

Público: `/w/<slug>/trabajos` (todas, filtro por categoría), `/trabajos/<categoria>`,
`/trabajos/<categoria>/<trabajo>` con galería en mosaico y visor a pantalla completa, «También
vieron» (3 de la misma categoría) y botón **Pedir presupuesto** que lleva a `/presupuesto` con la
categoría preelegida cuando hay correspondencia por nombre. Módulo de página `trabajos` en el menú.
Las 5 «galerías» de Alboom entran como trabajos en sus categorías (la de videos como trabajo con
videos de YouTube/Vimeo).

Panel: Sitio web → Trabajos (lista, categorías, ficha con subida múltiple directa a R2 — mismo
camino que el portfolio de socios —, ordenar fotos arrastrando, elegir portada, publicar). Sólo
dueño/admin, como el blog. Tope por trabajo: 300 fotos.

### PR 3 — Testimonios

Tablas nuevas (SQL `fotoffice_sitio_testimonios`), siguiendo la separación de Clickatón:

- `FotofficeTestimonio`: workspaceId, texto (≤1200), extracto destacado opcional (≤240),
  autorNombre, autorDetalle («Fiesta de XV de Cami», «Alumno del curso inicial»), fotoUrl opcional,
  enlace (Instagram) opcional, calificación 1–5 opcional, estado PENDIENTE/PUBLICADO/RECHAZADO,
  consentimiento (bool + fecha), origen (IMPORTADO/FORMULARIO/INVITACION/CARGA_MANUAL),
  clientId/proyectoId opcionales, destacado, orden, moderadoPor/At.
- `FotofficeTestimonioInvitacion`: workspaceId, token (hash), clientId, proyectoId, correo,
  estado ENVIADA/RESPONDIDA/VENCIDA, enviadaAt, respondidaAt, vence (90 días), clave de idempotencia.

Cómo se consiguen:

1. **Enlace abierto** `/w/<slug>/testimonio`: cualquiera deja nombre, texto, calificación, foto y
   consentimiento de publicación. Entra PENDIENTE. Campo trampa + freno por IP.
2. **Invitación personal**: botón «Pedir testimonio» en la ficha del cliente y del proyecto →
   genera enlace con token (prellenado con nombre y trabajo) y lo manda con la plantilla de
   mensajes (tipo nuevo `TESTIMONIO`, variable `[link_testimonio]`) por correo o WhatsApp, igual
   que los demás mensajes. El testimonio queda atado al cliente/proyecto.
3. **Automático (apagado por omisión)**: en Configuración → Testimonios, «pedir testimonio N días
   después de finalizar el proyecto» (cron diario, tope diario, una sola vez por cliente y
   proyecto). Al encenderlo se avisa que equivale a mandar.

Moderación: Sitio web → Testimonios (pendientes primero; publicar, rechazar, editar extracto,
destacar, ordenar, carga manual). Aviso al equipo cuando entra uno nuevo. Bloque TESTIMONIALS y
página `/testimonios` con todos los publicados. El texto público nunca muestra el correo.

### PR 4 — Importador de Alboom Prosite y redirecciones

Tabla nueva `FotofficeSitioRedireccion` (workspaceId, desde (ruta), hacia (ruta o URL), código
301/302, origen) — general, sirve para cualquier migración. El catch-all del sitio (y el proxy en
dominio propio) la consulta antes del 404.

Importador como script de operaciones `packages/db/prisma/scripts/ops-sitio-importar-alboom-prosite.ts`
(modo simulación por omisión, `--apply` para escribir), con la lógica en `apps/fotoffice/lib/sitio-importar/`
(probada con HTML guardado). Lee **el sitio público** (no hace falta la sesión de Prosite):

- **Blog**: los 31 artículos publicados (lista de ids leída del panel; incluye Selpix `320993`,
  que no aparece en el listado público) con título, fecha (`dd/mm/aaaa às hh:mm` → hora argentina), categorías,
  portada, cuerpo HTML (pasa por el mismo saneado que el editor). Slug = el de Alboom sin el número;
  `createdAt` = fecha de publicación para que el orden quede bien. Los 4 títulos con restos de
  generador («aqui-tienes-un-articulo…», «claro-aqui-tienes…», «listo-aca-tenes…», «titulo-…»)
  reciben slug limpio derivado del título real.
- **Trabajos**: 40 trabajos + 5 galerías con título, categoría, lugar, fecha, descripción y todas
  las fotos en tamaño grande (se pide la original de `storage.alboom.ninja`, no el recorte de alfred).
- **Testimonios**: los 32 de la portada (texto completo + foto) → PUBLICADO, origen IMPORTADO,
  consentimiento = «publicado por el autor en el sitio anterior».
- **Páginas**: Quién soy (RICH_TEXT + CTA), Agenda (RICH_TEXT con los 4 tipos de cita + botones a
  presupuesto y WhatsApp), Cursos (RICH_TEXT por curso + TESTIMONIALS), Imprimí tus fotos (EMBED
  ComprameLaFoto), y las páginas propias de cursos/servicios que están en línea (cursoxv, celular,
  cursolightroom, fotografia-inicial, workshopxv, consultorias) con el mismo slug. Las de prueba
  (`prueba`, `prueba-sfpr`, `datos`, `contacto-2`, `agenda2024`) no se migran: redirigen a la
  página equivalente o a la portada.
- **Landing pages** (decisión mía, corregible): las de cursos/talleres/servicios en línea se migran
  como páginas propias (texto, fotos y un INQUIRY_FORM en lugar del formulario de Alboom). Las de
  un evento puntual («los videos de los 15 de X») **no** se migran: son de 2019–2025, ya
  cumplieron su función y su contenido real (el enlace a videos/fotos) Alboom lo muestra sólo
  después de enviar el formulario. Sus direcciones redirigen a `/trabajos`. Se deja un informe con
  la lista para que Daniel marque alguna que quiera conservar.
- **No se migran**: los 9 borradores del blog (duplicados de «¿Qué es ComprameLaFoto?» y textos de
  2018 nunca publicados), «Soluciones Alboom», «Acceso a clientes», «Sociedades y Sellos» (el sello
  SFPR va como imagen en el pie si Daniel lo quiere).
- **Portada**: HERO con 4–5 fotos de trabajos destacados, PORTFOLIO (recientes 6), RICH_TEXT corto
  de presentación, TESTIMONIALS, BLOG_LATEST, INQUIRY_FORM, CONTACT.
- **Menú**: Inicio, Trabajos, Blog, Quién soy, Presupuesto, Imprimí tus fotos, Agendá un turno,
  Capacitate, Tienda Online (enlace externo `dnxshop.com.ar`). Sin «Acceso a clientes» ni
  «Soluciones Alboom». Ingresar queda arriba a la derecha (ya existe).
- **Fotos a R2**: todas las imágenes se copian a `fotoffice-media` bajo
  `fotoffice/<workspaceId>/sitio/...`; el localizador del blog suma `storage.alboom.ninja` y
  `alfred.alboompro.com` a su lista blanca. Las que den 404 se informan con su artículo/trabajo.
- **Redirecciones**: `/post/<id>-*` y `/post.php?id=` → `/blog/<slug>`; `/portfolio/<cat>/<id>-*`
  → `/trabajos/<cat>/<slug>`; `/portfolio[/<cat>]`, `/galerias`, `/gallery/<id>-*` → trabajos;
  `/sobre` → `/quien-soy`; `/contato` → `/presupuesto`; `/depoimento` → `/testimonio`;
  `/agenda`, `/cursos`, `/imprimir` → sus páginas; `/home` → `/`; `/proof/*` →
  `https://dnxfotografia.alboompro.com/proof/*` (302, mientras Alboom exista).
- Idempotente: re-correrlo actualiza por `origenExternoId`, no duplica. Escribe en borrador del
  sitio; **publicar lo hace Daniel** después de mirarlo (o se publica al final del PR si el
  resultado se verificó en la vista previa — decisión mía: lo dejo en borrador y aviso).

Se corre una vez para DNX contra producción (simulación → informe → `--apply`).

### PR 5 — Plantillas de verdad

Una plantilla pasa a ser un **sitio completo**: diseño (presets + tipografía + colores sugeridos)
+ páginas + bloques con textos y fotos de muestra (fotos propias de FOTOFFICE en R2, no de
clientes). Cinco plantillas:

1. **Eventos** — fotógrafo de XV y bodas (la estructura de DNX): hero a pantalla completa,
   trabajos, testimonios, presupuesto.
2. **Estudio** — estudio con local (servicios, ubicación, impresiones, turnos).
3. **Retrato editorial** — minimal, tipografía serif, mucho blanco.
4. **Oscura** — fondo oscuro, fotos protagonistas.
5. **Institución** — la actual institucional mejorada (SFPR, Gus Barbers).

Selector con **vista previa real** (la plantilla dibujada con el mismo renderer, en miniatura, no
franjas abstractas). Aplicar a un sitio con contenido: sólo diseño (como hoy) u «diseño + páginas
de muestra que no existan» — nunca pisa páginas ni bloques del usuario.

## 7. Restricciones

- Next.js de este repo tiene cambios: leer `node_modules/next/dist/docs/` antes de tocar rutas.
- Schema compartido por cinco bases: tablas nuevas `Fotoffice*` sin FK a tablas existentes,
  `CREATE TABLE IF NOT EXISTS`, textos en vez de enums, código tolerante a tabla faltante.
- Migraciones a mano en la base de FOTOFFICE de producción y `prisma migrate resolve --applied`.
  Sin staging (decisión de Daniel).
- No se escribe nada en Alboom. Sólo lectura del sitio público.
- Horas en hora argentina. Textos en español rioplatense, «dinero», nunca «plata».
- No invitar a nadie ni mandar correos reales durante la migración (las invitaciones de testimonio
  automáticas nacen apagadas).
- El sitio de SFPR y Gus Barbers tiene que verse igual después del PR 1 (prueba con sus
  `sectionsJson` reales).

## 8. Lo que decide quien construye

Nombres internos de componentes, forma exacta del JSON de cada bloque, estilo visual de los
bloques nuevos (respetando `--wsite-*` y los presets), cómo se pagina `/trabajos`, y los textos
de muestra de las plantillas.

## 9. Pasos de Daniel después

1. Mirar el sitio en `fotoffice.com/w/dnx-estudio` (borrador en vista previa) y publicarlo.
2. Conectar `dnxfotografia.com.ar` en Sitio web → Dominio y cambiar los DNS.
3. Revisar que las categorías del formulario sean las que quiere ofrecer.
4. Cuando quiera, encender el pedido automático de testimonios.
