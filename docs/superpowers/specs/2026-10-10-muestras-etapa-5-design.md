# Muestras Fotográficas — Etapa 5: difusión y equipo

Fecha: 2026-10-10 · Estado: alcance pedido por Daniel; este documento fija el diseño.
Diseño general: `docs/superpowers/specs/2026-10-08-muestras-fotograficas-design.md` (sección
"Funcionalidades sumadas el 2026-10-09"). Etapa anterior:
`docs/superpowers/specs/2026-10-09-muestras-etapa-4-design.md` (en PR, sin fusionar; esta etapa sale
de su rama).
Plan: `docs/superpowers/plans/2026-10-10-muestras-etapa-5.md`.

> **Numeración.** Como en las etapas 2 a 4, la numeración del diseño general sigue corrida. Esta
> etapa construye tres funcionalidades de la lista del 2026-10-09: **"Coorganizadores y curadores
> con permiso de edición"**, **"Invitación a la inauguración con confirmación de asistencia"** y
> **"Piezas para redes generadas desde la ficha"**. La plataforma sigue siendo el soporte digital de
> una muestra **presencial**: el equipo prepara la sala, la invitación lleva gente a la
> inauguración y las piezas para redes llevan gente a la sala.

## Qué se construye

1. **Equipo de la muestra.** Quien propuso la muestra (el **dueño**) invita personas por email con
   uno de dos roles: **Coorganización** (edita la muestra, las obras, el plano, las piezas, la
   difusión y la inauguración, modera el libro y ve las estadísticas) o **Textos y curaduría**
   (edita sólo el texto curatorial, los créditos y los textos de cada obra). La invitación se acepta
   con la cuenta de Google del email invitado; si el correo está apagado, quien invita ve el enlace
   para copiarlo. Todas las comprobaciones de dueño pasan a **una sola regla de permisos**. Queda
   registrado quién hizo el último cambio y en qué parte.
2. **Inauguración con confirmación de asistencia.** La ficha suma la **hora** de la inauguración.
   Página pública `/m/<slug>/inauguracion` con día, hora, sede, mapa, "Agendar" (archivo `.ics` y
   enlace a Google Calendar) y el formulario **"Voy"** (nombre, email optativo, acompañantes), sin
   cuenta y con el anti-spam del libro de visitas. Cupo optativo con **lista de espera**. Quien
   confirma recibe en pantalla un **enlace personal** para ver o cancelar su lugar. El equipo ve la
   lista, la baja en CSV y cierra las confirmaciones. Los datos personales se **borran 30 días
   después del cierre de la muestra**.
3. **Piezas para redes.** Imágenes armadas en el servidor con `sharp` a partir de la ficha: posteo
   de Instagram **1080×1350**, historia **1080×1920** y cuadrado **1080×1080**, en cuatro variantes:
   **"Inaugura"**, **"Últimos días"**, **"Obra destacada"** (se elige la obra) e **"Invitación"**
   (con QR a la página de la inauguración). La invitación sale también **para imprimir** (A6 y A5,
   PDF de una página). Se descargan desde la nueva sección **"Difusión"** del panel.

## Decisiones

### Equipo y permisos

