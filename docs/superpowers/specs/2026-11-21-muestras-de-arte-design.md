# Muestras de Arte — una plataforma, dos dominios

Fecha: 2026-11-21 (hora argentina). Estado: borrador para aprobar por Daniel.
Relacionado: `2026-10-08-muestras-fotograficas-design.md` y las etapas 2 a 8 de Muestras.

## 1. Intención

Muestras Fotográficas (`apps/muestras`, muestrasfotograficas.com) resultó ser una herramienta que
sirve para muestras de **cualquier disciplina**: armar la muestra, su sala virtual, fichas con QR,
convocatorias, curaduría, inauguración, libro de visitas, difusión y venta. Daniel quiere abrirla a
todo el arte bajo **muestrasdearte.com**, sin perder la identidad de muestrasfotograficas.com.

**Decidido por Daniel (21/11):**

- **Una sola app, dos dominios.** No se copia la plataforma. `apps/muestras` atiende los dos; el
  dominio por el que entra el visitante decide la marca, los textos y qué muestras se ven.
- **Muestras mixtas → opción B:** cada muestra tiene **una disciplina principal** y otras
  secundarias opcionales. Aparece en muestrasfotograficas.com **sólo si la principal es
  fotografía**. En muestrasdearte.com aparecen todas.
- **Los videos se suben a YouTube** y desde ahí se comparten: la plataforma guarda el enlace y lo
  muestra embebido. No guardamos archivos de video.
- Alcance de cambios acordado en la conversación (tabla de la sección 5): disciplinas, perfil de
  artista, varias vistas por obra, medidas en 3D, técnica y soporte, video y audio, venta de
  originales y seriadas, envío a coordinar, montaje con piezas de piso, convocatorias por
  disciplina; agregados: audioguía, agenda paralela, accesibilidad, informe de estado; quitar en
  el dominio de arte lo propio de fotografía (FotoRank/Clickatón, papeles, banner de Rosario).

## 2. Objetivos, no objetivos y anti-objetivos

**Objetivos**

1. Que una institución, un colectivo o un artista arme en muestrasdearte.com una muestra de
   pintura, escultura, grabado, cerámica, textil, instalación, videoarte, etc., con todas las
   herramientas que hoy tiene una muestra de fotografía.
2. Que las obras se describan bien según su disciplina (vistas, medidas, materiales, video).
3. Que se pueda vender la **obra original única**, que es la venta central fuera de la fotografía.
4. Que muestrasfotograficas.com siga siendo un sitio de fotografía, alimentado por la misma base.

**No objetivos (por ahora)**

- Teatro, música en vivo y danza como "muestras" (son otro producto: funciones, entradas, butacas).
  Sólo entran como actividad paralela de una muestra (sección 6.6).
- Subir videos a YouTube desde la plataforma (API de YouTube, cuotas, permisos de canal).
- Recorrido virtual 3D o 360°, modelos 3D de esculturas.
- Otros idiomas.
- Base propia o proyecto Vercel propio para muestrasdearte.com.
- Renombrar tablas de la base (`PhotographerProfile`, `PhotographerPortfolioPhoto`).

**Anti-objetivos (sería un fracaso aunque funcione)**

- Que alguien que hoy usa muestrasfotograficas.com note un cambio que no pidió: textos que dicen
  "artista" donde decían "fotógrafo", pinturas en la portada, campos que lo confunden.
- Que Google vea la misma muestra en los dos dominios como contenido duplicado.
- Que un formulario de escultura pida "papel" o un formulario de fotografía pida "peso".
- Que una venta de un original deje al comprador sin saber cuándo y cómo recibe la obra.

## 3. Restricciones

- **Base compartida:** las tablas `Cultural*` viven en Neon `divine-hall`, rama `development`,
  junto con FOTOFFICE y FotoRank. Las migraciones se aplican **a mano, con permiso**, y se
  registran con su checksum. Sólo columnas y tablas nuevas, opcionales o con valor por defecto;
  nada que obligue a tocar datos de otras apps.
- **Sin staging:** se va directo a producción. Cada etapa tiene que dejar
  muestrasfotograficas.com funcionando igual que antes.
