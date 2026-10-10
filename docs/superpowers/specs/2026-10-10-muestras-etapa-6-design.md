# Muestras Fotográficas — Etapa 6: expositores por enlace y sorpresa de la muestra

Fecha: 2026-10-10 · Estado: alcance pedido por Daniel, con sus respuestas del mismo día (QR de sala,
visibilidad por punto de entrada, rotación por visitante, sin tope de 40 obras, portfolio por
artista, botón "Adquirir obra", pase de 8 horas); este documento fija el diseño.
Diseño general: `docs/superpowers/specs/2026-10-08-muestras-fotograficas-design.md`. Etapa anterior:
`docs/superpowers/specs/2026-10-10-muestras-etapa-5-design.md` (en PR, sin fusionar; esta etapa sale
de su rama, que a su vez sale de la etapa 4, también sin fusionar; las etapas 1 a 3 están en
producción).
Plan: `docs/superpowers/plans/2026-10-10-muestras-etapa-6.md`.

> **Numeración.** Como en las etapas 2 a 5, la numeración del diseño general sigue corrida. Esta
> etapa suma dos cosas que Daniel pidió el 2026-10-10 y que no estaban en la lista del 2026-10-09:
> **expositores que cargan sus obras por un enlace** y **la sorpresa de la muestra** (qué se ve
> online y qué se descubre en la sala). La plataforma sigue siendo el soporte digital de una muestra
> **presencial**: lo online presenta a los artistas y lleva gente a la sala; la sala es donde se
> ven las obras.

## Qué se construye

1. **Enlace de expositores.** Quien organiza genera **un enlace único de la muestra** y lo manda
   (por WhatsApp o mail) a las personas que **ya eligió** para exponer. No hay selección ni
   curaduría (eso es la convocatoria de la etapa 3, que sigue igual y puede convivir con esto).
   Cada expositor entra con Google, completa su **perfil de fotógrafo** (nombre, biografía, foto) y
   carga sus obras: por cada obra, **la foto que se cuelga en la sala** con todos los datos para la
   ficha, el catálogo y el plano de montaje. Quien organiza **aprueba** cada obra o **pide cambios**.
   Lo aprobado entra a la muestra como cualquier obra: galería, fichas, marcos, catálogo, plano y
   estadísticas.
2. **Portfolio del artista.** Cada fotógrafo tiene, en su perfil, un **portfolio**: fotos que **no
   se exponen**, cada una con sus datos, que sirven para **todas** sus muestras y se ven en su perfil
   público. Es lo que el público ve del artista sin adelantar la sala.
3. **Sin tope de 40 obras.** Cuántas obras tiene una muestra lo decide quien organiza según su sala.
   Queda un tope técnico alto (**300**) por el tiempo y el tamaño de los PDF. Quien organiza puede
   poner, si quiere, un tope de obras por expositor.