| # | Decisión | Por qué |
|---|---|---|
| D1 | **Tres roles por muestra**: `OWNER` (el `proposedByUserId`, no se guarda en la tabla del equipo), `CO_ORGANIZER` ("Coorganización") y `TEXT_EDITOR` ("Textos y curaduría"). El super admin conserva todos los permisos, como hasta ahora. | Es el mínimo útil: en una muestra real hay quien la arma con vos (necesita casi todo) y quien escribe el texto curatorial y las fichas (no tiene por qué ver la lista de invitados con sus emails, mover el plano ni moderar el libro). Un rol "sólo lectura" no resuelve ningún pedido; un rol por permiso sería una grilla que nadie configura. El identificador del segundo rol es `TEXT_EDITOR` y no `CURATOR` para no confundirlo en el código con los curadores de la convocatoria (etapa 3), que puntúan en forma anónima y son otra cosa. |
| D2 | **Permisos como capacidades** fijas por rol (tabla abajo). Una sola función pura `can(capacidad, { role, isSuperAdmin })` en `packages/muestras/src/team.ts`, y en la app `rolEnMuestra` / `dondePuede` (`lib/equipo/permisos.ts`), que **reemplazan todas** las comprobaciones `proposedByUserId === usuario.id` (lista completa en "Comprobaciones que se reemplazan"). | Hoy hay ~30 comprobaciones copiadas a mano en consultas, acciones y rutas. Sumar un rol sin unificarlas deja huecos seguros. `dondePuede` devuelve el filtro de Prisma, así cada consulta sigue siendo **una** consulta con el permiso adentro (no "leer y después mirar"). |
| D3 | **La coorganización no borra, no transfiere, no cancela ni maneja el equipo.** Cancelar o reactivar la muestra queda para el dueño. Borrar y transferir **no existen** hoy; si se suman, serán sólo del dueño (capacidad `manageTeam`/nueva). Enviar a revisión **sí** puede (es parte de prepararla). Los correos de aprobación y rechazo siguen yendo al dueño. | Cancelar avisa al público que la muestra no va: es una decisión del responsable. Enviar a revisión es el paso natural de quien terminó de cargar la ficha. |
| D4 | **Convocatoria, curaduría y selección siguen siendo sólo del dueño** (capacidad `manageCall`, que sólo tiene `OWNER`). La coorganización no ve el ranking anónimo ni la imagen anónima, y por eso **no** se suma a los conflictos de la etapa 3 (puede enviar obras a la convocatoria de una muestra que coorganiza). | El anonimato de la etapa 3 depende de quién ve el ranking. Abrirlo a más personas obliga a repensar los conflictos (D8 de la etapa 3) y la etapa no lo pide. Pasa por la misma función `can`, así ampliarlo después es cambiar una línea de la tabla. |
| D5 | **Invitación por email** con enlace de **un solo uso** que vence a los **30 días**; en la base queda el **SHA-256** del token (se reutiliza `lib/curaduria/token.ts`). **Se acepta sólo con la cuenta de Google cuyo email es el invitado** (igual que el código actual de la etapa 3 para curadores). El dueño no puede invitarse a sí mismo; tope de **10 personas** por muestra (invitadas o activas). Reenviar = token nuevo; "Sacar del equipo" = `REVOKED` con efecto inmediato; cada integrante puede **"Dejar el equipo"**. Cambiar el rol de alguien activo no pide aceptar de nuevo. | Exigir el email evita que un enlace reenviado le dé acceso a un tercero: el equipo puede editar la muestra publicada sin pasar por revisión. Uso único + vencimiento, como en la etapa 3. |
| D6 | **Correo apagado**: la acción de invitar devuelve el enlace **sólo a quien invita** (el actor), que lo ve con un botón "Copiar enlace" y el texto "No pudimos mandar el correo: copiá el enlace y mandáselo por WhatsApp o por mail". El token crudo no se guarda en ningún lado. | Hoy `MUESTRAS_CORREOS_EN_VIVO` está apagado en producción. Mismo patrón que la invitación a curar (`EquipoCuratorial`). |
| D7 | **Edición simultánea**: columna `editVersion` (entero) que suben **sólo** el guardado de la ficha y el de los textos. El formulario la manda escondida; si no coincide con la de la base (leída con `FOR UPDATE` dentro de la transacción), no se guarda: "Mientras editabas, Ana Pérez guardó cambios en los textos. Recargá la página para ver la versión nueva (lo que escribiste se pierde: copialo antes)". El plano, la inauguración y la moderación no la tocan (no pisan la ficha). | Con dos personas editando, "gana el último" borraría en silencio el trabajo del otro. `updatedAt` no sirve: cambia también al guardar el plano o la inauguración y daría falsos choques. |
| D8 | **Registro mínimo**: `lastEditedByUserId`, `lastEditedAt` y `lastEditedPart` (`FICHA`, `TEXTOS`, `MONTAJE`, `INAUGURACION`) en `CulturalActivity`. El panel de la muestra muestra "Último cambio: Ana Pérez, en los textos, el 14 nov a las 18:40". La moderación del libro ya guarda `moderatedByUserId`; el equipo guarda `invitedByUserId`. Sin historial completo. | Responde la pregunta real ("¿quién tocó esto?") sin una tabla de auditoría que crece sin límite. |
| D9 | **Rol de textos con su propia acción** (`guardarTextos`): escribe `curatorialText`, `curatorCredits` y, **por id**, `title`, `year` y `technique` de cada obra con `updateMany({ where: { id, activityId } })`. **Nunca** toca imagen, autor, orden, destacadas ni el perfil vinculado, y no borra ni crea obras. En los mismos estados que la ficha (borrador, rechazada, publicada; no en revisión); publicada, **no vuelve a revisión**. | El editor de la ficha borra y vuelve a crear las obras: dárselo al rol de textos le daría todo. Autor y perfil tocan derechos (etapa 2) y quedan para dueño y coorganización. |
| D10 | **Las visitas del equipo no cuentan**: `esDeQuienOrganiza` pasa a recibir el `activityId` y mira dueño, super admin **o integrante activo** (cualquier rol). | Extiende D15 de la etapa 4: el equipo revisa su propia muestra muchas veces y no debe inflar los números. |
| D11 | **Listados**: "Mis muestras" muestra las propias y aquellas donde sos parte del equipo, con tu rol. Los listados del panel (Montaje, Estadísticas, Difusión) usan la capacidad de cada sección. En los **listados**, el super admin ve **sólo lo suyo** (como hoy); entra a cualquier muestra por su dirección. | Hoy los listados del super admin son los propios; `dondePuede` devolvería todo el sitio. Se resuelve con la opción `{ listado: true }`. |

**Capacidades por rol** (`✓` = puede):

