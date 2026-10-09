# Muestras Fotográficas — Etapa 3: convocatoria online y curaduría anónima

Fecha: 2026-10-09 · Estado: alcance decidido con Daniel en chat; este documento fija el diseño.
Diseño general: `docs/superpowers/specs/2026-10-08-muestras-fotograficas-design.md` (sección
"Funcionalidades sumadas el 2026-10-09"). Etapa anterior: `docs/superpowers/specs/2026-10-09-muestras-etapa-2-design.md`.
Plan: `docs/superpowers/plans/2026-10-09-muestras-etapa-3.md`.

> **Numeración.** Como en la etapa 2, la parte de FOTOFFICE del diseño general (aprobación por
> institución, blog, portal del socio, resumen semanal) sigue corrida hacia adelante. Esta etapa
> construye la funcionalidad "Convocatoria y curaduría online privada y anónima".

## Qué se construye

1. **Convocatoria online** de una muestra: bases, fechas (hora argentina), obras por persona,
   requisitos de las imágenes y texto de derechos. Página pública `/convocatorias` (las que
   reciben o van a recibir obras) y `/convocatorias/<slug>` con **"Enviar obras"** (pide cuenta).
2. **Envío** del fotógrafo: hasta N obras con título, año, técnica y un texto breve; acepta bases
   y derechos; puede cambiarlo o retirarlo hasta el cierre; lo sigue en **"Mis envíos"**.
3. **Curaduría privada y anónima**: el organizador invita curadores por email; cada curador ve
   todas las obras **sin nombre de autor**, en un orden propio, con un código anónimo estable, y
   las puntúa **de 1 a 5** con una nota optativa (teclado). El organizador ve el ranking
   (promedio y cantidad), selecciona y descarta, y conoce los nombres **recién al cerrar la
   curaduría**. **"Armar la muestra"** copia las elegidas a la galería de la muestra.
4. **Correos** (detrás de `MUESTRAS_CORREOS_EN_VIVO`): envío recibido, convocatoria cerrada,
   seleccionada / no seleccionada, invitación a curar.
5. **Panel**: "Convocatorias" y "Curaduría" pasan a estar construidas; se suma **"Mis envíos"**
   en "Tu cuenta". Ventas y Estadísticas siguen "en preparación".

## Recorrido

```
DRAFT ──abrir──▶ OPEN ──cerrar (después de la fecha)──▶ CLOSED ──empezar curaduría──▶ CURATING ──cerrar curaduría──▶ DONE ──armar la muestra (una vez)
  ▲                │
  └─volver a borrador (dueño sin envíos; super admin siempre)

OPEN, según las fechas:  UPCOMING (todavía no recibe) → RECEIVING (recibe) → ENDED (terminó el plazo, falta cerrar)
```

Las fases de OPEN se calculan con `callPhase(c, ahora)`, no se guardan (mismo criterio que
Próxima/Abierta/Cerrada de las muestras).

## Decisiones

