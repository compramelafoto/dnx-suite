# Muestras Fotográficas — Etapa 7: del concurso de FotoRank a la muestra

Fecha: 2026-10-10 · Estado: diseño con las respuestas de Daniel del mismo día (permiso por bases,
preseleccionados = finalistas, botón en el panel de resultados de FotoRank) y lo que mostró la
exploración de FotoRank (la publicación oficial de resultados está trabada en producción). Diseño general:
`docs/superpowers/specs/2026-10-08-muestras-fotograficas-design.md` (sección "Concurso → muestra
(etapa 5)": la numeración quedó corrida y ahora es la **Etapa 7**; decisiones 9 y 12 del diseño
general). Etapa anterior: `docs/superpowers/specs/2026-10-10-muestras-etapa-6-design.md` (las etapas
1 a 6 están en producción).
Plan: `docs/superpowers/plans/2026-10-10-muestras-etapa-7-fotorank.md`.

> La plataforma es el soporte digital de una muestra **presencial**. Esta etapa resuelve un caso muy
> concreto: una organización termina su concurso en FotoRank, publica los resultados y quiere
> **colgar en una sala** las obras ganadoras y preseleccionadas. Hoy tendría que bajar cada foto,
> volver a cargarla en Muestras y escribir a mano autor, premio y categoría. Con esta etapa aprieta
> **"Armar muestra"** y recibe un **borrador de muestra** con todo eso cargado.

## Qué se construye

1. **"Armar muestra" en FotoRank** (decisión de Daniel). En el panel de resultados del concurso
   (`/dashboard/concursos/<id>/resultados`), cuando los resultados están **cerrados por el jurado o
   publicados** (lote `FINALIZED` o `PUBLISHED`), aparece un recuadro "Llevá los ganadores a una
   muestra" con el botón **"Armar muestra"**, que abre Muestras Fotográficas en la página del
   concurso. Antes dice "Cuando el jurado cierre los resultados vas a poder armar una muestra con las
   obras". Es lo único que cambia en el panel de FotoRank.
2. **"Concursos" en el panel de Muestras** (`/panel/concursos`, grupo "Para organizar"). Lista los
   concursos de FotoRank de las organizaciones donde la persona organiza y que ya tienen resultados
   cerrados o publicados. Por cada concurso: cuántos ganadores, menciones y preseleccionados hay, y si ya armó
   una muestra con él. Desde ahí (o llegando por el botón de FotoRank) elige **qué niveles traer**
   (ganadores, menciones, preseleccionados) y si arma **una muestra nueva** o suma las obras a **una
   muestra suya** que todavía se puede editar.
3. **Borrador de muestra con las obras.** Se crea una muestra en borrador (tipo `MUESTRA`) con título,
   descripción y organización tomados del concurso, y una fila por obra con: título, autor (cuenta
   de FotoRank, que es la misma cuenta de Muestras), **premio y categoría** ("1.er premio · Paisaje",
   "Mención de honor · Retrato", "Preseleccionada · Paisaje") y el **orden del ranking** (categoría,
   premio, puesto).
4. **Las imágenes se copian** del bucket privado de FotoRank al bucket de Muestras (`muestras/`), por
   tandas, con el enlace firmado que FotoRank ya ofrece a FOTOFFICE. Así la muestra no depende de que
   el concurso siga existiendo, y la sala, las fichas y el catálogo usan la misma imagen de siempre
   (WebP de 2000 px).
5. **Panel "Del concurso"** en cada muestra armada así (`/panel/muestras/<id>/concurso`): por obra,
   **"Galería virtual"** (entra a la muestra), **"Se imprime"** (va a fichas, marcos, plano y
   catálogo) y **"A la venta"** (sólo queda marcado y se le pregunta al autor: la venta es otra
   etapa); el estado de la copia de la imagen y del **permiso del autor**; un **enlace para copiar**
   por autor; y **"Actualizar desde FotoRank"**.
6. **Permiso del autor** (diseño general, decisión 12; decisión de Daniel). Si las bases que el
   autor aceptó en FotoRank autorizan exhibir su obra (`allowExhibition`), la obra entra sin clic y
   el autor **se entera** en "Dónde expongo", donde puede **sacarla**. Si no, la obra entra recién
   cuando el autor **acepta con un clic**. Como la muestra es **la primera vez que el nombre del
   autor se hace público** (FotoRank publica sólo códigos anónimos), el nombre aparece si las bases
   piden atribución (`attributionRequired`) o si el autor lo confirma (D28). La venta **siempre** pide un clic aparte. Todo en pantalla, sin
   correo (el correo de Muestras sigue apagado en producción).
7. **Enlaces cruzados.** La página pública de la muestra dice **"Muestra del concurso X"** con
   enlace a los resultados en FotoRank; la página de resultados (y la del concurso, mientras está
   abierta) de FotoRank dice **"Ver la muestra en la sala"**, con nombre, lugar y fechas de cada muestra
   **publicada** que salió del concurso.
8. **Portada de Muestras.** El ítem "O conectá tu concurso de {FOTORANK} y llevá a la sala a los
   ganadores y preseleccionados." pasa a ser verdadero; se ajusta a "O traé los ganadores y
   preseleccionados de tu concurso de {FOTORANK}: te armamos el borrador de la muestra con sus
   obras." (`apps/muestras/lib/portada/funciones.ts`).

## Lo que encontramos en FotoRank (base compartida)

FotoRank, FOTOFFICE y Muestras usan **la misma base** (Neon `divine-hall-10689679`, rama
`development`) y **la misma tabla `User`**: el `authorUserId` de una obra de FotoRank es la cuenta con
la que esa persona entra a Muestras. Las maratones de Clickatón viven en otra base
(`baseDelConcurso` de FotoRank las busca por el cliente cruzado) y **quedan fuera**: desde Muestras no
se encuentran (y si una aparece en la base propia como `experienceType = MARATHON`, se rechaza con un
mensaje claro, D5).