| Capacidad | Para qué | Dueño | Coorganización | Textos |
|---|---|---|---|---|
| `view` | Entrar a la muestra en el panel | ✓ | ✓ | ✓ |
| `editActivity` | Ficha completa y obras (`guardarBorrador`) | ✓ | ✓ | |
| `editTexts` | Texto curatorial, créditos, textos de obras (`guardarTextos`) | ✓ | ✓ | ✓ |
| `submitForReview` | Enviar a revisión | ✓ | ✓ | |
| `cancel` | Cancelar / reactivar | ✓ | | |
| `hanging` | Plano de montaje | ✓ | ✓ | |
| `pieces` | Fichas y piezas para imprimir | ✓ | ✓ | |
| `promote` | Difusión: piezas para redes e invitación imprimible | ✓ | ✓ | |
| `rsvp` | Inauguración: configurar, ver la lista con emails, CSV | ✓ | ✓ | |
| `stats` | Estadísticas | ✓ | ✓ | |
| `guestbook` | Moderar el libro y cambiar su modo | ✓ | ✓ | |
| `manageTeam` | Invitar, cambiar rol, sacar | ✓ | | |
| `manageCall` | Convocatoria, curaduría, selección, armar la muestra | ✓ | | |

### Inauguración y asistencia

| # | Decisión | Por qué |
|---|---|---|
| D12 | **Hora de la inauguración**: `openingAt` guarda día **y hora** (hora argentina). La ficha suma "Hora" (`HH:MM`) y "Hasta" (optativa → `openingEndsAt`). Una `openingAt` a las **00:00** argentinas se lee como "sin hora" (`openingHasTime`): son las filas de antes, que guardaban sólo el día. La inauguración no puede ser después del cierre. Texto: "Viernes 14 de noviembre, de 19 a 21 h". | Sin columna nueva para la hora y sin migrar datos. Una inauguración a la medianoche no existe en la práctica; el formulario no deja cargar 00:00. |
| D13 | **Configuración** en `CulturalActivity`: `rsvpStatus` (`OFF` por defecto, `OPEN`, `CLOSED`), `rsvpCapacity` (personas, optativo, 1–5000), `rsvpMaxCompanions` (0–9, por defecto 3) y `openingNote` (hasta 300 caracteres, p. ej. "Habrá un brindis y palabras de la curadora"). | El organizador decide si quiere confirmaciones; muchas inauguraciones son abiertas. |
| D14 | **Cuándo se puede confirmar** (`rsvpState`): muestra (tipo `MUESTRA`) **publicada**, presencial, no cancelada, con inauguración **con hora**, `rsvpStatus = OPEN` y **antes de que empiece** la inauguración. Si no: `UNAVAILABLE` (la página no existe: 404), `OFF` (la página muestra los datos y "Entrada libre, no hace falta confirmar"), `CLOSED` ("Ya no se reciben confirmaciones"). | La página de la invitación sirve igual para difundir aunque no se pidan confirmaciones. Cerrar sola al empezar evita confirmaciones que nadie va a leer. |
| D15 | **Formulario "Voy"**, sin cuenta: nombre (2–80, obligatorio, sin enlaces ni emails), email (optativo), acompañantes (0 a `rsvpMaxCompanions`). Anti-spam del libro (D18 etapa 4): campo trampa y **3 s** mínimos (fallan en silencio), freno por huella de IP **10 cada 10 min por muestra**, **300 por hora por muestra**, y un tope duro de **2000 confirmaciones** por muestra. Debajo del botón: "Tus datos los ve sólo quien organiza. Se borran 30 días después de que termina la muestra." | Mismo equilibrio que el libro de visitas: un grupo en la misma red puede anotarse; un robot no llena la lista. |
| D16 | **Cupo y lista de espera**: personas de una confirmación = 1 + acompañantes. Con cupo, si `confirmadas + personas > cupo` la confirmación entra **en lista de espera** (y la pantalla lo dice). La decisión se toma en una transacción con `SELECT … FOR UPDATE` sobre la muestra, así dos confirmaciones simultáneas no pasan el cupo. Cuando se libera lugar (alguien cancela, el equipo cancela a alguien o sube el cupo) pasan a confirmadas **en orden de llegada**; si a la primera no le alcanza el lugar, pasa la siguiente que entre (`promoteFromWaitlist`). El equipo puede **confirmar a mano** aunque se pase del cupo. | Orden de llegada es lo que se puede explicar en una línea. Saltear a quien no entra evita que un grupo grande bloquee lugares libres. El organizador conoce su sala mejor que la regla. |
| D17 | **Un email, una confirmación por muestra** (`@@unique([activityId, email])`; sin email no hay control de repetidos). Si el email ya está: "Ese email ya está anotado. Para cambiar la cantidad, cancelá con tu enlace personal y volvé a confirmar." | Evita duplicados sin pedir cuenta. Dice que el email está anotado sólo a quien lo escribe, con freno por IP; es un dato de baja sensibilidad y se acepta (ver Riesgos). |
| D18 | **Enlace personal** `/m/<slug>/inauguracion/r/<token>` (token de 32 bytes, en la base su SHA-256): muestra el estado (confirmado o en espera), los datos de la inauguración, "Agendar" y **"No voy a poder ir"**. Se muestra **una vez** en pantalla después de confirmar, con "Copiar enlace", y va en el correo si está encendido. `noindex` y `referrer: no-referrer`. | Con el correo apagado, es la única forma de que la persona cancele o vea si salió de la lista de espera. |
| D19 | **Agendar**: archivo `.ics` (`/m/<slug>/inauguracion/evento.ics`, RFC 5545: `UID` estable `inauguracion-<id>@muestrasfotograficas.com`, horas en UTC con `Z`, textos escapados y líneas plegadas a 75 octetos, duración por defecto **2 h**) y enlace a **Google Calendar** (`calendar.google.com/calendar/render?action=TEMPLATE…`). Funciones puras. | El `.ics` lo abre cualquier teléfono; el enlace de Google evita bajar un archivo en Android. Sin dependencias. |
| D20 | **La lista** (`/panel/difusion/<id>/inauguracion`): nombre, email, acompañantes, estado y fecha; totales (confirmaciones, personas, en espera); acciones cancelar, confirmar y pasar a espera; **"Cerrar confirmaciones"**; **CSV** (`/api/inauguracion/<id>/csv`) con separador `;`, BOM UTF-8 (Excel en castellano lo abre directo) y celdas que empiezan con `= + - @` prefijadas con `'` (inyección de fórmulas). Dueño, coorganización o super admin (`rsvp`). | El CSV es para la puerta del evento y para agradecer. El `;` es lo que espera Excel con configuración regional argentina. |
| D21 | **Privacidad y retención**: nombre y email sólo los ven dueño, coorganización y super admin; **nunca** salen en páginas públicas, piezas ni estadísticas. Se guardan sólo los datos del formulario (ni IP, ni user-agent). **30 días después de `endsAt`** se borran todas las filas de asistencia de la muestra y queda un resumen numérico (`rsvpSummary`: confirmaciones, personas, en espera) con `rsvpPurgedAt`. | 30 días alcanzan para agradecer y armar la próxima convocatoria; después el dato ya no tiene uso y sólo es riesgo. El resumen permite seguir mostrando "142 personas confirmaron". |
| D22 | **Limpieza en dos capas**: (1) **perezosa**: `barrerAsistenciasVencidas()` corre al abrir cualquier página del panel (como mucho una vez cada 6 h por instancia, hasta 50 muestras por pasada) y, antes de mostrar la lista, para esa muestra; (2) **cron diario optativo** `/api/cron/asistencias` (09:00 UTC = 06:00 argentinas) en `vercel.json`, que sólo corre con `Authorization: Bearer $CRON_SECRET`. **Para que Daniel decida** si se enciende el cron (pide la variable `CRON_SECRET` en Vercel). | Muestras no tiene tareas programadas (D4 etapa 3). La limpieza perezosa garantiza que nadie **vea** datos vencidos; el cron garantiza que se **borren** aunque nadie entre al panel. |
| D23 | **Correos** (detrás de la compuerta de dos llaves): "Confirmaste tu asistencia" / "Quedaste en lista de espera" (con el enlace personal y el `.ics`), "Se liberó un lugar" (al pasar de espera a confirmada) e invitación al equipo. **Todo funciona con el correo apagado**: la pantalla muestra el enlace personal y el de la invitación para copiar; el equipo ve en la lista quién pasó de la espera (y su email, si lo dejó, para avisarle). | El correo está apagado en producción. |

