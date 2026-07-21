# Ecosistema editorial Info Spot ↔ ComprameLaFoto (end-to-end)

## Ciclo completo

```text
Evento (CLF o Info Spot)
   ↓
Cobertura fotográfica / álbum CLF
   ↓
Centro Editorial de Coberturas
   ↓
Selector de fotos → derivados editoriales
   ↓
Nota / ficha pública Info Spot
   ↓
CTA comercial (/api/r)
   ↓
Venta / descarga en ComprameLaFoto
```

Info Spot = capa editorial y descubrimiento.  
CLF = álbumes, originales, precios, carrito, pagos, inscripciones.

## Etapas documentadas

| Doc | Tema |
|------|------|
| [19](./19-editorial-workflow-core.md) | Workflow editorial genérico |
| [20](./20-content-origin-and-sync.md) | ContentOrigin |
| [21](./21-clf-event-inbound-sync.md) | Sync inbound CLF → Info Spot |
| [22](./22-infospot-to-clf-event-provisioning.md) | Provisioning outbound |
| [23](./23-event-geolocation.md) | Georreferenciación |
| [24](./24-homepage-distribution-engine.md) | Home dinámica |
| [25](./25-editorial-coverage-center.md) | Centro de coberturas |
| [26](./26-clf-editorial-photo-selector.md) | Selector de fotos |
| [27](./27-public-editorial-coverage.md) | Publicación pública |
| [29](./29-jobs-and-workers-plan.md) | Jobs / workers |

## Smoke Etapa 11

```bash
pnpm --filter infospot smoke:seed
# URLs típicas:
# /eventos/smoke-e11-event-a … event-e
# /noticias/smoke-e11-article-c … article-e
pnpm --filter infospot smoke:cleanup
```

Marcador: `[SMOKE-E11]` / `smoke-e11-*`. Solo borrar ese set.

## Licencia editorial

Ver [26](./26-clf-editorial-photo-selector.md) y `lib/editorial-photos/license-policy.ts`.

- Default producción: `PENDING`.
- `AUTHORIZED` automático: términos CLF ≥ `2026-07-21` (§5 Info Spot). Kill switch: `INFOSPOT_CLF_EDITORIAL_LICENSE_CONTRACT=0`.
- Staging: `INFOSPOT_ALLOW_STAGING_EDITORIAL_LICENSE=1`.
- Director puede autorizar foto a foto.
- `REVOKED` → placeholder público; crédito se conserva en metadatos internos.

## Seguridad (checklist)

- No exponer `storageKey` / original CLF en props públicas.
- Tracking solo vía `/api/r` con allowlist de orígenes.
- Server actions de redacción requieren sesión + rol.
- Derivados síncronos: migrar a worker antes de producción a escala (doc 29).

## Comandos de validación

```bash
pnpm --filter infospot test:editorial-workflow
pnpm --filter infospot test:content-origin
pnpm --filter infospot test:clf-event-sync
pnpm --filter infospot test:clf-event-provisioning
pnpm --filter infospot test:geolocation
pnpm --filter infospot test:distribution
pnpm --filter infospot test:coverage
pnpm --filter infospot test:editorial-photos
pnpm --filter infospot test:public-coverage
pnpm --filter infospot lint
pnpm --filter infospot check-types
pnpm --filter infospot build
```
