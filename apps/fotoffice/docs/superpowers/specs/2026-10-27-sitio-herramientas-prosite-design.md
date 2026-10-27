# Sitio web: las secciones de Prosite que le faltan a FOTOFFICE

27/10/2026. Sigue a `2026-10-26-sitio-dnx-desde-alboom-design.md` (contenido ya migrado).

## 1. Intención

Daniel pidió que el desarrollador web de FOTOFFICE tenga **las mismas secciones que ofrece Alboom
Prosite**, sin copiarlo exacto («que tenga las secciones que ellos ofrecen»), y que se le confirme
cuando todos los datos y herramientas de Prosite estén en FOTOFFICE. Se relevó el panel de Prosite
(sólo lectura, 27/10) y se comparó con el código.

## 2. Relevamiento de Prosite (16 secciones del panel)

Contenido: Mi portafolio, Banners, Blog, Menú, Páginas. Crece tu negocio: Inbox, Landing Pages,
Testimonios, SEO (búsqueda, Google Analytics, Facebook, redireccionamientos), Sociedades y Sellos,
Propuestas (PDF por enlace). Diseño: editor (logo, favicon, menú, banners, trabajos recientes,
declaraciones, trabajos destacados, blog, boletín informativo, colaboraciones, pie, colores,
fuentes, botones, formularios), temas. Configuración: general (contacto, idioma, protección de
fotos), dominio, redes sociales (enlaces, imagen al compartir, página de Facebook, botón flotante
de WhatsApp con mensaje de bienvenida, posición y tamaño).

Elementos del armador de páginas/landings: título, texto, imagen, video, botón, mapa, divisor,
espaciador, HTML, redes, formulario, ícono, preguntas frecuentes, cuenta regresiva, botón de pago,
botón de WhatsApp, reseñas de Google, comentarios de Facebook, antes/después, formulario del CRM.
Por página: nombre, URL, imagen y texto al compartir, SEO (título, descripción, palabras clave,
ocultar de buscadores), favicon propio, código extra en `<head>`.

**Datos de DNX en Prosite todavía no migrados:** 9.820 envíos del Inbox (formularios XLS, Celular,
Contacto de proveedores, CursoLightroom, landings…); 5 colaboradores (Photostraps, Clog, Alboom,
Fotolibros La Isla, Stan); SEO (palabras clave, verificación de Google, píxel de Facebook
1551456739072627); botón flotante de WhatsApp (341 341-9869, «Hola como podemos ayudarte»); redes
(Facebook, YouTube, Instagram, X, Vimeo, LinkedIn, Pinterest). Google Analytics es Universal
(`UA-…`), apagado por Google en 2023: no se migra.

## 3. Ya está en FOTOFFICE

Favicon, carrusel de portada, trabajos destacados, redirecciones editables, dominio propio, pedido
de testimonios, plantillas; parcial: SEO global y por página, colores/tipografías/botones, pie,
landings (páginas propias + formulario de presupuesto), bandeja (Consultas).

## 4. Qué se construye (4 entregas)

### PR A — Ajustes del sitio
- **SEO**: palabras clave; imagen al compartir elegible (global y por página); «ocultar de
  buscadores» por página (`noindex` + fuera del sitemap); código de verificación de Google.
- **Medición**: ID de Google Analytics 4 (`G-…`) y píxel de Meta (sólo el número). Se valida el
  formato y FOTOFFICE arma el script: **nunca HTML/JS libre** (ver §5).
- **Botón flotante de WhatsApp**: número, mensaje de bienvenida (opcional, en globo), texto
  inicial del chat, lado izquierdo/derecho, tamaño. Global para todo el sitio.
- **Redes en el pie**: todas las de `CONTACT_SOCIAL_NETWORKS` + Flickr, con íconos.
- **Protección de fotos**: interruptor que bloquea clic derecho y arrastre de imágenes del sitio
  público (disuasivo; se dice así en el panel).
- Se guarda dentro de los JSON existentes del sitio (borrador → publicar), **sin columnas nuevas**
  (el esquema se comparte con otras bases). Se cargan los datos de DNX en el borrador.

### PR B — Bloques nuevos del armador
Divisor · Preguntas frecuentes (acordeón) · Cuenta regresiva (fecha, texto al terminar) ·
Antes/después (comparador deslizable de dos fotos) · Logos de colaboradores (imagen + enlace +
nombre; reemplaza «Sociedades y Sellos») · Íconos con texto (lista de 2–6 ítems, set cerrado de
íconos) · Mapa (dirección → Google Maps embebido) · Botón de WhatsApp (con texto) · Botón de pago
(enlace a un cobro de Mercado Pago/Cobrador con monto mostrado; es un botón, no un checkout).
Se cargan los 5 colaboradores de DNX en el borrador.

### PR C — Formularios propios, boletín y bandeja
- **Bloque Formulario**: campos propios (texto, correo, teléfono, número, fecha, lista, casilla,
  texto largo; obligatorio sí/no), texto del botón y qué pasa al enviar (mensaje, redirigir a una
  página del sitio o a un enlace, o **mostrar contenido oculto** — el caso «dejá tus datos para ver
  los videos»). Opción «crear también una consulta» (va a Consultas con categoría/origen).
- **Bloque Boletín**: correo (y nombre opcional) → suscriptores.
- **Bandeja de formularios** (Sitio web → Formularios): envíos por formulario, leído/archivado,
  ver detalle, responder por correo/WhatsApp (enlaces), **exportar a Excel (CSV)**. Suscriptores del
  boletín con exportación. Tablas nuevas (`FotofficeSitioFormulario*`), con anti-spam (campo trampa
  + tope por IP como el formulario de presupuesto).
- **Importación** de los 9.820 envíos del Inbox de Prosite a la bandeja (agrupados por formulario).

### PR D — Visitas y documentos
- **Contador de visitas por página** (tabla diaria por sitio y ruta; sin cookies ni datos
  personales; se ignoran bots). Se ve en el panel junto a cada página y en un resumen.
- **Documentos**: subir un PDF y compartirlo con un enlace `/w/<slug>/d/<nombre>` (reemplaza
  «Propuestas» de Prosite). Listado, copiar enlace, despublicar.

## 5. No se construye (decisiones)
- **HTML/JS libre** (bloque HTML y código en `<head>`): el sitio público corre en `fotoffice.com`,
  el mismo origen que el panel; un script libre podría robar sesiones. Lo cubren GA4, píxel,
  verificación y EMBED con hosts permitidos.
- **Reseñas de Google**: requiere la API de Places paga y verificación del perfil; queda para
  después. **Comentarios de Facebook**: el plugin está discontinuado por Meta.
- **Idioma**: el público de FOTOFFICE es hispanohablante; queda fijo en español.
- **Formulario del CRM de Alboom**: lo reemplazan el formulario de presupuesto y el bloque Formulario.

## 6. Restricciones
Sin columnas nuevas en tablas existentes (tablas nuevas sí, con SQL a mano + `migrate resolve`).
No romper SFPR ni Gus Barbers (sus `sectionsJson` se leen tal cual). Textos en español rioplatense
claro. Nada se publica solo: lo de DNX va al borrador.
