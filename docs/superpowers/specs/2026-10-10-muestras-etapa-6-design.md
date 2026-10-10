# Muestras Fotográficas — Etapa 6: expositores por enlace y sorpresa de la muestra

Fecha: 2026-10-10 · Estado: alcance pedido por Daniel (con dos definiciones suyas del mismo día
sobre el QR y la visibilidad por punto de entrada); este documento fija el diseño.
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
   carga sus obras: por cada obra, **una foto principal** (la que se cuelga en la sala) con todos
   los datos para la ficha, el catálogo y el plano de montaje, y **fotos adicionales** (otras de la
   serie, del proceso) con sus propios datos. Quien organiza fija los topes, revisa, **aprueba** o
   **pide cambios**. Lo aprobado entra a la muestra como cualquier obra: galería, fichas, marcos,
   catálogo, plano y estadísticas.
2. **Sorpresa de la muestra (visibilidad por punto de entrada).** Quien organiza decide, por
   muestra, qué se ve de las **obras expuestas** según **por dónde entra** cada persona:
   - **La publicación online** (la página de la muestra, las páginas de obra, las piezas para redes):
     **todas**, **ninguna**, **las destacadas** (como hasta hoy) o **algunas al azar** (cuántas elige
     quien organiza).
   - **El perfil de cada artista** (`/fotografos/<slug>`): las expuestas **como en la publicación
     online** o **ninguna**; y si se ven sus **otras obras** (las fotos adicionales).
   - **El QR de la sala** (la ficha al lado del cuadro): la obra escaneada, **las del mismo artista**
     o **toda la muestra**; además la biografía, las otras obras del artista, **las otras muestras
     donde expuso** y la **entrada de compra** (la venta llega con la etapa de Ventas; hoy la entrada
     muestra el precio y "consultá a la organización").
   - **Después del cierre**: se muestra todo (por defecto) o se mantiene la reserva.
   Con **presets en castellano** ("Adelanto", "Sorpresa total", "Destacadas", "Todo a la vista") y
   **"Personalizado"**.
3. **Pase de sala.** Escanear el QR de una ficha en la sala da un **pase de 8 horas** en ese
   teléfono (una cookie firmada) que deja ver la versión digital de las obras según el ajuste
   "QR de la sala". Un enlace compartido sin el pase lleva a la publicación online, que respeta la
   sorpresa.
4. **Artistas en la publicación online.** La página de la muestra suma la sección **"Artistas"**:
   foto, nombre, biografía y, si quien organiza lo permite, **sólo sus obras que no se exponen**
   (las fotos adicionales). Así se conoce a cada artista sin ver lo que cuelga en la sala.

## Decisiones

### Expositores

