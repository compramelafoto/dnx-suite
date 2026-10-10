# Muestras Fotográficas — Etapa 4: la sala

Fecha: 2026-10-09 · Estado: alcance pedido por Daniel; este documento fija el diseño.
Diseño general: `docs/superpowers/specs/2026-10-08-muestras-fotograficas-design.md` (secciones
"Piezas para imprimir" y "Funcionalidades sumadas el 2026-10-09"). Etapa anterior:
`docs/superpowers/specs/2026-10-09-muestras-etapa-3-design.md`.
Plan: `docs/superpowers/plans/2026-10-09-muestras-etapa-4.md`.

> **Numeración.** Como en las etapas 2 y 3, la numeración del diseño general sigue corrida. Esta
> etapa junta todo lo que pasa **en la sala**: la plataforma es el soporte digital de una muestra
> presencial. Construye "Piezas para imprimir" (marco, cartel, catálogo, plano de montaje),
> "Estadísticas de visitas y escaneos de QR" y "Libro de visitas digital vía QR". Las ventas (y sus
> estadísticas) siguen para la etapa de Ventas.

## Qué se construye

1. **Piezas para imprimir** en "Montaje e impresión", todas en PDF armado en el servidor, sin
   navegador, con la misma biblioteca y el mismo estilo que las fichas de sala de la etapa 2:
   - **Marco / remarco** de cada obra: la foto con su margen blanco (passe-partout), título y autor
     debajo, en A4, A3, 30×40, 40×50 o 50×70 cm, vertical, horizontal o automática. Una obra o todas.
     Opción **"sólo el remarco"** (sin foto, con la ventana marcada) para usar con una copia propia.
   - **Cartel de sala** con el **texto curatorial**: título, organizadores, créditos de curaduría,
     texto, fechas, horarios, sede y QR a la página de la muestra. A3, A2 o 50×70.
   - **Catálogo** en PDF (A5 o A4): portada, texto curatorial, una página por obra (imagen, título,
     autor, año, técnica), índice de autores y una página final con QR.
   - **Plano y lista de montaje**: el organizador define paredes (nombre, ancho, alto optativo) y
     asigna obras en orden con la medida de su marco; el PDF dibuja cada pared a escala con las obras
     centradas a **150 cm** y espaciadas parejo, más una tabla con distancias y una lista de control.
   - **Afiche del libro de visitas** (A4 o A3) con su QR.
2. **Estadísticas** (sección del panel): visitas a la página de la muestra y de cada obra, escaneos
   de los QR (fichas, cartel y catálogo, afiche del libro), por día, sólo para quien organiza.
3. **Libro de visitas digital**: quien recorre la sala escanea el afiche, deja un comentario (nombre
   y ciudad optativos) sin crear cuenta; el organizador modera; los publicados se ven en la página
   de la muestra.
4. **Texto curatorial** y **créditos de curaduría** como campos optativos de la muestra, visibles
   también en su página pública.

## Decisiones