| # | Decisión | Por qué |
|---|---|---|
| D1 | **Una convocatoria por muestra** (`CulturalCall.activityId` único), sólo tipo `MUESTRA`. Quien organiza es el `proposedByUserId` de la muestra (o el super admin). La muestra puede estar en **borrador**: todavía no tiene obras. | La muestra ya es la unidad con dueño y permisos; repetirlos en la convocatoria sería otra fuente de verdad. Una muestra sin obras no puede pasar revisión, así que exigir que esté publicada bloquearía justamente este flujo. |
| D2 | Estados como **texto**: `DRAFT`, `OPEN`, `CLOSED`, `CURATING`, `DONE`. Envíos `ACTIVE`/`WITHDRAWN`, decisiones `PENDING`/`SELECTED`/`DISCARDED`, curadores `INVITED`/`ACTIVE`/`REVOKED`. | Mismo criterio que toda la suite: un enum que falta en una base rompe sus escrituras. |
| D3 | **Abrir no pasa por revisión.** La convocatoria se publica al abrirla. Moderación: el **super admin** puede volverla a borrador siempre; el dueño, sólo mientras no haya envíos. | Daniel pidió que el organizador "abra" la convocatoria. Pedir revisión para algo con fecha de cierre agrega días de espera. Riesgo de spam acotado: hace falta cuenta de Google, hay freno de 10 creaciones por hora y la página no muestra palabras de revisión. **Para que Daniel confirme.** |
| D4 | **Cerrar es un botón del organizador**, habilitado recién **después** de la fecha de cierre. Pasada la fecha (fase `ENDED`) ya no se reciben ni retiran envíos aunque nadie haya cerrado. Sin cron. | Muestras no tiene tareas programadas y sumar una pide permiso en la configuración de Vercel. El cierre manual es además el momento natural para congelar los códigos y mandar el correo de cierre. |
| D5 | Edición: en borrador, todo. **Abierta**: título, bases, requisitos y **estirar** el cierre (nunca acortarlo). Apertura, tope por persona y texto de derechos quedan fijos. Cerrada: nada. | Cambiar las reglas con envíos adentro es injusto para quien ya mandó; acortar el plazo le saca tiempo a quien estaba preparando su envío. |
| D6 | **Un envío por persona y convocatoria** (`@@unique([callId, userId])`) con hasta N obras. Guardar reemplaza todas las obras del envío. Retirar marca `WITHDRAWN`; volver a enviar lo reactiva. Las imágenes se suben por `/api/imagenes` (uso `obra`, bajo `muestras/<userId>/`) y el servidor exige que cada URL sea **de la misma persona**. | Reutiliza la subida y el achicado de la etapa 1 sin tocar la ruta. Exigir la carpeta propia impide mandar como propia una imagen subida por otra persona. |
| D7 | El curador ve **imagen, código, título, año, técnica y el texto breve de cada obra**. El texto es por obra, no por envío. El formulario pide no poner el nombre ni en la imagen ni en los textos. | En una muestra el título y el texto son parte de la obra (en FotoRank se ocultan porque es un concurso). Un texto por envío uniría las obras de una misma persona y facilitaría reconocerla. **Para que Daniel confirme** (alternativa: ocultar título y texto). |
| D8 | **Conflictos:** quien organiza y quien está invitado a curar (por cuenta o por email, aunque no haya aceptado) no pueden enviar; quien envió no puede ser invitado ni aceptar una invitación. | Sin esto el anonimato no sirve: el organizador vería su obra en el ranking, un curador reconocería la suya. |
| D9 | **Invitación a curar por email**, con enlace de **un solo uso** que vence a los **30 días**. En la base queda el **SHA-256** del token, nunca el token. Se acepta con **cualquier** cuenta de Google (no se exige que coincida el email). El organizador puede reenviar (token nuevo) y sacar a alguien. | Mucha gente tiene más de una cuenta de Google; exigir coincidencia frustra la aceptación. El uso único y el vencimiento limitan el daño de un enlace reenviado. Una copia de la base no alcanza para entrar como curador. |
| D10 | **Cada curador ve todas las obras**: no hay reparto. | Para convocatorias de hasta algunos cientos de obras alcanza y evita todo el armado de lotes de FotoRank. Repartir es una mejora posterior. |
| D11 | **Código anónimo** (`O-001`…) asignado **al cerrar**, como la **posición** de cada obra en un orden por hash (`callId` + id de la obra). Único por construcción; se recalcula idéntico si el cierre se cortó a la mitad (se repite al empezar la curaduría). | Lección de Clickatón: un hash recortado a 4 dígitos (9000 valores) chocó a las 80 obras y dejó el congelamiento partido. La posición no choca nunca y el orden no revela fecha de envío ni autor. |
| D12 | **Orden propio por curador**, estable entre visitas (hash de curador + convocatoria + obra), sin `node:crypto` (cyrb53 en `packages/muestras`). | Mismo criterio que `sortEntriesForJuror` de FotoRank: nadie ve las obras en el orden de llegada, y dos curadores no comparten el mismo sesgo de orden. El paquete llega al navegador (barra del panel), por eso no usa `node:crypto`. |
| D13 | **Puntaje entero de 1 a 5 + nota optativa** (hasta 1000 caracteres). Teclado: **1–5** puntúa, **← →** pasan de obra, **N** escribe la nota, **Escape** sale de la nota. Filtros "Todas", "Me faltan", "Puntuadas"; la lista se arma al elegir el filtro y no cambia al puntuar. Se puede corregir hasta que cierre la curaduría. | Lo más simple que permite filtrar y ordenar. Lección del visor de FotoRank: si el filtro se recalcula al puntuar, la obra se va de abajo de los ojos. |
| D14 | **La imagen anónima va por una ruta propia**, `/api/curaduria/obras/<id>/imagen`: verifica sesión y permiso, lee el objeto del bucket (`GetObject`) y lo sirve con `Cache-Control: private`. Toda negativa responde **404**. La URL del bucket (`…/muestras/<userId>/…`) **nunca** llega al navegador del curador ni al del organizador antes del cierre. | La URL pública lleva el id de quien subió la imagen. Copiar a una clave anónima se descartó: duplica almacenamiento y la URL pública seguiría abierta sin control de acceso. |
| D15 | **Sin EXIF**: `sharp` descarta los metadatos al pasar a WebP (verificado con una prueba: EXIF, XMP e IPTC no sobreviven). | El campo "Artist" de la cámara delataría al autor. |
| D16 | **Proyección por lista de permitidos**: `toCuratorView` arma cada obra campo por campo y la consulta ni siquiera pide envío, autor ni URL. Una lista de campos prohibidos (`CURATOR_FORBIDDEN_FIELDS`) se vigila con un test (`leakedFields`). | Idea tomada de `entry-for-juror.ts` de FotoRank: el anonimato deja de depender de que quien edite se acuerde de la regla. |
| D17 | **El organizador** ve, durante la curaduría, el **ranking anónimo**: código, imagen (por la ruta anónima), título, promedio, cantidad de puntajes y las notas **sin decir de quién**; el avance de cada curador (cuántas puntuó). Selecciona, descarta o deshace. Los **nombres de autor aparecen recién en `DONE`** (la consulta no los pide antes). El super admin tiene la misma regla. | Daniel: "las identidades sólo después de cerrar la curaduría". El organizador conoce a su equipo, así que ver el avance por curador no rompe nada. |
| D18 | Sacar a un curador (`REVOKED`) hace que **sus puntajes dejen de contar** en el ranking; se conservan en la base. | Si alguien se va o hubo un conflicto, su opinión no debería seguir pesando. |
| D19 | **Tope de 40 y 12:** no se puede seleccionar más de `40 − obras que la muestra ya tiene`. **Armar la muestra** (sólo en `DONE`, **una sola vez**, con la muestra editable: no en revisión ni despublicada) copia las elegidas **en el orden del ranking**, después de las que ya había; las mejores completan las destacadas hasta 12; vincula el perfil de fotógrafo del autor si tiene; marca `rightsConfirmedAt` (cada autor aceptó la autorización). `assembledAt` se marca dentro de la misma transacción. | Respeta `MAX_WORKS`/`MAX_HIGHLIGHTS` de la etapa 1. El organizador ajusta orden y destacadas después en el editor de siempre. La transacción evita duplicar obras con un doble clic. |
| D20 | **Correos**: "Recibimos tus obras" (cada guardado), "Cerró la convocatoria" (en lote, al cerrar), resultado "seleccionada" / "gracias por participar" (en lote, al cerrar la curaduría; lo no decidido cuenta como no elegido) e invitación a curar. Los masivos se marcan (`closedNoticeSentAt`, `resultsNoticeSentAt`) **antes** de mandar y van por el **envío en lote de Resend** (100 por pedido). Todos detrás de la compuerta de dos llaves de la etapa 1. | Uno por uno, 300 correos pasan el tiempo máximo de la función. Marcar antes evita duplicados si dos pedidos llegan juntos. A quien no quedó se le escribe con cuidado, sin "rechazada". |
| D21 | Panel: **Convocatorias** y **Curaduría** pasan a `ready: true`; **"Mis envíos"** (`/panel/envios`) se suma en "Tu cuenta". Encabezado y pie suman **"Convocatorias"**. | Todas las funcionalidades a la vista (criterio de la etapa 2). |
| D22 | Páginas públicas: `/convocatorias` lista sólo las que reciben o van a recibir; `/convocatorias/<slug>` existe para todo lo que no es borrador (un enlace compartido no se rompe al cerrar). El enlace a la muestra aparece sólo si la muestra está publicada. Sin palabras de revisión ni aprobación. | Mismas reglas de la etapa 1. |

