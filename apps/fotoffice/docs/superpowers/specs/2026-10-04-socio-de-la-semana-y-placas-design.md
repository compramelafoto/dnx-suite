# Socio de la semana y placas de Comunicación — diseño

Fecha: 04/10/2026. Decidido con Daniel en las sesiones del 02/10 y del 04/10.

## Para qué

La fotografía es un oficio que se hace mejor en comunidad. FOTOFFICE presenta cada semana a un
socio, para que los colegas se conozcan más allá del nombre y armen una **red de contactos
fuerte**: a quién recomendar, con quién asociarse en un evento grande, a quién pedirle un
reemplazo o un consejo. El área de Comunicación lo difunde en redes con una placa, y además da
la bienvenida en redes a cada socio nuevo.

Orden de construcción:

1. **Comunicación → Placas** (este documento, Parte 1).
2. **Socio de la semana** (Parte 2).
3. **Clickatoner de la semana**, en Clickatón. Queda para después: es otra aplicación y hoy su
   rotación estaría vacía hasta que la 1ª edición publique sus resultados.

---

## Parte 1 — Comunicación → Placas

### Quién la usa

Quien tenga activo el módulo **Comunicación**: el dueño, los administradores y quien tenga un
rol con Comunicación. Con "Ver" se pueden ver y descargar las placas, copiar el texto y
marcarlas como publicadas. Con "Gestionar", además, diseñar las plantillas y sumar o quitar
bienvenidas a mano. Quien sólo gestiona Comunicación abre en el editor únicamente las plantillas
de placa, nunca el carnet.

### Las plantillas las diseña Comunicación

- Hay dos **tipos** de plantilla: **Bienvenida al nuevo socio** y **Socio de la semana**.
- Cada tipo tiene dos **formatos**: **cuadrado** (1080×1080, para publicaciones) y
  **historia** (1080×1920, vertical).
- Se diseñan con el **mismo diseñador del carnet**: fondo, colores, tipografías, logo y dónde
  va cada cosa.
- La primera vez se arranca desde un **diseño base**, para no empezar con la hoja en blanco.
  Desde ahí Comunicación lo cambia como quiera. Si no la crearon todavía, la placa sale con ese
  diseño base.
- Cada plantilla se identifica por una marca en su versión (`templateKey`), igual que el
  carnet:
  - `placa-bienvenida-cuadrada-v1`, `placa-bienvenida-historia-v1`
  - `placa-socio-semana-cuadrada-v1`, `placa-socio-semana-historia-v1`
- Las plantillas de placa no aparecen en la lista del diseñador del carnet, y viceversa.

### Datos que se completan solos

| Dato | Clave | De dónde sale |
|---|---|---|
| Nombre y apellido / nombre | `fullName`, `firstName` | ficha del socio |
| Foto de perfil | `profilePhoto` | foto del portal; si no hay, la del carnet |
| Zona | `zone` | ciudad y provincia del estudio; si no, las personales |
| Especialidad | `specialty` | sus especialidades, separadas por " · " |
| Socio desde | `joinedAt` | fecha de alta |
| Número de socio | `memberNumber` | ficha |
| Instagram | `instagramHandle` | `@usuario` |
| Institución y logo | `institutionName`, `institutionLogo` | configuración de la institución |
| Frase de "Más sobre mí" | `aboutPhrase` | Parte 2 |
| Fotos 1, 2 y 3 | `featuredPhoto1..3` | Parte 2, elegidas por el socio |

Todos son opcionales: una placa nunca deja de salir porque falte un dato. Lo que falta no se
dibuja.

### Qué ve Comunicación

**Comunicación → Placas** tiene tres pestañas:

- **Bienvenidas.** Cada socio nuevo aparece solo en la lista cuando **paga su primera cuota**
  (cuando la solicitud pasa a `COMPLETADA`). Para cada uno:
  - la vista de la placa, cuadrada e historia;
  - **Descargar** (PNG);
  - **Copiar texto sugerido** (con su @ de Instagram para etiquetarlo);
  - **Marcar como publicada**, para saber cuáles ya se subieron a las redes.
  - Si no tiene foto de perfil, la lista lo marca "sin foto" y la placa sale con sus iniciales.
- **Socio de la semana.** El de esta semana y el historial, con lo mismo. Se llena en la Parte 2.
- **Plantillas.** Las cuatro plantillas, con "Crear desde el diseño base" o "Editar".

### Cómo se generan

