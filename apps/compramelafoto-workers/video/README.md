# ComprameLaFoto — Video Worker

Worker Node independiente para procesar `VideoProcessingJob` con **ffmpeg** y **ffprobe** del sistema.

## Qué hace

1. Recupera jobs `PROCESSING` trabados (lock más viejo que `VIDEO_WORKER_STALE_JOB_MINUTES`).
2. Toma un job `PENDING` (con lock atómico `FOR UPDATE SKIP LOCKED`).
3. Descarga el original desde R2 a un directorio temporal.
4. **ffprobe**: duración, ancho, alto, orientación.
5. **Thumbnail** JPG (~10 % del video, máx. 720 px de lado largo, según orientación).
6. **Preview** MP4 fragmentado (ver tabla abajo), sin audio, máx. 720p, con watermark ASCII.

### Filtro `scale` (ffmpeg)

Según orientación detectada por ffprobe (ratio ancho/alto):

| Orientación | Filtro primario | Luego |
|-------------|-----------------|-------|
| landscape | `scale=-2:720` | `scale=trunc(iw/2)*2:trunc(ih/2)*2` |
| portrait | `scale=720:-2` | idem |
| square | `scale=720:720` | idem |

Un solo string en `-vf` (sin comillas anidadas). Log: `[video-worker] ffmpeg scale filter { videoId, orientation, filter }`.
7. Sube thumbnail y preview a R2 (no borra el original).
8. Actualiza `VideoAsset` → `READY` y job → `COMPLETED`.

### Preview por duración del original

| Duración | Fragmentos | Duración c/u | Preview aprox. |
|----------|------------|--------------|----------------|
| ≥ 30 s | 5 | 3 s | ~15 s |
| 12–30 s | 3 | 3 s | ~9 s |
| &lt; 12 s | 1–3 | adaptativo (≥0,35 s) | cabe en el clip sin romper ffmpeg |

## Requisitos

- Node 20+
- **ffmpeg** y **ffprobe** en PATH

```bash
brew install ffmpeg
```

## Variables de entorno

Mismas que la app principal (desde `../.env` / `../.env.local`):

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `DATABASE_URL` | Sí | PostgreSQL (misma DB que la app) |
| `R2_ACCOUNT_ID` | Sí | Cloudflare R2 |
| `R2_ACCESS_KEY_ID` | Sí | |
| `R2_SECRET_ACCESS_KEY` | Sí | |
| `R2_ENDPOINT` | Sí | |
| `R2_BUCKET_NAME` o `R2_BUCKET` | Sí | |
| `VIDEO_WORKER_POLL_INTERVAL_MS` | No | Default `10000` (loop `start`) |
| `VIDEO_WORKER_MAX_ATTEMPTS` | No | Default `3` |
| `VIDEO_WORKER_STALE_JOB_MINUTES` | No | Default `30` — jobs `PROCESSING` con `lockedAt` más viejo se recuperan o fallan |

## Instalación

Desde la **raíz del repo** o desde `video-worker` (no hagas `cd video-worker` si ya estás ahí):

```bash
# Si estás en compramelafoto/
cd video-worker && npm install

# Si ya estás en video-worker/
npm install
```

El worker usa el **Prisma Client generado en la raíz** (`../node_modules/@prisma/client`). Tras clonar o cambiar el schema:

```bash
# Desde video-worker
npm run prisma:generate

# O desde la raíz del monorepo
npx prisma generate
```

## Comandos

```bash
# Procesar un solo job y salir
npm run process-once

# Loop continuo (producción / Railway / Fly / Render)
npm run start

# Desarrollo con recarga
npm run dev
```

## Keys R2 generadas

- `albums/{albumId}/videos/thumbnail/{videoId}.jpg`
- `albums/{albumId}/videos/preview/{videoId}.mp4`

## Estados

| Momento | VideoAsset | VideoProcessingJob |
|---------|------------|----------------------|
| Lock | `PROCESSING` | `PROCESSING`, `attempts++` |
| OK | `READY` + keys + metadata | `COMPLETED` |
| Error transitorio | `UPLOADED` | `PENDING`, `runAfter` backoff |
| Error final (≥ max intentos) | `FAILED` + `processingError` | `FAILED` |
| Lock trabado (&lt; max intentos) | `UPLOADED` | `PENDING`, `lastError`: recovered stale |
| Lock trabado (≥ max intentos) | `FAILED` | `FAILED`, job expired while processing |

## Deploy (Railway / Fly / Render)

- **Start command**: `npm run start`
- **Root directory**: `video-worker`
- Instalar ffmpeg en la imagen (ej. Dockerfile `apt-get install -y ffmpeg`)
- Copiar o enlazar variables de entorno de producción

Ejemplo Dockerfile mínimo:

```dockerfile
FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ../prisma
RUN npm ci
COPY . .
CMD ["npm", "run", "start"]
```

(Ajustar paths según monorepo en el host.)

## Prueba local

1. Subir un video desde el dashboard (Paso 1) con `ENABLE_VIDEO_MVP=1`.
2. Verificar job `PENDING` en DB.
3. `cd video-worker && npm run process-once`
4. Refrescar tab Videos: estado **Listo** y thumbnail si R2 público está configurado.

### Probar recovery de jobs trabados

```sql
-- Simular job colgado (ajustá videoId / job id)
UPDATE "VideoProcessingJob"
SET status = 'PROCESSING', "lockedAt" = NOW() - INTERVAL '45 minutes'
WHERE status = 'PENDING'
LIMIT 1;

UPDATE "VideoAsset" SET "processingStatus" = 'PROCESSING' WHERE id = <videoId>;
```

```bash
VIDEO_WORKER_STALE_JOB_MINUTES=30 npm run process-once
```

Deberías ver `[video-worker] recovered stale job` y el job vuelve a `PENDING` con el video en `UPLOADED`.

Para probar fallo por intentos agotados, repetí con `attempts >= VIDEO_WORKER_MAX_ATTEMPTS` antes del recovery.

### Reintentar un job que falló (scale / ffmpeg)

Si el job quedó en `FAILED` con intentos agotados, resetear manualmente y volver a correr el worker:

```sql
-- Reemplazá <VIDEO_ID> por el id del VideoAsset
UPDATE "VideoProcessingJob"
SET
  status = 'PENDING',
  attempts = 0,
  "lastError" = NULL,
  "lockedAt" = NULL,
  "runAfter" = NULL,
  "updatedAt" = NOW()
WHERE "videoId" = <VIDEO_ID>;

UPDATE "VideoAsset"
SET
  "processingStatus" = 'UPLOADED',
  "processingError" = NULL
WHERE id = <VIDEO_ID>;
```

```bash
cd video-worker && npm run process-once
```

Probar horizontal y vertical: subir dos clips, verificar log del filtro y que thumbnail + preview queden en `READY`.