| # | Decisión | Por qué |
|---|---|---|
| D1 | **Un enlace por muestra**, reutilizable, en una tabla propia `CulturalExhibitorLink` (1 a 1 con la muestra): estado `OPEN`/`CLOSED`, fecha límite optativa, topes, instrucciones. Dirección `/expositores/<token>` (32 bytes base64url). **El token se guarda tal cual** (no su SHA-256): quien organiza lo copia muchas veces, a lo largo de semanas, para mandarlo de a una persona. "Generar un enlace nuevo" lo reemplaza y el viejo deja de andar; "Cerrar" frena altas y envíos nuevos. | A diferencia de la invitación al equipo (etapa 5, D5), este enlace **no da permisos sobre la muestra**: sólo deja proponer obras que quien organiza aprueba. Guardar sólo el hash obligaría a regenerarlo cada vez que hay que volver a copiarlo, y cada regeneración rompe los enlaces ya mandados. |
| D2 | **Sin selección, pero con aprobación por obra.** El enlace es para gente ya elegida; aun así, una obra entra a la muestra **sólo cuando quien organiza la aprueba**. Un enlace reenviado a un tercero, en el peor caso, produce una persona desconocida en la lista que se saca con un clic. No hay "aceptar a la persona" aparte. | Una sola compuerta, donde importa: lo que se publica y se imprime. Dos compuertas (persona y obra) duplican el trabajo de quien organiza. |
| D3 | **Ingreso con Google** (`requireUsuario`, como todo el panel). Al sumarse: "Cómo firmás" (nombre del expositor), **perfil de fotógrafo** (si no tiene, se crea en el mismo formulario con nombre, biografía, ciudad, Instagram y foto, con `guardarPerfil`; si tiene, se vincula) y la **aceptación de derechos** ("Soy autor/a de las obras que cargo. Autorizo a mostrarlas online según lo que elija la organización y a imprimir fichas, marcos y catálogo"). Fila `CulturalExhibitor` (`activityId`, `userId`, `profileId`, `displayName`, `status`, `rightsAcceptedAt`); única por `(activityId, userId)`. | El perfil es lo que el público ve del artista (punto 4). Sin perfil con biografía no hay "Artistas". |
| D4 | **Una obra = una foto principal + fotos adicionales.** `CulturalExhibitorWork` (la principal y sus datos) y `CulturalExhibitorPhoto` (cada adicional, con los suyos). Las adicionales **nunca se cuelgan** en la sala: son las "otras obras" del artista que se pueden ver online. | Es lo que pidió Daniel: la principal es la que se exhibe; las adicionales presentan al artista sin adelantar la sala. |
| D5 | **Datos de la obra expuesta** (todo lo que necesitan ficha, catálogo y plano). **Obligatorios para enviar**: foto principal, título (≤ 160), año (1826 al año próximo), técnica y soporte ("Impresión giclée sobre papel algodón", ≤ 160), **medida de la imagen** (ancho × alto en cm, 5–300), **medida con marco** (ancho × alto en cm, 5–300, no menor que la imagen) y **edición** (`UNIQUE` "Pieza única", `LIMITED` "Edición limitada" con **número de esta copia y total** —1 ≤ n ≤ total ≤ 999—, `OPEN` "Edición abierta", `NA` "No corresponde"). **Optativos**: texto de la obra (statement, ≤ 800), "La quiero vender" + **precio en pesos** (entero, obligatorio si se marca; sin centavos), notas para el montaje (≤ 300, sólo las ve la organización: "marco negro de 3 cm, se cuelga con alambre"). **Fotos adicionales**: título obligatorio; año, técnica y texto breve (≤ 300) optativos. | Las medidas del marco son lo que pide el plano de montaje (etapa 4, D9, mismos topes 5–300 cm); la medida de la imagen y la edición van en la ficha y el catálogo, como en cualquier muestra de fotografía. El precio se guarda ahora para que la etapa de Ventas no tenga que volver a pedirlo. |
| D6 | **Topes por muestra** que fija quien organiza: obras por expositor (**3** por defecto, 1–20), fotos adicionales por obra (**3** por defecto, 0–10), expositores (**30** por defecto, 1–100). El tope de **40 obras por muestra** (`MAX_WORKS`) sigue y se controla **al aprobar**. | Igual que `maxWorksPerPerson` de la convocatoria. 40 es lo que ya dimensionan galería, catálogo y plano (pregunta abierta para Daniel). |
| D7 | **Estados de una obra del expositor** (texto): `DRAFT` (borrador, la edita el expositor), `SUBMITTED` (enviada; el expositor puede retirarla y volver a borrador mientras nadie la revisó), `CHANGES_REQUESTED` (quien organiza pidió cambios con una nota; el expositor la corrige y la reenvía), `APPROVED` (en la muestra; **bloqueada** para el expositor) y `REMOVED` (quien organiza la sacó de la muestra). Una obra aprobada a la que se le piden cambios **sigue publicada con los datos anteriores** hasta que se vuelve a aprobar. Reglas puras `exhibitorWorkTransition`. | El expositor no puede cambiar en silencio algo que ya está impreso en una ficha. Pedir cambios no saca la obra de la sala. |
| D8 | **Lo aprobado se copia a `CulturalActivityWork`** (imagen, título, autor = nombre del expositor, `authorUserId`, `authorProfileId` = su perfil, año, técnica, al final del orden) y la obra del expositor guarda `activityWorkId` **sin FK**, igual que `CulturalCallWork.activityWorkId` (el editor de la muestra borra y vuelve a crear sus obras conservando los ids). Volver a aprobar actualiza esa fila por id. Se aprueba dentro de una transacción con `SELECT … FOR UPDATE` sobre la muestra (como armar desde la convocatoria) y en los mismos estados en que se puede editar la ficha (`canEdit`: no "en revisión"). | Todo lo construido (galería, página de obra, fichas, marcos, catálogo, plano, estadísticas, piezas) ya trabaja sobre `CulturalActivityWork`: no se toca. Los datos que la tabla no tiene (medidas, edición, precio, statement) se leen de la obra del expositor por `activityWorkId`. |
| D9 | **Convivencia con el editor de la muestra.** En `guardarBorrador`, una obra que vino de un expositor **conserva su imagen y su autor** (el servidor ignora lo que llegue del formulario; el editor los muestra como "Lo carga quien expone"); título, año y técnica sí se editan y **se copian de vuelta** a la obra del expositor (y lo mismo en `guardarTextos` del rol de textos). Si el editor la quita de la galería, la obra del expositor pasa a `REMOVED` con la nota "La organización la sacó de la muestra" (mismo lugar donde hoy se marca `OBRA_QUITADA_DE_LA_GALERIA` para la convocatoria). | Una sola versión de los textos en los dos lados; la imagen y la autoría son del expositor. |
| D10 | **El enlace anda con la muestra en borrador, rechazada, en revisión, publicada y despublicada**; no anda si la muestra está **cancelada**, **ya cerró** o no es de tipo muestra. Aprobar obras sigue la regla de D8 (no "en revisión"). Enviar obras nuevas requiere el enlace abierto y antes de la fecha límite; corregir una obra con cambios pedidos se puede siempre que la muestra no esté cancelada ni cerrada. | Las obras se juntan **antes** de mandar la muestra a revisión: Daniel aprueba una muestra que ya tiene sus obras. |
| D11 | **Permisos.** Capacidad nueva **`exhibitors`** (dueño y coorganización): generar y cerrar el enlace, topes, ver expositores y obras, aprobar, pedir cambios, corregir datos, sacar. El rol de textos **no** la tiene. **El expositor no es un rol del equipo**: sólo ve y edita lo suyo (`CulturalExhibitor.userId = usuario.id`, estado `ACTIVE`), nunca la muestra en el panel ni las obras de otros. Puede ser también del equipo (un colectivo que organiza y expone). | Mantiene la tabla de capacidades de la etapa 5 (una línea por capacidad). La organización necesita a la coorganización para juntar obras. |
| D12 | **Sin correo.** Todo se ve en pantalla: el expositor ve el estado de cada obra y la nota en "Donde expongo" (`/panel/expositor`); quien organiza ve un contador "3 obras para revisar" en la muestra y en "Mis muestras". Los correos ("Te pidieron cambios", "Aprobaron tu obra") quedan fuera de alcance. | El correo está apagado en producción (`MUESTRAS_CORREOS_EN_VIVO`). |