| # | Decisión | Por qué |
|---|---|---|
| D1 | **PDF con `pdf-lib` + `qrcode` + `sharp`**, Helvetica con textos pasados a WinAnsi, QR vectorial, colores del sitio. **Diseños fijos**, sin el diseñador de plantillas de la suite. | Es lo que ya imprime las fichas y anda sin navegador. El diseñador de plantillas arrastra un render pesado (las funciones de diplomas de FotoRank pasan los 250 MB). Un diseño sobrio fijo sirve para el 90 % de las muestras; las plantillas quedan como mejora. |
| D2 | **Las fotos de las piezas son las que ya guardamos** (2000 px de lado mayor, WebP), pasadas a JPEG con `sharp` al armar el PDF. El panel dice, por medida, qué calidad esperar para una foto 3:2: **buena** en A4 (≈230 ppp), **aceptable** en A3, 30×40 y 40×50 (≈125–165 ppp), **blanda** en 50×70 (≈100 ppp). Umbrales: 200 y 120 ppp. Para medidas grandes se ofrece **"sólo el remarco"**. | Los originales en alta resolución llegan recién con Ventas (diseño general). Pedir otra subida "para imprimir" ahora duplica almacenamiento y flujo. Decirlo antes evita una impresión cara y decepcionante. **Daniel tiene que saberlo.** |
| D3 | **Marco**: margen del 12 % del lado corto del papel arriba y a los costados, y 1,6 veces eso abajo (ahí van título y autor, y compensa el peso visual, como un passe-partout clásico). La foto entra entera, centrada, sin recorte. Orientación **automática** según la foto (cuadrada → vertical), o forzada. | Una regla proporcional queda bien en todas las medidas sin ajustar a mano. Nunca se recorta una obra. |
| D4 | **PDF de más de 4 MB → R2.** Si el PDF supera 4 MB (marcos con foto de varias obras, catálogo) se sube a `muestras/piezas/<muestra>/<sha256 del PDF>.pdf` con `Content-Disposition: attachment` y la ruta responde **303** a esa dirección. Los más livianos se descargan directo como las fichas. El PDF lleva fecha fija (la `updatedAt` de la muestra): el mismo contenido da el mismo archivo y no se acumulan copias. | Vercel corta toda respuesta de una función en **4,5 MB**. 40 marcos con foto pesan 20–30 MB. La clave es el hash del contenido: no se puede adivinar sin tener el PDF. Sin dependencias nuevas (no hace falta firmar URLs). |
| D5 | **Texto curatorial y créditos**: columnas optativas `curatorialText` (hasta 6000 caracteres) y `curatorCredits` (hasta 300) en `CulturalActivity`. Se cargan en el editor de la muestra (sólo tipo muestra), se ven en su página pública y alimentan cartel y catálogo. Editarlo en una muestra publicada **no vuelve a revisión** (regla de siempre). | Es parte de la ficha, no de una pieza: se escribe una vez y se usa en cuatro lugares. Vuelve a revisión sólo lo que ya volvía; el super admin puede despublicar como siempre. |
| D6 | **Cartel**: A3, A2 o 50×70, vertical. El tamaño de letra del texto curatorial se elige solo (el más grande que entra). Si ni con la letra mínima entra, termina en "…" y el panel lo advierte para textos largos. Sin texto curatorial el cartel sale igual (título, datos y QR). | El organizador no tiene que diagramar nada. Avisar es mejor que cortar en silencio. |
| D7 | **Catálogo**: A5 (por defecto) o A4. Portada (foto de portada, título, organiza, fechas, sede), texto curatorial (corre las páginas que haga falta), **una página por obra en el orden de la galería, todas** (no sólo las destacadas), índice alfabético de autores con sus páginas, página final con QR a la muestra. Números de página desde la 2. | El catálogo es para la sala y para quien lo pide: la reserva de imágenes de la galería online (etapa 1) no aplica a un objeto que se reparte en la muestra. |
| D8 | **Plano de montaje en una columna JSON `hangingPlan`** de `CulturalActivity`, validada por una regla pura (`parseHangingPlan` + `hangingPlanProblems`). Hasta 30 paredes; cada obra en una sola pared. Al leer, las obras que ya no están en la muestra se descartan. | **No hay FK posible**: el editor de la muestra borra y vuelve a crear las obras (con el mismo id) en cada guardado, así que una FK en cascada borraría el plano entero cada vez que se edita la muestra (el mismo motivo por el que `CulturalCallWork.activityWorkId` no tiene FK). Sin FK, dos tablas no ganan integridad y suman una escritura en transacción; el plano se lee y se guarda siempre entero y es chico (≤ 40 obras). |
| D9 | **Reglas del plano**: línea de centro a **150 cm** del piso (editable entre 100 y 200), espacio **parejo** entre obras y bordes: `(ancho − suma de marcos) / (obras + 1)`. Avisos: **no entran** (suman más que la pared), **muy juntas** (menos de 5 cm), **toca el piso**, **pasa el alto de la pared**. Medidas en cm con un decimal. | Es la convención de museo más usada y la más fácil de replicar con un metro. Los avisos son lo que el montajista descubre tarde si nadie lo calcula. |
| D10 | **PDF del plano**: A4 apaisado; una página por pared con el alzado a escala (piso, línea de centro, cada marco numerado) y una tabla (n.º, obra, autor, marco, distancia del borde izquierdo al centro, altura del borde superior, casilla "colgada"); al final, la **lista de control** de todas las obras por pared y las que no tienen pared. | El montajista trabaja con la hoja en la mano: dibujo + números + tilde. |
| D11 | **Cuándo se puede**: plano y marcos, en **cualquier estado** de una muestra propia (se preparan antes de publicar). Las piezas **con QR** (fichas, cartel, catálogo, afiche del libro) sólo con la muestra **publicada**. Dueño (`proposedByUserId`) o super admin. | Un QR a una página que no existe no sirve (etapa 2, D9). El montaje se prepara semanas antes de la aprobación. |
| D12 | **QR con conteo**: `/q/o/<obra>`, `/q/m/<muestra>` (cartel y catálogo) y `/q/l/<muestra>` (afiche del libro). La ruta suma un escaneo y redirige con **302** y `Cache-Control: no-store` a `/m/<slug>/o/<obra>`, `/m/<slug>` o `/m/<slug>/libro`. Las fichas nuevas usan `/q/o/…`. Si la muestra no está publicada o la obra ya no existe, va a la portada sin contar. | El 302 sin caché hace que cada escaneo pase por el servidor. La dirección queda más corta (≈60 caracteres contra ≈100): el QR es menos denso y se lee mejor de lejos. Los ids no cambian (etapa 2, D15), así que un QR impreso dura toda la muestra. |
| D13 | **Fichas ya impresas** (QR directo a `/m/<slug>/o/<id>`) **siguen andando** y cuentan como **visitas a la obra**, no como escaneos: sin un parámetro en la dirección no hay forma honesta de distinguir un escaneo de un enlace compartido. El panel lo explica y sugiere reimprimir si se quiere separar. | Inventar escaneos por heurística (sin "referer", desde un teléfono) daría números falsos. |
| D14 | **Visitas por baliza del navegador**: un componente cliente manda `navigator.sendBeacon('/api/visitas', …)` al abrir la página de la muestra o de una obra, **una vez por pestaña** (marca en `sessionStorage`, sin cookies). Las visitas a una obra **incluyen** las que llegaron por QR. | Las páginas públicas se sirven de caché (`revalidate = 300`): el servidor no se entera de cada visita. Los robots casi nunca ejecutan JavaScript, así que la baliza ya los filtra. |
| D15 | **Privacidad**: sólo **contadores diarios agregados** por muestra, obra, día y tipo. **No se guarda** IP, user-agent, cookie ni usuario. La IP se usa sólo en memoria, convertida en huella SHA-256, para el freno. Se descartan robots (lista de user-agents), pedidos de precarga y las visitas y escaneos **del organizador o del super admin** con sesión abierta. | Se cumple sin aviso de cookies y sin datos personales. No contar al organizador evita que se infle su propia muestra al revisarla. |
| D16 | **Tabla `CulturalActivityDailyStat`** con clave primaria compuesta `(activityId, workId, day, metric)`; `workId = ""` para la muestra entera (sin FK, D8); `day` como **texto `AAAA-MM-DD` en hora argentina**; `metric` ∈ `VIEW`, `SCAN`, `GUESTBOOK_SCAN`. Suma atómica con `INSERT … ON CONFLICT DO UPDATE SET count = count + 1` (SQL crudo con parámetros). | El día como texto evita los corrimientos de zona de `timestamp` sin zona (ya nos pasó). Con `ON CONFLICT` dos visitas simultáneas nunca chocan (un `upsert` de Prisma puede fallar con P2002). La clave compuesta hace de índice para todas las consultas. |
| D17 | **Panel de Estadísticas** (sección lista): `/panel/estadisticas` con las muestras propias publicadas o despublicadas y sus totales; `/panel/estadisticas/<id>` con totales, dos gráficos de barras diarios (visitas y escaneos) de **60 días** que terminan hoy o 30 días después del cierre, y una tabla por obra. Gráfico en SVG armado en el servidor, sin bibliotecas, con la tabla de números a mano. | Lo mínimo que responde "¿viene gente?, ¿escanean?, ¿qué obra llama más?". Sin dependencias nuevas. |
| D18 | **Libro de visitas, público y sin cuenta**: nombre y ciudad optativos (60 caracteres), comentario obligatorio (500). Rechaza enlaces y direcciones de correo. Anti-spam: **campo trampa** oculto, **tiempo mínimo de 3 s** entre que se abre el formulario y se envía (los dos fallan en silencio, como si se hubiera guardado), freno por huella de IP **10 cada 10 min por muestra** y **200 por hora por muestra** (en memoria). | Una visita escolar comparte la red del lugar: 10 por IP deja comentar a un grupo. Fallar en silencio no le enseña al robot qué lo delató. No se guarda la IP. |
| D19 | **Moderación con modo por muestra** (`guestbookMode`): **`PUBLISH`** (por defecto: se publica al instante y el organizador oculta o borra), **`REVIEW`** (queda pendiente hasta que el organizador lo publica) u **`OFF`** (libro cerrado). Estados de cada comentario: `PENDING`, `PUBLISHED`, `HIDDEN`. Borrar es definitivo y pide confirmación. **Para que Daniel confirme** el modo por defecto. | Es un libro de visitas: lo natural es ver el propio comentario enseguida. Los filtros y el freno acotan el abuso, y quien prefiera revisar antes lo cambia con un clic. |
| D20 | **Cuándo recibe**: desde que la muestra está publicada hasta **15 días después del cierre**; cancelada o con el libro cerrado, no. `/m/<slug>/libro` muestra los publicados (más nuevos primero) y el formulario; es `noindex`. La página de la muestra muestra los **6 últimos** con un enlace "Dejá tu comentario". | Mucha gente escribe al volver a casa. `noindex` le quita a un spammer el incentivo de posicionar texto. |
| D21 | **Panel**: "Estadísticas" pasa a `ready: true`; la moderación del libro vive en `/panel/estadisticas/<id>/libro`. "Montaje e impresión" pasa a una página por muestra (`/panel/montaje/<id>`) con todas las piezas y el editor del plano, y deja de mostrar "También en preparación" (`MONTAJE_EN_PREPARACION` se elimina). "Ventas" sigue en preparación y suma "Ventas por obra y por autor". | Todas las funcionalidades a la vista; nada construido aparece como futuro (test existente). |
| D22 | **Sin dependencias nuevas**: `pdf-lib`, `qrcode`, `sharp` y `@aws-sdk/client-s3` ya están en la app. | Una dependencia nueva mueve el lockfile de todas las apps. |