**Publicación oficial trabada.** La exploración de FotoRank mostró que hoy, en producción, la
publicación oficial de resultados (lote `PUBLISHED` con `metadata.publication.status = "LIVE"`) sólo
funcionó como prueba en staging. Por eso esta etapa **no exige** `LIVE`: usa el **último lote
`FINALIZED` o `PUBLISHED`**, la misma fuente que ya usan los diplomas, las imágenes de ganadores y la
tienda de FOTOFFICE. Esa fuente sólo la ve la organización del concurso; lo que se hace público es la
muestra, que pasa por su propia revisión y publicación en Muestras.

| Tema | Dónde está | Qué significa para esta etapa |
|---|---|---|
| Concurso | `FotorankContest` (`id` cuid, `organizationId`, `title`, `slug` único **por organización**, `status` enum, `visibility` `PUBLIC`/`PRIVATE`/`UNLISTED`, `shortDescription`, `coverImageUrl`) | Se lee por `id`. La URL pública es `/concursos/<slug>`. |
| Categorías | `FotorankContestCategory` (`name`, `sortOrder`, `status`) | Nombre de la categoría en el premio y orden. |
| Obra | `FotorankContestEntry` (`authorUserId Int?` con relación a `User`, `title?`, `categoryId`, `status` `CONFIRMED`/`REJECTED`/`WITHDRAWN`/…, `withdrawnAt`, `activeAssetId`, `registrationId`, `anonymousJuryCode`) | Título y autor. Una obra `REJECTED`/`WITHDRAWN` o retirada no se trae. |
| Imagen | `FotorankContestEntryAsset` (`ORIGINAL`, `JURY_PREVIEW` de ~2000 px) en un **R2 privado de FotoRank**. Ruta firmada `GET /api/fotorank/external/entry-image` (HMAC con `DNX_FOTORANK_LINK_SECRET`): `variant=original` responde 302 a una descarga de R2 de 120 s (hasta ~25 MB); `variant=preview` devuelve un JPEG de 1600 px **con marca de agua** (lo que usa la tienda). | Muestras no tiene llaves del bucket de FotoRank: usa esa ruta, como la tienda de FOTOFFICE (`apps/fotoffice/lib/store/artworks/fotorank-client.ts`). Se copia el **original** (la vista previa trae marca de agua y no sirve para la sala; el `JURY_PREVIEW` sin marca no se ofrece por la ruta). **FotoRank no cambia.** |
| Resultados | `FotorankResultBatch` (`status` `DRAFT…FINALIZED`/`PUBLISHED`/`CANCELLED`, `finalizedAt`, `publishedAt`, `metadata` JSON) y `FotorankResultEntry` (`resultStatus` `WINNER`/`MENTION`/`FINALIST`/`RANKED`/`TIED`/`DISQUALIFIED`/`NOT_SELECTED`…, `awardType` `FIRST_PLACE`/`SECOND_PLACE`/`THIRD_PLACE`/`FINALIST`/`HONORABLE_MENTION`/`SPECIAL_MENTION`/`PEOPLE_CHOICE`/`SPONSOR_AWARD`/`CUSTOM`, `finalPosition`, `categoryId`, `coverageStatus`, puntajes, `anonymousCode`) unido a la obra por `FotorankJuryEntrySnapshot.entryId`. | Fuente de esta etapa: **el último lote `FINALIZED` o `PUBLISHED`** (D1). |
| Publicación oficial | `getPublicResultsPayload` (`apps/fotorank/app/lib/fotorank/results/public-results-payload.ts`): lote `PUBLISHED` + `metadata.publication.status === "LIVE"`, con `winnerSelections`/`finalistSelections` en la metadata. **Hoy trabada en producción** (sólo anduvo una publicación de prueba en staging). La página pública `/concursos/<slug>/resultados` muestra **sólo códigos anónimos**; `metadata.publicCreditsPolicy` dice si se mostrarían nombres. | No se exige `LIVE`. Consecuencia: **la muestra es la primera vez que se publican los nombres de los autores** (D28). |
| "Preseleccionados" | En el código de FotoRank no existe la palabra; lo que hay son **finalistas**: `resultStatus = FINALIST` o `awardType = FINALIST` en el lote (y `finalistSelections` en la metadata de publicación). `FotorankFinalistSnapshot`/`FotorankFinalistPackage` son otra cosa: el paquete **para votación del público** por consigna (maratones), con códigos públicos y "finalista ≠ ganador". | **Decisión de Daniel:** preseleccionados = finalistas del lote. No se usan los paquetes de votación. |
| Otra lista de ganadores | `listContestWinners` (`apps/fotorank/app/lib/fotorank/design/winners.ts`, imágenes para redes), los diplomas (`diplomas/resolveRecipients.ts`) y la tienda (`awardsByEntry`, `bestAward` y `authorNames` en `apps/fotoffice/lib/store/artworks/catalog.ts` y `catalog-rules.ts`) usan el lote **`FINALIZED` o `PUBLISHED`**, `FotorankResultEntry.awardType`/`resultStatus` y excluyen `DISQUALIFIED`. | Misma regla, copiada como regla pura en `packages/muestras` (no se importa código de otra app). |
| Organizadores | `ContestOrganization` y `ContestOrganizationMember` (`role` `OWNER`/`ADMIN`/`EDITOR`/`JUDGE`/`VIEWER`, `status` `ACTIVE`/…). El panel resuelve la organización activa con `resolveActiveOrganizationForUser`. | Puede armar una muestra un **miembro `ACTIVE` con rol `OWNER`, `ADMIN` o `EDITOR`** de la organización del concurso, o el super admin. Jurados y lectores no. |
| Super admin | `isGlobalSuperAdmin(user)` de `@repo/auth` (`globalRole` o `role` = `SUPER_ADMIN`), igual en las dos apps. | Mismo criterio. |
| Bases que aceptó el autor | `FotorankContestEntry.registration.rulesVersion.configurationVersion.configurationJson.rights` (`allowExhibition`, `allowPublication`, `allowCatalog`, `allowPrint`, `allowCommercial`, `attributionRequired`…, tipos en `apps/fotorank/app/lib/fotorank/rules-config/types.ts`). La tienda lo lee con `rightsAcceptedByAuthor` (`apps/fotoffice/lib/store/artworks/consent.ts`). | Decide si alcanza con avisar o hay que pedir permiso (D14). Se leen **las bases que firmó ese autor**, no las vigentes. |
| Nombre del autor | `FotorankProfile.displayName` y, si no hay, `User.name` (como `authorNames` de la tienda). | Nombre inicial; el autor lo cambia al aceptar. |
| Anonimato | El jurado ve obras por `anonymousCode`; nombres, puntajes, notas del jurado y votos nunca salen en lo público (`PUBLIC_RESULTS_FORBIDDEN_KEYS`). | Muestras **no lee** códigos anónimos, puntajes, votos, jurados ni notas. Lee premio, nivel, categoría y puesto final del lote cerrado por el jurado. |
| Panel del concurso | `apps/fotorank/app/(dashboard)/dashboard/concursos/[id]/resultados/page.tsx` (resultados y publicación, con el chequeo de organización y super admin); `ganadores/page.tsx` (imágenes para redes); `ContestDashboard.tsx` (botones del concurso); rutas en `apps/fotorank/app/lib/routes.ts`. El menú lateral por perfil no se toca. | El botón va en **resultados**. |
| Páginas públicas | `apps/fotorank/app/concursos/[slug]/page.tsx` (sólo concursos `PUBLISHED`/`ACTIVE`; un concurso terminado da 404) y `apps/fotorank/app/concursos/[slug]/resultados/page.tsx` (dinámica). | "Ver la muestra" va en las dos; la de resultados es la que sigue viva cuando el concurso termina. |