### Sorpresa: visibilidad por punto de entrada

| # | Decisión | Por qué |
|---|---|---|
| D13 | **Un ajuste por muestra**, en una columna `visibility JSONB` de `CulturalActivity` (vacía = como hasta hoy, ver D16). Forma (`v: 1`): `preset`; `online` (`exhibited`: `ALL` \| `HIGHLIGHTS` \| `RANDOM` \| `NONE`, `randomCount` 1–12, `rotation`: `FIXED` \| `DAILY`, `seed`, `artists` sí/no, `otherWorks` sí/no); `profile` (`exhibited`: `LIKE_ONLINE` \| `NONE`, `otherWorks` sí/no); `room` (`exhibited`: `SCANNED` \| `ARTIST` \| `ALL`, `otherWorks`, `otherExhibitions`, `buy` sí/no); `revealAfterClose` sí/no. Se lee **siempre** con `parseVisibility(json, galleryMode)`, que devuelve un ajuste completo y válido aunque la columna venga rota. | Una columna JSON es una sola migración y no multiplica columnas que todo `include` de la muestra tiene que leer. La regla pura es la única que interpreta el JSON. |
| D14 | **Presets** (lo que ve quien organiza, en castellano): **"Adelanto"** (`PREVIEW`: 3 obras al azar fijas, artistas con biografía y sus otras obras, perfil como lo online, QR: la obra + las del mismo artista + otras obras + otras muestras + compra, se revela todo al cerrar), **"Sorpresa total"** (`SURPRISE`: igual pero ninguna expuesta online), **"Destacadas"** (`HIGHLIGHTS`: las destacadas hasta el cierre, como hasta hoy), **"Todo a la vista"** (`OPEN`), y **"Personalizado"** (`CUSTOM`, se abren todas las opciones). Elegir un preset reescribe todo; tocar cualquier opción pasa a "Personalizado". | Daniel pidió que sea simple de entender. Cuatro frases cubren los casos reales; el detalle queda a un clic. |
| D15 | **Al azar: un sorteo fijo, no por visita.** Las obras online salen de ordenar las expuestas por `stableHash("muestras-sorpresa:v1:<seed>:<id>")` y tomar las primeras N (se muestran en el orden de la galería). `seed` es un valor al azar que se crea al elegir "al azar" y que cambia con **"Volver a sortear"**. Opción **"Cambia cada día"** (`DAILY`): la clave suma el día argentino (`toArDay(now)`). Por defecto, **fijo** (`FIXED`). **No** se sortea en cada visita, ni en el servidor ni en el navegador. | (1) **Caché**: las páginas públicas son ISR (`revalidate = 300`); un sorteo determinista da la misma respuesta en la galería, la página de obra, el perfil, las piezas y los metadatos, y vale para todo el período de caché. (2) **Filtración**: sortear en el navegador obliga a mandarle **todas** las obras (con sus URL del bucket) y elegir allí: cualquiera las ve en el código de la página. Sortear en el servidor en cada visita hace la página dinámica y basta con recargar veinte veces para ver toda la muestra. (3) Con "cada día", en una muestra de 30 días con 20 obras y 3 por día se termina viendo casi todo: el panel lo advierte ("Con los días, quien vuelve seguido termina viendo más obras"). El fijo nunca muestra más de N. |
| D16 | **Muestras existentes y nuevas sin ajuste** (`visibility` vacía): se comportan **exactamente como hoy** (`galleryMode` `FULL` → "Todo a la vista"; si no → "Destacadas"), con el QR y el perfil del preset. Al **generar el enlace de expositores** por primera vez, si la muestra no tiene ajuste, se guarda **"Adelanto"** y el panel lo dice ("Elegimos 'Adelanto'… podés cambiarlo en Visibilidad"). En la ficha, el control "Mostrar todas las obras mientras está abierta" se reemplaza por un enlace a **Visibilidad** cuando la muestra ya tiene ajuste (y el servidor deja de escribir `galleryMode` desde el formulario en ese caso). | No cambia nada de lo publicado sin que nadie lo pida. La sorpresa es parte del pedido de los expositores: se enciende con ellos. |
| D17 | **Una sola regla para todo lo público.** `visibleWorks` (galería), `workAccess` (página de obra), `profileWorksInActivity` (perfil) y la lista de obras de "Obra destacada" (piezas para redes) pasan a leer el ajuste. Las páginas no deciden: llaman a la regla. Una obra **oculta** online: no aparece en la galería, ni en el perfil, ni en "anterior/siguiente", ni en los metadatos (`og:image`), ni en las piezas; su página `/m/<slug>/o/<id>` muestra **el aviso sin imagen** (título y autor, `noindex`), como el `TEASER` de hoy. | Evita que la galería, el perfil y la página de obra se contradigan (lo mismo que buscaba `workAccess` en la etapa 4). |
| D18 | **"Artistas" en la página de la muestra** (si `online.artists`): una tarjeta por artista con al menos una obra **expuesta** en la muestra (aunque esté oculta): foto, nombre, ciudad, biografía (primeros 280 caracteres + "Ver perfil") y, si `online.otherWorks`, **sus fotos adicionales** de obras aprobadas (miniaturas que abren el visor existente; sin página propia). Salen de los expositores con obras aprobadas y, en muestras sin expositores, de los perfiles vinculados a las obras. | Es lo que pidió Daniel: conocer al artista sin ver lo que cuelga en la sala. |
| D19 | **Perfil público** (`/fotografos/<slug>`): por cada muestra, las expuestas según `profile.exhibited` (y la regla online), y si `profile.otherWorks`, una fila **"Otras obras"** con sus adicionales de esa muestra. "Y 3 obras más para ver en la sala" se mantiene (sólo un número). | Mismo criterio que la página de la muestra. |
| D20 | **Después del cierre** (`revealAfterClose`, por defecto **sí**): la galería pasa a "Archivo de la muestra" con todas las expuestas, como hasta hoy. Con "no", la reserva sigue (para quien quiera itinerar la muestra). | La reserva sirve mientras se puede ir a la sala; después, el archivo es lo que queda. |
| D21 | **Capacidad nueva `visibility`** (dueño y coorganización) para la página `/panel/muestras/<id>/visibilidad` y la acción `guardarVisibilidad`. Al guardar se revalidan la muestra, sus obras y `/fotografos`. **Aviso** si la portada de la muestra es la misma imagen que una obra expuesta oculta ("La portada es una de las obras que reservás para la sala"). | La portada se ve siempre (listado, mapa, metadatos): es la única filtración que la regla no puede evitar sola. |