- **Un solo proyecto Vercel** (`muestras-dnxsuite`): se le agrega el dominio nuevo. Daniel compra
  muestrasdearte.com (y www) y carga variables secretas; Claude puede cargar el DNS.
- **Venta apagada:** sigue en OFF hasta que se cierre la homologación de Mercado Pago (desde CLF).
  Lo de venta de esta etapa se construye y se prueba en modo TEST.
- **Cookie de sesión:** hoy `lib/sesion.ts` usa un solo `COOKIE_DOMAIN` por variable. Con dos
  dominios, el dominio de la cookie tiene que salir del host de cada pedido (una cookie no puede
  servir para los dos). Quien entra en un dominio no está logueado en el otro: es aceptable.
- **Google OAuth:** hay que agregar la URI de retorno de muestrasdearte.com al cliente "DNX Suite —
  Web Apps", y el retorno tiene que volver al mismo dominio del que salió.
- **R2:** el bucket privado `muestras-privado` tiene CORS de PUT sólo desde
  muestrasfotograficas.com; hay que sumar muestrasdearte.com.
- **Fuentes del PDF:** las fichas y certificados usan Helvetica (WinAnsi); los textos nuevos
  ("Óleo sobre tela", "Bronce a la cera perdida") entran, pero hay que pasarlos por `paraWinAnsi`.

## 4. Enfoques considerados

| Enfoque | Qué implica | Por qué sí / no |
|---|---|---|
| **A. Copiar `apps/muestras` a `apps/muestras-arte`** | Dos apps de ~500 archivos, cada una con su dominio. | Rápido de arrancar, pero cada arreglo se hace dos veces, las dos se separan con el tiempo y las muestras no se comparten. **Descartado.** |
| **B. Una app, dos dominios (elegido)** | La misma app; el host decide la "marca" (logo, colores, textos, filtro de disciplinas). Una tabla, un panel. | Un solo código, las 111 muestras cargadas sirven en los dos, y fotografía queda como una vitrina filtrada. Pide cuidado con textos, cookies, SEO y correos por dominio. |
| C. Mudar todo a muestrasdearte.com y redirigir el viejo | Un solo dominio genérico. | Rompe el anti-objetivo: muestrasfotograficas.com pierde su identidad y su público. **Descartado.** |

## 5. Qué cambia (resumen acordado)

| Hoy (fotografía) | Con Muestras de Arte |
|---|---|
| Perfil "Fotógrafo", `/fotografos` | Perfil "Artista" con disciplinas; `/artistas` en arte, `/fotografos` sigue en fotografía |
| La muestra no tiene disciplina | Disciplina principal + secundarias, por muestra; disciplina por obra |
| Una imagen por obra | Varias vistas por obra (imágenes y videos de YouTube) |
| Medidas ancho × alto + marco | Alto × ancho × profundidad, peso, "medidas variables" |
| Técnica en texto libre | Técnica + soporte/materiales, con sugerencias por disciplina |
| Sólo imágenes | Imágenes, videos (YouTube) y audio (audioguía) |
| Venta digital o impresa (papel Fine Art) | + original único, + obra seriada, + "consultar precio" |
| Envío de láminas | Envío a coordinar, embalaje y seguro; entrega al cierre de la muestra |
| Plano con paredes | + piezas de piso/pedestal y necesidades técnicas |
| Convocatorias con fotos | Requisitos por disciplina |

## 6. Diseño

### 6.1 La marca sale del dominio

Un módulo nuevo, `lib/marca.ts`, con dos marcas fijas en el código:

```ts
type Marca = {
  id: "FOTOGRAFIA" | "ARTE";
  dominio: "muestrasfotograficas.com" | "muestrasdearte.com";
  nombre: "Muestras Fotográficas" | "Muestras de Arte";
  disciplinas: "SOLO_FOTOGRAFIA" | "TODAS";
  palabraAutor: { singular: "fotógrafo" | "artista"; plural: ... };
  rutaAutores: "/fotografos" | "/artistas";
  logo, colores (variables CSS --mf-*), imagen para redes, descriptor de tarjeta;
};
```

