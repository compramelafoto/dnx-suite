# FOTOFFICE — Digitalización de VHS y DVD · Parte 1: la Grabadora

Fecha: 2026-10-20 · Estado: diseño de la parte 1 aprobado en chat por Daniel el 20/10/2026; falta su
revisión de este documento.

Un servicio para digitalizar cassettes VHS y DVD de clientes **dentro de FOTOFFICE**: primero para
DNX y preparado para que otros negocios lo enciendan. La computadora del local graba desde una
capturadora USB **en el navegador**, sin guardar el video en el disco, mientras la gente sigue
trabajando en esa misma computadora. Lo grabado sube al almacenamiento en tiempo real; un servidor
lo convierte a Full HD con la marca del negocio, y el cliente recibe un correo para pagar y
descargar.

El proyecto se divide en cuatro partes, cada una con su diseño, su plan y su prueba:

1. **Grabadora** (este documento): capturar, ver, subir, cortar solo; DVD desde una carpeta.
2. **Servidor de conversión**: unir, recortar, corregir la proporción, Full HD 16:9, marca animada.
3. **Pedido y entrega**: correo, pago, descargas, plazos, envío.
4. **Para otros negocios**: módulo encendible, comisión, marca propia, ayudante para apagar la PC.

## Decisiones de Daniel (20/10/2026)

Las de las partes 2 a 4 quedan asentadas acá para no perderlas; cada parte las detalla en su diseño.

| # | Decisión | Parte |
|---|---|---|
| D1 | Todo **en el navegador** (Chrome o Edge), sin programa de Windows. | 1 |
| D2 | Graba **en segundo plano**: la computadora se sigue usando. | 1 |
| D3 | **Ventanita flotante** (como Meet) con vista previa, tiempo, subida, señal y "Detener". | 1 |
| D4 | **Corte automático** tras **5 minutos sin imagen** (configurable por negocio). Se recorta el final **y el comienzo** sin imagen. | 1 y 2 |
| D5 | "La imagen se ve estirada" **por casilla**, recordada por equipo (no se detecta sola). | 1 y 2 |
| D6 | DVD: **un clic** para elegir la carpeta `VIDEO_TS`; todos los videos **de corrido en uno solo**. Sin problema con el peso ni con DVD originales. | 1 y 2 |
| D7 | Video final **Full HD 1920×1080, 16:9**, imagen 4:3 sin estirar y barras negras a los costados. | 2 |
| D8 | Marca abajo a la derecha: "Digitalizado por:", el logo y el WhatsApp con su número; **entra animada cada 10 minutos**. Cada negocio, la suya. | 2 y 4 |
| D9 | La conversión corre en **un VPS compartido** con el servidor de FTP de CLF (reparte el costo fijo). | 2 |
| D10 | Subida **directo al almacenamiento** en pedacitos (no por streaming al VPS). | 1 |
| D11 | Se integra con lo que ya existe: Cobrador, pedido con seña y saldo, **un trabajo por cassette o DVD**; un pedido puede tener varios. | 3 |
| D12 | Envío del correo al terminar: **lo elige cada pedido** ("Enviar al cliente automáticamente al terminar"); si no, queda "Listo para enviar". | 3 |
| D13 | Pago por Mercado Pago o **transferencia al alias de Mercado Pago ya conectado**, detectada sola (la "espera de transferencia" que ya existe). | 3 |
| D14 | Descargas: **3 por video**; cada descarga extra cuesta **el 25 % del precio de ese video**. | 3 |
| D15 | Los videos quedan **30 días**; avisos por correo **10, 5 y 1 día** antes de borrarse; extensión de 30 días más por **el 50 % del precio del pedido**. | 3 |
| D16 | **30 días para retirar los cassettes**; después se descartan, explicando que no hay espacio para guardarlos. | 3 |
| D17 | Envío por cadetería: el cliente lo pide y carga el domicilio (con sugerencias de Google), que **se guarda en su ficha**; precio por **franjas de kilómetros** desde el local, calculadas con Google. PedidosYa Envíos queda para más adelante. | 3 |
| D18 | Otros negocios: comisión **5 %** (la de siempre por módulo). En transferencias, la comisión queda como **saldo pendiente y se descuenta de otra comisión acumulada**, como con los pagos manuales de cuotas de la SFPR. | 4 |
| D19 | **Apagar la computadora al terminar**: ayudante opcional que se instala una vez; aviso de **60 segundos** con "Cancelar"; apaga cuando todo terminó de subir. | 4 |
| D20 | Precio del servicio: **a confirmar** (se carga como producto del catálogo). | 3 |