## Qué se reutiliza de FotoRank y qué se rehace

Las tablas de juzgamiento de FotoRank (`FotorankJudge*`, lotes de admisión, rúbricas, evaluaciones)
viven en la misma base, pero están atadas a concursos, categorías, lotes congelados y a la cuenta
de jurado (`JudgeAccount`), que es otra identidad. Su código vive en `apps/fotorank` (no es un
paquete importable) y `packages/jury-ranking` resuelve un problema más grande (métodos de
agregación, desempates, cobertura). **Se mantienen tablas propias de Muestras** y se copian las
**ideas**, no el código:

| De FotoRank / Clickatón | En Muestras |
|---|---|
| `entry-for-juror.ts`: proyección por lista de permitidos + campos prohibidos vigilados por test | `toCuratorView`, `CURATOR_FORBIDDEN_FIELDS`, `leakedFields` (D16) |
| `jury-order.ts`: orden estable por jurado con hash | `curatorOrder` con cyrb53 (D12) |
| Código anónimo de Clickatón que chocó a las 80 obras; arreglo "el número es la posición" | `anonymousCodes` por posición (D11) |
| `signedPreviewUrl`: la imagen del jurado no sale del bucket con su URL | Ruta propia con sesión y permiso (D14) |
| `colaDelVisor.ts`: filtros que no esconden la obra al calificar; teclado | `filterForCurator` y visor con lista fija (D13) |
| `packages/jury-ranking` (media recortada, desempates) | **No** se usa: con 1–5 alcanza el promedio y la cantidad (`rankWorks`). Si un día hace falta, se cambia sólo esa función. |