- `marcaDelPedido()` lee el host (`headers()`), con `localhost` y las URLs de preview resueltas por
  la variable `MUESTRAS_MARCA_POR_DEFECTO` (por defecto `FOTOGRAFIA`, para que todo lo que hoy anda
  siga igual).
- Todo lo que hoy dice "muestrasfotograficas.com" en el código pasa a pedirle el dominio a la marca:
  `app/layout.tsx` (metadata, `APP_URL`), `lib/correos/enviar.ts`, `lib/fichas/cargar.ts` y
  `pdf.ts`, `lib/piezas/textos.ts`, `lib/ventas/certificado.ts`, `components/perfil/formulario-perfil.tsx`,
  el `User-Agent` de geocodificación (queda genérico de la plataforma), `lib/ruta-segura.ts`
  (aceptar los dos dominios como destino válido).
- **Cada muestra tiene un dominio "de casa"**: fotografía si su disciplina principal es
  fotografía; si no, arte. Lo que se imprime o se manda por mail de esa muestra (QR, fichas,
  afiches, catálogo, certificado, correos de inauguración, convocatoria y equipo) usa **el dominio
  de casa de la muestra**, no el del que hizo clic. Así un QR impreso no cambia según quién lo
  generó.
- **SEO:** la URL canónica de cada muestra, obra y perfil es la de su dominio de casa.
  - Una muestra de fotografía se ve en los dos dominios; en arte lleva `canonical` a fotografía.
  - Una muestra de otra disciplina pedida en muestrasfotograficas.com **redirige (308)** a
    muestrasdearte.com.
  - Perfiles: casa = fotografía si todas las disciplinas del artista son fotografía; si no, arte.
    `/fotografos/<slug>` en el dominio de arte redirige a `/artistas/<slug>` y viceversa según casa.
  - `sitemap.xml` y `robots.txt` por dominio, con sólo lo que tiene casa ahí.
- **Panel:** el mismo `/panel` en los dos dominios. Cambia sólo la marca y las palabras. El listado
  "Mis muestras" muestra todas las del usuario, de cualquier disciplina, con una etiqueta de
  dominio de casa.
- **Sesión:** el dominio de la cookie se calcula por pedido (`.muestrasfotograficas.com` o
  `.muestrasdearte.com`); `COOKIE_DOMAIN` queda sólo como override para local.
- **Google y clave:** el inicio de sesión vuelve al dominio de origen (guardar el host en el
  `state` y validarlo contra la lista de dos dominios).
- **Mercado Pago:** `back_urls` y descriptor de tarjeta (`SALE_STATEMENT_DESCRIPTOR`, hoy
  "MUESTRAS FOTO") según la marca de la muestra: "MUESTRAS ARTE" para arte.
- **Correos:** remitente con el nombre de la marca de la muestra; mismo dominio de envío de Resend
  que hoy (sumar muestrasdearte.com como dominio verificado es opcional y queda para después).

### 6.2 Disciplinas

Lista fija en `packages/muestras/src/disciplines.ts`, con etiqueta y el grupo de campos que usa
cada una (sección 6.3):

| Código | Etiqueta | Grupo de medidas |
|---|---|---|
| FOTOGRAFIA | Fotografía | plana |
| PINTURA | Pintura | plana |
| DIBUJO | Dibujo | plana |
| GRABADO | Grabado y obra gráfica | plana |
| ILUSTRACION | Ilustración | plana |
| COLLAGE | Collage y técnica mixta | plana |
| ESCULTURA | Escultura | volumen |
| CERAMICA | Cerámica | volumen |
| TEXTIL | Arte textil | plana o volumen |
| JOYERIA | Joyería de autor | volumen |
| INSTALACION | Instalación | variable |
| ARTE_DIGITAL | Arte digital | plana o pantalla |
| VIDEOARTE | Videoarte | tiempo |
| ARTE_SONORO | Arte sonoro | tiempo |
| ARTE_URBANO | Arte urbano | plana o variable |
| OTRA | Otra | libre |

**Base (migración nueva):**

