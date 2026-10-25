# FOTOFFICE — Digitalización de VHS y DVD · Parte 2: Conversión

Fecha: 2026-10-20 · Estado: decisiones tomadas por el controlador con autorización explícita de
Daniel ("seguí con la parte 2 hasta producción, tomá las decisiones por tu cuenta"). Basado en las
decisiones D7, D8 y D9 del diseño de la parte 1
(`2026-10-20-fotoffice-digitalizacion-grabadora-design.md`).

Convierte cada grabación terminada (VHS o DVD) en **un MP4 Full HD 16:9** con la imagen sin estirar,
barras negras a los costados, recortado al comienzo y al final, con la **marca animada del negocio
cada 10 minutos**, y lo guarda en el R2 privado. Después borra los pedacitos crudos.

## Decisiones

| # | Decisión | Por qué |
|---|---|---|
| P1 | Corre como **Cloud Run Job** en el proyecto GCP **`dnx-video-worker`** (el mismo del procesador de videos de CLF), disparado por **Cloud Scheduler cada 15 minutos**. Reemplaza el "VPS compartido" de D9. | Ya existe la cuenta, la facturación con tope de avisos, Artifact Registry, las claves de R2 en Secret Manager y el patrón probado en producción. Se paga sólo el tiempo de conversión; no hay servidor fijo. Un VPS pedía crear una cuenta nueva. |
| P2 | Paquete nuevo **`apps/fotoffice-workers/digitalizacion`** (`fotoffice-digitalizacion-worker`), mismo estilo que `apps/compramelafoto-workers/video`: `config.ts` con zod, modo `drain`, Dockerfile con ffmpeg. | Separado del de CLF: otra base, otro bucket, otro ciclo de vida. |
| P3 | **Sin disco**: cada tramo se lee de R2 en streaming y entra a ffmpeg por una tubería con nombre (FIFO); la salida es MP4 fragmentado por `stdout` que sube a R2 con subida multiparte. | Cloud Run guarda `/tmp` en memoria: 3 h de cinta (~5 GB crudos + ~11 GB final) no entran. |
| P4 | Video final: **1920×1080, 30 cuadros, H.264 High, CRF 21 con tope 10 Mbps, AAC 192 kbps 48 kHz**, contenedor MP4 fragmentado (`frag_keyframe+empty_moov+default_base_moof`). | Full HD estándar (D7), reproducible en navegadores, VLC, QuickTime y televisores; ~3,5 GB por hora. |
| P5 | Imagen: primero se corrige el pixel no cuadrado (`scale=iw*sar:ih,setsar=1`); si la grabación tiene **"estirada"**, se lleva a 4:3 (`scale=1440:1080`); si no, se encaja en 1920×1080 sin deformar (`force_original_aspect_ratio=decrease`); barras negras (`pad`) y desentrelazado sólo de los cuadros entrelazados (`yadif=deint=interlaced`). | D5 y D7: forma real, barras negras, Full HD. Los DVD caseros vienen 720×480 entrelazados con pixel no cuadrado. |
| P6 | Recortes VHS: el tramo 1 empieza en `max(0, primeraImagenSeg − 5)`; el tramo `ultimaImagenTramo` termina en `ultimaImagenSeg + 5`; los tramos posteriores se descartan. Con `sinImagen` la grabación pasa a **SIN_IMAGEN** y no se convierte. DVD: sin recortes. | D4 y spec parte 1 §6 (5 s de margen). |
| P7 | Varios tramos (VHS) se unen en orden con el filtro `concat`. Los VOB de un DVD se concatenan byte a byte en una sola entrada (MPEG-PS lo admite). | Spec parte 1 §7 y §8. |
| P8 | Marca: imagen PNG armada por el worker con `sharp` desde `FotofficeWorkspaceBranding` del negocio: "Digitalizado por:", el **logo** (`logoUrl`; si no hay, el `commercialName` en texto) y el **ícono de WhatsApp con el número** (`whatsapp`; si no hay, se omite esa línea). Abajo a la derecha, 40 px del borde. | D8; cada negocio la suya. |
| P9 | Animación: aparece **en el minuto 1 y después cada 10 minutos**, queda **8 s**, **entra deslizándose desde la derecha en 0,6 s y sale igual**. Se hace con la expresión `x` del filtro `overlay` (sin decodificar nada extra). | D8 ("entra como una animación cada 10 min"); el minuto 1 es la suposición ya aceptada en la parte 1. |
| P10 | Cola en la base: columnas nuevas en `DigitalizacionGrabacion`. Al cerrar o "terminar con lo grabado", la grabación queda **PENDIENTE** de conversión. El worker toma una con `FOR UPDATE SKIP LOCKED`, sólo si terminó hace **15 minutos o más** (margen para pedacitos atrasados) y no tiene partes PENDIENTE de menos de 30 minutos. | Varias ejecuciones en paralelo no se pisan; no se convierte una cinta a la que le falta el final. |
| P11 | Reintentos: hasta **3 intentos**; un PROCESANDO con más de **6 h** sin terminar vuelve a PENDIENTE (o pasa a ERROR al tercer intento). | Una cinta de 8 h 30 tarda menos de 6 h con 4 vCPU a `veryfast`; si el contenedor se cae, no queda trabada. |
| P12 | Al terminar bien: guarda `videoKey` (`digitalizacion/<ws>/<id>/final.mp4`), tamaño y duración, y **borra los pedacitos** `t*/`. Desde ese momento el servidor rechaza partes nuevas de esa grabación y "Descargar crudo" ya no está. | D10 parte 1 (borrar pedacitos para no pagar dos veces). |
| P13 | Recursos del job: **4 vCPU, 4 GiB**, tope de tarea **24 h**, 1 tarea por ejecución, cada ejecución convierte grabaciones hasta vaciar la cola o pasar 20 h. | Cloud Run Jobs admite hasta 24 h por tarea. |
| P14 | Pantalla: la lista muestra el estado de conversión ("En cola", "Convirtiendo…", "Video listo", "Sin imagen", "Error") y, con video listo, **"Ver video"** y **"Descargar video"** (URLs firmadas); con error, **"Reintentar conversión"**. | Cierra la etapa visible para el negocio; la entrega al cliente es la parte 3. |
| P15 | Claves: reutiliza los secretos de R2 que ya existen en `dnx-video-worker` (misma cuenta de Cloudflare) y **un secreto nuevo `FOTOFFICE_DATABASE_URL`** que carga Daniel. Si la clave de R2 de CLF no alcanza a `fotoffice-private`, se agregan `FOTOFFICE_R2_ACCESS_KEY_ID` / `FOTOFFICE_R2_SECRET_ACCESS_KEY` (el worker las prefiere si existen). | El controlador no lee ni carga credenciales. |

