# ComprameLaFoto — Camera FTP Gateway (MVP)

Servidor FTP dedicado para **Conexión de Cámara**. Recibe JPG/JPEG, sube el raw a R2 y encola `CameraIngestJob` — **no** procesa fotos (`finalize` lo hace `camera-ingest-worker`).

## Flujo

```
Cámara → FTP STOR → Gateway (auth + rate limit + validación)
       → PUT R2 albums/{albumId}/raw/...
       → createCameraUploadLogAndEnqueue()
       → 226 OK
camera-ingest-worker → finalizeAlbumPhotoFromRaw → foto visible en álbum
```

**Importante:** el gateway solo encola. Para que la foto aparezca en el álbum tenés que tener **`camera-ingest-worker` corriendo** (`npm run start` en `camera-ingest-worker/`).

## Requisitos

- Node 20+
- PostgreSQL + migraciones (`CameraConnectionSettings`, `CameraIngestJob`, …)
- Cloudflare R2 (mismas credenciales que la app)
- Fotógrafo con Conexión de Cámara **habilitada**, no pausada, álbum activo y credenciales FTP
- **`camera-ingest-worker`** activo en staging/prod

## Variables de entorno

Ver [`.env.example`](./.env.example).

| Variable | Default | Descripción |
|----------|---------|-------------|
| `DATABASE_URL` | — | PostgreSQL |
| `R2_ACCOUNT_ID` | — | Cloudflare R2 |
| `R2_ACCESS_KEY_ID` | — | |
| `R2_SECRET_ACCESS_KEY` | — | |
| `R2_ENDPOINT` | — | |
| `R2_BUCKET_NAME` o `R2_BUCKET` | — | Bucket |
| `CAMERA_CONNECTION_FTP_PORT` | `21` | Puerto control FTP |
| `FTP_PASV_URL` | — | **IP/hostname público** para modo pasivo |
| `FTP_PASV_MIN_PORT` | `50000` | Inicio rango PASV |
| `FTP_PASV_MAX_PORT` | `50050` | Fin rango PASV |
| `FTP_MAX_UPLOAD_BYTES` | `31457280` (30 MB) | Tamaño máximo por archivo |
| `FTP_RATE_LIMIT_WINDOW_MS` | `600000` (10 min) | Ventana rate limit |
| `FTP_RATE_LIMIT_MAX_FILES` | `60` | Máx. archivos por ventana / fotógrafo |
| `HEALTH_PORT` | `8080` | HTTP `/health` y `/ready` |

En la app (panel):

- `CAMERA_CONNECTION_FTP_SERVER_LIVE=true`
- `CAMERA_CONNECTION_FTP_HOST` = hostname público del gateway

## Puertos (firewall / Docker / VPS)

| Puerto | Protocolo | Uso |
|--------|-----------|-----|
| `21` (o `CAMERA_CONNECTION_FTP_PORT`) | TCP | Control FTP (USER, PASS, PASV, STOR) |
| `50000-50050` (rango PASV) | TCP | **Datos en modo pasivo** (la cámara conecta acá tras PASV) |
| `8080` (o `HEALTH_PORT`) | TCP | HTTP `/health`, `/ready` |

### FTP pasivo (PASV)

1. La cámara se conecta al puerto **21** y autentica.
2. Al subir (`STOR`), envía `PASV`; el servidor responde con `FTP_PASV_URL` + un puerto del rango.
3. La cámara abre una **segunda conexión TCP** a ese puerto para transferir los bytes.

`FTP_PASV_URL` debe ser la IP o DNS que la cámara alcanza desde su red (IP pública del VPS, no `0.0.0.0` ni `127.0.0.1` salvo pruebas locales).

En Docker, mapeá el rango completo (`50000-50050:50000-50050`).

## Endpoints HTTP

### `GET /health` — liveness

Siempre `200` si el proceso HTTP responde. No consulta DB.

```json
{
  "status": "ok",
  "service": "camera-ftp-gateway",
  "uptime": 3600,
  "ftpPort": 21,
  "passivePortRange": "50000-50050",
  "maxUploadBytes": 31457280
}
```

### `GET /ready` — readiness

`200` si DB y config R2 están OK; `503` si falta algo.

```json
{
  "status": "ready",
  "service": "camera-ftp-gateway",
  "checks": [
    { "name": "r2_config", "ok": true },
    { "name": "database", "ok": true }
  ]
}
```