### QR de la sala y pase

| # | Decisión | Por qué |
|---|---|---|
| D22 | **El pase se da sólo desde un código de sala**, no desde el id de la obra. Cada obra expuesta tiene un **código de sala** al azar (12 caracteres de un alfabeto sin ambiguos, ≈ 60 bits) en la tabla `CulturalActivityRoomCode` (`code` PK, `activityId` FK cascade, `workId` **sin FK**, único `(activityId, workId)`), creado al generar las fichas. Las fichas imprimen el QR **`/q/s/<código>`**. `/q/o/<id>` sigue andando como en la etapa 4 (cuenta y lleva a la página pública) **pero no da pase**. | **El id de la obra no es secreto**: el de cada obra visible online está en la galería, en su dirección y en la baliza. Si `/q/o/<id>` diera pase, cualquiera tomaría el id de una obra visible y, con "QR: toda la muestra" o "las del mismo artista", vería las ocultas desde su casa. El código sólo está impreso en la sala. La etapa 4 todavía no está en producción, así que no hay fichas con `/q/o` impresas allí; las fichas de la etapa 2 (QR directo a la página) siguen llevando a la versión pública. |
| D23 | **El pase es una cookie firmada**, no un token en la dirección: `/q/s/<código>` cuenta el escaneo, agrega la obra a la cookie **`mf_sala_<activityId>`** (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, **8 horas**) y redirige (302, `no-store`) a **`/m/<slug>/sala/o/<obra>`**. Contenido: versión, muestra, vencimiento y los ids escaneados (hasta 40), firmado con **HMAC-SHA256** y una **llave por muestra** guardada en `CulturalActivityRoomKey` (32 bytes al azar, creada sola la primera vez). Cada escaneo renueva las 8 horas. Sin variables de entorno nuevas. | Una dirección con token se comparte por WhatsApp con el token adentro. La cookie queda en el teléfono que escaneó: **si alguien comparte la dirección**, quien la abre no tiene el pase y va a la versión pública (D24). Firmar en vez de guardar cada pase evita una escritura por escaneo y una tabla que crece. La llave por muestra en la base evita configurar un secreto en Vercel. |
| D24 | **Vista de sala** `/m/<slug>/sala/o/<obra>` (y `/m/<slug>/sala` con lo escaneado): **dinámica**, `noindex`, `referrer: no-referrer`, `Cache-Control: private, no-store`. Con pase válido de esa muestra (o si quien mira es del equipo o super admin: "Ver como en la sala" en el panel): la obra con su foto, sus datos completos (medidas, edición, texto), el **artista** (foto, biografía completa, enlaces), **sus otras obras de la muestra** según `room.exhibited`, **sus fotos adicionales** (`room.otherWorks`), **las otras muestras donde expuso** (`room.otherExhibitions`, con lo que cada una deja ver online) y la **entrada de compra** (`room.buy`). **Sin pase** (o vencido, o de otra muestra, o la obra no entra en el alcance): redirige a `/m/<slug>/o/<obra>` (la versión pública, que respeta la sorpresa). Las páginas públicas siguen siendo ISR: **ninguna lee cookies**. | Separar la vista de sala de la página pública mantiene la caché y hace imposible que una página cacheada sirva a otra persona lo que vio quien tenía el pase. |
| D25 | **Las imágenes de la vista de sala no muestran la dirección del bucket**: se sirven por `/m/<slug>/sala/img/<id>` (obra expuesta o foto adicional), que valida el pase y devuelve los bytes desde R2 (`leerDeR2`, como la imagen anónima de la curaduría) con `Cache-Control: private, max-age=600`, `Referrer-Policy: no-referrer` y `X-Content-Type-Options: nosniff`. Freno por IP `imagenSala` 600 cada 10 min. | El bucket es público y sus direcciones no vencen: si la página mostrara la URL de R2, copiarla saltearía las 8 horas para siempre. El proxy hace que lo que se ve en la sala venza con el pase. |
| D26 | **Riesgo residual aceptado.** (1) Quien tiene el pase puede sacar capturas: inevitable, y es alguien que ya está en la sala. (2) Una **foto del QR** publicada en redes da pase a quien la escanee: la ficha física es el secreto. Para cortarlo: **"Cortar los accesos de sala"** (rota la llave: todos los pases vigentes dejan de valer) y **"Cambiar los códigos de sala"** (borra los códigos; hay que reimprimir las fichas). (3) Sin cookies (navegador muy restringido) el escaneo lleva a la versión pública. (4) Copiar la cookie a otro teléfono exige saber hacerlo y vence en 8 horas. | Es el equilibrio que pidió Daniel: el QR de la sala muestra todo, lo online cuida la sorpresa, y el pase vence en horas. |
| D27 | **Entrada de compra** (sólo si `room.buy` y la obra está marcada "La quiero vender"): "A la venta · $ 120.000" y el texto "Para comprarla, consultá a la organización en la sala." Componente `EntradaDeCompra` con estados `NONE` y `ASK` (la etapa de Ventas suma `BUY`, que llevará al pago con DNX Payments). El precio **nunca** se muestra en la publicación online en esta etapa. | La venta (etapa 7) depende del Split 1:N de Mercado Pago, que todavía no tiene orden productiva. El dato queda cargado y el punto de entrada, en su lugar. |
| D28 | **QR y estadísticas.** `/q/s/<código>` cuenta un **escaneo** de esa obra (métrica `SCAN`, como `/q/o`), con los mismos frenos y sin contar al equipo. La vista de sala manda la baliza de visita de la obra. | Las estadísticas por obra siguen siendo una sola columna para quien organiza. |