- `CulturalActivity.primaryDiscipline String @default("FOTOGRAFIA")` y
  `CulturalActivity.otherDisciplines String[] @default([])`. El default deja las 111 muestras
  cargadas como fotografía sin script aparte.
- `CulturalActivityWork.discipline String?`, `CulturalExhibitorWork.discipline String?`,
  `CulturalCallWork.discipline String?`, `PhotographerPortfolioPhoto.discipline String?`: si está
  vacía, vale la principal de la muestra (o, en el portfolio, la primera del perfil).
- `PhotographerProfile.disciplines String[] @default(["FOTOGRAFIA"])`.
- Índice por `primaryDiscipline` para el listado.

**Reglas:**

- Al crear una muestra en muestrasdearte.com, la disciplina principal es obligatoria y no tiene
  valor sugerido. En muestrasfotograficas.com queda en fotografía y no se pregunta (el formulario
  se ve como hoy); el organizador puede cambiarla desde "Más opciones", y el panel avisa que la
  muestra pasará a vivir en muestrasdearte.com.
- Cambiar la principal de fotografía a otra **con la muestra publicada** pide confirmación: los QR
  ya impresos siguen funcionando (redirigen) pero las piezas nuevas salen con el otro dominio.
- Portada y listado de arte: filtro por disciplina (chips) además de país/cercanía.
- `GET /api/public/actividades` **todavía no está en main**: vive en el PR #481 (abierto, rama
  `feat/muestras-cerca-portal-infospot`), junto con la tarjeta del portal y la sincronización de
  InfoSpot. Cuando se fusione (antes o después de esta obra), esa ruta agrega `primaryDiscipline`
  y `otherDisciplines` y por defecto devuelve **sólo fotografía**; con `?disciplinas=todas`
  devuelve todo. Si se fusiona después, el filtro se agrega en ese PR.
- **FOTOFFICE e InfoSpot no cambian en esta etapa:** la tarjeta "Muestras fotográficas cerca tuyo"
  del portal de socios y la sincronización semanal de InfoSpot siguen recibiendo sólo fotografía.
  *(Decisión de Claude: las instituciones de FOTOFFICE son de fotografía; abrir InfoSpot al arte
  es una decisión aparte.)*
- El tipo de actividad `SALIDA` ("Salida fotográfica") se oculta en el dominio de arte.

### 6.3 Obras: vistas, medidas, técnica

**Vistas por obra.** Tabla nueva `CulturalWorkMedia`:

```
id, ownerType ("ACTIVITY_WORK" | "EXHIBITOR_WORK" | "CALL_WORK" | "PORTFOLIO"), ownerId,
kind ("IMAGE" | "YOUTUBE"), imageUrl?, youtubeId?, posterUrl?, caption?,
isPrimaryVideo Boolean @default(false), sortOrder, createdAt
```

- La **vista principal sigue en `imageUrl`** de cada tabla de obras, como hoy: todo lo que ya usa
  `imageUrl` (fichas, sala, piezas, grillas, curaduría) sigue andando sin tocarse. Las vistas
  extra van en `CulturalWorkMedia`. Tope: 8 vistas extra por obra.
- Una obra cuya principal es un video (videoarte, arte sonoro con video) guarda en `imageUrl` la
  **imagen de portada** del video (sección 6.4), y el video como primera vista extra con la marca
  `isPrimaryVideo` en el orden 0. Así fichas, PDFs y grillas siempre tienen una imagen.
- En la página de obra y en la sala: carrusel con la principal + vistas; los videos se reproducen
  ahí mismo.
- En la galería pública se respeta lo que ya decide el organizador en "visibilidad" (cuántas obras
  expuestas se ven online): una obra oculta oculta también sus vistas.
- Al copiar obras entre etapas (expositor → muestra, convocatoria → muestra, concurso → muestra)
  se copian también sus vistas.

**Medidas y datos.** Hoy las medidas (`imageWidthCm`, `imageHeightCm`, `frameWidthCm`,
`frameHeightCm`, `edition*`) existen **sólo en `CulturalExhibitorWork`**; `CulturalActivityWork`
tiene título, año y técnica. Fichas (`lib/fichas/cargar.ts`), piezas (`lib/piezas/cargar.ts`) y
montaje (`lib/montaje/consultas.ts`) las leen de la obra del expositor enlazada por
`activityWorkId`, así que una obra que carga el organizador directo no tiene medidas.