### Piezas para redes

| # | Decisión | Por qué |
|---|---|---|
| D24 | **Formatos**: `POST` 1080×1350, `STORY` 1080×1920, `SQUARE` 1080×1080 (JPEG calidad 90, sRGB, sin metadatos), y para la invitación **`A6`** 1240×1748 y **`A5`** 1748×2480 (300 ppp) envueltos en un PDF de una página con `pdf-lib`. **Variantes**: `OPENING` ("Inaugura": día y hora), `LAST_DAYS` ("Últimos días": "Hasta el 20 de noviembre"), `WORK` ("Obra destacada": título, autor, y la muestra), `INVITATION` ("Te invitamos a la inauguración" + QR a `/m/<slug>/inauguracion`). JPEG y no PNG: es una foto (PNG pesaría 2–3 MB y Instagram lo recomprime igual). | Las tres medidas que piden Instagram y Facebook hoy. Imprimir la invitación con la misma composición garantiza que se vea igual en papel que en el teléfono. |
| D25 | **Cuándo**: sólo con la muestra **publicada** (como las piezas con QR, D11 de la etapa 4: no se difunde algo que puede no aprobarse). `OPENING` hasta que empieza la inauguración (y si tiene día; la hora es optativa para esta pieza); `LAST_DAYS` hasta el cierre (el panel la recomienda cuando faltan 7 días o menos, `isLastDays`); `WORK` si hay obras; `INVITATION` con la inauguración con hora y antes de que empiece (con o sin confirmación de asistencia: si no hay, el QR lleva igual a la página con los datos). | Una pieza de "Inaugura" de algo que ya inauguró confunde. |
| D26 | **Texto con `sharp({ text })` (Pango) y un archivo de fuente del repo (`fontfile`)**, una capa por bloque (antetítulo, título, datos, pie), compuestas sobre la imagen. **No** `<text>` dentro de un SVG: en Vercel no hay fuentes del sistema y **librsvg ignora `@font-face`**, así que el texto puede salir vacío (es la conclusión documentada en `apps/fotorank/app/lib/fotorank/external/entry-image-watermark.ts`, en producción). **Verificado en este repo** (sharp 0.34.5 de `apps/muestras`, Node 24): `sharp({ text: { text, font: "Roboto 64px", fontfile, rgba: true, width: 900, wrap: "word" } })` dibuja con tildes y ñ, parte en líneas al ancho pedido y devuelve el alto (con el que se ajusta el tamaño); dos `fontfile` distintos en el mismo proceso funcionan; sin configuración de fontconfig sólo imprime el aviso inofensivo `Fontconfig error: Cannot load default config file`. **Falla cerrada**: si una capa sale sin píxeles visibles, la pieza da error (nunca una imagen sin texto). | Es el único camino sin dependencias nuevas que ya probó andar en Vercel. Pasar el texto a trazos con una biblioteca de fuentes (fontkit, opentype.js) pide sumar una dependencia a la app (mueve el lockfile de todas). |
| D27 | **Fuente: Archivo** (la del sitio, licencia OFL), **estática** Regular y Bold, en `apps/muestras/assets/fonts/` con su `OFL.txt`, incluidas en la función con `outputFileTracingIncludes`. Si no se consiguen las estáticas, se usa `Roboto-Regular.ttf` (ya está en `apps/fotorank/assets/fonts/`, Apache 2.0) para todo. **No** la versión variable: con Pango, el peso de una fuente variable depende de cómo fontconfig nombre sus instancias. | Mantiene la identidad del sitio. Las estáticas eliminan la duda del peso. |
| D28 | **Composición**: foto arriba y **banda de tinta** (`#1c2b35`) abajo con el texto en blanco; el antetítulo en el amarillo de los spots (`#e0a526`); pie "muestrasfotograficas.com". La portada de la muestra se recorta para llenar su caja (`fit: cover`, `position: attention`); **una obra nunca se recorta** (`fit: contain` sobre fondo oscuro, regla D3 de la etapa 4). En la historia, nada de texto en los 250 px de arriba ni de abajo (ahí van los controles de Instagram). El título prueba tamaños de mayor a menor hasta entrar en su caja (máximo 3 líneas); si ni el menor entra, se corta con "…". Caracteres que la fuente no tiene (emojis) se quitan. QR de la invitación en SVG con rectángulos (librsvg dibuja rectángulos sin fuentes), con margen blanco. | Texto sobre una banda lisa se lee siempre, sea cual sea la foto. Sin editor: la variante y la obra son las únicas elecciones. |
| D29 | **Ruta** `GET /api/redes/<id>?formato=post|historia|cuadrado|a6|a5&variante=inaugura|ultimos-dias|obra|invitacion&obra=<id>&descargar=1`. Capacidad `promote`, muestra publicada, variante disponible, obra de esta muestra; si no, 404 en texto. `Cache-Control: private, max-age=300`. Freno `redes` **120 cada 10 min** por persona. `maxDuration = 30`. Se arma en cada pedido (≈ 0,5–1 s, < 1 MB): no se guarda en R2. El panel muestra **una vista previa a la vez** (selector de variante, formato y obra) y "Descargar". | Doce vistas previas a la vez serían doce armados por visita al panel. Una pieza pesa mucho menos que el tope de 4,5 MB de Vercel. |

