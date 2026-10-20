# Worker de digitalización (FOTOFFICE)

Convierte las grabaciones de pantalla/cámara que los socios hacen en `/digitalizacion/grabar`
(partes de MediaRecorder subidas a R2) en un video MP4 final: junta las partes, normaliza con
ffmpeg, agrega la placa de marca ("Digitalizado por:" + nombre comercial y WhatsApp) y deja la
grabación en estado LISTA para verla en la lista.

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