### Panel y otras piezas

| # | Decisión | Por qué |
|---|---|---|
| D29 | **Panel.** En la muestra: **"Expositores"** (`/panel/muestras/<id>/expositores`: enlace, topes, lista de expositores con sus obras, estados y acciones) y **"Visibilidad"** (`/panel/muestras/<id>/visibilidad`). Para quien expone: sección nueva **"Donde expongo"** (`/panel/expositor`, grupo "Tu cuenta", `ready: true`) y `/panel/expositor/<id>` (sus obras de esa muestra). Entrada pública `/expositores/<token>`. | Daniel quiere todo a la vista y construido. |
| D30 | **Fichas, catálogo y plano usan los datos del expositor**: la ficha suma "Medidas" y "Edición" (p. ej. "40 × 60 cm. Edición 2/10") y su QR pasa a `/q/s/<código>`; el catálogo suma medidas, edición y el texto de la obra; el editor del plano **propone** la medida con marco del expositor al colgar la obra (sigue editable). El precio **no** va en fichas ni catálogo en esta etapa (pregunta para Daniel: lista de precios aparte). | El expositor ya cargó lo que el montajista necesita: no hay que volver a tipearlo. |
| D31 | **Piezas para redes**: "Obra destacada" sólo ofrece obras **visibles online hoy** según el ajuste (D17); con "Sorpresa total" la variante no está disponible ("Con 'Sorpresa total' no se difunden obras de la sala") y el panel sugiere la pieza "Inaugura". | Una pieza para redes es publicación online. |
| D32 | **Convocatoria (etapa 3)**: una muestra puede tener convocatoria, enlace de expositores o los dos. Las obras elegidas en la convocatoria entran como hoy (son expuestas y respetan la sorpresa) pero **no** tienen fotos adicionales ni medidas. **Fuera de alcance**: "invitar a las personas seleccionadas como expositoras" (un botón que las sume con sus obras ya aprobadas). | Son dos caminos distintos (con y sin selección). Unirlos es una mejora clara, pero no hace falta para el pedido. |
| D33 | **Sin dependencias nuevas.** `node:crypto` (HMAC, `timingSafeEqual`, `randomBytes`), `sharp`, `pdf-lib`, `qrcode` y `@aws-sdk/client-s3` ya están. | Una dependencia nueva mueve el lockfile de todas las apps. |

**Capacidades por rol** (se suman a la tabla de la etapa 5):

| Capacidad | Para qué | Dueño | Coorganización | Textos |
|---|---|---|---|---|
| `exhibitors` | Enlace de expositores, topes, aprobar, pedir cambios, corregir, sacar | ✓ | ✓ | |
| `visibility` | Visibilidad (sorpresa), cortar accesos de sala, cambiar códigos | ✓ | ✓ | |

## Ajustes por defecto (lo que pidió Daniel)

| Punto de entrada | "Adelanto" (por defecto al usar expositores) | "Sorpresa total" | "Destacadas" (muestras sin ajuste) | "Todo a la vista" |
|---|---|---|---|---|
| Publicación online: obras expuestas | 3 al azar, fijas | ninguna | destacadas (hasta 12) | todas |
| Publicación online: artistas con biografía | sí | sí | sí | sí |
| Publicación online: otras obras del artista | sí | sí | sí | sí |
| Perfil del artista: expuestas | como lo online | ninguna | como lo online | como lo online |
| Perfil del artista: otras obras | sí | sí | sí | sí |
| QR de la sala: expuestas | la escaneada + las del mismo artista | ídem | ídem | ídem |
| QR de la sala: otras obras, otras muestras, compra | sí | sí | sí | sí |
| Después del cierre | se ve todo | se ve todo | se ve todo | se ve todo |