### Panel, portada y dependencias

| # | Decisión | Por qué |
|---|---|---|
| D30 | **Sección nueva "Difusión"** (`/panel/difusion`, grupo "Para organizar", `ready: true`): listado de muestras con `promote`; `/panel/difusion/<id>` con piezas para redes, invitación imprimible y acceso a la inauguración; `/panel/difusion/<id>/inauguracion` con la configuración y la lista. Equipo en `/panel/muestras/<id>/equipo`; aceptar en `/panel/equipo/invitacion/<token>`. | Daniel quiere todas las funcionalidades a la vista y construidas, sin "próximamente". |
| D31 | **`EN_PREPARACION`**: hoy sólo explica **Ventas**; ninguna de las tres funcionalidades estaba ahí (la portada las lista en `lib/portada/funciones.ts` como funcionalidades, sin marca de futuro). No se quita nada; la sección nueva nace `ready` y el test existente ("no explica como futuro algo que ya está construido") lo vigila. La portada no cambia. | Se verificó en el código: `EN_PREPARACION` tiene una sola clave (`ventas`). |
| D32 | **Sin dependencias nuevas**: `sharp`, `pdf-lib`, `qrcode` y `resend` ya están en la app. Los únicos archivos binarios nuevos son las fuentes (D27). | Una dependencia nueva mueve el lockfile de todas las apps. |