## Decisiones

### Origen y permisos

| # | Decisión | Por qué |
|---|---|---|
| D1 | **Fuente: el último lote `FINALIZED` o `PUBLISHED`** del concurso (ordenado por `finalizedAt`, después `publishedAt`), como diplomas, imágenes de ganadores y tienda. No se exige la publicación `LIVE` porque hoy está trabada en producción. De ese lote: resultados con `resultStatus` `WINNER`/`MENTION`/`FINALIST` o con `awardType`; **nunca** `DISQUALIFIED` ni `NOT_SELECTED`/`RANKED` sin premio. Nivel: `HONORABLE_MENTION`/`SPECIAL_MENTION` o `MENTION` → menciones; `FINALIST` → preseleccionados; el resto de los premios → ganadores. Sin lote así: "Este concurso todavía no tiene resultados cerrados por el jurado" y no hay botón. | Es la fuente que ya usa todo FotoRank. La ve sólo la organización del concurso; lo público es la muestra, que pasa por su revisión en Muestras. |
| D2 | **Quién arma** (pregunta 4 abierta): miembro `ACTIVE` con rol `OWNER`/`ADMIN`/`EDITOR` de la organización del concurso (`ContestOrganizationMember`), o super admin. En Muestras, quien arma queda como **responsable** de la muestra nueva (`proposedByUserId`). Para sumar obras a una muestra existente hay que ser su responsable. Capacidad nueva **`contest`** (sólo dueño): armar, actualizar, opciones por obra y enlaces a autores. La coorganización **ve** el panel "Del concurso" (capacidad `view`) pero no lo cambia. | El concurso es de la organización; la muestra, de quien la arma. Una sola persona responde ante los autores. |
| D3 | **El permiso se vuelve a leer en cada acción**, en la base: la membresía en la organización del concurso y el rol en la muestra. Si a alguien lo sacan de la organización, ya no puede actualizar desde FotoRank (sigue siendo responsable de la muestra que armó). | Mismo criterio que las etapas 5 y 6. |
| D4 | **Lo que se lee de FotoRank** (nunca más): concurso (`id`, `title`, `slug`, `shortDescription`, `visibility`, `experienceType`, `organizationId`, nombre de la organización), categorías (`id`, `name`, `sortOrder`), lote (`id`, `status`, `finalizedAt`, `publishedAt`, `updatedAt`), de cada resultado `juryEntrySnapshotId`, `categoryId`, `awardType`, `resultStatus`, `finalPosition`, `preliminaryPosition`, y de cada obra `id`, `title`, `entryNumber`, `authorUserId`, `status`, `withdrawnAt` y las `rights` de las bases que aceptó. **Nunca** `anonymousCode`, puntajes, votos, jurados, notas, email ni teléfono del autor. El nombre del autor sale de `FotorankProfile.displayName` o `User.name` (como `authorNames` de la tienda). Obras `REJECTED`, `WITHDRAWN`, `REPLACED` o con `withdrawnAt` no se traen. | Lista cerrada: el test de la Task 5 revisa los `select`. |
| D5 | **Sólo concursos propios de FotoRank.** Las maratones viven en la base de Clickatón y desde Muestras no se encuentran. Si el concurso no está en la base o es `experienceType = MARATHON` (o `distributionChannel` de Clickatón): "Las maratones de Clickatón todavía no se pueden llevar a una muestra. Escribinos y lo vemos." En FotoRank, el recuadro "Armar muestra" no aparece en maratones (`baseDelConcurso(...).esDeClickaton` o `experienceType = MARATHON`). | Una sola base, sin cliente cruzado. |

### Armado