## Datos (migración aditiva, a mano)

`20261029120000_muestras_etapa_4_sala` (ordena después de las dos `20261028120000_*` de `origin/main`).

- **`CulturalActivity`** suma: `curatorialText TEXT?`, `curatorCredits TEXT?`,
  `guestbookMode TEXT NOT NULL DEFAULT 'PUBLISH'`, `hangingPlan JSONB?`, y las relaciones inversas.
- **`CulturalActivityDailyStat`**: `activityId` (FK a `CulturalActivity`, `ON DELETE CASCADE`),
  `workId TEXT NOT NULL DEFAULT ''`, `day TEXT`, `metric TEXT`, `count INT NOT NULL DEFAULT 0`;
  clave primaria `(activityId, workId, day, metric)`.
- **`CulturalActivityGuestbookEntry`**: `id` cuid, `activityId` (FK cascade), `name?`, `city?`,
  `comment`, `status TEXT DEFAULT 'PUBLISHED'`, `moderatedAt?`, `moderatedByUserId INT?`,
  `createdAt`; índice `(activityId, status, createdAt)`. **Sin IP, sin user-agent, sin usuario.**

Sin enums, ids de usuario `Int` sin relación a `User`, no toca filas existentes (las columnas nuevas
son optativas o con valor por defecto; Postgres no reescribe la tabla). La SQL se compara con
`prisma migrate diff` contra el schema de `origin/main`. **La aplica a mano en producción el
controlador** (Neon `divine-hall-10689679`, rama `development`), la registra en `_prisma_migrations`
con el SHA-256 del archivo, **antes de publicar el código**: Prisma pide todas las columnas del
modelo, y una columna de `CulturalActivity` que falte rompe **todo el sitio de Muestras**, no sólo lo
nuevo.

