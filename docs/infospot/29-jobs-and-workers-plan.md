# Plan de jobs y workers — Info Spot ↔ CLF

## Estado actual

Varios procesos son **síncronos o manuales (CLI / acción de redacción)**:

| Proceso | Hoy | Prioridad producción |
|---------|-----|----------------------|
| Sync inbound eventos CLF | CLI `sync:clf-events` | Alta — cron cada 15–60 min |
| Provisioning outbound convocatoria | CLI / acción redacción | Media — on-demand + retry |
| Sync álbumes / coberturas | Acción sync cobertura | Alta — cron + webhook futuro |
| Reconcile comercial fotos | CLI `reconcile:public-coverage` / acción | Alta — cron diario o cada hora |
| Derivados editoriales (Sharp + R2) | Síncrono en selección | **Crítica** — worker async |
| Invalidación cache público | `revalidateTag` en actions | OK — mantener |
| Métricas vistas/clics | API `/api/metrics/view` + `/api/r` | OK — ya agregadas |

## No activar en producción en esta etapa

Ningún cron de producción debe encenderse hasta:

1. worker de derivados estable;
2. política de licencia contractual (`INFOSPOT_CLF_EDITORIAL_LICENSE_CONTRACT`);
3. runbooks de fallo / dead-letter;
4. límites de rate hacia Nominatim / CLF read-only.

## Diseño recomendado (futuro)

### Worker: editorial derivatives

- Cola: `PENDING` / `PROCESSING` / `READY` / `FAILED`.
- Payload: `photoId`.
- Idempotente por variantes `photoId+width+format`.
- Timeout y reintentos con backoff.
- No leer originales en el request HTTP del redactor.

### Cron: reconcile CLF events

- Frecuencia sugerida staging: 30 min.
- Idempotente vía ContentOrigin + field ownership.
- No cambiar estado editorial automáticamente.

### Cron: reconcile albums + commercial

- Actualizar `InfoSpotCoverage.commercialStatus`.
- Actualizar `InfoSpotEditorialPhoto.commercialStatus` / URLs.
- Invalidar `infospot-public-coverage`.

### Cron: stale origins

- Marcar `STALE` / `DISABLED` si evento CLF privado o archivado.
- Retirar CTA sin borrar nota.

## Observabilidad

- Contadores: sync ok/fail, derivados fail, CTA clicks.
- Alertas redacción: licencia REVOKED, álbum DELETED con usos activos.

## Comandos manuales (staging)

```bash
pnpm --filter infospot sync:clf-events
pnpm --filter infospot provision:clf-event -- <eventId>
pnpm --filter infospot reconcile:public-coverage
```