```bash
curl -s http://127.0.0.1:8080/health | jq
curl -s http://127.0.0.1:8080/ready | jq
```

## Instalación y ejecución local

```bash
npx prisma generate
npx prisma migrate deploy

cd camera-ftp-gateway
npm install
npm run start
```

En otra terminal, el worker:

```bash
cd camera-ingest-worker
npm run start
```

## Probar con FileZilla

1. Panel → **Conexión de Cámara** → activar, elegir álbum, copiar usuario/contraseña FTP.
2. Arrancar gateway + ingest worker.
3. FileZilla → Gestor de sitios → Nuevo sitio:
   - **Protocolo:** FTP
   - **Host:** `127.0.0.1` (local) o `CAMERA_CONNECTION_FTP_HOST`
   - **Puerto:** `21`
   - **Cifrado:** Solo FTP explícito sobre TLS (sin FTPS en MVP)
   - **Tipo de acceso:** Normal
   - **Usuario / contraseña:** del panel (`u123`, etc.)
4. **Modo de transferencia:** Pasivo (por defecto en FileZilla).
5. Directorio remoto: `/` (recomendado).
6. Arrastrá un `.jpg` al panel remoto.
7. Verificá logs `[camera-ftp-gateway] upload_queued` y luego la foto en el álbum (tras el worker).

Si falla la lista de directorios, es normal (filesystem virtual); la subida por drag & drop igual funciona.

## Smoke test (`basic-ftp`)

```bash
cd camera-ftp-gateway
FTP_HOST=127.0.0.1 \
FTP_USER=u123 \
FTP_PASS=xxxxxxxx \
FTP_PASV_URL=127.0.0.1 \
npm run smoke-test
```

Usa `test-fixtures/sample.jpg` por defecto (`FTP_SMOKE_FILE` para otro path).

Verificá:

- `CameraUploadLog` → `RECEIVED`
- `CameraIngestJob` → `PENDING`
- Tras el worker: `Photo` en el álbum

## Probar rate limit

Bajá el límite para pruebas:

```bash
FTP_RATE_LIMIT_MAX_FILES=3 \
FTP_RATE_LIMIT_WINDOW_MS=600000 \
npm run start
```

Subí 4 JPG seguidos (FileZilla o smoke-test en loop). El cuarto debe fallar con `550` y un `CameraUploadLog` en `REJECTED` en el panel/historial.

```bash
# Ejemplo rápido (4 uploads)
for i in 1 2 3 4; do
  FTP_SMOKE_FILE=test-fixtures/sample.jpg npm run smoke-test || true
done
```

## Docker

**Producción (VPS) — gateway + worker:**

```bash
cd deploy/camera-connection
cp .env.example .env   # completar DATABASE_URL, R2_*, FTP_PASV_URL
docker compose up -d --build
```

Guía completa: [`docs/camera-connection-production-deploy.md`](../docs/camera-connection-production-deploy.md)

**Solo gateway (local):**

```bash
docker compose -f camera-ftp-gateway/docker-compose.yml build
docker compose -f camera-ftp-gateway/docker-compose.yml up
```

## Seguridad y hardening

- Solo JPG/JPEG (extensión + magic bytes `FF D8 FF`)
- Rate limit por fotógrafo (`userId` + `ftpUsername`)
- Sin path traversal; upload plano (basename)
- Sin RETR / DELE / rename
- Contraseñas **nunca** en logs (`[camera-ftp-gateway]` estructurado)
- Si R2 OK pero falla el encolado → intenta `deleteFromR2` del raw huérfano
- Buffer en memoria (sin disco persistente)

## Limitaciones actuales

- Sin FTPS/TLS
- Sin PNG / HEIC / RAW
- Rate limit **en memoria** por instancia (no compartido entre réplicas)
- Sin `autoPublish` en gateway
- Dos pools Prisma (`getPrisma` + `lib/prisma` en helpers del monorepo)

## Pendientes deploy staging

1. VPS/Fly/Railway con puertos 21, PASV y 8080 abiertos.
2. `FTP_PASV_URL` = IP pública del host.
3. `camera-ingest-worker` desplegado y monitoreado.
4. `CAMERA_CONNECTION_FTP_SERVER_LIVE=true` en la app.
5. Alertas: `/ready` ≠ 200, cola `CameraIngestJob` PENDING creciendo, logs `orphan_raw_delete_failed`.
6. FTPS si una cámara lo exige.
7. Rate limit distribuido (Redis) si hay más de una réplica del gateway.