- La placa se **genera en el momento de abrirla o descargarla**. No se guarda la imagen. Así
  siempre sale con la foto y la plantilla vigentes.
- Se dibuja con `@repo/design-studio` (PDF → PNG con `mupdf`, sin navegador), igual que las
  placas de participante de Clickatón.
- Las fotos se pasan antes por `sharp`: las WebP (que `mupdf` no lee) se convierten, se
  enderezan según su EXIF y se achican a 1600 px.
- Una imagen sin dato —el socio sin foto, las fotos destacadas que todavía no eligió— se quita
  del diseño antes de dibujar. El módulo de diseño la trataría como error y no emitiría la
  placa.
- El módulo de diseño todavía no dibuja las esquinas redondeadas de un **rectángulo** (las de
  una imagen sí). El diseño base no las usa; queda anotado para corregirlo en el módulo.
- La entrada de la lista de bienvenidas se crea en `completeApplicationIfPaid`. Si falla, el
  alta del socio sigue igual: el error se registra y no se propaga.

### Datos nuevos

Una tabla, `MemberWelcome` (migración `20261005000000_fotoffice_member_welcome`):

- `id`, `workspaceId`, `memberId` (único: un socio se recibe una sola vez)
- `source`: `AUTO` (al pagar la primera cuota) o `MANUAL` (lo sumó Comunicación: socios dados de
  alta a mano o importados, que nunca entran solos)
- `publishedAt`, `publishedByUserId` (marca "ya publicada")
- `createdAt`

El Socio de la semana (Parte 2) lleva su propia tabla de rotación con su marca de publicada: un
socio puede salir en varias vueltas y no cabe en una fila única por socio.

El SQL se aplica a mano en producción antes de fusionar y se registra con
`prisma migrate resolve --applied`.

### Arreglos de base

- **El carnet** buscaba "la última plantilla editada" y, si no era la suya, volvía al diseño de
  fábrica. Con las placas eso pasaría siempre. Ahora toda plantilla con marca se busca por su
  marca (`findTemplateByKey`), y el carnet también.
- **El módulo Comunicación** pasa de "planeado" a disponible, con su clave
  `COMMUNICATIONS_MODULE_KEY`. Lo enciende el super admin por institución, como los demás.
- **Permisos:** las plantillas de placa las edita quien tiene Comunicación en "Gestionar". El
  carnet sigue con Socios en "Gestionar".

---

## Parte 2 — Socio de la semana

### "Más sobre mí"

Una pestaña nueva en el perfil del socio, en el portal. Arriba lleva este texto:

> **¿Para qué es esto?**
> La fotografía es un oficio que se hace mejor en comunidad. Cada semana la institución
> presenta a un socio como **Socio de la semana**, para que nos conozcamos más allá del nombre:
> de dónde sos, qué te apasiona, en qué podés dar una mano y en qué te gustaría crecer.
>
> Conocerse es el primer paso para armar una **red de colegas fuerte**: alguien a quien
> recomendar cuando no podés tomar un trabajo, con quien asociarte en un evento grande, a quien
> pedirle un reemplazo o un consejo. Muchas alianzas y trabajos futuros nacen de una charla
> entre colegas.
>
> Todas las preguntas son opcionales y sólo se muestra lo que contestes. En algún momento te va
> a tocar ser el Socio de la semana: cuanto más completes, mejor te van a conocer.

Preguntas, todas opcionales y de respuesta corta:

1. ¿Cómo empezaste en la fotografía?
2. ¿Qué es lo que más te apasiona fotografiar?
3. ¿Qué fotógrafo o fotógrafa te inspira?
4. ¿Con qué equipo trabajás? (cámara o lente favoritos)
5. Una foto tuya de la que estés orgulloso/a y por qué (con link)
6. ¿En qué podés dar una mano a otros colegas?
7. ¿En qué te gustaría que te ayuden o aprender?
8. Algo de vos que no tenga que ver con la foto

Además:

- Casilla **"Quiero que mis colegas me escriban por WhatsApp"**. Usa el teléfono del perfil.
- Casilla de aviso: **"Sé que en algún momento voy a aparecer como Socio de la semana en el panel
  de los socios."**
- Elegir **hasta 3 fotos** para su placa, de su portfolio o subidas en el momento.

### La rotación

- Cada **viernes a las 00:00 (hora argentina)** se elige un socio al azar. Queda destacado hasta
  el jueves a las 23:59.