| # | Decisión | Por qué |
|---|---|---|
| D6 | **Tres tablas nuevas, ninguna columna nueva en tablas existentes** (ver Datos): `CulturalContestImport` (una por muestra), `CulturalContestWork` (una por obra traída) y `CulturalContestAuthor` (una por autor y muestra). Como en la etapa 6, **lo que entra a la muestra se copia a `CulturalActivityWork`** y la fila del concurso guarda `activityWorkId` **sin FK**; los datos que esa tabla no tiene (premio, categoría, "se imprime", venta, permiso) se leen por `activityWorkId`. Sin FK a tablas de FotoRank: borrar un concurso no frena ni rompe nada (las imágenes ya son copias). | Todo lo construido (galería, sorpresa, fichas, marcos, plano, catálogo, estadísticas, piezas) ya trabaja sobre `CulturalActivityWork`. Una columna nueva en `CulturalActivity` sin aplicar tumba todo el sitio; tablas nuevas, no. |
| D7 | **Niveles a traer**, elegidos al armar: **Ganadores** (1.º, 2.º y 3.er premio) y **Menciones** (mención, mención especial) marcados por defecto; **Preseleccionados** sin marcar. Se pueden cambiar después con "Actualizar desde FotoRank". Una obra en varios niveles (dos categorías) aparece una vez, con su mejor premio. Tope: el técnico de la muestra (**300**, `MAX_WORKS`); si no entran, se avisa cuántas sobran y no se arma. | Lo común es colgar ganadores y menciones; los preseleccionados suelen ser muchos. |
| D8 | **Muestra nueva:** `MUESTRA`, en borrador, título "Muestra <título del concurso>", descripción = `shortDescription` del concurso (o "Las obras premiadas y seleccionadas de <concurso>, organizado por <organización>."), organiza = nombre de la organización, sin sede, fechas provisorias (desde dentro de 30 días, por 30 días) con el aviso "Revisá fechas y sede: las pusimos provisorias". La ficha incompleta no se puede mandar a revisión (reglas de siempre). **Muestra existente:** del dueño, tipo `MUESTRA`, editable (`canEdit`), sin otro concurso ya importado (una importación por muestra; un concurso puede alimentar varias muestras, p. ej. una itinerante). | Lo único que falta para publicar es lo que sólo sabe quien organiza: sede, fechas y textos. |
| D9 | **Datos por obra** al traerla: `entryId`, autor (`authorUserId`, `authorName`), título (o "Obra <número>"), nivel (`WINNER`/`MENTION`/`FINALIST`), `awardType`, categoría (`categoryId`, `categoryName`), texto del premio (`distinction`: "1.er premio · Paisaje"; sin categoría si el concurso tiene una sola; "Preseleccionada · Paisaje" para finalistas), orden del ranking (`rank`: categoría por `sortOrder`, después premio, después puesto). Año y técnica vacíos (los completa quien organiza o el autor en el editor). | El premio es el dato que el público más mira en la sala. |
| D10 | **Idempotente.** Única `(activityId, entryId)`. Armar dos veces con la misma muestra o "Actualizar desde FotoRank" **sólo agrega lo que falta**; todo dentro de una transacción con `SELECT … FOR UPDATE` sobre la muestra (como el armado desde la convocatoria). Una obra que quien organiza **sacó** (desde el panel o desde el editor) queda con `include = false` y no se vuelve a sumar sola. | Doble clic, dos pestañas o actualizar no duplican nada. |
| D11 | **Cambios en FotoRank después de armar.** Se guarda el lote usado (`resultBatchId` y su `updatedAt`, en `sourceVersion`). Si el último lote `FINALIZED`/`PUBLISHED` es otro (o cambió), el panel dice "Los resultados de FotoRank cambiaron desde que armaste la muestra" y ofrece **"Actualizar desde FotoRank"**, que: suma las obras nuevas (si su nivel está elegido); actualiza premio, categoría y orden de las que siguen; marca **"Ya no figura en los resultados del concurso"** (`sourceStatus = GONE`) las que salieron, quedaron descalificadas o que FotoRank rechazó o retiró, **sin sacarlas** de la muestra (decide quien organiza, con un botón al lado). Si ya no queda ningún lote válido (p. ej. el jurado reabrió y el lote quedó `CANCELLED`), no se puede actualizar y se avisa; la muestra no cambia. El título de la obra no se pisa. | La sala puede estar impresa: nada desaparece solo. |
| D12 | **Imágenes copiadas por tandas** (como la tienda de FOTOFFICE). Muestras firma con `DNX_FOTORANK_LINK_SECRET` (**variable nueva en el proyecto de Vercel de Muestras**, mismo valor que en FotoRank y FOTOFFICE; la carga Daniel) un enlace `variant=original` de 10 minutos, lo baja (sigue el 302 de R2; hasta 30 MB; 30 s de espera), lo pasa por `procesarImagen(…, "obra")` (2000 px, WebP, sin EXIF) y lo sube a **`muestras/<authorUserId>/fr-<entryId>.webp`** (clave fija: copiar dos veces pisa el mismo objeto). **6 imágenes por pedido** (≈ 3 s cada una); el panel sigue pidiendo mientras queden ("Copiando imágenes: 12 de 40"). Una que falla queda `FAILED` con "No pudimos traer la imagen de FotoRank" y "Reintentar". El módulo de firma se **copia** a `apps/muestras/lib/concursos/firma.ts`, idéntico (mismo vector fijo de test que las otras dos copias). | Copiar es más seguro que enlazar: la muestra vive más que el concurso y no expone el bucket privado. Por tandas porque 300 imágenes no entran en una función. Sin dependencias nuevas. |

### Qué entra a la muestra y qué se imprime

