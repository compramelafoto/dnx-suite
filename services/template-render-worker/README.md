# @repo/template-render-worker

Worker HTTP interno que renderiza documentos Template V2 resueltos a PNG vía Playwright (`@repo/template-engine-renderer`).

## Variables

| Variable | Descripción |
|----------|-------------|
| `DNX_TEMPLATE_RENDER_HMAC_SECRET` | Secreto compartido con Clickatón (firma HMAC) |
| `TEMPLATE_RENDER_WORKER_PORT` | Puerto HTTP (default `8787`) |

## Endpoints

- `GET /internal/health` — `{ ok, rendererVersion, browserAvailable }`
- `POST /internal/template-render` — body JSON firmado con headers `X-DNX-*`

## Local

```bash
export DNX_TEMPLATE_RENDER_HMAC_SECRET=dev-local-hmac-secret
pnpm --filter @repo/template-render-worker dev
```

Clickatón (misma máquina):

```bash
CLICKATON_CARD_RENDER_PROVIDER=remote
CLICKATON_CARD_REMOTE_RENDER_URL=http://127.0.0.1:8787/internal/template-render
DNX_TEMPLATE_RENDER_HMAC_SECRET=dev-local-hmac-secret
```