## Estado de partida (verificado el 20/10/2026 en `origin/main`)

| Pieza | Estado real | Consecuencia |
|---|---|---|
| Módulos (`lib/modules/registry.ts`, `WorkspaceFeatureModule`, `lib/modules/gating.ts`) | Catálogo con encendido por negocio y menú configurable. | "Digitalización" es un módulo más: `digitalizacion`, encendido sólo en DNX. |
| Pedidos y trabajos (`FotofficePedido`, `FotofficeProyecto`) | Pedido con seña, saldo, cuotas y enlace público; **un trabajo por renglón del pedido** (`pedidoId` + `pedidoItemIndex`). | La grabación se ata a un trabajo. Cassettes de un mismo renglón se distinguen por **número de cassette**. La parte 3 decide si cada cassette es su propio trabajo. |
| Carpeta del trabajo (`FotofficeArchivoTrabajo`, `app/actions/carpetas.ts`) | Archivos del trabajo en el bucket **privado** de R2, subidos con URL firmada; al subir pasa a "Listo para retirar" y avisa al cliente. El comentario del modelo ya nombra "un VHS digitalizado". | El video final (parte 2) entra como archivo de la carpeta del trabajo; se reutiliza su aviso. |
| R2 privado (`lib/ficha/adjuntos-r2.ts`, `clienteR2Privado()`, `R2_PRIVATE_BUCKET`) | Cliente S3 y firma de URLs para el bucket privado. | Los pedacitos van al bucket privado con su propio prefijo. **No** se usa el bucket público de imágenes. |
| Servidor de video (`apps/compramelafoto-workers/video`) | ffmpeg con cola en tabla; **nunca desplegado**. | Base para la parte 2. |
| Servidor de FTP (`camera-ftp-gateway`) | **No desplegado** (decisión del 19/10). | Comparte el VPS en la parte 2. |

## Parte 1: la Grabadora

### 1. Dónde vive

- Módulo **`digitalizacion`** en `MODULE_REGISTRY` (categoría GENERAL, `AVAILABLE`), ruta
  `/digitalizacion`, encendido por negocio con `WorkspaceFeatureModule`. Al inicio, sólo DNX.
- Dos pantallas:
  - **Grabar** (`/digitalizacion/grabar`): la estación de grabación.
  - **Grabaciones** (`/digitalizacion`): lista con estado, trabajo y cassette, duración, motivo de
    fin, tamaño subido, y las acciones "Continuar", "Terminar con lo grabado", "Descartar" y
    "Descargar crudo".
- Requiere **Chrome o Edge de escritorio** (versión 116 o mayor). En otro navegador la estación
  muestra un aviso y no deja grabar.

### 2. La estación de grabación

1. **Equipo**: dos listas con las entradas de video y de audio (`enumerateDevices`). La elección se
   recuerda en el navegador.
2. **Vista previa** con medidor de audio. Se pide a la capturadora 1920×1080 a 30 cuadros.
3. **Calidad**: Alta (6 Mbps), **Media (4 Mbps, por defecto, ~1,8 GB por hora)**, Baja (2,5 Mbps).
   Audio a 128 kbps.
4. **"La imagen se ve estirada"**: casilla con una guía 4:3 sobre la vista previa. Se guarda por
   equipo y viaja con cada grabación para que el servidor la corrija.
5. **Calibrar "sin señal"**: con la videocasetera apagada, toma 5 segundos de la pantalla y guarda
   su "huella" (una grilla de 8×8 colores promedio). Se guarda por equipo.
6. **Asignar**: elegir trabajo (buscador por cliente o número de pedido) y número de cassette, o
   "Sin pedido (prueba)".
7. **Grabar**: el mismo clic arranca la grabación y abre la ventanita flotante.

**Equipo** = la combinación de capturadora y conversor, identificada por la etiqueta del
dispositivo de video. Su configuración (huella sin señal y casilla de estirada) se guarda **en la
base**, por negocio, y se copia en el navegador. Así sobrevive si se borra el navegador.