*(Decisión de Claude:)* las medidas pasan a vivir también en `CulturalActivityWork`, que es **la
que manda** de acá en adelante:

- Columnas nuevas, todas opcionales, en las dos tablas: `widthCm`, `heightCm` (en
  `CulturalActivityWork`; en la del expositor siguen `imageWidthCm`/`imageHeightCm`),
  `frameWidthCm`, `frameHeightCm`, `edition`, `editionNumber`, `editionSize` (sólo en
  `CulturalActivityWork`, que no las tenía), y en ambas `depthCm Float?`, `weightKg Float?`,
  `dimensionsVariable Boolean @default(false)`, `durationSec Int?`, `support String?` (soporte o
  materiales, separado de `technique`), `technicalNeeds String[]`, `accessibleDescription String?`,
  `audioUrl String?`.
- Al aprobar la obra de un expositor, se copian sus medidas a la obra de la muestra (como hoy se
  copian imagen y título).
- La migración copia a `CulturalActivityWork` las medidas de las obras de expositor ya enlazadas.
- Fichas, piezas y montaje leen primero `CulturalActivityWork`; si está vacía, la del expositor
  (para no depender de que la copia haya corrido).
- En portfolio y convocatoria sólo se agregan `support`, `depthCm` y `dimensionsVariable`.
- En el formulario de las disciplinas "volumen" se rotulan "Alto / Ancho / Profundidad" y se
  ocultan los campos de marco; en las "planas" se ven como hoy.

**El formulario cambia según la disciplina de la obra.** Una función
`camposDeObra(disciplina)` en el paquete define qué campos se muestran, cómo se llaman y qué
sugerencias tiene la técnica (lista con texto libre). Ejemplo:

| Grupo | Campos | Sugerencias de técnica |
|---|---|---|
| plana | ancho, alto, marco opcional, técnica, soporte | Óleo, acrílico, acuarela, grafito, xilografía, serigrafía… / tela, papel, madera |
| volumen | alto, ancho, profundidad, peso, técnica, materiales | Talla, modelado, fundición, ensamble / bronce, madera, gres… |
| tiempo | duración, video principal, técnica | Monocanal, multicanal, loop |
| variable | "medidas variables" o medidas aproximadas, descripción del espacio | — |

Fotografía conserva **exactamente** el formulario de hoy.

**Texto de la ficha** (`lib/fichas`): se arma en el orden de catálogo de arte:
*Título, año — Técnica sobre soporte — Alto × ancho × prof. cm — Edición*. Ejemplo:
"Óleo sobre tela, 2024 · 80 × 100 cm". Para fotografía se mantiene el texto actual.

### 6.4 Videos de YouTube

- El artista sube el video **a su canal de YouTube** (público o "no listado") y pega el enlace.
  Se aceptan `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/` y `/embed/`; se guarda
  sólo el `youtubeId` (11 caracteres, validado por patrón).
- Al guardar, el servidor consulta el oEmbed público de YouTube
  (`https://www.youtube.com/oembed?url=…&format=json`): si falla, el video es privado, no existe o
  no permite insertarse, y se muestra "Este video no se puede mostrar fuera de YouTube. Revisá que
  sea público o no listado y que permita insertarlo".
- Se reproduce embebido desde `https://www.youtube-nocookie.com/embed/<id>` (sin cookies de
  seguimiento hasta que la persona da play). Hoy la app no tiene CSP; no se crea una para esto. Si
  algún día se agrega, tiene que permitir ese dominio en `frame-src`.
- **Imagen de portada:** el artista puede subir una; si no, al guardar se copia la miniatura de
  YouTube (`img.youtube.com/vi/<id>/hqdefault.jpg`) a R2 con el mismo procesado que las demás
  imágenes. Así fichas, afiches y grillas no dependen de YouTube.
- Si un video se borra en YouTube más tarde, la página muestra la portada con "Video no
  disponible" (se detecta en el navegador; no hay revisión periódica).