## Datos (migración aditiva, a mano)

`20261031120000_muestras_etapa_6_expositores` (ordena después de
`20261030120000_muestras_etapa_5_difusion`).

- **`CulturalActivity`** suma **una** columna: `visibility JSONB` (optativa). Relaciones inversas
  `exhibitorLink`, `exhibitors`, `roomCodes`, `roomKey` (sin columnas).
- **`CulturalExhibitorLink`**: `id` cuid, `activityId` único (FK cascade), `token` único, `status`
  (`OPEN` \| `CLOSED`, por defecto `OPEN`), `closesAt TIMESTAMP(3)?` (fin del día argentino),
  `maxWorksPerExhibitor INT DEFAULT 3`, `maxPhotosPerWork INT DEFAULT 3`, `maxExhibitors INT DEFAULT
  30`, `instructions TEXT?` (≤ 1500), `createdByUserId INT`, `createdAt`, `updatedAt`,
  `rotatedAt?`.
- **`CulturalExhibitor`**: `id` cuid, `activityId` (FK cascade), `userId INT` (sin relación),
  `profileId` (FK a `PhotographerProfile`, `ON DELETE SET NULL`), `displayName`, `status`
  (`ACTIVE` \| `REMOVED`), `rightsAcceptedAt`, `joinedAt`, `removedAt?`, `removedByUserId INT?`.
  Único `(activityId, userId)`; índices `(userId, status)` y `(profileId)`.
- **`CulturalExhibitorWork`**: `id` cuid, `exhibitorId` (FK cascade), `activityId` (FK cascade,
  para consultar por muestra sin pasar por el expositor), `status` (`DRAFT` por defecto),
  `imageUrl`, `title`, `year INT?`, `technique TEXT?`, `imageWidthCm`, `imageHeightCm`,
  `frameWidthCm`, `frameHeightCm` (`DOUBLE PRECISION?`, un decimal), `edition TEXT?`
  (`UNIQUE`\|`LIMITED`\|`OPEN`\|`NA`), `editionNumber INT?`, `editionSize INT?`, `statement TEXT?`,
  `forSale BOOLEAN DEFAULT false`, `priceArs INT?`, `hangingNotes TEXT?`, `sortOrder INT DEFAULT 0`,
  `reviewNote TEXT?`, `activityWorkId TEXT?` (sin FK, D8), `submittedAt?`, `reviewedAt?`,
  `reviewedByUserId INT?`, `createdAt`, `updatedAt`. Índices `(exhibitorId, sortOrder)`,
  `(activityId, status)`, `(activityWorkId)`.
- **`CulturalExhibitorPhoto`**: `id` cuid, `workId` (FK a `CulturalExhibitorWork`, cascade),
  `imageUrl`, `title`, `year INT?`, `technique TEXT?`, `caption TEXT?`, `sortOrder INT DEFAULT 0`,
  `createdAt`. Índice `(workId, sortOrder)`.
- **`CulturalActivityRoomCode`**: `code TEXT` PK, `activityId` (FK cascade), `workId TEXT` (sin FK),
  `createdAt`. Único `(activityId, workId)`.
- **`CulturalActivityRoomKey`**: `activityId TEXT` PK (FK cascade), `secret TEXT` (64 hex),
  `createdAt`, `rotatedAt?`. **Nunca** se incluye en una consulta pública: se lee sólo en
  `lib/sala/llave.ts`.

Sin enums, ids de usuario `Int` sin relación a `User`, no toca filas existentes (la columna nueva es
optativa: Postgres no reescribe la tabla). La SQL completa está en la Task 4 del plan y se compara
con `prisma migrate diff`. **La aplica a mano en producción el controlador, antes de publicar el
código** (Neon `divine-hall-10689679`, rama `development`), **después** de las de las etapas 4 y 5,
y la registra en `_prisma_migrations` con el SHA-256 del archivo. Una columna de `CulturalActivity`
sin aplicar **rompe todo el sitio de Muestras**.

## Rutas

| Ruta | Quién | Qué |
|---|---|---|
| `/expositores/[token]` | público; para sumarse, con sesión | Datos de la muestra, instrucciones, topes, fecha límite; "Ingresá con Google" o el formulario de alta (D3). `noindex`, `no-referrer`. Enlace viejo o cerrado: "Este enlace ya no recibe expositores". |
| `/panel/expositor` | con sesión | "Donde expongo": mis participaciones, con el estado de cada obra. |
| `/panel/expositor/[id]` | el expositor | Sus obras de esa muestra: foto principal, datos, fotos adicionales, enviar, retirar, ver la nota de cambios. |
| `/panel/muestras/[id]/expositores` | `exhibitors` | Enlace (copiar, generar nuevo, cerrar, fecha límite, topes, instrucciones), expositores y obras, aprobar, pedir cambios, corregir, sacar. |
| `/panel/muestras/[id]/visibilidad` | `visibility` | Presets, personalizado, volver a sortear, vista previa "qué ve cada uno", cortar accesos, cambiar códigos, "Ver como en la sala". |
| `/q/s/[código]` (dentro de `/q/[tipo]/[id]`) | público | Cuenta el escaneo, da el pase y redirige a la vista de sala (D22, D23). |
| `/m/[slug]/sala`, `/m/[slug]/sala/o/[workId]` | con pase (o equipo) | Vista de sala (D24). Dinámica, privada. |
| `/m/[slug]/sala/img/[id]` | con pase (o equipo) | Imagen por proxy (D25). |
| `/m/[slug]` | público | Galería según la sorpresa; sección "Artistas". |
| `/m/[slug]/o/[workId]` | público | Según la sorpresa; oculta → aviso sin imagen. |
| `/fotografos/[slug]` | público | Según el ajuste del perfil; "Otras obras". |
| `/api/redes/[id]` | `promote` | "Obra destacada" sólo con obras visibles online. |
| `/api/fichas/[id]`, `/api/piezas/[id]/[pieza]` | `pieces` | Fichas con `/q/s/<código>`, medidas y edición; catálogo con los datos del expositor. |