## Comprobaciones que se reemplazan (todas pasan por `can` / `dondePuede` / `rolEnMuestra`)

| Archivo | Hoy | Pasa a |
|---|---|---|
| `packages/muestras/src/review.ts` | `isOwner` en `canPerform` (submit, cancel, uncancel) y `canEdit` | `can("submitForReview" / "cancel" / "editActivity")` con `Actor.role`; nueva `canEditTexts` |
| `packages/muestras/src/call.ts` | `esDueno` en `canCallAction` | `can("manageCall")` (sólo dueño: mismo comportamiento) |
| `packages/muestras/src/curation.ts` | `canViewCallImage({ isOwner })` | quien llama calcula `isOwner` con `can("manageCall")` |
| `lib/actividades/consultas.ts` | `listarMias` (`proposedByUserId`), `buscarPropia`, `listarMuestrasParaMontaje` | `listarMias(usuario)` con dueño **o** integrante y su rol; `buscarParaEditar(id, usuario)` con `view` y rol; montaje con `hanging` (`listado`) |
| `lib/actividades/acciones.ts` | `canEdit` en `guardarBorrador`; `canPerform` en `transicion` | rol con `rolEnMuestra`, `canEdit`/`canPerform` con `role`; `editVersion` y registro (D7, D8). `obrasParaGuardar` sigue usando el perfil del **dueño** (no es un permiso: es a quién se vinculan las obras) |
| `lib/montaje/acciones.ts`, `lib/montaje/consultas.ts` | `proposedByUserId` en el `where` | `dondePuede(usuario, "hanging")` |
| `lib/piezas/cargar.ts`, `lib/fichas/cargar.ts` | ídem | `dondePuede(usuario, "pieces")` |
| `lib/estadisticas/consultas.ts` | `listarConEstadisticas(userId)`, `estadisticasDeMuestra` | `dondePuede(usuario, "stats")` (listado con `{ listado: true }`) |
| `lib/estadisticas/contar.ts`, `lib/estadisticas/qr.ts`, `app/api/visitas/route.ts`, `app/q/[tipo]/[id]/route.ts` | `esDeQuienOrganiza(proposedByUserId)` | `esDelEquipo(activityId)` (D10) |
| `lib/libro/acciones.ts` (`moderarEntrada`, `cambiarModoLibro`), `lib/libro/consultas.ts` | ídem | `dondePuede(usuario, "guestbook")` |
| `lib/convocatorias/acciones.ts` (`crearConvocatoria`, `guardarConvocatoria`, `transicion` —abrir, volver a borrador, cerrar, cerrar curaduría— y `empezarCuraduria`) | `proposedByUserId !== usuario.id && !esSuperAdmin` | `puedeConDueno(usuario, "manageCall", ownerUserId)` (para `transicion`, el `canCallAction` puro con `role`) |
| `lib/convocatorias/consultas.ts` (`listarConvocatoriasMias`, `muestrasSinConvocatoria`, `buscarConvocatoriaDelOrganizador`) | ídem | `dondePuede(usuario, "manageCall")` sobre `activity` |
| `lib/curaduria/acciones.ts` (`convocatoriaParaEquipo`; el conflicto de `aceptarInvitacion` queda igual), `lib/curaduria/imagen.ts` | ídem | `manageCall` |
| `lib/seleccion/acciones.ts` (`decidir`, `armarMuestra`) | ídem + `canEdit` | `manageCall` + `canEdit` con el rol del dueño |
| `lib/envios/acciones.ts`, `app/convocatorias/[slug]/enviar/page.tsx` | `isOwner` para el conflicto | sin cambio de comportamiento: `activityRole(...) === "OWNER"` |
| `app/panel/muestras/[id]/page.tsx`, `app/panel/page.tsx`, `app/panel/muestras/page.tsx` | `buscarPropia`, `canEdit`, `listarMias(usuario.id)` | `buscarParaEditar` + rol: ficha completa, sólo textos o sólo lectura |
| `app/api/piezas/[id]/[pieza]/route.ts`, `app/api/fichas/[id]/route.ts` | a través de `cargar*` | sin cambio propio (heredan `pieces`) |
| `lib/correos/enviar.ts` (`avisarAprobada`, `avisarRechazada`) | destinatario `proposedByUserId` | **sin cambio**: no es un permiso, es a quién se avisa (D3) |

`grep -rn "proposedByUserId" apps/muestras --include='*.ts' --include='*.tsx'` al final de la etapa sólo
puede mostrar: `lib/equipo/permisos.ts`, las escrituras de creación (`guardarBorrador`), los
destinatarios de correos y los `select` que alimentan a `activityRole`.

## Datos (migración aditiva, a mano)