- **Curaduría anónima:** el reproductor de YouTube muestra el nombre del canal y el título del
  video. En convocatorias con curaduría anónima, el formulario de envío avisa: "Para que la
  selección sea anónima, subí el video como no listado, con un título que no te identifique, desde
  un canal sin tu nombre". El visor de curaduría no agrega ningún otro dato. *(Pendiente de
  confirmar con Daniel, ver sección 9.)*

### 6.5 Audio: audioguía

- Cada obra puede tener una **audioguía**: el artista o el organizador graba hasta 3 minutos
  contando la obra. Columna `audioUrl String?` en `CulturalActivityWork` (y en la obra de
  expositor, que se copia al aprobarse).
- Se sube como archivo (MP3, M4A/AAC u OGG; hasta 6 MB) a R2 público, prefijo `muestras/audio/`.
  *(Decisión de Claude: Daniel pidió YouTube para video; para audio un archivo corto es más simple
  de escuchar en sala con el celular y no exige crear un video. Si prefiere YouTube también acá,
  se cambia sin afectar el resto.)*
- En la página de obra a la que lleva el QR, el reproductor aparece arriba de todo: "Escuchá al
  artista".
- También sirve para obras de **arte sonoro** como vista principal sin video.

### 6.6 Agenda paralela

- Las actividades de tipo CHARLA, TALLER, PROYECCION y OTRA (ya existen en `ACTIVITY_TYPES`) pueden
  colgar de una muestra: columna `parentActivityId String?` en `CulturalActivity`.
- Se cargan desde el panel de la muestra ("Agenda de la muestra") con fecha, hora, lugar (por
  defecto, el de la muestra) y cupo opcional, reutilizando la inscripción de la inauguración
  (`rsvp*`).
- Se ven en la página de la muestra y en la sala, ordenadas por fecha. También aparecen en el
  listado general con la etiqueta de la muestra.
- Acá entran performance, concierto o lectura **como actividad de la muestra**, no como muestra.

### 6.7 Venta de originales y obras seriadas

Se apoya en el motor de la etapa 8 (`CulturalWorkOffer`, `CulturalEditionCopy`, certificados
Ed25519, Split en tres). Cambios:

- `CulturalWorkOffer.format` suma dos valores a `DIGITAL` y `PRINT`:
  - **`ORIGINAL`**: la pieza física única que se expone. `editionKind = UNIQUE`, `editionSize = 1`,
    sin archivo para subir. Una obra tiene como máximo una oferta ORIGINAL.
  - **`MULTIPLE`** (obra seriada original: grabado, serigrafía, fundición numerada): igual que una
    edición limitada (copias + P/A), pero cada ejemplar es físico, firmado y numerado por el
    artista. Sin archivo.
  - `PRINT` pasa a llamarse en pantalla "Reproducción" fuera de fotografía (en fotografía sigue
    "Copia impresa"). Su campo `paper` se rotula "Soporte" y la sugerencia de papeles Fine Art
    aparece sólo en fotografía.
- **Qué formatos se ofrecen según la disciplina:** fotografía como hoy (digital, impresa) más
  original si el autor vende la copia expuesta; arte digital: digital + reproducción; plana:
  original, reproducción; grabado: original o seriada; volumen: original o seriada; tiempo
  (videoarte, arte sonoro) y variable (instalación): **sólo "consultar precio"**. *(Decisión de
  Claude: vender el archivo de un video obligaría a guardar videos grandes en R2, y Daniel pidió
  que los videos vivan en YouTube.)*
- **"Consultar precio":** una obra puede mostrarse "en venta, consultar". El botón abre un
  formulario (nombre, correo, mensaje) que llega por mail al organizador y al autor. No hay pago en
  línea. Tabla `CulturalSaleInquiry` (activityId, activityWorkId, nombre, email, mensaje, estado,
  createdAt); se purga a los 12 meses.