- Entran **todos los socios activos**, hayan completado o no "Más sobre mí".
- **Nadie se repite hasta que salieron todos**; después empieza una vuelta nueva. Quien se
  asocia en el medio entra en la vuelta en curso.
- Queda registrado quién salió, en qué semana y en qué vuelta.
- El administrador puede **saltear** a un socio (pidió no salir o dejó de estar activo). En ese
  caso se elige otro al azar en el momento. Si un socio se da de baja durante su semana, deja de
  mostrarse.
- Si un viernes falla la tarea automática, el socio se elige la próxima vez que alguien entra al
  panel. Nunca queda una semana vacía.
- La elección es al azar y queda registrada, pero sin la prueba pública de los sorteos.

### La tarjeta en el panel de los socios

Arriba del panel del portal:

- foto de perfil, nombre, zona y especialidad;
- las respuestas de "Más sobre mí" que contestó;
- una frase armada con las preguntas 6 y 7, por ejemplo: *"Juan puede darte una mano con
  iluminación de estudio y quiere aprender video."*;
- **"Escribile por WhatsApp"**, sólo si el socio lo aceptó, con un mensaje ya escrito;
- sus redes, su web y el link a su portfolio publicado;
- la invitación: *"Conocelo, escribile, ofrecele una mano. Las mejores alianzas empiezan con una
  charla entre colegas."*

El socio destacado ve *"¡Esta semana sos el Socio de la semana!"* y, si no completó "Más sobre
mí", un botón para completarlo.

### Reglas de privacidad

- El botón de WhatsApp **sólo aparece si el socio lo aceptó** y **sólo dentro del portal**, con
  sesión iniciada. Al escribir por WhatsApp quien escribe ve el número: por eso es opcional.
- En el **sitio público** hay un bloque opcional "Socio de la semana". Sólo muestra a quien dio
  permiso para aparecer en público (`directoryOptIn`) y nunca muestra WhatsApp, teléfono ni
  correo. Si el socio de esa semana no dio permiso, el bloque no aparece esa semana.

### Comunicación

- Ve al socio recién el viernes, sin anticipación.
- En **Comunicación → Placas → Socio de la semana** tiene la placa cuadrada e historia, el texto
  sugerido con su @ y la marca de publicada.
- El viernes ve un aviso en su tablero: *"Ya está el Socio de la semana: María López. Su placa
  está lista."*

### Cómo quedó programado (04/10)

- Tablas `MemberAboutMe` (una fila por socio) y `MemberSpotlight` (una fila por elección, con
  `round`, salteo y marca de publicada). Migración `20261006000000_fotoffice_socio_de_la_semana`.
- La rotación vive dentro del módulo Comunicación: con el módulo apagado no se elige a nadie.
- Elige la tarea `/api/cron/socio-de-la-semana`, que corre cada hora a los 5 minutos (la pasada
  del viernes 00:05 elige; las demás no hacen nada). La primera visita al panel del socio, a
  Comunicación o al inicio de la institución también elige, si la tarea no corrió. Un candado de
  Postgres por institución (`pg_advisory_xact_lock`) impide que dos elecciones simultáneas elijan
  a dos socios distintos. El sitio público **no** elige: no queremos que un robot de búsqueda
  mueva la rotación.
- Las fotos que el socio sube sólo para la placa van a `fotoffice/member-featured/<institución>/
  <socio>/`, con subida directa a R2 como el portfolio. Sólo se aceptan esas y las de su portfolio.
- La placa del socio de la semana toma sola la frase (lo que más le apasiona) y las fotos elegidas.
- En el sitio público, el bloque "Socio de la semana" está en la categoría **Socios** del
  constructor.
- El inicio de la institución avisa a Comunicación cuando la placa de la semana está sin publicar
  y cuántas bienvenidas faltan publicar.

### Fuera de alcance por ahora

- Avisar por correo o WhatsApp a todos los socios cuando sale uno nuevo.
- **Publicar directo en Instagram (feed e historias).** Es posible: la suite ya tiene
  `@repo/social-publisher`, que publica imágenes y historias en Instagram a través de la API
  oficial de Meta. Para FOTOFFICE harían falta la conexión de la cuenta de Instagram de cada
  institución (cuenta profesional vinculada a una página de Facebook), la aprobación de la app
  por Meta y una cola de publicación con aprobación previa de Comunicación. Se diseña aparte
  cuando las placas estén en uso.