`20261030120000_muestras_etapa_5_difusion` (ordena después de `20261029120000_muestras_etapa_4_sala`).

- **`CulturalActivity`** suma: `openingEndsAt TIMESTAMP(3)?`, `openingNote TEXT?`,
  `rsvpStatus TEXT NOT NULL DEFAULT 'OFF'`, `rsvpCapacity INT?`,
  `rsvpMaxCompanions INT NOT NULL DEFAULT 3`, `rsvpSummary JSONB?`, `rsvpPurgedAt TIMESTAMP(3)?`,
  `editVersion INT NOT NULL DEFAULT 0`, `lastEditedByUserId INT?`, `lastEditedAt TIMESTAMP(3)?`,
  `lastEditedPart TEXT?`, y las relaciones inversas `members` y `rsvps`.
- **`CulturalActivityMember`**: `id` cuid, `activityId` (FK, `ON DELETE CASCADE`), `email`
  (minúsculas), `userId INT?`, `role` (`CO_ORGANIZER` | `TEXT_EDITOR`), `status` (`INVITED` |
  `ACTIVE` | `REVOKED`, por defecto `INVITED`), `tokenHash` único, `invitedByUserId INT`,
  `invitedAt`, `acceptedAt?`, `revokedAt?`. Únicos `(activityId, email)` y `(activityId, userId)`;
  índice `(userId, status)` (para "Mis muestras" y `dondePuede`).
- **`CulturalActivityRsvp`**: `id` cuid, `activityId` (FK cascade), `name`, `email?`, `companions INT
  DEFAULT 0`, `status` (`CONFIRMED` | `WAITLIST` | `CANCELLED`, por defecto `CONFIRMED`),
  `manageTokenHash` único, `createdAt`, `updatedAt`, `cancelledAt?`, `promotedAt?`. Único
  `(activityId, email)` (los NULL no chocan en Postgres); índice `(activityId, status, createdAt)`.
  **Sin IP, sin user-agent, sin usuario.**

Sin enums, ids de usuario `Int` sin relación a `User`, no toca filas existentes (columnas optativas
o con valor por defecto constante: Postgres no reescribe la tabla). La SQL completa está en la
Task 4 del plan y se compara con `prisma migrate diff`. **La aplica a mano en producción el
controlador, antes de publicar el código** (Neon `divine-hall-10689679`, rama `development`), y la
registra en `_prisma_migrations` con el SHA-256 del archivo. Como en la etapa 4: una columna de
`CulturalActivity` sin aplicar **rompe todo el sitio de Muestras**. Además, **la migración de la
etapa 4 tiene que estar aplicada antes** (esta rama sale de la suya).

## Rutas

| Ruta | Quién | Qué |
|---|---|---|
| `/m/[slug]/inauguracion` | público | Día, hora, sede, mapa, nota, "Agendar", formulario "Voy" (D14). 404 si `UNAVAILABLE`. Dinámica. |
| `/m/[slug]/inauguracion/evento.ics` | público | Archivo de calendario (D19). |
| `/m/[slug]/inauguracion/r/[token]` | quien tiene el enlace | Ver y cancelar su lugar (D18). `noindex`, `no-referrer`. |
| `/m/[slug]` | público | Suma "Confirmá tu asistencia" (si `OPEN`) o la hora de la inauguración. |
| `/panel/muestras` | con sesión | Propias y compartidas, con rol. |
| `/panel/muestras/[id]` | `view` | Ficha completa (`editActivity`), sólo textos (`editTexts`) o lectura; último cambio; enlaces según capacidad. |
| `/panel/muestras/[id]/equipo` | `view` (gestiona sólo `manageTeam`) | Integrantes, invitar, reenviar, cambiar rol, sacar; "Dejar el equipo". |
| `/panel/equipo/invitacion/[token]` | con sesión | Aceptar (`referrer: no-referrer`). |
| `/panel/difusion` | con sesión | Muestras con `promote`. |
| `/panel/difusion/[id]` | `promote` | Piezas para redes, invitación imprimible, enlace a la inauguración. |
| `/panel/difusion/[id]/inauguracion` | `rsvp` | Configuración, lista, acciones, CSV. |
| `/api/redes/[id]` | `promote` | La pieza (JPEG o PDF) (D29). |
| `/api/inauguracion/[id]/csv` | `rsvp` | La lista en CSV (D20). |
| `/api/cron/asistencias` | Vercel Cron con `CRON_SECRET` | Limpieza diaria (D22). |

## Permisos (todo del lado del servidor)

- Cada `page.tsx` llama `requireUsuario(<su propia ruta>)`; el layout del panel no es control. Toda
  negativa en el panel es `notFound()` (no revela si la muestra existe).
- Cada acción vuelve a leer la sesión **y** el rol en la base (sacar a alguien del equipo corta su
  acceso en el próximo pedido; nada se guarda en la sesión).