- **Entrega del original y de la seriada** (sólo estos dos formatos; DIGITAL y PRINT siguen con
  el envío cobrado de hoy, `shippingCostArs` → `shippingArs`): la obra queda colgada hasta el cierre. La página de compra y el mail
  dicen "La obra se entrega al terminar la muestra, el <fecha de cierre>". Opciones: retiro en la
  sala (fecha y horario que carga el organizador) o envío a coordinar (el comprador deja su
  dirección; el costo se acuerda aparte y **no se cobra en la plataforma**: el pedido lleva
  `shippingArs = 0` y una marca `deliveryMode = "PICKUP" | "ARRANGE"`). El panel de pedidos muestra
  esos pedidos en una pestaña "Para entregar al cierre". En la sala y en la
  página de obra aparece la marca "Vendida" (punto rojo) apenas se confirma el pago.
- **Seña:** no se agrega en esta versión; para obras caras queda "consultar precio".
  *(Decisión de Claude: la seña obliga a un segundo cobro y a reglas de devolución; se evalúa
  cuando la venta esté en vivo.)*
- **Certificado:** el certificado actual se emite también para ORIGINAL y MULTIPLE; dice
  "Obra original única" o "Ejemplar N/M", con técnica, soporte y medidas. El dominio de
  verificación es el de casa de la muestra; `/verificar` funciona en los dos dominios.
- Topes: `SALE_PRICE_MAX_ARS` (20 millones) se mantiene; fee de plataforma 15 % igual.
- Todo esto queda **apagado** con la llave actual hasta la homologación.

### 6.8 Montaje

- `HangingPlan` versión 2: además de `walls`, una lista `floor` de **piezas de piso** (pedestal,
  tarima, piso, colgada del techo) con nombre de zona y obras, sin cálculo de altura.
  `parseHangingPlan` lee la versión 1 tal cual (las muestras actuales no cambian).
- Por obra, `technicalNeeds` (sección 6.3) opcional: enchufe, pantalla, proyector, sonido/auriculares,
  oscuridad, pedestal, colgado especial. Se cargan en la obra (expositor u organizador) y salen en
  la planilla de montaje descargable.
- Las obras de disciplinas "volumen" o "variable" no se pueden poner en una pared (el cálculo
  de altura respecto de la línea de centro no tiene sentido para ellas): van a una zona de piso,
  que es sólo una lista ordenada de obras, sin posiciones ni alturas.

### 6.9 Informe de estado

- Opcional, para cuando la institución recibe obras de otros. Por obra: estado al recibir y al
  devolver (bueno / con observaciones), observaciones, hasta 4 fotos de detalle, quién lo hizo y
  cuándo. Tabla `CulturalWorkConditionReport`.
- Se carga desde el panel ("Montaje → Estado de las obras") y se descarga como PDF con las dos
  columnas (entrada/salida). Sólo lo ven el equipo de la muestra y el autor de la obra.

### 6.10 Accesibilidad

- Campo `accessibleDescription String?` (hasta 1000 caracteres) por obra: descripción de lo que se
  ve, para lectores de pantalla y personas ciegas. Se usa como `alt` de la imagen principal y se
  lee en la página de obra con un botón "Escuchar descripción" (síntesis de voz del navegador, sin
  costo).
- El organizador puede marcar en la muestra si la sala tiene accesibilidad física y si hay
  visitas con intérprete (texto libre, se muestra en la ficha).

### 6.11 Convocatorias por disciplina

- La convocatoria hereda la disciplina principal de la muestra y puede abrirse a varias.
- Por disciplina, el organizador define: cantidad de vistas por obra (1 a 8), si exige video, si
  exige medidas, y si pide un dossier en PDF (hasta 10 MB, R2 privado, sólo lo ve la curaduría).
- El visor de curaduría muestra todas las vistas y videos de cada obra.

### 6.12 Qué se esconde en el dominio de arte

- **Importar desde FotoRank o Clickatón:** sólo en muestras con principal fotografía (en los dos
  dominios).
- Papeles fotográficos Fine Art como sugerencia: sólo fotografía.
- Banner de portada con las fotos de Rosario: sólo en muestrasfotograficas.com. La portada de arte
  usa portadas de muestras de arte ya publicadas (sección 7.3).
