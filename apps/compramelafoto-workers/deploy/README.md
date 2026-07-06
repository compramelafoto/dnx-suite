# Deploy — ComprameLaFoto workers (monorepo)

Los `Dockerfile` en `camera-ingest/` y `camera-ftp-gateway/` conservan el layout **standalone legacy** (`COPY prisma`, `COPY lib`, `npm ci`). **No usarlos en producción** hasta reescribirlos para:

- Contexto: raíz del monorepo `dnx-suite`
- `pnpm install --filter compramelafoto-camera-ingest-worker` (o gateway)
- `@repo/db` pre-generado (`packages/db`), sin `prisma generate` local en la imagen
- Paths: `apps/compramelafoto-workers/*` y `apps/compramelafoto/lib` compartida

## Desarrollo local (recomendado)

```bash
cd /path/to/dnx-suite
pnpm install
pnpm --filter compramelafoto-camera-ingest-worker dev
pnpm --filter compramelafoto-camera-ftp-gateway dev
pnpm --filter compramelafoto-video-worker dev
```

## docker-compose

`deploy/camera-connection/docker-compose.yml` apunta a contexto legacy (`../..`). Actualizar `context` y `dockerfile` antes de `docker compose up` en staging.