| # | Decisión | Por qué |
|---|---|---|
| D13 | **Tres casillas por obra** (las de la decisión 9 del diseño general): **"Galería virtual"** (la obra **está en la muestra**: se copia a `CulturalActivityWork` y lo que se ve online lo decide Visibilidad, la sorpresa de la etapa 6), **"Se imprime"** (entra en fichas, marcos, plano y catálogo; sin marcar, la obra está sólo online) y **"A la venta"** (sólo se guarda y se le pregunta al autor; no hay precio ni botón de compra en esta etapa). Por defecto: galería y se imprime marcadas, venta sin marcar. Sacar "Galería virtual" saca la obra de la muestra (y desmarca "Se imprime"). | Respeta las tres decisiones por obra del diseño general sin tocar la regla de visibilidad de la etapa 6. |
| D14 | **Cuándo entra una obra a la muestra:** marcada "Galería virtual", con la **imagen ya copiada** y con el **permiso de exhibición** resuelto: bases que autorizan (`RULES`) y el autor no la sacó, o el autor **aceptó** (`ACCEPTED`). **Decisión de Daniel:** si las bases que el autor firmó tienen `rights.allowExhibition = true` → base `RULES`: la obra entra sin esperar un clic, el autor la ve en "Dónde expongo" con "Las bases que aceptaste autorizan exponerla" y puede **sacarla** ("Prefiero que no se exponga"). Si no (o si las bases no se pueden leer) → base `EXPLICIT`: entra recién cuando el autor **acepta**. Una regla pura `contestWorkInGallery` decide; se aplica al armar, al copiar cada imagen, al cambiar una casilla y al responder el autor, siempre con la muestra bloqueada. | La decisión 12 del diseño general ("se exhibe si las bases lo autorizan") con aceptación cuando las bases no alcanzan. Sin correo, "avisar" es que el autor lo vea en su panel y el enlace que le manda quien organiza. |
| D15 | **Venta:** siempre explícita. Si quien organiza marca "A la venta", el autor ve "¿Aceptás que esta obra se ofrezca a la venta? Antes de vender te vamos a mostrar el precio y el reparto para que los confirmes." (`saleConsent` `PENDING` → `ACCEPTED`/`DECLINED`, con la fecha). Ninguna página pública cambia: la venta llega en la etapa de Ventas, que va a pedir confirmar precio y reparto. | Decisión 12 del diseño general: ganar no autoriza a vender. |
| D16 | **Sacar una obra.** Desde el panel ("Sacar de la muestra") o desde el editor de la muestra (quitarla de la galería): la fila queda `include = false`, `activityWorkId = null`. Si **el autor** la saca (o no acepta): `exhibitConsent = WITHDRAWN`/`DECLINED`, se borra la obra de la muestra y quien organiza lo ve ("El autor prefirió que no se exponga"). Una obra que el autor sacó **no se puede volver a sumar** sin que acepte de nuevo (puede cambiar de opinión desde su panel mientras la muestra no cerró). | Quien expone decide sobre lo suyo; quien organiza decide qué cuelga. |
| D17 | **Convivencia con el editor** (como la etapa 6, D9). Una obra del concurso **conserva su imagen y su autor** en `guardarBorrador` (el servidor ignora lo que llegue del formulario; el editor muestra "Viene del concurso"); título, año y técnica sí se editan. El orden lo decide el editor después de armar. Quitarla en el editor = D16. | Una sola galería, una sola forma de ordenarla. |

### El autor

| # | Decisión | Por qué |
|---|---|---|
| D18 | **"Dónde expongo"** (`/panel/expositor`) suma la sección **"Tus obras de concursos"**: una fila por muestra donde hay obras suyas traídas de un concurso, con el nombre del concurso, la muestra (fechas, lugar si ya está) y cuántas obras necesitan su respuesta. Cada fila abre **`/panel/expositor/concurso/<id>`** (`id` = `CulturalContestAuthor.id`). | Mismo lugar donde ya mira quien expone por enlace (etapa 6). |
| D19 | **Página del autor:** la muestra (título, organiza, fechas, sede o "Sede a confirmar"), el texto "<Organización> armó una muestra con obras de <concurso> y quiere exponer las tuyas." y, por obra, la imagen copiada, título, premio, y su estado con los botones: `EXPLICIT` pendiente → **"Acepto que se exponga"** / **"Prefiero que no"**; `RULES` → "Las bases que aceptaste autorizan exponerla." + **"Prefiero que no se exponga"**; aceptada o `RULES` → "Ya no quiero que se exponga" (mientras la muestra no cerró); venta (D15). La primera vez que acepta (o en cualquier momento) completa **"Cómo firmás"** y su **perfil de fotógrafo** con el mismo formulario de la etapa 6 (`crearOActualizarPerfil`), y sus obras pasan a apuntar al perfil (`authorProfileId`) y a ese nombre. Texto de la aceptación, versionado como `RIGHTS_TEXT` (constante `CONTEST_EXHIBIT_TEXT` con `CONTEST_EXHIBIT_TEXT_VERSION`): "Autorizo a exponer esta obra en la muestra, mostrarla online según lo que elija la organización e imprimir su ficha, su marco y el catálogo, con mi nombre como autor/a." | Reutiliza el alta de la etapa 6 sin pedir un enlace por muestra. |
| D20 | **Sólo la cuenta del autor.** La página exige sesión (`requireUsuario`) y que `CulturalContestAuthor.userId` sea la cuenta que entra; si no, "Este enlace es para otra cuenta. Entrá con la cuenta con la que participaste en el concurso." (sin mostrar el email). Por eso **no hace falta token**: el id de la fila no da acceso a nada sin la cuenta. | Las imágenes todavía no publicadas y las respuestas son sólo del autor. |
| D21 | **Enlace para mandar.** En el panel "Del concurso", por autor: el enlace completo (`APP_URL/panel/expositor/concurso/<id>`) con "Copiar enlace" y "Copiar mensaje" (texto listo para WhatsApp: "Hola <nombre>, con <organización> armamos una muestra con obras de <concurso> y queremos exponer la tuya. Entrá con la misma cuenta de FotoRank y confirmá acá: <enlace>"), y la marca **"Ya se lo mandé"** (`notifiedAt`, sólo para quien organiza). Cuando el correo de Muestras se encienda, se podrá mandar desde ahí (fuera de alcance). | El correo de Muestras está apagado en producción (`MUESTRAS_CORREOS_EN_VIVO`). |
| D22 | **Autor sin cuenta en FotoRank** (`authorUserId` vacío; sólo pasa con obras viejas o importadas): la obra se trae con el nombre en texto, base `EXPLICIT` y la nota "No tiene cuenta: no puede responder desde la plataforma. Si te autorizó por escrito, marcalo." → botón **"Tengo su autorización por escrito"** (quien organiza la confirma; queda `ACCEPTED` con `consentBy = ORGANIZER`). Igual para un autor con cuenta que respondió por otro medio. | Caso borde que no puede trabar una muestra. |

### Público y FotoRank