- Tipo "Salida fotográfica": sólo fotografía.
- **El filtro de muestrasfotograficas.com es por muestra, no por obra.** *(Decisión de Claude,
  sigue la opción B.)* Una muestra de fotografía con una pintura invitada se ve completa, como la
  armó el organizador. Los perfiles siguen la regla de "casa" de 6.1; en un perfil que se ve en
  fotografía, el portfolio muestra todas las obras del artista.
- Textos con "fotógrafo/a", "foto", "fotografía": pasan por la marca o por la disciplina. Lista
  inicial en el código (`app/fotografos`, `components/ficha/artistas.tsx`,
  `components/ventas/configurar-venta.tsx`, `components/portada/banner.tsx`,
  `app/m/[slug]/o/[workId]/page.tsx`, `lib/perfiles/acciones.ts`, `lib/ventas/certificado.ts`,
  `app/panel/expositor/ventas/...`, correos). La regla: **en fotografía no cambia ninguna
  palabra**.

## 7. Puesta en marcha

### 7.1 Etapas

Cada etapa va en su PR, directo a producción, sin romper fotografía:

1. **Marca por dominio** (6.1): `lib/marca.ts`, textos y dominio por marca, cookie por host,
   OAuth, redirecciones, canonical, sitemap. Con `MUESTRAS_MARCA_POR_DEFECTO=FOTOGRAFIA`, antes de
   conectar el dominio nuevo, muestrasfotograficas.com queda idéntico.
2. **Disciplinas** (6.2) + perfil de artista + portada y listado de arte. Migración 1.
   Acá se conecta muestrasdearte.com.
3. **Obras** (6.3, 6.4, 6.5, 6.10): vistas, YouTube, medidas, formulario por disciplina, ficha,
   audioguía, descripción accesible. Migración 2.
4. **Convocatorias, montaje e informe de estado** (6.8, 6.9, 6.11). Migración 3.
5. **Agenda paralela** (6.6).
6. **Venta de originales y seriadas, consultar precio** (6.7), en modo TEST. Migración 4.

### 7.2 Lo que hace Daniel

- Comprar muestrasdearte.com (con www) y avisar en qué registrador; Claude carga el DNS y lo suma
  al proyecto Vercel.
- Logo de Muestras de Arte (o pedir una propuesta a Claude con el mismo lenguaje que el de
  fotografía).
- Agregar en Vercel las variables secretas nuevas que aparezcan y fusionar los PR (el clasificador
  no deja a Claude).

### 7.3 Contenido inicial

- Relevamiento de muestras de arte vigentes en Argentina y el Mercosur, con el mismo método y
  script que las cargas del 10/10 (fichas propuestas por Daniel, APPROVED, sin obras, portadas
  copiadas a R2 sólo cuando el permiso esté claro). Se cargan recién cuando muestrasdearte.com esté
  en línea.
- La portada de arte necesita imágenes con permiso: hasta tener las primeras muestras propias,
  usa una grilla de portadas de muestras cargadas, con su crédito y enlace.

## 8. Lo que queda para quien construye

- Nombres de componentes, archivos y funciones; cómo partir cada etapa en tareas.
- Diseño visual de la marca de arte dentro del sistema actual de variables `--mf-*`.
- Cómo mostrar el carrusel de vistas en la sala y en la página de obra.
- Texto exacto de mensajes y avisos, siguiendo el tono de los que ya existen.
- Topes finos (largo de textos, cantidad de piezas de piso, tamaño de fotos de estado), mientras
  respeten los de la sección 6.

## 9. Pendiente de confirmar con Daniel

Una sola pregunta, sobre **curaduría anónima con videos de YouTube** (sección 6.4): el
reproductor de YouTube muestra el nombre del canal y el título, y eso puede revelar al autor.

Revisión independiente hecha el 21/11. Lo que resolvió Claude y conviene que Daniel revise:
medidas en la obra de la muestra (6.3), videoarte e instalación sólo con "consultar precio" (6.7),
entrega al cierre sólo para original y seriada (6.7), filtro por muestra y no por obra (6.12),
zonas de piso como listas sin alturas (6.8), audioguía como archivo y no YouTube (6.5), sin seña
(6.7), FOTOFFICE e InfoSpot sólo con fotografía (6.2).