Antes de la **primera** grabación en ese navegador se muestra una lista para tildar: "La computadora
no se suspende (Configuración → Sistema → Energía)" y "La capturadora no se usa en Meet ni en Zoom".

### 3. La ventanita flotante

- Usa **Document Picture-in-Picture**: una ventana chica que queda arriba de todo y se puede mover y
  achicar.
- Muestra:
  - la vista previa (sin sonido);
  - **● GRABANDO** y el tiempo;
  - el estado de la subida: "al día" o "pendiente: X MB";
  - el estado de la señal: "OK" o "Sin imagen hace m:ss — se corta en m:ss";
  - el botón **Detener**.
- Si se cierra (por ejemplo, porque otra página abrió la suya), **la grabación sigue**; la estación
  ofrece "Abrir ventanita" para volver a mostrarla.
- La página principal **nunca reproduce el audio** por los parlantes.

### 4. Funcionamiento en segundo plano

- **Grabación**: `MediaRecorder` con `timeslice` de 10 s.
  - El formato se elige según lo que soporte el navegador, en este orden:
    `video/mp4;codecs=avc1,mp4a.40.2`, `video/webm;codecs=h264,opus`, `video/webm;codecs=vp9,opus`.
  - El formato elegido se guarda en la grabación.
  - Una pestaña que captura cámara no se congela ni se descarta, y los eventos de `MediaRecorder` y
    las subidas siguen con la ventana minimizada.
- **Análisis de imagen**: en un **Web Worker**, con `MediaStreamTrackProcessor` sobre una copia de la
  pista de video. Toma **un cuadro por segundo**, lo achica a 64×36 en un `OffscreenCanvas` y lo
  clasifica. El worker no depende de los temporizadores de la página, que el navegador frena en
  segundo plano.
- **Latido**: cada 30 s la estación informa al servidor duración, bytes, último segundo con imagen y
  tramos sin señal. Si una grabación en curso pasa **3 minutos sin latido**, la lista la muestra como
  **Interrumpida**. Ese estado se calcula al leer, sin tarea programada.
- Mientras graba o sube, `beforeunload` pide confirmación para cerrar.

### 5. Subida en pedacitos

1. Cada pedacito pide su URL firmada, sube y confirma:
   - `POST /api/digitalizacion/grabaciones/[id]/partes` con `{ tramo, indice, bytes }` → URL `PUT`
     firmada por 15 minutos para la clave
     `digitalizacion/<workspaceId>/<grabacionId>/t<tramo>/<indice con 6 dígitos>.<ext>` en
     `R2_PRIVATE_BUCKET`;
   - `PUT` directo a R2;
   - `POST .../partes/confirmar` verifica con `HEAD` que el objeto existe y que su tamaño coincide,
     y marca la parte LISTA.
2. **Cola en IndexedDB**: cada pedacito se guarda ahí hasta que se confirma. Así sobrevive a un corte
   de internet o a recargar la página.
   - Se suben hasta 2 a la vez.
   - Se reintenta con espera creciente (de 2 s hasta 60 s) mientras la página siga abierta.
   - Al confirmarse, se borra de la cola.
3. Pedir de nuevo una parte ya confirmada no la pisa: la constraint única
   `(grabacionId, tramo, indice)` + la clave determinística hacen idempotente el reintento.
4. El bucket privado necesita CORS para `PUT` desde `fotoffice.com` (y `localhost` para desarrollo).
   **Verificar en la implementación** si la carpeta del trabajo ya lo dejó configurado.

### 6. Corte automático

**Qué se mide en cada cuadro de 64×36:**
- brillo medio;
- saturación media;
- dominancia de azul;
- varianza espacial;
- diferencia con el cuadro anterior;
- distancia a la **huella calibrada**.

**Cómo se clasifica cada segundo** (función pura, testeable):

| Clase | Regla (umbrales ajustables, a calibrar con el equipo real) |
|---|---|
| `SIN_SENAL_CALIBRADA` | Distancia a la huella menor que el umbral. |
| `NEGRO` | Brillo medio muy bajo y varianza baja. |
| `AZUL` | Azul dominante, uniforme y saturado (pantalla azul de la videocasetera). |
| `NIEVE` | Varianza espacial alta, poca saturación y **casi sin correlación** con el cuadro anterior. |
| `CONGELADA` | Diferencia con el cuadro anterior ≈ 0 durante **60 s seguidos** o más. |
| `IMAGEN` | Ninguna de las anteriores. |