| # | Decisión | Por qué |
|---|---|---|
| D23 | **El premio en lo público:** página de la obra (`/m/<slug>/o/<id>`), vista de sala y visor de la galería muestran la línea **"1.er premio · Paisaje — <Concurso>"**; la ficha de sala y el catálogo la agregan arriba de los datos; el marco no (sólo título y autor). Sale de `distinctionsForWorks(activityId, workIds)` por `activityWorkId`, como los datos del expositor. Respeta la sorpresa: una obra oculta online no muestra nada. | Lo publica la muestra, ya revisada en Muestras; es lo que la sala exhibe igual. |
| D24 | **"Muestra del concurso X"** en la página pública de la muestra, debajo de "Organiza": "Muestra del concurso <título>" con enlace a `<FOTORANK_PUBLIC_BASE_URL>/concursos/<slug>` (por omisión `https://fotorank.dnxsuite.com`) **sólo** si el concurso sigue existiendo, es `PUBLIC` y su página pública está abierta (`PUBLISHED`/`ACTIVE`); si no, el texto sin enlace (un concurso terminado da 404 en FotoRank y sus resultados oficiales no están publicados). | Cierra el círculo hacia FotoRank. |
| D25 | **"Ver la muestra en la sala" en FotoRank:** en `/concursos/<slug>` (mientras esté abierto) y en `/concursos/<slug>/resultados` (en las dos ramas: con resultados oficiales publicados y con "Resultados todavía no publicados", que es lo que hoy ven todos) un bloque **"Muestras del concurso"**: por cada muestra **publicada** (`reviewStatus = APPROVED`, no cancelada, tipo `MUESTRA`) que salió del concurso: título, sede y ciudad, fechas y "Ver la muestra" (`MUESTRAS_PUBLIC_BASE_URL/m/<slug>`, por omisión `https://muestrasfotograficas.com`). Lo arma `muestrasDelConcurso(contestId)`, que **nunca rompe la página**: cualquier error (por ejemplo, la migración todavía no aplicada) devuelve una lista vacía y no muestra nada. | FotoRank está en producción con concursos reales (SFEF hasta el 31/10): el cambio no puede tumbar la página. |
| D26 | **Cambios en FotoRank, todos chicos y aditivos:** (1) `lib/fotorank/external/muestras.ts` (dos funciones: URL de Muestras y `muestrasDelConcurso`), (2) `components/contest-public/MuestrasDelConcurso.tsx`, (3) una línea en `concursos/[slug]/page.tsx` y en `concursos/[slug]/resultados/page.tsx`, (4) el recuadro "Armar muestra" en `(dashboard)/dashboard/concursos/[id]/resultados/page.tsx` (sólo si hay lote `FINALIZED` o `PUBLISHED`, el concurso no es una maratón y la persona es `OWNER`/`ADMIN`/`EDITOR` de la organización o super admin), (5) el comentario de `entry-image-signing.ts` que lista las copias del módulo (tres en vez de dos). **Ninguna escritura de FotoRank cambia**, ninguna ruta existente cambia de forma, sin variables obligatorias nuevas. | FotoRank en producción. Decisión de Daniel: el botón está en el panel de resultados de FotoRank y lleva a Muestras, donde vive todo lo demás. |
| D27 | **Sin dependencias nuevas.** `node:crypto`, `sharp` y `@aws-sdk/client-s3` ya están en Muestras. | El lockfile es de todas las apps. |
| D28 | **Crédito del autor (primera vez que su nombre es público).** FotoRank publica sólo códigos anónimos, así que la muestra es la primera publicación del nombre. Regla pura `authorCredit({ attributionRequired, consentBy, signed })`: se muestra el nombre (perfil de FotoRank o cuenta, o "Cómo firmás" si lo completó) si las bases que firmó piden atribución (`rights.attributionRequired = true`) **o** si el autor confirmó en "Dónde expongo" (aceptó, o completó "Cómo firmás"), **o** si la organización marcó su autorización escrita. Si no, la obra figura como **"Autoría reservada"** (`authorName` en la muestra) sin perfil vinculado, y pasa al nombre en cuanto se cumple una condición. El panel "Del concurso" lo dice por obra ("Se va a ver su nombre" / "Autoría reservada hasta que el autor confirme"). Mismo criterio que la tienda (`authorCredit` de `catalog-rules.ts`). | Publicar el nombre es un dato personal: lo autorizan las bases o el autor. |

**Capacidades por rol** (se suma a la tabla de las etapas 5 y 6):

| Capacidad | Para qué | Dueño | Coorganización | Textos |
|---|---|---|---|---|
| `contest` | Armar desde un concurso, actualizar, casillas por obra, sacar, enlaces a autores, "autorización por escrito" | ✓ | | |

La coorganización ve el panel "Del concurso" en modo lectura (`view`).

## Estados (texto)

- `CulturalContestWork.tier`: `WINNER` | `MENTION` | `FINALIST`.
- `CulturalContestWork.imageStatus`: `PENDING` | `COPIED` | `FAILED`.
- `CulturalContestWork.sourceStatus`: `CURRENT` | `GONE`.
- `CulturalContestWork.exhibitBasis`: `RULES` | `EXPLICIT`.
- `CulturalContestWork.exhibitConsent`: `PENDING` | `ACCEPTED` | `DECLINED` | `WITHDRAWN` (con `RULES` empieza en `ACCEPTED` con `consentBy = RULES`).
- `CulturalContestWork.consentBy`: `RULES` | `AUTHOR` | `ORGANIZER`.
- `CulturalContestWork.saleConsent`: `NOT_ASKED` | `PENDING` | `ACCEPTED` | `DECLINED`.
- Transiciones en la regla pura `contestConsentTransition(action, work)`: `accept`, `decline`, `withdraw`, `reconsider` (autor), `writtenConsent` (organización), `askSale`/`cancelSale` (organización), `acceptSale`/`declineSale` (autor).

## Datos (migración aditiva, a mano)

`20261101120000_muestras_etapa_7_fotorank` (ordena después de `20261031120000_muestras_etapa_6_expositores`).