## Rutas

| Ruta | Quién | Qué |
|---|---|---|
| `/q/[tipo]/[id]` (`o`, `m`, `l`) | público | Cuenta el escaneo y redirige (D12). |
| `POST /api/visitas` | público | Baliza de visita. Siempre 204. |
| `/m/[slug]` | público | Suma texto curatorial, últimos comentarios del libro y la baliza. |
| `/m/[slug]/o/[workId]` | público | Suma la baliza. |
| `/m/[slug]/libro` | público | Libro de visitas: comentarios publicados y formulario (`noindex`). |
| `/panel/montaje` | con sesión | Las muestras propias de tipo muestra (todas menos las rechazadas) con acceso a cada una. El super admin entra a cualquiera por su dirección. |
| `/panel/montaje/[id]` | dueño o super admin | Fichas, marcos, cartel, catálogo, afiche del libro y editor del plano. |
| `/api/piezas/[id]/[pieza]` (`marcos`, `cartel`, `catalogo`, `montaje`, `libro`) | dueño o super admin | PDF directo o 303 a R2 (D4). |
| `/api/fichas/[id]` | dueño o super admin | Igual que antes; el QR pasa a `/q/o/<id>`. |
| `/panel/estadisticas` | con sesión | Muestras propias publicadas o despublicadas con totales. |
| `/panel/estadisticas/[id]` | dueño o super admin | Totales, gráficos diarios, tabla por obra. |
| `/panel/estadisticas/[id]/libro` | dueño o super admin | Modo del libro y moderación. |