## Datos (migración aditiva, a mano)

`20261028120000_muestras_etapa_3_convocatorias` (ordena después de las dos `20261027120000_*` de
`origin/main`: `fotoffice_etapa_5_contratos` y `muestras_etapa_2_perfiles`).

- **`CulturalCall`**: `id` cuid, `activityId` único (FK a `CulturalActivity`, `ON DELETE CASCADE`),
  `slug` único, `title`, `basesText`, `requirementsText?`, `rightsText`, `opensAt`, `closesAt`,
  `maxWorksPerPerson` (3), `status` ("DRAFT"), `createdByUserId Int`, `openedAt?`, `closedAt?`,
  `curationStartedAt?`, `curationClosedAt?`, `assembledAt?`, `closedNoticeSentAt?`,
  `resultsNoticeSentAt?`, `createdAt`, `updatedAt`. Índices `(status, closesAt)`, `createdByUserId`.
- **`CulturalCallSubmission`**: `callId` (FK cascade), `userId Int`, `authorName`, `status`
  ("ACTIVE"), `basesAcceptedAt`, `rightsAcceptedAt`, `withdrawnAt?`. Único `(callId, userId)`.
- **`CulturalCallWork`**: `callId` y `submissionId` (FK cascade), `imageUrl`, `title`, `year?`,
  `technique?`, `statement?`, `sortOrder`, `anonymousCode?`, `decision` ("PENDING"), `decidedAt?`,
  `activityWorkId?` **sin FK** (el editor de la muestra reescribe sus obras con `deleteMany` +
  `createMany`: una FK con `SET NULL` se vaciaría en cada guardado). Único `(callId, anonymousCode)`
  (los NULL no chocan en Postgres).
- **`CulturalCallCurator`**: `callId` (FK cascade), `email` (minúsculas), `userId Int?`,
  `tokenHash` único, `status` ("INVITED"), `invitedByUserId`, `invitedAt`, `acceptedAt?`,
  `revokedAt?`. Únicos `(callId, email)` y `(callId, userId)`.
- **`CulturalCallScore`**: `callWorkId` y `curatorId` (FK cascade), `score Int`, `note?`.
  Único `(callWorkId, curatorId)`.
- `CulturalActivity` suma la relación inversa `call CulturalCall?` (no cambia columnas).

Ids de usuario `Int` **sin relación a `User`**; sin enums; no toca filas existentes. La SQL se
compara con `prisma migrate diff` contra el schema de `origin/main` (sólo `CREATE TABLE`,
`CREATE INDEX` y `ADD CONSTRAINT`). **La aplica a mano en producción el controlador, con la
autorización que dio Daniel** (Neon `divine-hall-10689679`, rama `development`), y la registra en
`_prisma_migrations` con el SHA-256 del archivo, **antes de publicar el código** (las páginas nuevas
consultan las tablas nuevas; el resto del sitio no las toca).

## Rutas