- **`CulturalContestImport`**: `id` cuid, `activityId` **único** (FK cascade a `CulturalActivity`), `contestId TEXT` (sin FK), `contestSlug`, `contestTitle`, `organizationId TEXT`, `organizationName`, `tiers TEXT[]` (niveles elegidos), `resultBatchId TEXT`, `resultBatchStatus TEXT` (`FINALIZED`/`PUBLISHED`), `sourceVersion TIMESTAMP(3)` (`updatedAt` del lote usado), `createdByUserId INT`, `createdAt`, `updatedAt`, `syncedAt TIMESTAMP(3)`. Índice `(contestId)`.
- **`CulturalContestWork`**: `id` cuid, `importId` (FK cascade), `activityId` (FK cascade), `entryId TEXT`, `authorUserId INT?`, `authorName`, `title`, `tier`, `awardType TEXT?`, `categoryId TEXT`, `categoryName`, `distinction`, `rank INT`, `sourceStatus` (`CURRENT`), `sourceImageAt TIMESTAMP(3)?` (cuándo se copió), `imageStatus` (`PENDING`), `imageUrl TEXT?`, `imageError TEXT?`, `include BOOLEAN DEFAULT true`, `toPrint BOOLEAN DEFAULT true`, `forSale BOOLEAN DEFAULT false`, `exhibitBasis`, `attributionRequired BOOLEAN DEFAULT false` (de las bases que firmó, D28), `exhibitConsent`, `consentBy TEXT?`, `consentAt TIMESTAMP(3)?`, `saleConsent` (`NOT_ASKED`), `saleConsentAt?`, `activityWorkId TEXT?` (sin FK), `createdAt`, `updatedAt`. Único `(activityId, entryId)`; índices `(importId, rank)`, `(authorUserId)`, `(activityWorkId)`, `(activityId, imageStatus)`.
- **`CulturalContestAuthor`**: `id` cuid, `importId` (FK cascade), `activityId` (FK cascade), `userId INT?`, `authorName`, `profileId` (FK a `PhotographerProfile`, `ON DELETE SET NULL`), `displayName TEXT?` (cómo firma, al aceptar), `notifiedAt?`, `respondedAt?`, `textVersion TEXT?`, `createdAt`, `updatedAt`. Único `(activityId, userId)` (las filas sin cuenta tienen `userId` nulo: una por obra); índices `(userId)`, `(importId)`.

Sin enums, ids de usuario `Int` sin relación a `User`, **sin columnas nuevas en tablas existentes** y sin FK hacia tablas de FotoRank. La SQL completa está en la Task 3 del plan. **La aplica a mano en producción el controlador, antes de publicar el código** (Neon `divine-hall-10689679`, rama `development`), y la registra en `_prisma_migrations` con el SHA-256 del archivo. Como FotoRank comparte el schema, su cliente Prisma también conoce las tablas nuevas; FotoRank sólo las **lee**, y siempre dentro de `try/catch`.

## Rutas

| Ruta | App | Quién | Qué |
|---|---|---|---|
| `/dashboard/concursos/[id]/resultados` | FotoRank | organización | Recuadro "Armar muestra" (D26). |
| `/concursos/[slug]`, `/concursos/[slug]/resultados` | FotoRank | público | "Muestras del concurso" (D25). |
| `/panel/concursos` | Muestras | con sesión | Concursos con resultados cerrados o publicados de tus organizaciones; `?concurso=<id>` abre ese. |
| `/panel/concursos/[contestId]` | Muestras | organización del concurso | Niveles, muestra nueva o existente, "Armar la muestra". |
| `/panel/muestras/[id]/concurso` | Muestras | `contest` (dueño); `view` en lectura | Imágenes, casillas, permisos, enlaces, actualizar. |
| `/panel/expositor` | Muestras | con sesión | Suma "Tus obras de concursos". |
| `/panel/expositor/concurso/[id]` | Muestras | el autor | Aceptar, sacar, venta, perfil (D19). |
| `/m/[slug]`, `/m/[slug]/o/[workId]`, sala | Muestras | público / pase | Premio y "Muestra del concurso" (D23, D24). |
| `/api/fichas/[id]`, `/api/piezas/[id]/[pieza]` | Muestras | `pieces` | Premio en fichas y catálogo; sin las obras "sólo online" (D13). |

## Permisos (todo del lado del servidor)

- Cada `page.tsx` nueva del panel llama `requireUsuario(<su ruta>)`. Toda negativa es `notFound()`.
- `puedeArmarDesdeConcurso(usuario, contestId)` (lee `ContestOrganizationMember` `ACTIVE` con rol `OWNER`/`ADMIN`/`EDITOR` de la organización del concurso, o super admin) en la página del concurso y en `armarMuestraDesdeConcurso` y `actualizarDesdeConcurso`.
- `rolEnMuestra` + `puede(usuario, "contest", rol)` en el panel "Del concurso" y en cada acción (`copiarImagenesDelConcurso`, `guardarOpcionesDeObra`, `sacarObraDelConcurso`, `marcarAutorizacionEscrita`, `marcarEnlaceMandado`).
- Autor: la fila `CulturalContestAuthor` con `userId = usuario.id` en `responderComoAutor`, `guardarFirmaDeAutor`.
- Frenos por persona: `armarDesdeConcurso` 10/h, `actualizarConcurso` 30/h, `copiarImagenesConcurso` 600/10 min, `opcionesConcurso` 600/10 min, `respuestaAutor` 120/h.

## Privacidad y filtraciones (lista de control)