## Permisos (todo del lado del servidor)

- Cada `page.tsx` llama `requireUsuario(<su propia ruta>)` salvo las públicas (`/expositores/[token]`
  lo pide recién para sumarse; la vista de sala usa el pase). Toda negativa en el panel es
  `notFound()`.
- Cada acción vuelve a leer la sesión y, según el caso, el rol (`rolEnMuestra` + `can`) o la fila del
  expositor **en la base**. Sacar a un expositor corta en el próximo pedido.
- Acciones nuevas: `crearEnlaceExpositores`, `guardarEnlaceExpositores`, `renovarEnlaceExpositores`,
  `cerrarEnlaceExpositores` (`exhibitors`); `sumarmeComoExpositor` (enlace abierto, sesión, derechos);
  `guardarObraDeExpositor`, `borrarObraDeExpositor`, `enviarObraDeExpositor`,
  `retirarObraDeExpositor` (el expositor, sobre lo suyo); `aprobarObraDeExpositor`,
  `pedirCambiosObraDeExpositor`, `corregirObraDeExpositor`, `sacarObraDeExpositor`,
  `sacarExpositor` (`exhibitors`); `guardarVisibilidad`, `volverASortear`, `cortarAccesosDeSala`,
  `cambiarCodigosDeSala` (`visibility`).
- Imágenes: la foto de una obra o adicional tiene que ser **de quien la carga** (`esImagenDeUsuario`:
  `<R2>/muestras/<userId>/<id>.webp`, el mismo control que la convocatoria).
- Frenos por persona: `sumarseExpositor` 20/h, `guardarObraExpositor` 300/h, `enviarObraExpositor`
  60/h, `revisarExpositores` 600/10 min, `guardarVisibilidad` 60/h, `enlaceExpositores` 30/h. Por
  huella de IP: `paginaExpositores` 60/10 min, `imagenSala` 600/10 min, `vistaSala` 300/10 min. El
  freno `qr` existente cubre `/q/s` (el código de 60 bits no se puede adivinar con ese ritmo).

## Privacidad y filtraciones (lista de control)

Una obra expuesta **oculta** según el ajuste no puede aparecer en ningún lugar público. Lugares
revisados y cómo quedan:

| Lugar | Riesgo | Cómo queda |
|---|---|---|
| Galería de `/m/<slug>` (HTML y datos del componente cliente) | La URL de R2 de una obra oculta en el HTML o en la carga del componente | Al cliente viaja sólo lo que devuelve `visibleWorks` (ya era así; ahora la regla mira el ajuste). Test que renderiza la página y busca la URL oculta. |
| `/m/<slug>/o/<id>` | Imagen u `og:image` de una oculta | `workAccess` con el ajuste → aviso sin imagen, `noindex`, sin `og:image`. |
| Anterior / siguiente | Ids de ocultas | Sólo entre visibles (ya era así). |
| `/fotografos/<slug>` | Miniaturas de ocultas | `profileWorksInActivity` con el ajuste; sólo el número de las reservadas. |
| Sección "Artistas" | Mezclar expuestas con adicionales | Sólo `CulturalExhibitorPhoto` de obras aprobadas; las expuestas nunca. |
| Piezas para redes "Obra destacada" | Difundir una oculta | Sólo visibles online (D31). |
| Metadatos (`og:image` de la muestra) | La portada es una obra oculta | Aviso en Visibilidad (D21). |
| Mapa del sitio, robots | Indexar ocultas | No hay `sitemap.ts` en la app; las páginas de ocultas son `noindex`; la vista de sala es `noindex` y dinámica. |
| `/q/o/<id>` | Pase desde un id público | No da pase (D22). |
| `/q/s/<código>` | Adivinar códigos | 60 bits + freno `qr` por IP. |
| Vista de sala compartida | Que el enlace muestre lo oculto | Sin cookie → versión pública (D24). |
| Imágenes de la vista de sala | Copiar la URL del bucket | Proxy con pase (D25). |
| Baliza `/api/visitas` | Confirmar que existe una obra | Responde siempre 204 (ya era así). |
| Rutas del panel y API (`/api/fichas`, `/api/piezas`, `/api/redes`) | Ver ocultas sin permiso | Capacidades de la etapa 5; son para quien organiza. Los PDF grandes en R2 tienen clave con hash (etapa 4, D4). |
| Panel del expositor | Ver obras de otros expositores | Consultas siempre con `exhibitorId` propio. |
| Caché ISR | Que una página cacheada muestre lo del pase | Las páginas públicas no leen cookies; la vista de sala es `no-store`. |
| Precio | Mostrar precios online | Sólo en la vista de sala (D27). |