- Acciones nuevas: `invitarAlEquipo`, `reenviarInvitacion`, `cambiarRol`, `sacarDelEquipo`
  (`manageTeam`); `aceptarInvitacionEquipo` (token con forma, vigente, email de la cuenta =
  invitado, no es el dueño); `dejarElEquipo` (integrante activo); `guardarTextos` (`editTexts`);
  `guardarInauguracion`, `cambiarAsistencia`, `cerrarConfirmaciones` (`rsvp`);
  `confirmarAsistencia` y `cancelarMiAsistencia` (públicas, D15–D18).
- Frenos por persona: `invitarEquipo` 30/h, `aceptarEquipo` 20/h, `guardarTextos` 120/h,
  `guardarInauguracion` 60/h, `gestionarAsistencias` 600/10 min, `exportarAsistencias` 30/h,
  `redes` 120/10 min. Por huella de IP: `asistencia` 10/10 min por muestra,
  `asistenciaConsultas` 120/10 min, `miAsistencia` 30/10 min; por muestra: `asistencia` 300/h.

## Privacidad

- Asistencia: sólo lo que la persona escribe; el email es optativo; nada de IP ni cookies. Visible
  sólo para dueño, coorganización y super admin; nunca en páginas públicas, piezas, estadísticas ni
  en el rol de textos. Borrado a los 30 días del cierre (D21–D22).
- Equipo: el email de cada integrante lo ve el equipo de esa muestra (es como se invitó). Las
  invitaciones vencidas o revocadas conservan el email mientras exista la muestra (se puede quitar a
  mano; ver Fuera de alcance).
- `/privacidad` suma dos párrafos: confirmación de asistencia (qué se guarda, quién lo ve, cuándo se
  borra) y equipo de una muestra.

## Reglas puras nuevas en `packages/muestras` (con tests)

- `team.ts`: roles, etiquetas, capacidades, `can`, `rolesWith`, `activityRole`, estados del
  integrante, `MAX_TEAM_MEMBERS`, `teamInviteProblems`, partes editables y `lastEditText`.
- `review.ts`: `Actor.role`, `canEdit`/`canPerform` con capacidades, `canEditTexts`.
- `opening.ts`: hora (`openingAtFrom`, `openingHasTime`, `formatArTime`, `openingWhenText`),
  `rsvpState`, `rsvpInput`, `rsvpProblems`, `rsvpPlacement`, `promoteFromWaitlist`, `rsvpTotals`,
  `rsvpPurgeDue`, `openingIcs`, `googleCalendarUrl`, `rsvpCsv`.
- `social.ts`: formatos, variantes, `availableSocialVariants`, `socialLayout`, `socialTexts`,
  `cleanSocialText`, `TITLE_SIZES`, `socialFileName`.
- `panel.ts`: sección "Difusión".

## Riesgos

- **Columnas sin aplicar** en `CulturalActivity` rompen todo el sitio: la migración (y antes la de la
  etapa 4) va antes del deploy, sin excepción.
- **Texto de las piezas en Vercel** (D26): se apoya en lo mismo que la marca de agua de FotoRank en
  producción, pero la primera verificación real es en producción. El plan pide bajar una pieza de
  cada formato apenas se publica; si saliera sin texto, la ruta da error (falla cerrada), no una
  imagen vacía.
- **Fuente**: hay que sumar al repo los TTF estáticos de Archivo (OFL, se distribuyen libremente);
  si no, se usa Roboto (D27).
- **Edición en equipo**: `editVersion` evita pisar cambios en la ficha y los textos, pero quien
  pierde el choque tiene que recargar y volver a escribir. El mensaje lo dice.
- **Revocación**: sacar a alguien corta el acceso en el siguiente pedido, pero una pestaña abierta
  puede seguir **viendo** lo último que cargó hasta que recargue.
- **"Ese email ya está anotado"** (D17) le confirma a quien lo escribe que ese email está en la lista.
  Lo acota el freno por IP; la alternativa (no avisar) dejaría a la persona sin saber qué pasó.
- **Sin email no hay control de repetidos**: alguien puede anotarse dos veces. El equipo ve la lista
  y puede cancelar repetidos.
- **Limpieza** (D22): sin el cron, una muestra cuyo equipo no vuelve a entrar al panel borra sus
  datos recién cuando alguien abra cualquier página del panel (pasa todos los días mientras haya
  uso). Con el cron, a las 24 h.
- **Freno en memoria** = "N por instancia" (mismo límite conocido de las etapas 1 a 4).
- **Instagram cambia sus medidas**: hoy 1080×1350 (4:5) y 1080×1920 (9:16). Están en una constante.

## Fuera de alcance

Transferir la muestra a otra persona; borrar una muestra; roles a medida o permisos por persona;
historial completo de cambios; que el equipo reciba los correos de aprobación; abrir la convocatoria
y la curaduría a la coorganización; recordatorio automático el día de la inauguración; envío masivo
a los confirmados; preguntas extra en el formulario; varias funciones o turnos de inauguración;
editor de piezas (textos, colores o tipografía elegibles); publicar directo en redes; video o
carrusel; quitar a mano invitaciones vencidas del equipo.