| Lugar | Riesgo | Cómo queda |
|---|---|---|
| Lectura de FotoRank | Traer resultados que no son del jurado | Sólo el último lote `FINALIZED`/`PUBLISHED`; sin `DISQUALIFIED`; obras rechazadas o retiradas fuera (D1, D4). Test con lote `DRAFT`, `REVIEW_REQUIRED`, `CANCELLED` y descalificadas. |
| Lectura de FotoRank | Romper el anonimato del jurado | Ningún `select` pide `anonymousCode`, puntajes, votos, jurados ni notas (D4). Test sobre los `select`. |
| Muestra pública | Nombre del autor publicado por primera vez | Sólo con atribución en las bases, confirmación del autor o autorización escrita; si no, "Autoría reservada" (D28). |
| Maratones | Leer otra base | No se usa el cliente cruzado; mensaje claro (D5). |
| `/panel/concursos` | Ver concursos de otra organización | Sólo organizaciones con membresía `ACTIVE` `OWNER`/`ADMIN`/`EDITOR`. |
| Imágenes | Exponer el bucket privado de FotoRank | Se copian; la URL firmada vive 10 minutos y nunca llega al navegador. |
| Imágenes copiadas | Verse antes del permiso | La URL de una obra sin permiso sólo la ven el dueño de la muestra (panel) y el autor (su página); no está en `CulturalActivityWork`, así que ninguna página pública la conoce. |
| Página del autor | Que otra cuenta responda | Exige `userId` igual a la sesión (D20). |
| `/m/<slug>` y obra | Premio de una obra oculta | Sólo obras visibles según la sorpresa (D23). |
| FotoRank público | Mostrar muestras en borrador | Sólo `APPROVED`, no canceladas (D25). |
| Precio | — | No existe en esta etapa. |

## Reglas puras nuevas en `packages/muestras` (con tests)

- `contest.ts`: `CONTEST_TIERS`, `CONTEST_TIER_LABELS`, `DEFAULT_CONTEST_TIERS`, `CONTEST_IMAGE_BATCH = 6`, `CONTEST_EXHIBIT_TEXT` (+ versión), `SALE_CONSENT_TEXT`; `pickResultBatch(batches)` (último `FINALIZED`/`PUBLISHED`), `tierOf({ resultStatus, awardType })`, `contestSelections(resultEntries)` (ganadores, menciones y preseleccionados, sin descalificadas, sin repetir, con el mejor premio), `awardText(awardType, tier)`, `distinctionText({ tier, awardType, categoryName, singleCategory })`, `rankContestWorks(rows, categories)`, `rightsFromConfigurationJson(json)`, `exhibitBasisFromRights(rights)`, `authorCredit(...)`, `planContestImport({ selected, existing, tiers, galleryCount })` (crear, actualizar, marcar `GONE`, sobrantes), `contestWorkInGallery(row)`, `contestConsentTransition(action, row, ctx)`, `authorPendingCount(rows)`, `contestShareMessage(...)`.
- `team.ts`: capacidad `contest` (sólo `OWNER`); `panel.ts`: sección "Concursos" (`/panel/concursos`, grupo "Para organizar").

## Riesgos

- **Migración sin aplicar**: las tablas nuevas no rompen el resto del sitio (ninguna columna en tablas existentes), pero el panel "Concursos" y el bloque de FotoRank fallarían: el de FotoRank está protegido (D25); la migración va igual **antes** del deploy.
- **Nombres sin autorización**: si las bases no piden atribución y el autor no responde, la obra
  sale como "Autoría reservada" (D28); quien organiza lo ve y puede mandar el enlace otra vez.
- **`DNX_FOTORANK_LINK_SECRET` sin cargar en Muestras**: el armado anda, pero las imágenes quedan `FAILED` con "Falta configurar la conexión con FotoRank (avisale a la administración)". El panel lo dice arriba.
- **Lote finalizado que cambia**: un lote `FINALIZED` puede reemplazarse si el jurado reabre. Por eso la muestra guarda qué lote usó y avisa (D11); y como la muestra sólo es pública después de su revisión en Muestras, un cambio antes de publicar no llega al público.
- **Originales grandes** (25 MB, más de 50 megapíxeles): `procesarImagen` los rechaza; la obra queda `FAILED` con el motivo. Si pasa seguido, se puede pedir `variant=preview`… pero trae marca de agua: no sirve para la sala.
- **Tiempo de copia**: 300 obras ≈ 50 pedidos de 6; el panel tiene que quedar abierto (se puede cerrar y seguir después: lo copiado no se pierde).
- **Bases ilegibles** (concursos viejos sin versión de bases): todo pasa a `EXPLICIT` (más clics, nunca menos permiso).
- **Dos copias de títulos** (FotoRank y la muestra): a propósito; el título en la muestra lo decide quien organiza.

## Fuera de alcance

Clickatón (otra base); mandar correos a los autores (el enlace se copia a mano); venta, precio y
reparto (etapa de Ventas); medidas y edición de las obras del concurso (se cargan en el plano de
montaje como cualquier obra); traer textos del jurado o puntajes; sincronización automática con
FotoRank (siempre con el botón); sumar autores como expositores de la etapa 6.

## Decisiones de Daniel (2026-10-10) y preguntas que quedan

Resueltas: permiso por bases (`allowExhibition` → entra sin clic y el autor puede sacarla; si no,
aceptación explícita, D14); preseleccionados = finalistas (D1); el botón "Armar muestra" vive en el
panel de resultados de FotoRank y lleva a Muestras (D26). Por la exploración: fuente = último lote
`FINALIZED` o `PUBLISHED` (D1), sólo concursos propios de FotoRank (D5), crédito del autor según
atribución o confirmación (D28), imágenes copiadas como la tienda (D12).

Quedan para Daniel:
1. Cargar `DNX_FOTORANK_LINK_SECRET` en el proyecto de Vercel de Muestras (mismo valor que en FotoRank
   y FOTOFFICE). Sin eso no se copian las imágenes.
2. ¿Ganadores y menciones marcados por defecto y preseleccionados no, está bien?
3. ¿El título por defecto "Muestra <concurso>" y las fechas provisorias a 30 días están bien, o
   preferís que el formulario pida fechas y sede antes de armar?
4. ¿Quién de la organización de FotoRank puede armar: `OWNER`, `ADMIN` y `EDITOR` (propuesta) o sólo `OWNER`?
5. Si las bases **no** piden atribución y el autor no responde, la obra se expone como "Autoría
   reservada" (D28). ¿Te parece bien, o preferís que en ese caso la obra no entre hasta que el autor
   confirme?