Además: la cookie del pase no identifica a la persona (muestra, vencimiento e ids de obras); es
necesaria para la función y no se usa para contar. `/privacidad` suma un párrafo sobre el pase de
sala y otro sobre los datos de los expositores (perfil público, quién ve las notas de montaje y el
precio).

## Reglas puras nuevas en `packages/muestras` (con tests)

- `visibility.ts`: tipos, presets y etiquetas, `parseVisibility`, `visibilityFromPreset`,
  `presetOf`, `onlineExhibitedWorks` (todas/destacadas/al azar fijo o por día/ninguna, revelar al
  cerrar), `roomExhibitedWorks`, `visibilitySummary` (textos "qué ve cada uno"),
  `coverIsHiddenWork`.
- `gallery.ts`, `work-access.ts`, `profile.ts`: `visibleWorks`, `workAccess` y
  `profileWorksInActivity` leen `visibility` (firma compatible: la muestra suma `visibility`).
- `exhibitors.ts`: límites y textos, `exhibitorLinkState`, `exhibitorJoinProblems`,
  `exhibitorWorkInput`/`exhibitorWorkProblems` (D5), `exhibitorPhotoProblems`,
  `exhibitorWorkTransition` (D7), `editionText`, `sizeText`, `priceText`, `toActivityWork` (D8),
  `pendingReviewCount`.
- `room.ts`: `ROOM_CODE_ALPHABET`, `isRoomCode`, `newRoomCode(random)`, `ROOM_PASS_HOURS = 8`,
  `roomPassPayload`, `encodeRoomPass`/`decodeRoomPass` (sin firma: la firma es de la app),
  `mergeRoomPass`, `roomPassValid`, `buyEntry`.
- `team.ts`: capacidades `exhibitors` y `visibility`.
- `stats.ts`: tipo de QR `s` (escaneo de obra).
- `panel.ts`: sección "Donde expongo".

## Riesgos

- **Columna sin aplicar** en `CulturalActivity` (`visibility`) rompe todo el sitio: la migración (y
  antes las de las etapas 4 y 5) va antes del deploy.
- **Fichas ya impresas**: las de la etapa 2 (QR directo a la página de la obra) llevan a la versión
  pública; con "Sorpresa total" quien escanea ve el aviso sin imagen. Hay que **reimprimir las fichas**
  para el pase de sala. El panel lo dice en Visibilidad.
- **Foto del QR en redes** (D26): da pase a quien la escanee. Se corta rotando la llave y, si sigue,
  cambiando los códigos (reimpresión).
- **Webviews de lectores de QR** (cámara de Instagram, Lens): la cookie vive en ese navegador
  interno; si la persona abre después el enlace en otro navegador, ve la versión pública.
- **Tráfico del proxy de imágenes**: cada vista de sala baja la imagen por la función (≈ 300–600 KB,
  2000 px WebP). Con el público de una sala es poco; si una muestra tuviera miles de escaneos por
  día, se vería en el costo de Vercel.
- **Sorteo y obras nuevas**: con "al azar", aprobar una obra nueva puede cambiar cuáles se ven (si
  su clave queda entre las primeras N). Es raro y no filtra más de N.
- **Copias de textos**: título, año y técnica viven en dos tablas (D9); las acciones las mantienen
  iguales, pero un cambio hecho a mano en la base en una sola no se copia.
- **Enlace guardado tal cual** (D1): una copia de la base deja sumarse como expositor a quien la
  tenga; nada se publica sin aprobación.
- **Freno en memoria** = "N por instancia" (mismo límite conocido de las etapas 1 a 5).

## Fuera de alcance

Correos a expositores (cambios pedidos, aprobada); invitaciones personales por email a cada
expositor; convertir seleccionados de la convocatoria en expositores; venta y pago (etapa de Ventas:
la entrada de compra queda preparada); lista de precios imprimible; originales en alta para
imprimir; que el expositor descargue sus fichas; fotos adicionales con página propia; ordenar
artistas a mano; pase de sala desde el cartel o el catálogo; varias llaves o pases por persona;
estadísticas de la vista de sala aparte de las de la obra.

## Preguntas para Daniel

1. **Ajuste por defecto al usar expositores**: ¿"Adelanto" (3 al azar fijas) o "Sorpresa total"
   (ninguna)? ¿Y 3 es un buen número?
2. **Duración del pase de sala**: 8 horas (alcanza para la visita y para mirar de nuevo esa noche).
   ¿Más o menos?
3. **Tope de 40 obras por muestra**: con 15 expositores y 3 obras cada uno ya se pasa. ¿Lo subimos
   (hay que mirar catálogo y plano) o alcanza?
4. **Fotos adicionales**: ¿por obra (otras de la serie, como está diseñado) o un portfolio por
   artista, independiente de las obras?
5. **Precio**: ¿se muestra en la vista de sala desde ya (como está diseñado) o sólo cuando exista la
   venta? ¿Querés una lista de precios impresa?
6. **Reimprimir fichas**: el pase de sala necesita las fichas nuevas (QR `/q/s/…`). ¿Lo avisamos en el
   panel de cada muestra publicada o sólo en Visibilidad?