**Cómo se decide el corte:**
- **Contador**: arranca en el primer segundo sin imagen.
  - Se reinicia sólo tras **3 segundos seguidos** con `IMAGEN`, para que un parpadeo no lo reinicie.
  - Al llegar a **`minutosSinSenal`** (por negocio, 5 por defecto), detiene la grabación con motivo
    `SIN_SENAL`.
- **Puntos de recorte** (los aplica la parte 2):
  - `primeraImagenSeg`: el primer segundo de un bloque de 3 s seguidos con imagen.
  - `ultimaImagenSeg`: el último segundo con imagen antes del bloque final sin señal.
  - El servidor deja **5 segundos de margen** a cada lado.
  - Si toda la grabación queda sin imagen, se marca y **no se convierte**.
- **Tope de seguridad**: **8 h 30 min** (cintas en modo LP o EP); motivo `TOPE`.
- **Detener a mano**: motivo `MANUAL`; los recortes de comienzo y final se aplican igual.

### 7. Cortes e interrupciones

- **Internet**: la cola de IndexedDB espera y reintenta; la grabación no se detiene.
- **Se cuelga el navegador o se corta la luz**: lo confirmado queda en R2 y la grabación aparece
  Interrumpida. La lista ofrece dos acciones:
  - **Continuar**: abre la estación con el mismo trabajo y cassette y graba el **tramo siguiente**.
    El servidor une los tramos en orden. El análisis del nuevo tramo arranca de cero.
  - **Terminar con lo grabado**: la cierra como COMPLETA con lo que hay.
- Al reabrir la estación, si en IndexedDB quedaron pedacitos sin subir de una grabación anterior, se
  suben primero.
- **Descartar** borra los pedacitos de R2 y deja la grabación como DESCARTADA.

### 8. DVD

1. Botón **"Digitalizar DVD"**: `showDirectoryPicker()`. Si se elige la raíz del disco, se busca
   `VIDEO_TS` adentro.
2. Se toman los `VTS_NN_M.VOB` con **M ≥ 1** (los `_0.VOB` son menús), ordenados por NN y después
   por M. La lista con nombres y tamaños se guarda en `dvdArchivos`.
3. Cada archivo se lee en **pedacitos de 16 MB** (`File.slice`) y sube por la **misma cola** de
   partes (tipo DVD, tramo 1). La ventanita muestra el avance (archivos y GB).
4. Al terminar: COMPLETA con motivo `DVD_COMPLETO`. La unión y la conversión son de la parte 2.

No hay análisis de señal ni recortes en DVD.

### 9. Descargar crudo (para comprobar la parte 1)

En la lista, "Descargar crudo":
- pide URLs `GET` firmadas de las partes en orden;
- las escribe una tras otra en un archivo que elige el usuario (`showSaveFilePicker`, escritura en
  streaming).

No pasa por Vercel (que no puede servir varios GB) y no ocupa memoria. Es una herramienta de
verificación; la entrega real al cliente es la de la parte 3.

### 10. Apagar al terminar

La casilla "Apagar la computadora al terminar" queda **preparada pero oculta**. Aparece cuando la
parte 4 entregue el ayudante y la estación lo detecte en `127.0.0.1`.

### 11. Modelo de datos (tablas nuevas, sin tocar las existentes)