**Costo estimado** (dólar a ~1.500 pesos): una cinta de 3 h se convierte en ~1,5–3 h de 4 vCPU →
**~1.000 a 1.500 pesos por cinta**; las ejecuciones vacías del reloj entran en la franja gratis de
Cloud Run (lo midió el worker de CLF). Corrige el "~250 pesos" que se estimó en el chat de la parte 1.

## Modelo de datos (columnas nuevas en `DigitalizacionGrabacion`)

| Columna | Tipo | Uso |
|---|---|---|
| `conversionEstado` | `String?` | null (todavía grabando), PENDIENTE, PROCESANDO, LISTA, ERROR, SIN_IMAGEN |
| `conversionIntentos` | `Int @default(0)` | |
| `conversionError` | `String?` | Mensaje corto para la pantalla |
| `conversionLockAt` | `DateTime?` | Cuándo la tomó el worker |
| `videoKey` | `String?` | Clave del MP4 final |
| `videoBytes` | `BigInt?` | |
| `videoDuracionSeg` | `Int?` | |
| `convertidaAt` | `DateTime?` | |
| `partesBorradasAt` | `DateTime?` | |

Índice `(conversionEstado, terminadaAt)`. Migración a mano, sólo `ADD COLUMN IF NOT EXISTS` sobre la
tabla nueva de la parte 1 (nadie más la usa), **aplicada antes del deploy**.

## Cambios en FOTOFFICE

- `cerrarGrabacion` y `terminarConLoGrabado`: además de COMPLETA, ponen `conversionEstado` en
  PENDIENTE (o SIN_IMAGEN si `sinImagen` y es VHS).
- `pedirParte` / `confirmarParte`: rechazan (definitivo) si `conversionEstado` es PROCESANDO o LISTA
  o si `partesBorradasAt` no es null.
- `urlsDeLectura` (crudo): rechaza si `partesBorradasAt`.
- Nuevas: `urlDeVideoAction(id, modo)` (ver/descargar, VIEW) y `reintentarConversionAction(id)`
  (MANAGE; ERROR → PENDIENTE con intentos en 0).
- Lista de grabaciones: estado de conversión, duración final, tamaño final y los botones de P14.

## Worker

- `config.ts`: `FOTOFFICE_DATABASE_URL` (o `DATABASE_URL`), `R2_*` y `FOTOFFICE_R2_*` opcionales,
  `FOTOFFICE_R2_PRIVATE_BUCKET` (default `fotoffice-private`), `DIGITALIZACION_WORKER_MAX_HORAS`
  (default 20), `DIGITALIZACION_WORKER_PRESET` (default `veryfast`).
- `cola.ts`: tomar una (SQL con `SKIP LOCKED`), recuperar trabadas, marcar LISTA / ERROR.
- `plan.ts` (**puro, con tests**): de la grabación y sus partes arma el plan: entradas (tramos o DVD),
  recortes, filtros y argumentos de ffmpeg.
- `marca.ts`: arma el PNG de la marca con sharp; `marca-tiempo.ts` (**puro, con tests**): la expresión
  `x` del overlay y los instantes en que aparece.
- `convertir.ts`: crea los FIFO, alimenta cada uno con las partes en orden desde R2, corre ffmpeg y
  sube la salida a R2 con `@aws-sdk/lib-storage` (`Upload`, partes de 64 MB).
- `index.ts`: `drain` (hasta vaciar o tope de horas) y `once`.

## Pruebas

- Unitarias (vitest en el paquete del worker): plan de recortes (tramo 1, último tramo, tramos
  descartados, sin imagen), filtros por caso (estirada / no estirada / DVD), expresión de la marca y
  sus instantes, reglas de la cola (margen de 15 min, partes pendientes, intentos y trabadas).
- **Prueba real local con ffmpeg** (antes del deploy): generar con ffmpeg dos tramos WebM de prueba
  (barras de color con timer, 1280×720 y 4:3 "estirado"), partirlos en pedacitos de 10 s como hace
  `MediaRecorder`, servirlos desde una carpeta en lugar de R2 y comprobar: un MP4 1920×1080 que se
  reproduce, duración = recortes esperados, la marca visible en el segundo 60 y oculta en el 70.
  Lo mismo con un VOB de prueba (MPEG-2 720×480 4:3 entrelazado).
- Producción: después de que Daniel cargue el secreto, convertir la grabación de prueba que deje en
  DNX (o una de cámara web) y verificar "Video listo" en la lista.

## Fuera de la parte 2

Correos, pago, descargas contadas, plazos y envío (parte 3). La conversión no avisa al cliente.