## Permisos (todo del lado del servidor)

- Cada `page.tsx` llama `requireUsuario(<su propia ruta>)`; el layout del panel no es control.
- Dueño = `proposedByUserId`, o super admin. Toda negativa en páginas del panel es `notFound()`
  (no revela si la muestra existe); en `/api/piezas` sin sesión redirige a `/login?next=/panel/montaje`.
- Acciones: `guardarMontaje` (dueño, tipo muestra, cualquier estado), `moderarEntrada` (dueño de la
  muestra del comentario), `cambiarModoLibro` (dueño), `dejarComentario` (público, D18–D20).
- Frenos por persona: `piezas` 60/10 min, `guardarMontaje` 120/h, `moderarLibro` 600/10 min,
  `cambiarModoLibro` 60/h. Por huella de IP: `visitas` 300/10 min, `escaneos` 120/10 min,
  `libro` 10/10 min por muestra; por muestra: `libro` 200/h. Superar el freno de visitas o escaneos
  sólo deja de contar: la redirección y la página andan igual.

## Privacidad

- Nada que identifique a quien visita: ni IP, ni user-agent, ni cookies, ni usuario. Los contadores
  son por día y no se pueden cruzar con nada.
- El libro guarda sólo lo que la persona escribe. Nombre y ciudad son optativos.
- La página `/privacidad` suma dos párrafos: cómo contamos visitas y qué guarda el libro de visitas.

## Reglas puras nuevas en `packages/muestras` (con tests)

- `print.ts`: medidas de marco, cartel y catálogo; orientación; `frameLayout`; `printPpi`,
  `printQuality`, `expectedQuality`; `largestThatFits`; `catalogPlan`; `authorIndex`.
- `dates.ts`: `formatArDayLong`, `dateRangeText`, `addArDays`.
- `hanging.ts`: `parseHangingPlan`, `hangingPlanProblems`, `hangingLayout`, `unassignedWorks`, `formatCm`.
- `stats.ts`: métricas, `isBotUserAgent`, `isPrefetch`, `scanPath`/`scanUrl`, `statsWindow`,
  `dayRange`, `dailySeries`, `statTotals`, `perWorkTotals`, `barChart`.
- `guestbook.ts`: modos y estados, `guestbookInput`, `guestbookProblems`, `hasLinkOrEmail`,
  `guestbookState`, `initialEntryStatus`, `nextEntryStatus`, `guestbookSignature`.
- `panel.ts`: Estadísticas lista.

## Riesgos

- **Columna sin aplicar** en `CulturalActivity` rompe todas las páginas de Muestras: la migración
  va antes del deploy, sin excepción.
- **Calidad de impresión** (D2): con fotos de 2000 px, 50×70 se ve blanda. Lo dice el panel; la
  solución de fondo son los originales en alta de la etapa de Ventas.
- **Imprenta profesional**: los PDF son RGB y sin sangrado (como las fichas). Para marcos y
  catálogo alcanza con una impresora o un laboratorio fotográfico; una imprenta offset puede pedir
  CMYK y sangrado.
- **Tiempo de la función**: 40 fotos pasadas a JPEG ≈ 10–20 s. La ruta declara `maxDuration = 60` y
  procesa una foto por vez para no llenar la memoria.
- **PDF públicos en R2** (D4): quien tenga la dirección baja el PDF. La clave es el hash del
  contenido (no se adivina). Conviene una regla de ciclo de vida de R2 que borre
  `muestras/piezas/` a los 30 días (configuración del bucket, la hace el controlador o Daniel).
- **Números inflables**: cualquiera puede mandar balizas a mano. Los frenos por IP lo acotan; las
  estadísticas son orientativas, no una auditoría.
- **Freno en memoria** = "N por instancia" (mismo límite conocido de las etapas 1 a 3).
- **Spam en el libro** con el modo `PUBLISH`: filtros, freno, `noindex` y moderación posterior.
  Si aparece, el organizador pasa a `REVIEW`.
- **Caracteres fuera de WinAnsi** salen como "?" (igual que las fichas).
- **Escaneos de fichas viejas** cuentan como visitas (D13).

## Fuera de alcance

Plantillas del diseñador para las piezas; subir originales en alta "para imprimir"; CMYK y
sangrado; estadísticas de ventas (van con Ventas); aviso por correo al organizador por cada
comentario; exportar las estadísticas a CSV; reacciones o respuestas en el libro; invitación a la
inauguración y piezas para redes (otras funcionalidades del diseño general).