4. **Sorpresa de la muestra (visibilidad por punto de entrada).** Quien organiza decide, por
   muestra, qué se ve de las **obras expuestas** según **por dónde entra** cada persona:
   - **La publicación online** (página de la muestra, páginas de obra, piezas para redes): **todas**,
     **ninguna**, **las destacadas** (como hasta hoy) o **una cantidad al azar** que elige quien
     organiza, que pueden ser **siempre las mismas** (con "Volver a sortear" y, si quiere, "cambian
     cada día") o **cambiar para cada visitante**. Además, si se presenta a los **artistas** con su
     biografía y su **portfolio**.
   - **El perfil de cada artista**: las expuestas **como en la publicación online** o **ninguna**.
   - **El QR de la sala** (la ficha al lado del cuadro): la obra escaneada, **las del mismo artista**
     o **toda la muestra**; además la biografía, el portfolio, **las otras muestras donde expuso** y
     el botón **"Adquirir obra"**.
   - **Después del cierre**: se muestra todo (por defecto) o se mantiene la reserva.
   Con **presets en castellano** ("Adelanto", "Sorpresa total", "Destacadas", "Todo a la vista") y
   **"Personalizado"**. No hay un ajuste impuesto: al habilitar el enlace de expositores, el panel
   **le pide a quien organiza que elija**, con una sugerencia ya marcada (3 al azar, siempre las
   mismas).
5. **Pase de sala.** Escanear el QR de una ficha en la sala da un **pase de 8 horas** en ese
   teléfono (una cookie firmada) que deja ver la versión digital de las obras según el ajuste
   "QR de la sala". Un enlace compartido sin el pase lleva a la publicación online, que respeta la
   sorpresa.
6. **"Adquirir obra".** En la vista de sala, las obras que el expositor marcó para vender tienen el
   botón **"Adquirir obra"**, que lleva a la página de venta de esa obra. Mientras la venta con
   Mercado Pago no esté activa, esa página dice **"La venta de esta obra todavía no está
   disponible"** y ofrece consultar a la organización en la sala. **El precio no se muestra en
   ningún lado público** hasta que la venta exista (etapa de Ventas).

## Decisiones

### Expositores

| # | Decisión | Por qué |
|---|---|---|
| D1 | **Un enlace por muestra**, reutilizable, en una tabla propia `CulturalExhibitorLink` (1 a 1 con la muestra): estado `OPEN`/`CLOSED`, fecha límite optativa, topes optativos, instrucciones. Dirección `/expositores/<token>` (32 bytes base64url). **El token se guarda tal cual** (no su SHA-256): quien organiza lo copia muchas veces, a lo largo de semanas, para mandarlo de a una persona. "Generar un enlace nuevo" lo reemplaza y el viejo deja de andar; "Cerrar" frena altas y envíos nuevos. | A diferencia de la invitación al equipo (etapa 5, D5), este enlace **no da permisos sobre la muestra**: sólo deja proponer obras que quien organiza aprueba. Guardar sólo el hash obligaría a regenerarlo cada vez que hay que volver a copiarlo, y cada regeneración rompe los enlaces ya mandados. |
| D2 | **Sin selección, pero con aprobación por obra.** El enlace es para gente ya elegida; aun así, una obra entra a la muestra **sólo cuando quien organiza la aprueba**. Un enlace reenviado a un tercero, en el peor caso, produce una persona desconocida en la lista que se saca con un clic. No hay "aceptar a la persona" aparte. | Una sola compuerta, donde importa: lo que se publica y se imprime. |
| D3 | **Ingreso con Google** (`requireUsuario`, como todo el panel). Al sumarse: "Cómo firmás" (nombre del expositor), **perfil de fotógrafo** (si no tiene, se crea en el mismo formulario con nombre, biografía, ciudad, Instagram y foto; si tiene, se vincula) y la **aceptación de derechos** ("Soy autor/a de las obras que cargo. Autorizo a mostrarlas online según lo que elija la organización y a imprimir fichas, marcos y catálogo"). Fila `CulturalExhibitor` (`activityId`, `userId`, `profileId`, `displayName`, `status`, `rightsAcceptedAt`); única por `(activityId, userId)`. | El perfil (biografía y portfolio) es lo que el público ve del artista. |
| D4 | **Una obra del expositor = la foto que se cuelga y sus datos** (`CulturalExhibitorWork`). Las fotos que **no** se exponen van al **portfolio del artista** (D13), no a la obra. | Respuesta de Daniel: el portfolio es del artista y sirve para todas sus muestras. |
| D5 | **Datos de la obra expuesta**. **Obligatorios para enviar**: foto, título (≤ 160), año (1826 al año próximo), técnica y soporte ("Impresión giclée sobre papel algodón", ≤ 160), **medida de la imagen** (ancho × alto en cm, 5–300), **medida con marco** (ancho × alto en cm, 5–300, no menor que la imagen) y **edición** (`UNIQUE` "Pieza única", `LIMITED` "Edición limitada" con **número de esta copia y total** —1 ≤ n ≤ total ≤ 999—, `OPEN` "Edición abierta", `NA` "No corresponde"). **Optativos**: texto de la obra (statement, ≤ 800), **"La quiero vender"** + **precio en pesos** (entero; obligatorio si se marca), notas para el montaje (≤ 300, sólo las ve la organización). | Las medidas del marco son lo que pide el plano de montaje (etapa 4, D9, mismos topes 5–300 cm); medida y edición van en la ficha y el catálogo. El precio se carga ahora para que la etapa de Ventas no tenga que volver a pedirlo, pero **no se muestra al público** hasta que la venta exista (D30). |
| D6 | **Topes del enlace, todos optativos** (vacío = sin tope): obras por expositor (1–300) y cantidad de expositores (1–300). El único tope fijo es el técnico de la muestra (**300 obras**, D17), que se controla **al aprobar**. El formulario del enlace sugiere 3 obras por expositor. | Respuesta de Daniel: cuántas obras entran depende de la sala; lo decide quien organiza. |
| D7 | **Estados de una obra del expositor** (texto): `DRAFT` (borrador, la edita el expositor), `SUBMITTED` (enviada; el expositor puede retirarla mientras nadie la revisó), `CHANGES_REQUESTED` (quien organiza pidió cambios con una nota; el expositor la corrige y la reenvía), `APPROVED` (en la muestra; **bloqueada** para el expositor) y `REMOVED` (quien organiza la sacó de la muestra). Una obra aprobada a la que se le piden cambios **sigue publicada con los datos anteriores** hasta que se vuelve a aprobar. Reglas puras `exhibitorWorkTransition`. | El expositor no puede cambiar en silencio algo que ya está impreso en una ficha. |
| D8 | **Lo aprobado se copia a `CulturalActivityWork`** (imagen, título, autor = nombre del expositor, `authorUserId`, `authorProfileId` = su perfil, año, técnica, al final del orden) y la obra del expositor guarda `activityWorkId` **sin FK**, igual que `CulturalCallWork.activityWorkId` (el editor de la muestra borra y vuelve a crear sus obras conservando los ids). Volver a aprobar actualiza esa fila por id. Se aprueba dentro de una transacción con `SELECT … FOR UPDATE` sobre la muestra (como armar desde la convocatoria) y en los mismos estados en que se puede editar la ficha (`canEdit`: no "en revisión"). | Todo lo construido (galería, página de obra, fichas, marcos, catálogo, plano, estadísticas, piezas) ya trabaja sobre `CulturalActivityWork`. Los datos que esa tabla no tiene (medidas, edición, venta, statement) se leen de la obra del expositor por `activityWorkId`. |
| D9 | **Convivencia con el editor de la muestra.** En `guardarBorrador`, una obra que vino de un expositor **conserva su imagen y su autor** (el servidor ignora lo que llegue del formulario; el editor los muestra como "Lo carga quien expone"); título, año y técnica sí se editan y **se copian de vuelta** a la obra del expositor (y lo mismo en `guardarTextos` del rol de textos). Si el editor la quita de la galería, la obra del expositor pasa a `REMOVED` con la nota "La organización la sacó de la muestra". | Una sola versión de los textos en los dos lados; la imagen y la autoría son del expositor. |
| D10 | **El enlace anda con la muestra en borrador, rechazada, en revisión, publicada y despublicada**; no anda si la muestra está **cancelada**, **ya cerró** o no es de tipo muestra. Enviar obras nuevas requiere el enlace abierto y antes de la fecha límite; corregir una obra con cambios pedidos se puede siempre que la muestra no esté cancelada ni cerrada. | Las obras se juntan **antes** de mandar la muestra a revisión. |
| D11 | **Permisos.** Capacidad nueva **`exhibitors`** (dueño y coorganización): generar y cerrar el enlace, topes, ver expositores y obras, aprobar, pedir cambios, corregir datos, sacar. El rol de textos **no** la tiene. **El expositor no es un rol del equipo**: sólo ve y edita lo suyo (`CulturalExhibitor.userId = usuario.id`, estado `ACTIVE`), nunca la muestra en el panel ni las obras de otros. | Mantiene la tabla de capacidades de la etapa 5. |
| D12 | **Sin correo.** Todo se ve en pantalla: el expositor ve el estado de cada obra y la nota en "Donde expongo" (`/panel/expositor`); quien organiza ve un contador "3 obras para revisar" en la muestra y en "Mis muestras". | El correo está apagado en producción (`MUESTRAS_CORREOS_EN_VIVO`). |

### Portfolio del artista

| # | Decisión | Por qué |
|---|---|---|
| D13 | **Tabla `PhotographerPortfolioPhoto`** colgada de `PhotographerProfile` (FK cascade): imagen, título (obligatorio, ≤ 160), año, técnica (≤ 160), texto breve (≤ 300), orden. Tope técnico **60 fotos por perfil**. La carga **la persona dueña del perfil** (`PhotographerProfile.userId = usuario.id`) desde "Mi perfil de fotógrafo" y desde "Donde expongo" (atajo "Tu portfolio"); el super admin también. Las imágenes tienen que ser suyas (`esImagenDeUsuario`: `<R2>/muestras/<userId>/<id>.webp`). | Respuesta de Daniel: las fotos no expuestas son un portfolio del artista, reutilizable en todas sus muestras. 60 alcanza para presentar a alguien y acota el almacenamiento y la página del perfil. |
| D14 | **Dónde se ve el portfolio**: en el **perfil público** `/fotografos/<slug>` siempre (es del artista, no de una muestra), en la sección **"Artistas"** de cada muestra si `online.artists` (primeras 8 fotos y "Ver portfolio") y en la **vista de sala** si `room.portfolio`. | El perfil es del artista; cada muestra decide si lo presenta. |
| D15 | **Una foto del portfolio no puede ser una obra expuesta**: al guardar, se rechaza una imagen cuya URL ya está en una obra del expositor o de una muestra (`CulturalExhibitorWork` o `CulturalActivityWork` con su `authorUserId`), con el mensaje "Esa foto es una obra que expusiste o vas a exponer: no la sumes al portfolio, así sigue siendo sorpresa en la sala." El formulario lo advierte arriba. Una copia del mismo archivo subida de nuevo tiene otra URL: es riesgo residual del artista. | El portfolio es público; si el artista sube la obra que cuelga, arruina la sorpresa. |
| D16 | **Perfiles sin cuenta** (los crea un organizador en la etapa 2) no tienen portfolio hasta que la persona los reclama. | Nadie más que el artista decide qué muestra de sí. |

### Cantidad de obras

| # | Decisión | Por qué |
|---|---|---|
| D17 | **`MAX_WORKS` pasa de 40 a 300** y deja de ser un límite de diseño: es un **tope técnico** de seguridad. 300 sale del armado de PDF: cada foto se convierte de a una (≈ 0,3–0,5 s) y con 300 un PDF completo con fotos tarda 90–150 s; la memoria de `pdf-lib` crece con cada imagen incrustada; y los ~300 elementos de la galería, el editor y el plano siguen siendo manejables en un teléfono. Todo lo que hoy dice "40" se revisa (lista en el plan, Task 5): validación, editor, selección de la convocatoria, textos de la portada y frenos. | Respuesta de Daniel: el organizador decide según su sala; un tope técnico protege a la plataforma. |
| D18 | **PDF con muchas obras.** (1) **Marcos con foto** de todas las obras: se bajan **por tandas de 40** ("Marcos 1 a 40", "41 a 80"…; parámetro `tanda`), así cada PDF tarda lo mismo que hoy. (2) **Catálogo**: hasta 60 obras con imágenes de 1400 px (como hoy); con más, 1000 px; con más de 150, 800 px (en A5 a 300 ppp alcanzan para la caja de la imagen). (3) `/api/piezas` sube `maxDuration` de 60 a **300 s** (Vercel Pro lo permite; verificar el plan del proyecto). Los PDF de más de 4 MB ya van a R2 (etapa 4, D4). Fichas, cartel, plano y afiche no llevan fotos: no cambian. | Mantiene cada descarga dentro del tiempo de una función sin pedir una cola de trabajos. |
| D19 | **Se mantiene el tope de 12 destacadas** (`MAX_HIGHLIGHTS`), que ahora sólo usa el modo "Las destacadas". La cantidad al azar no tiene ese tope: va de 1 a la cantidad de obras expuestas. | Las destacadas son la elección a mano de un anticipo: más de 12 deja de ser un anticipo y llena la página. Quien quiera mostrar más usa "al azar" o "todas". |

### Sorpresa: visibilidad por punto de entrada

| # | Decisión | Por qué |
|---|---|---|
| D20 | **Un ajuste por muestra**, en una columna `visibility JSONB` de `CulturalActivity` (vacía = como hasta hoy, D24). Forma (`v: 1`): `preset`; `online` (`exhibited`: `ALL` \| `HIGHLIGHTS` \| `RANDOM` \| `NONE`, `randomCount` ≥ 1, `rotation`: `FIXED` \| `DAILY` \| `PER_VISIT`, `seed`, `artists` sí/no); `profile` (`exhibited`: `LIKE_ONLINE` \| `NONE`); `room` (`exhibited`: `SCANNED` \| `ARTIST` \| `ALL`, `portfolio`, `otherExhibitions`, `buy` sí/no); `revealAfterClose` sí/no. Se lee **siempre** con `parseVisibility(json, galleryMode)`, que devuelve un ajuste completo y válido aunque la columna venga rota. | Una columna JSON es una sola migración. La regla pura es la única que interpreta el JSON. |
| D21 | **Presets**: **"Adelanto"** (`PREVIEW`: 3 al azar, siempre las mismas; artistas con biografía y portfolio; perfil como lo online; QR: la obra + las del mismo artista + portfolio + otras muestras + "Adquirir obra"; se revela todo al cerrar), **"Sorpresa total"** (`SURPRISE`: igual pero ninguna expuesta online), **"Destacadas"** (`HIGHLIGHTS`: como hasta hoy), **"Todo a la vista"** (`OPEN`) y **"Personalizado"** (`CUSTOM`). Elegir un preset reescribe todo; tocar cualquier opción pasa a "Personalizado". | Daniel pidió que sea simple de entender: cuatro frases y el detalle a un clic. |
| D22 | **Al azar, "siempre las mismas"** (`FIXED`, y `DAILY` como variante): las obras online salen de ordenar las expuestas por `stableHash("muestras-sorpresa:v1:<seed>:<día o vacío>:<id>")` y tomar las primeras N (se muestran en el orden de la galería). `seed` se crea al elegir "al azar" y cambia con **"Volver a sortear"**. Es determinista: la página sigue en caché (`revalidate = 300`) y galería, página de obra, perfil y piezas coinciden. Con "cambian cada día", el panel advierte que quien vuelve seguido termina viendo más obras. | Daniel quiere que quien organiza pueda fijar el anticipo. Sortear en el navegador obligaría a mandarle todas las obras (con sus URL del bucket). |
| D23 | **Al azar, "cambian para cada visitante"** (`PER_VISIT`). La página de la muestra **sigue en caché** y no trae ninguna obra expuesta: el bloque de la galería lo carga un componente cliente desde **`GET /api/m/<slug>/anticipo`**, una ruta **dinámica** que elige N obras **en el servidor, en cada pedido** (`crypto.randomInt`, sin semilla) y devuelve **sólo esas N** (id, título, autor, año, técnica, imagen), con `Cache-Control: private, no-store`. **Nunca** viaja el conjunto completo al navegador. Freno por huella de IP `anticipo` **60 cada 10 min**; pasado el tope, devuelve las mismas que la última vez para esa IP (en memoria) o, si no hay, una lista vacía. En este modo las obras expuestas **no tienen página pública con imagen** (`/m/<slug>/o/<id>` muestra el aviso sin imagen, `noindex`; el visor de la galería no enlaza a la página), **el perfil** muestra sólo el número de obras reservadas, y **las piezas para redes** ofrecen cualquier obra expuesta (la elige quien organiza). **Aviso en el panel** al elegirlo: "Cada visitante ve otras N obras. Quien entre varias veces (o use un programa) va a terminar viendo todas: si querés que la sala sea sorpresa, elegí 'siempre las mismas' o 'ninguna'." | Respuesta de Daniel. Elegir en el servidor por pedido es lo único que cumple "por visitante" sin mandar todas las obras; separarlo en una ruta mantiene en caché el resto de la página. Sin página de obra con imagen, un buscador no indexa obras que cambian en cada visita. |
| D24 | **Muestras sin ajuste** (`visibility` vacía): se comportan **exactamente como hoy** (`galleryMode` `FULL` → "Todo a la vista"; si no → "Destacadas"). **No hay un ajuste impuesto**: al **generar el enlace de expositores** de una muestra sin ajuste, el panel muestra en el mismo paso el bloque **"¿Qué se ve online?"** con los presets y la sugerencia ya marcada (**"Adelanto": 3 al azar, siempre las mismas**), y no se puede generar el enlace sin confirmar una opción. En la ficha, el control "Mostrar todas las obras mientras está abierta" se reemplaza por un enlace a **Visibilidad** cuando la muestra ya tiene ajuste (y el servidor deja de escribir `galleryMode` desde el formulario en ese caso). | Respuesta de Daniel: la elección es de quien organiza; la plataforma sugiere. |
| D25 | **Una sola regla para todo lo público.** `visibleWorks` (galería), `workAccess` (página de obra), `profileWorksInActivity` (perfil) y la lista de "Obra destacada" (piezas para redes) leen el ajuste. Una obra **oculta** online: no aparece en la galería, ni en el perfil, ni en "anterior/siguiente", ni en los metadatos (`og:image`), ni en las piezas; su página muestra **el aviso sin imagen** (título y autor, `noindex`), como el `TEASER` de hoy. | Evita que galería, perfil y página de obra se contradigan. |
| D26 | **"Artistas" en la página de la muestra** (si `online.artists`): una tarjeta por artista con al menos una obra **expuesta** en la muestra (aunque esté oculta): foto, nombre, ciudad, biografía (280 caracteres + "Ver perfil") y las primeras **8 fotos de su portfolio** (miniaturas que abren el visor; "Ver portfolio" lleva al perfil). Salen de los perfiles vinculados a las obras (expositores, convocatoria o editor). | Conocer al artista sin ver lo que cuelga en la sala. |
| D27 | **Después del cierre** (`revealAfterClose`, por defecto **sí**): la galería pasa a "Archivo de la muestra" con todas las expuestas (también en `PER_VISIT`: la página deja de pedir el anticipo y muestra todas, con sus páginas). Con "no", la reserva sigue. | La reserva sirve mientras se puede ir a la sala. |
| D28 | **Capacidad nueva `visibility`** (dueño y coorganización) para `/panel/muestras/<id>/visibilidad` y `guardarVisibilidad`. Al guardar se revalidan la muestra, sus obras y `/fotografos`. **Aviso** si la portada de la muestra es la misma imagen que una obra expuesta oculta. | La portada se ve siempre (listado, mapa, metadatos). |

### QR de la sala, pase y "Adquirir obra"

| # | Decisión | Por qué |
|---|---|---|
| D29 | **El pase se da sólo desde un código de sala**, no desde el id de la obra. Cada obra expuesta tiene un **código de sala** al azar (12 caracteres de un alfabeto sin ambiguos, ≈ 60 bits) en `CulturalActivityRoomCode` (`code` PK, `activityId` FK cascade, `workId` **sin FK**, único `(activityId, workId)`), creado al generar las fichas. Las fichas imprimen el QR **`/q/s/<código>`**. `/q/o/<id>` sigue andando como en la etapa 4 (cuenta y lleva a la página pública) **pero no da pase**. | El id de una obra no es secreto: el de cada obra visible online está en la galería y en su dirección. Si `/q/o/<id>` diera pase, cualquiera vería las ocultas desde su casa. El código sólo está impreso en la sala. |
| D30 | **El pase es una cookie firmada de 8 horas** (decisión de Daniel): `/q/s/<código>` cuenta el escaneo, agrega la obra a la cookie **`mf_sala_<activityId>`** (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, `Max-Age` 8 h) y redirige (302, `no-store`) a **`/m/<slug>/sala/o/<obra>`**. Contenido: versión, muestra, vencimiento y los ids escaneados (hasta 60), firmado con **HMAC-SHA256** con una **llave por muestra** guardada en `CulturalActivityRoomKey` (32 bytes al azar, creada sola la primera vez). Cada escaneo renueva las 8 horas. Sin variables de entorno nuevas. | Una dirección con token se comparte por WhatsApp con el token adentro; la cookie queda en el teléfono que escaneó. Firmar en vez de guardar cada pase evita una escritura por escaneo. |
| D31 | **Vista de sala** `/m/<slug>/sala/o/<obra>` (y `/m/<slug>/sala` con lo escaneado): **dinámica**, `noindex`, `referrer: no-referrer`, privada. Con pase válido de esa muestra (o si quien mira es del equipo o super admin: "Ver como en la sala"): la obra con su foto, sus datos (medidas, edición, texto), el **artista** (foto, biografía completa, enlaces), **sus otras obras de la muestra** según `room.exhibited`, **su portfolio** (`room.portfolio`), **las otras muestras donde expuso** (`room.otherExhibitions`, con lo que cada una deja ver online) y el botón **"Adquirir obra"** (D33). **Sin pase** (o vencido, o de otra muestra, o la obra fuera del alcance): redirige a `/m/<slug>/o/<obra>` (la pública). **Ninguna página pública lee cookies.** | Separar la vista de sala mantiene la caché y hace imposible que una página cacheada sirva a otra persona lo que vio quien tenía el pase. |
| D32 | **Las imágenes de la vista de sala no muestran la dirección del bucket**: se sirven por `/m/<slug>/sala/img/<id>` (obra expuesta permitida), que valida el pase y devuelve los bytes desde R2 (`leerDeR2`, como la imagen anónima de la curaduría) con `Cache-Control: private, max-age=600`, `Referrer-Policy: no-referrer` y `X-Content-Type-Options: nosniff`. Las del portfolio son públicas (están en el perfil) y van directo. | El bucket es público y sus direcciones no vencen: si la página mostrara la URL de R2, copiarla saltearía las 8 horas para siempre. |
| D33 | **"Adquirir obra"** (sólo si `room.buy` y la obra está marcada "La quiero vender"): botón en la vista de sala que lleva a **`/m/<slug>/sala/o/<obra>/adquirir`** (con pase; sin pase, a la página pública). Hoy esa página muestra título, autor y **"La venta de esta obra todavía no está disponible."** + "Si te interesa, consultá a la organización en la sala." **Sin precio.** Su estado sale de una regla pura `saleState({ salesEnabled, forSale })` con `salesEnabled = false` fijo en esta etapa (`UNAVAILABLE`); la etapa de Ventas agrega `AVAILABLE` (precio y compra con DNX Payments, Split 1:N) en la misma página. | Respuesta de Daniel. El Split 1:N de Mercado Pago todavía no tiene orden productiva; el botón y la página quedan en su lugar para no rediseñar la sala después. |
| D34 | **Riesgo residual aceptado.** (1) Quien tiene el pase puede sacar capturas. (2) Una **foto del QR** publicada en redes da pase a quien la escanee: se corta con **"Cortar los accesos de sala"** (rota la llave) y **"Cambiar los códigos de sala"** (borra los códigos; hay que reimprimir las fichas). (3) Sin cookies, el escaneo lleva a la versión pública. (4) Copiar la cookie a otro teléfono exige saber hacerlo y vence en 8 horas. | El equilibrio que pidió Daniel. |
| D35 | **QR y estadísticas.** `/q/s/<código>` cuenta un **escaneo** de esa obra (métrica `SCAN`), con los mismos frenos y sin contar al equipo. La vista de sala manda la baliza de visita de la obra. | Una sola columna por obra para quien organiza. |

### Panel y otras piezas

| # | Decisión | Por qué |
|---|---|---|
| D36 | **Panel.** En la muestra: **"Expositores"** y **"Visibilidad"**. Para quien expone: **"Donde expongo"** (`/panel/expositor`, grupo "Tu cuenta", `ready: true`). "Mi perfil de fotógrafo" suma **"Portfolio"**. Entrada pública `/expositores/<token>`. | Daniel quiere todo a la vista y construido. |
| D37 | **Aviso de reimprimir fichas** (decisión de Daniel): **sólo** en Visibilidad y en Montaje e impresión: "El pase de sala necesita las fichas con el QR nuevo. Si imprimiste fichas antes, volvé a bajarlas." | Son los dos lugares donde se decide y se imprime. |
| D38 | **Fichas, catálogo y plano usan los datos del expositor**: la ficha suma medidas y edición ("40 × 60 cm. Edición 2/10") y su QR pasa a `/q/s/<código>`; el catálogo suma medidas, edición y el texto de la obra; el editor del plano **propone** la medida con marco del expositor. El precio **no** va en ninguna pieza. | El expositor ya cargó lo que el montajista necesita. |
| D39 | **Piezas para redes**: "Obra destacada" sólo ofrece obras visibles online hoy (D25); en `PER_VISIT`, cualquier expuesta (D23); con "Sorpresa total" la variante no está disponible. | Una pieza para redes es publicación online. |
| D40 | **Convocatoria (etapa 3)**: una muestra puede tener convocatoria, enlace de expositores o los dos. Las obras elegidas en la convocatoria entran como hoy y respetan la sorpresa. **Fuera de alcance**: sumar a los seleccionados como expositores. | Son dos caminos distintos (con y sin selección). |
| D41 | **Sin dependencias nuevas.** `node:crypto` (HMAC, `timingSafeEqual`, `randomBytes`, `randomInt`), `sharp`, `pdf-lib`, `qrcode` y `@aws-sdk/client-s3` ya están. | Una dependencia nueva mueve el lockfile de todas las apps. |

**Capacidades por rol** (se suman a la tabla de la etapa 5):

| Capacidad | Para qué | Dueño | Coorganización | Textos |
|---|---|---|---|---|
| `exhibitors` | Enlace de expositores, topes, aprobar, pedir cambios, corregir, sacar | ✓ | ✓ | |
| `visibility` | Visibilidad (sorpresa), cortar accesos de sala, cambiar códigos | ✓ | ✓ | |

## Presets

| Punto de entrada | "Adelanto" (sugerido) | "Sorpresa total" | "Destacadas" (muestras sin ajuste) | "Todo a la vista" |
|---|---|---|---|---|
| Online: obras expuestas | 3 al azar, siempre las mismas | ninguna | destacadas (hasta 12) | todas |
| Online: artistas con biografía y portfolio | sí | sí | sí | sí |
| Perfil del artista: expuestas | como lo online | ninguna | como lo online | como lo online |
| QR de la sala: expuestas | la escaneada + las del mismo artista | ídem | ídem | ídem |
| QR de la sala: portfolio, otras muestras, "Adquirir obra" | sí | sí | sí | sí |
| Después del cierre | se ve todo | se ve todo | se ve todo | se ve todo |

En "Personalizado", la cantidad al azar puede ser "siempre las mismas", "cambian cada día" o
"cambian para cada visitante".

## Datos (migración aditiva, a mano)

`20261031120000_muestras_etapa_6_expositores` (ordena después de
`20261030120000_muestras_etapa_5_difusion`).

- **`CulturalActivity`** suma **una** columna: `visibility JSONB` (optativa). Relaciones inversas
  sin columnas.
- **`CulturalExhibitorLink`**: `id` cuid, `activityId` único (FK cascade), `token` único, `status`
  (`OPEN` \| `CLOSED`), `closesAt TIMESTAMP(3)?` (fin del día argentino), `maxWorksPerExhibitor INT?`,
  `maxExhibitors INT?`, `instructions TEXT?` (≤ 1500), `createdByUserId INT`, `createdAt`,
  `updatedAt`, `rotatedAt?`.
- **`CulturalExhibitor`**: `id` cuid, `activityId` (FK cascade), `userId INT` (sin relación),
  `profileId` (FK a `PhotographerProfile`, `ON DELETE SET NULL`), `displayName`, `status`
  (`ACTIVE` \| `REMOVED`), `rightsAcceptedAt`, `joinedAt`, `removedAt?`, `removedByUserId INT?`.
  Único `(activityId, userId)`; índices `(userId, status)` y `(profileId)`.
- **`CulturalExhibitorWork`**: `id` cuid, `exhibitorId` (FK cascade), `activityId` (FK cascade),
  `status` (`DRAFT`), `imageUrl?`, `title`, `year?`, `technique?`, `imageWidthCm`, `imageHeightCm`,
  `frameWidthCm`, `frameHeightCm` (`DOUBLE PRECISION?`), `edition?`, `editionNumber?`,
  `editionSize?`, `statement?`, `forSale BOOLEAN DEFAULT false`, `priceArs INT?`, `hangingNotes?`,
  `sortOrder`, `reviewNote?`, `activityWorkId?` (sin FK), `submittedAt?`, `reviewedAt?`,
  `reviewedByUserId INT?`, `createdAt`, `updatedAt`. Índices `(exhibitorId, sortOrder)`,
  `(activityId, status)`, `(activityWorkId)`.
- **`PhotographerPortfolioPhoto`**: `id` cuid, `profileId` (FK a `PhotographerProfile`, cascade),
  `imageUrl`, `title`, `year INT?`, `technique TEXT?`, `caption TEXT?`, `sortOrder INT DEFAULT 0`,
  `createdAt`, `updatedAt`. Índice `(profileId, sortOrder)`.
- **`CulturalActivityRoomCode`**: `code TEXT` PK, `activityId` (FK cascade), `workId TEXT` (sin FK),
  `createdAt`. Único `(activityId, workId)`.
- **`CulturalActivityRoomKey`**: `activityId TEXT` PK (FK cascade), `secret TEXT` (64 hex),
  `createdAt`, `rotatedAt?`. **Nunca** se incluye en una consulta pública.

Sin enums, ids de usuario `Int` sin relación a `User`, no toca filas existentes. El cambio de
`MAX_WORKS` es de código (no hay tope en la base). La SQL completa está en la Task 4 del plan. **La
aplica a mano en producción el controlador, antes de publicar el código** (Neon
`divine-hall-10689679`, rama `development`), **después** de las de las etapas 4 y 5, y la registra en
`_prisma_migrations` con el SHA-256 del archivo. Una columna de `CulturalActivity` sin aplicar
**rompe todo el sitio de Muestras**.

## Rutas

| Ruta | Quién | Qué |
|---|---|---|
| `/expositores/[token]` | público; para sumarse, con sesión | Datos de la muestra, instrucciones, topes; alta (D3). `noindex`, `no-referrer`. |
| `/panel/expositor`, `/panel/expositor/[id]` | el expositor | "Donde expongo" y sus obras de una muestra. |
| `/panel/perfil` | con sesión | Suma "Portfolio". |
| `/panel/muestras/[id]/expositores` | `exhibitors` | Enlace (con la elección de visibilidad la primera vez), expositores y obras, revisión. |
| `/panel/muestras/[id]/visibilidad` | `visibility` | Presets, personalizado, sortear, "qué ve cada uno", cortar accesos, cambiar códigos, aviso de fichas. |
| `/panel/montaje/[id]` | `hanging` | Marcos por tandas; aviso de fichas. |
| `/api/m/[slug]/anticipo` | público | Sólo en `PER_VISIT`: N obras al azar por pedido (D23). Dinámica, `no-store`, freno por IP. |
| `/q/s/[código]` (dentro de `/q/[tipo]/[id]`) | público | Cuenta, da el pase y redirige (D29, D30). |
| `/m/[slug]/sala`, `/m/[slug]/sala/o/[workId]` | con pase (o equipo) | Vista de sala (D31). |
| `/m/[slug]/sala/o/[workId]/adquirir` | con pase (o equipo) | Página de venta: hoy "todavía no está disponible" (D33). |
| `/m/[slug]/sala/img/[id]` | con pase (o equipo) | Imagen por proxy (D32). |
| `/m/[slug]`, `/m/[slug]/o/[workId]`, `/fotografos/[slug]` | público | Según la sorpresa; "Artistas"; portfolio. |
| `/api/redes/[id]`, `/api/fichas/[id]`, `/api/piezas/[id]/[pieza]` | `promote` / `pieces` | Respetan la sorpresa; QR de sala; tandas. |

## Permisos (todo del lado del servidor)

- Cada `page.tsx` del panel llama `requireUsuario(<su propia ruta>)`; `/expositores/[token]` lo pide
  recién para sumarse; la vista de sala usa el pase. Toda negativa en el panel es `notFound()`.
- Cada acción vuelve a leer la sesión y, según el caso, el rol (`rolEnMuestra` + `can`), la fila del
  expositor o el perfil propio **en la base**.
- Acciones nuevas: enlace (`crearEnlaceExpositores` —con la visibilidad si falta—,
  `guardarEnlaceExpositores`, `renovarEnlaceExpositores`, `cambiarEstadoEnlace`: `exhibitors`);
  `sumarmeComoExpositor`; obras del expositor (`guardarObraDeExpositor`, `borrarObraDeExpositor`,
  `enviarObraDeExpositor`, `retirarObraDeExpositor`: el expositor); revisión
  (`aprobarObraDeExpositor`, `pedirCambiosObraDeExpositor`, `corregirObraDeExpositor`,
  `sacarObraDeExpositor`, `sacarExpositor`: `exhibitors`); portfolio (`guardarFotoDePortfolio`,
  `borrarFotoDePortfolio`, `ordenarPortfolio`: dueño del perfil o super admin); visibilidad
  (`guardarVisibilidad`, `volverASortear`, `cortarAccesosDeSala`, `cambiarCodigosDeSala`:
  `visibility`).
- Frenos por persona: `sumarseExpositor` 20/h, `guardarObraExpositor` 300/h, `enviarObraExpositor`
  60/h, `revisarExpositores` 600/10 min, `guardarVisibilidad` 60/h, `enlaceExpositores` 30/h,
  `guardarPortfolio` 300/h; `fichas` sube de 100 a **400** cada 10 min (una ficha por obra con 300
  obras). Por huella de IP: `paginaExpositores` 60/10 min, `anticipo` 60/10 min, `imagenSala`
  600/10 min, `vistaSala` 300/10 min. El freno `qr` existente cubre `/q/s`.

## Privacidad y filtraciones (lista de control)

| Lugar | Riesgo | Cómo queda |
|---|---|---|
| Galería de `/m/<slug>` (HTML y props del componente cliente) | URL de R2 de una obra oculta | Viaja sólo lo que devuelve `visibleWorks`; en `PER_VISIT`, nada (lo trae el anticipo). Test que serializa la página y busca la URL oculta. |
| `/api/m/<slug>/anticipo` | Devolver todas | Sólo N por pedido, elegidas en el servidor; freno por IP. Riesgo aceptado y avisado: con muchos pedidos se ven todas (D23). |
| `/m/<slug>/o/<id>` | Imagen u `og:image` de una oculta | `workAccess` con el ajuste → aviso sin imagen, `noindex`. En `PER_VISIT` todas las expuestas van así mientras está abierta. |
| `/fotografos/<slug>` | Miniaturas de ocultas | `profileWorksInActivity` con el ajuste; sólo el número de las reservadas. |
| Portfolio | El artista sube una obra expuesta | Se rechaza la misma URL (D15); aviso en el formulario. |
| Piezas para redes | Difundir una oculta | Sólo visibles (D39). |
| `og:image` de la muestra | Portada = obra oculta | Aviso en Visibilidad (D28). |
| Mapa del sitio, robots | Indexar ocultas | No hay `sitemap.ts`; páginas de ocultas y vista de sala `noindex`. |
| `/q/o/<id>` | Pase desde un id público | No da pase (D29). |
| `/q/s/<código>` | Adivinar códigos | 60 bits + freno `qr` por IP. |
| Vista de sala compartida | Que el enlace muestre lo oculto | Sin cookie → versión pública (D31). |
| Imágenes de la vista de sala | Copiar la URL del bucket | Proxy con pase (D32). |
| Precio | Mostrarlo antes de la venta | No se muestra en ningún lado público ni en piezas (D33, D38); sólo lo ve la organización. |
| Baliza `/api/visitas` | Confirmar que existe una obra | Responde siempre 204. |
| Panel del expositor | Ver obras de otros | Consultas siempre con `exhibitorId` propio. |
| Caché ISR | Servir lo del pase a otro | Las páginas públicas no leen cookies; vista de sala y anticipo son dinámicos y privados. |

La cookie del pase no identifica a la persona. `/privacidad` suma un párrafo sobre el pase de sala y
otro sobre los datos de los expositores y el portfolio.

## Reglas puras nuevas en `packages/muestras` (con tests)

- `visibility.ts`: tipos, presets y etiquetas, `parseVisibility`, `visibilityFromPreset`, `presetOf`,
  `onlineExhibitedWorks` (todas / destacadas / al azar fijo o diario / ninguna / por visita →
  `{ mode: "CLIENT_PICK" }`), `pickPerVisit(works, n, randomInt)`, `roomExhibitedWorks`,
  `visibilitySummary`, `coverIsHiddenWork`.
- `gallery.ts`, `work-access.ts`, `profile.ts`: leen `visibility`.
- `exhibitors.ts`: límites, `exhibitorLinkState`, `exhibitorJoinProblems`, `exhibitorWorkProblems`,
  `exhibitorWorkTransition`, `editionText`, `sizeText`, `fichaDetail`, `toActivityWork`,
  `pendingReviewCount`.
- `portfolio.ts`: `PORTFOLIO_MAX_PHOTOS = 60`, `portfolioPhotoProblems`, `portfolioPreview`.
- `room.ts`: código de sala, pase (sin firma), `ROOM_PASS_HOURS = 8`, `saleState`.
- `constants.ts`: `MAX_WORKS = 300`; `print.ts`: `FRAME_BATCH_SIZE = 40`, `frameBatches`,
  `catalogImageSize`.
- `team.ts`: capacidades `exhibitors` y `visibility`; `stats.ts`: QR `s`; `panel.ts`: "Donde expongo".

## Riesgos

- **Columna sin aplicar** en `CulturalActivity` rompe todo el sitio: la migración (y antes las de las
  etapas 4 y 5) va antes del deploy.
- **Fichas ya impresas**: llevan a la versión pública. Hay que reimprimir para el pase (aviso en
  Visibilidad y Montaje).
- **"Cambian para cada visitante"** revela, con el tiempo o con un programa, todas las obras (D23).
  Es la elección de quien organiza y el panel lo dice.
- **Foto del QR en redes** (D34): se corta rotando la llave y, si sigue, cambiando los códigos.
- **Webviews de lectores de QR**: la cookie vive en ese navegador interno.
- **Muestras grandes**: con 300 obras el catálogo tarda hasta ~2 minutos y pesa decenas de MB (va a
  R2). Si el plan de Vercel no permite 300 s, hay que bajar `maxDuration` y el tope técnico.
- **Tráfico del proxy de imágenes** y del anticipo: cada pedido pasa por una función.
- **Copias de textos**: título, año y técnica viven en dos tablas (D9).
- **Portfolio con la obra expuesta subida de nuevo** (otra URL): no se puede detectar sin comparar
  imágenes; queda en manos del artista, avisado.
- **Enlace guardado tal cual** (D1): nada se publica sin aprobación.
- **Freno en memoria** = "N por instancia".

## Fuera de alcance

Correos a expositores; invitaciones personales por email; convertir seleccionados de la convocatoria
en expositores; venta y pago (etapa de Ventas: el botón y la página quedan listos); mostrar precios;
lista de precios imprimible; originales en alta; comparar imágenes para detectar duplicados en el
portfolio; páginas propias por foto del portfolio; pase desde el cartel o el catálogo; cola de
trabajos para PDF muy grandes.

## Decisiones de Daniel (2026-10-10) y preguntas que quedan

Resueltas: rotación fija o por visitante a elección de quien organiza (D22, D23); sin ajuste
impuesto, se sugiere "Adelanto" con 3 (D24); sin tope de 40, tope técnico 300 y tope por expositor
optativo (D6, D17); portfolio por artista (D13–D16); "Adquirir obra" con página de venta y sin
precio (D33); pase de 8 horas (D30); aviso de reimprimir en Visibilidad y Montaje (D37).

Quedan para Daniel:
1. ¿El plan de Vercel del proyecto de Muestras permite `maxDuration = 300`? Si no, el tope técnico
   baja (p. ej. 120 obras).
2. ¿60 fotos de portfolio por artista está bien?
