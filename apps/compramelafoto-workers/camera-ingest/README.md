# ComprameLaFoto — Camera Ingest Worker

Worker Node independiente para procesar `CameraIngestJob` (`PENDING` → `finalizeAlbumPhotoFromRaw`).

## Qué hace

1. Recupera jobs `PROCESSING` trabados (`lockedAt` más viejo que `CAMERA_INGEST_STALE_MINUTES`).
2. Toma hasta `CAMERA_INGEST_BATCH_CONCURRENCY` jobs `PENDING` (lock atómico `FOR UPDATE SKIP LOCKED`).
3. Marca `CameraUploadLog` → `PROCESSING`.
4. Llama a `finalizeAlbumPhotoFromRaw` (Sharp + R2 + `Photo` + análisis + variantes).
5. Al éxito: job `COMPLETED`, log `SUCCESS`, `CameraConnectionSettings.lastUploadAt`.
6. Al fallo reintentable: job `PENDING` con `runAfter` (backoff), log `RECEIVED`.
7. Al fallo definitivo: job `FAILED`, log `FAILED`.

## Requisitos

- Node 20+
- Prisma Client generado en la **raíz** del monorepo (`npx prisma generate`)
- Migración `camera_ingest_jobs` aplicada
- Variables R2 y `DATABASE_URL` (mismas que la app)

## Variables de entorno

Cargadas desde `../.env` y `../.env.local`:

| Variable | Default | Descripción |
|----------|---------|-------------|
| `DATABASE_URL` | — | PostgreSQL |
| `R2_*` | — | Igual que la app principal |
| `MAX_FILE_SIZE` | 10 MB | Límite de raw (misma semántica que subida web) |
| `CAMERA_INGEST_POLL_INTERVAL_MS` | `3000` | Intervalo del loop `start` |
| `CAMERA_INGEST_MAX_ATTEMPTS` | `3` | Intentos antes de `FAILED` |
| `CAMERA_INGEST_STALE_MINUTES` | `30` | Recovery de locks trabados |
| `CAMERA_INGEST_BATCH_CONCURRENCY` | `1` | Jobs en paralelo por ciclo |

## Instalación

```bash
cd camera-ingest-worker
npm install

# Desde la raíz, si cambió el schema:
npx prisma generate
```

## Comandos

```bash
# Un ciclo (recovery + hasta N jobs) y salir
npm run process-once

# Loop continuo
npm run start

# Desarrollo con recarga
npm run dev
```

## Prueba local con raw existente en R2

### 1. Asegurar migración y worker

```bash
npx prisma migrate deploy   # desde la raíz
cd camera-ingest-worker && npm install
```

### 2. Subir o verificar raw en R2

La key debe ser `albums/{albumId}/raw/{uuid}-nombre.jpg` (mismo prefijo que subida web).

### 3. Encolar log + job (desde la raíz, script o REPL)

Ejemplo con `tsx` en la raíz (ajustá `userId`, `albumId`, `rawKey`, `filename`):

```bash
npx tsx -e "
import { createCameraUploadLogAndEnqueue } from './lib/camera-connection/create-camera-upload-log-and-enqueue.ts';
const r = await createCameraUploadLogAndEnqueue({
  userId: 1,
  albumId: 42,
  rawKey: 'albums/42/raw/test-manual-001.jpg',
  filename: 'test-manual-001.jpg',
  filesizeBytes: 500000,
});
console.log(r);
"
```

### 4. Procesar

```bash
cd camera-ingest-worker
npm run process-once
```

Verificar en DB: `CameraIngestJob.status = COMPLETED`, `Photo` creado, log `SUCCESS`.

### 5. Simular job trabado (recovery)

```sql
UPDATE "CameraIngestJob"
SET status = 'PROCESSING', "lockedAt" = NOW() - INTERVAL '45 minutes'
WHERE id = '<job-id>';
```

```bash
CAMERA_INGEST_STALE_MINUTES=30 npm run process-once
```

## Estados

| Momento | CameraIngestJob | CameraUploadLog |
|---------|-----------------|-----------------|
| Claim | `PROCESSING`, `attempts++` | `PROCESSING` |
| OK | `COMPLETED` + `photoId` | `SUCCESS` |
| Error transitorio | `PENDING`, `runAfter` | `RECEIVED` |
| Error final | `FAILED` | `FAILED` |
| Lock trabado (&lt; max) | `PENDING` | `RECEIVED` |
| Lock trabado (≥ max) | `FAILED` | `FAILED` |

## Deploy

**Producción (VPS, junto al gateway):** ver [`docs/camera-connection-production-deploy.md`](../docs/camera-connection-production-deploy.md) y `deploy/camera-connection/docker-compose.yml`.

- **Start command**: `npm run start`
- **Dockerfile**: `camera-ingest-worker/Dockerfile`
- No requiere ffmpeg; sí Sharp (incluido en dependencias)
- Misma `DATABASE_URL` y `R2_*` que la app Vercel y el gateway

## Notas

- Importa `finalizeAlbumPhotoFromRaw` del monorepo (`@/lib/...` vía `tsconfig` paths).
- Usa un `PrismaClient` propio; `finalizeAlbumPhotoFromRaw` usa el singleton de `lib/prisma.ts` (misma `DATABASE_URL`).
