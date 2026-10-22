# Worker de digitalización (FOTOFFICE)

Convierte las grabaciones de pantalla/cámara que los socios hacen en `/digitalizacion/grabar`
(partes de MediaRecorder subidas a R2) en un video MP4 final: junta las partes, normaliza con
ffmpeg, agrega la placa de marca ("Digitalizado por:" + nombre comercial y WhatsApp) y deja la
grabación en estado LISTA para verla en la lista.

## Versión para mirar (HLS)

Además del MP4 Full HD (`final.mp4`, para descargar), el worker arma una versión para mirar en
el navegador sin esperas: HLS VOD 1280×720 (el mismo cuadro final, con la marca y el pillarbox,
escalado), H.264 ~2 Mbps y AAC 128k, segmentos MPEG-TS de 6 s. Queda en R2 bajo la carpeta de
la grabación: `digitalizacion/<ws>/<grabacion>/hls/index.m3u8` y `seg_00001.ts`, `seg_00002.ts`…
En la base, `hlsKey = digitalizacion/<ws>/<grabacion>/hls` (sin barra final).

- **Durante la conversión** (sólo en el primer intento): el mismo ffmpeg saca las dos salidas
  (`split` del filtro). Los segmentos se escriben en `/tmp` y se suben uno por uno apenas están
  completos (cuando ya existe el siguiente), y se borran del disco: en memoria quedan 1 o 2.
  Al final se sube la playlist (con `#EXT-X-ENDLIST`) y `hlsKey` se guarda en la misma escritura
  que deja la grabación LISTA. Si el HLS falla (una subida, la playlist, más de 40 segmentos
  esperando), el MP4 sigue: la grabación queda LISTA sin `hlsKey` y se borra lo subido del HLS.
  Desde el segundo intento sólo se hace el MP4.
- **Relleno**: cuando no hay conversiones pendientes, el worker toma las grabaciones LISTA con
  `videoKey`, sin `hlsKey` y sin `videoBorradoAt`, y arma el HLS leyendo el `final.mp4` de R2 en
  streaming (con reanudación por `Range` si la conexión se corta). No hay columnas propias:
  - el bloqueo es `conversionLockAt` (renovado cada 5 min; sin renovar 30 min, otro lo retoma) y
    la toma usa `FOR UPDATE SKIP LOCKED`;
  - los intentos se cuentan en `conversionError` con el prefijo `HLS:<n>:` (en una grabación
    LISTA la pantalla no muestra ese campo). Se cuenta al tomarla; con 3 intentos no se reintenta
    más. Para reintentar a mano: `UPDATE "DigitalizacionGrabacion" SET "conversionError"=NULL WHERE id='…'`.

## Variables de entorno

Definidas en `src/config.ts`:

| Variable | Obligatoria | Detalle |
| --- | --- | --- |
| `DATABASE_URL` | sí | Base de producción de FOTOFFICE (en Cloud Run viene del secreto `FOTOFFICE_DATABASE_URL`). |
| `FOTOFFICE_R2_ENDPOINT` o `R2_ENDPOINT` | sí | Endpoint S3 de R2. |
| `FOTOFFICE_R2_ACCESS_KEY_ID` o `R2_ACCESS_KEY_ID` | sí | Clave de acceso de R2. |
| `FOTOFFICE_R2_SECRET_ACCESS_KEY` o `R2_SECRET_ACCESS_KEY` | sí | Secreto de R2. |
| `FOTOFFICE_R2_BUCKET`, `FOTOFFICE_R2_PRIVATE_BUCKET` o `R2_PRIVATE_BUCKET` | no | Se usa la primera definida (la misma variable que lee la app, `R2_PRIVATE_BUCKET`). Por defecto `fotoffice-private`. Al arrancar se verifica el acceso al bucket; si falla, el job termina con error sin tocar ninguna grabación. |
| `DIGITALIZACION_MAX_HORAS` | no | Por defecto `16`: pasado ese tiempo no toma trabajo nuevo. |
| `DIGITALIZACION_PRESET` | no | Preset de x264, por defecto `veryfast`. |

Las variables `FOTOFFICE_R2_*` tienen prioridad sobre las `R2_*` genéricas.

## Cómo se dispara

Cloud Scheduler (`disparar-digitalizacion-worker`) cada 15 minutos ejecuta el Cloud Run Job
`digitalizacion-worker` en `us-east1` (proyecto `dnx-video-worker`; 4 vCPU, 4 GiB, timeout 24 h).
El job corre `pnpm drain`: procesa todo lo pendiente en la cola y termina, así que sólo se factura
el tiempo trabajado. `pnpm once` procesa una sola grabación.

## Construir la imagen

Desde la raíz del monorepo:

```bash
gcloud builds submit --config apps/fotoffice-workers/digitalizacion/cloudbuild.yaml --project dnx-video-worker .
# otra etiqueta: --substitutions _TAG=v2
```

## Prueba local de punta a punta

Genera medios con ffmpeg, los parte como MediaRecorder y corre la conversión con R2 y base
falsos (todo queda en el directorio temporal). Requiere `ffmpeg` y `ffprobe` instalados:

```bash
cd apps/fotoffice-workers/digitalizacion
pnpm tsx scripts/prueba-local.ts
pnpm test          # tests unitarios
```

## Paso de Daniel

Antes de crear el job hay que cargar la URL de la base de FOTOFFICE como secreto:

```bash
printf '%s' '<DATABASE_URL de producción de FOTOFFICE>' | gcloud secrets create FOTOFFICE_DATABASE_URL --data-file=- --project dnx-video-worker
```

Las claves de R2 ya existen en el proyecto (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`). Sólo si el worker da `AccessDenied` sobre el bucket
`fotoffice-private`, hay que crear también las claves propias de FOTOFFICE
(`FOTOFFICE_R2_ACCESS_KEY_ID` y `FOTOFFICE_R2_SECRET_ACCESS_KEY`) como secretos y montarlas en el job.