```prisma
model DigitalizacionGrabacion {
  id                String    @id @default(cuid())
  workspaceId       String
  proyectoId        String?   // trabajo del pedido; null = prueba
  cassetteNumero    Int?
  tipo              String    // VHS | DVD
  estado            String    @default("GRABANDO") // GRABANDO | COMPLETA | DESCARTADA (Interrumpida se calcula)
  motivoFin         String?   // MANUAL | SIN_SENAL | TOPE | DVD_COMPLETO | TERMINADA_CON_LO_GRABADO
  mimeType          String?
  calidad           String?   // ALTA | MEDIA | BAJA
  corregirProporcion Boolean  @default(false)
  equipoId          String?
  tramos            Int       @default(1)
  duracionSeg       Int       @default(0)
  bytesSubidos      BigInt    @default(0)
  primeraImagenSeg  Int?
  ultimaImagenSeg   Int?
  sinImagen         Boolean   @default(false)
  tramosSinSenal    Json?     // [{ tramo, desde, hasta, clase }]
  dvdArchivos       Json?     // [{ nombre, bytes }]
  ultimoLatidoAt    DateTime?
  iniciadaAt        DateTime  @default(now())
  terminadaAt       DateTime?
  createdByUserId   Int?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  partes            DigitalizacionParte[]
  @@index([workspaceId, createdAt])
  @@index([proyectoId])
}

model DigitalizacionParte {
  id          String   @id @default(cuid())
  grabacionId String
  tramo       Int
  indice      Int
  key         String   @unique
  bytes       BigInt   @default(0)
  estado      String   @default("PENDIENTE") // PENDIENTE | LISTA
  createdAt   DateTime @default(now())
  @@unique([grabacionId, tramo, indice])
}

model DigitalizacionEquipo {
  id                 String   @id @default(cuid())
  workspaceId        String
  etiqueta           String   // label del dispositivo de video
  huellaSinSenal     Json?
  corregirProporcion Boolean  @default(false)
  updatedAt          DateTime @updatedAt
  @@unique([workspaceId, etiqueta])
}

model DigitalizacionAjustes {
  workspaceId     String @id
  minutosSinSenal Int    @default(5)
}
```

Relaciones con `Workspace` (Cascade) y `FotofficeProyecto` (SetNull) según el patrón del schema.
Migración **escrita a mano y aplicada antes del deploy** (FOTOFFICE no tiene staging, y una columna
sin aplicar rompe todo el modelo). Sólo crea tablas nuevas.

### 12. Rutas y permisos

| Ruta | Qué hace |
|---|---|
| `POST /api/digitalizacion/grabaciones` | Crea la grabación (tipo, trabajo, cassette, equipo, calidad, formato). |
| `PATCH /api/digitalizacion/grabaciones/[id]` | Latido y cierre (duración, bytes, señal, recortes, motivo). |
| `POST /api/digitalizacion/grabaciones/[id]/partes` | URL firmada para subir una parte. |
| `POST /api/digitalizacion/grabaciones/[id]/partes/confirmar` | Verifica con HEAD y marca LISTA. |
| `GET /api/digitalizacion/grabaciones/[id]/partes` | URLs firmadas de lectura, en orden (Descargar crudo). |
| Acciones de servidor | Continuar, Terminar con lo grabado, Descartar; guardar equipo y ajustes. |

Todas exigen sesión, el módulo encendido en el negocio y que la grabación sea de ese negocio. Las
claves se arman en el servidor y se validan con una regex propia. El navegador nunca elige la clave.

### 13. Pruebas

**Automáticas (Vitest):**
- clasificador de cuadros con imágenes sintéticas: negro, azul, nieve, congelada, huella calibrada,
  imagen normal;
- contador de corte: parpadeos, reinicio a los 3 s y corte exacto a los N minutos;
- cálculo de `primeraImagenSeg` y `ultimaImagenSeg`;
- orden y filtro de los VOB;
- armado y validación de claves;
- idempotencia de partes;
- estado Interrumpida calculado por latido.

**Prueba real (criterio de aceptación de la parte 1):**
1. Calibrar con el conversor AV a HDMI y la capturadora de DNX.
2. Grabar **una cinta de 2 horas** mientras alguien usa la computadora con normalidad (ventana
   minimizada, otras aplicaciones abiertas), y dejar que **corte sola** al terminar la cinta.
3. Verificar:
   - se cortó a los 5 minutos sin imagen;
   - `ultimaImagenSeg` coincide con el final real de la cinta;
   - "Descargar crudo" da un archivo que se reproduce entero, con sonido;
   - no quedaron partes pendientes.
4. Cortar internet 2 minutos durante la grabación y verificar que se recupera.
5. Cerrar el navegador a la fuerza, usar **Continuar** y verificar los dos tramos.
6. Un DVD casero: verificar que se suben todos los VOB en orden.

**Requisito de hardware**: conversor AV (RCA) a HDMI entre la videocasetera y la capturadora.

### 14. Fuera de la parte 1

Conversión, Full HD, proporción, marca animada, unión de tramos y VOB (parte 2); correos, pagos,
descargas, plazos y envío (parte 3); otros negocios, comisión y ayudante de apagado (parte 4).
Hasta la parte 2, los pedacitos de grabaciones COMPLETAS quedan en R2 sin borrarse; la parte 2 define
su limpieza.