| Ruta | Quién | Qué |
|---|---|---|
| `/convocatorias` | público | Las que reciben o van a recibir obras. |
| `/convocatorias/[slug]` | público | Bases, requisitos, derechos, fechas, "Enviar obras". |
| `/convocatorias/[slug]/enviar` | con sesión | Formulario de envío (crear, cambiar, retirar). |
| `/panel/envios` | con sesión | Mis envíos, con el resultado por obra al terminar. |
| `/panel/convocatorias` | con sesión | Las propias (todas, para el super admin) y "Armar su convocatoria" por muestra. |
| `/panel/convocatorias/[id]` | dueño o super admin | Estado, cuentas, botones de estado, equipo curatorial, bases y fechas. |
| `/panel/convocatorias/[id]/seleccion` | dueño o super admin, en `CURATING`/`DONE` | Ranking, filtros, seleccionar/descartar, avance del equipo, "Armar la muestra". |
| `/panel/curaduria` | con sesión | Convocatorias donde es curador activo, con su avance. |
| `/panel/curaduria/[id]` | curador activo, en `CURATING`/`DONE` | Visor anónimo (sólo lectura en `DONE`). Cualquier otro: 404. |
| `/panel/curaduria/invitacion/[token]` | con sesión | Aceptar la invitación (`referrer: no-referrer`). |
| `/api/curaduria/obras/[id]/imagen` | curador activo (desde `CURATING`) u organizador (desde `CLOSED`) | La imagen sin su URL. 404 ante cualquier negativa. |

## Permisos (todo del lado del servidor)

- Cada página llama `requireUsuario` con su propia ruta (el layout del panel no es control).
- Acciones: `crearConvocatoria`, `guardarConvocatoria` y las de estado (dueño o super admin,
  `canCallAction`, escritura condicionada al estado leído); `guardarEnvio`/`retirarEnvio` (sólo el
  propio, sólo en `RECEIVING`, sin conflicto); `invitarCurador`/`revocarCurador` (dueño o super
  admin, antes de `DONE`); `aceptarInvitacion` (token con forma, vigente, sin envío propio);
  `puntuar` (curador `ACTIVE`, `CURATING`, obra con código y envío activo); `decidir` (dueño o
  super admin, `CURATING`, tope); `armarMuestra` (dueño o super admin, `DONE`, una vez, muestra
  editable).
- Frenos por persona (en memoria, como la etapa 1): crear convocatoria 10/h, guardar envío 20/h,
  invitar 30/h, aceptar 20/h, puntuar 1200/10 min, decidir 600/10 min, imagen anónima 1500/10 min.

## Reglas puras nuevas en `packages/muestras` (con tests)

- `call.ts`: estados, fases y textos públicos; `missingForOpening`; `editableCallFields`;
  `closeDayProblem`; `canCallAction`/`nextCallStatus`; `submissionProblems`; `submitterConflict`.
- `curation.ts`: `stableHash`, `anonymousCodes`, `curatorOrder`, `toCuratorView`,
  `CURATOR_FORBIDDEN_FIELDS`, `leakedFields`, filtros y avance, `rankWorks`, `filterRanking`,
  `selectionRoom`, `canDecide`, `canScore`, `canSeeIdentity`, `canViewCallImage`,
  `invitationState`, `normalizeEmail`, `assemblyPlan`.
- `panel.ts`: secciones listas y "Mis envíos".

## Riesgos

- **Tablas sin aplicar** rompen sólo las páginas nuevas (no las existentes): igual la migración va
  antes del deploy.
- **Ancho de banda de la ruta anónima**: cada imagen (~300 KB) pasa por una función de Vercel.
  300 obras × 5 curadores ≈ 450 MB, con caché privada de 10 minutos en el navegador. Aceptable; si
  crece, servir con URL firmada de R2 de vida corta.
- **Freno en memoria** = "N por instancia" (mismo límite conocido de la etapa 1).
- **Cierre manual**: si el organizador no cierra, la convocatoria queda en `ENDED` (no recibe nada,
  pero tampoco avanza). El panel lo muestra; un recordatorio automático queda para más adelante.
- **Reconocimiento por estilo**: el anonimato técnico no impide que un curador reconozca a un autor
  por su obra; es un límite de toda curaduría ciega.
- **Enlace de invitación reenviado**: lo usa quien llegue primero; el organizador ve el estado de
  cada invitación y puede sacar a alguien.

## Fuera de alcance

Reparto de obras entre curadores, varias rondas de selección, criterios o rúbricas, cierre
automático por cron y recordatorios, conflictos de interés declarados por el curador, inscripción
paga, exportar a FotoRank, y la parte de FOTOFFICE del diseño general.
