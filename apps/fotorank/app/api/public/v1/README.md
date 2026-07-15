# FotoRank Public API — HTTP V1

**Etapa 08B.** Route Handlers HTTP públicos versionados. Consumen exclusivamente la capa segura de la Etapa 08A (`app/lib/public-api/v1`).

## Arquitectura

```
Route Handler
  → loader público V1 (listPublicEventsV1 / getPublicEventV1BySlug)
    → select seguro + serializador
      → contrato FotorankPublicEvent(ListItem)V1
        → envelope JSON V1
```

Los handlers **no** consultan Prisma ni reconstruyen el contrato.

## Rutas

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/public/v1/events` | Listado de eventos públicos listables |
| `GET` | `/api/public/v1/events/[slug]` | Detalle público por slug |

No existen en V1: `/results`, `/gallery`, `/registration`, `/marathons`, `/contests`.

Nombre genérico **`events`**: contrato común para futuros tipos de evento fotográfico. Hoy `eventType` es siempre `"contest"`.

## Envelopes

### Listado (200, incluso vacío)

```json
{
  "version": "v1",
  "data": {
    "items": []
  },
  "meta": {
    "count": 0
  }
}
```

### Detalle (200)

```json
{
  "version": "v1",
  "data": {
    "event": { "contractVersion": "v1", "slug": "ejemplo", "eventType": "contest" }
  }
}
```

### Error

```json
{
  "version": "v1",
  "error": {
    "code": "EVENT_NOT_FOUND",
    "message": "El evento solicitado no está disponible."
  }
}
```

## Estados HTTP

| Código | Cuándo |
|--------|--------|
| 200 | Listado (vacío o no) / detalle encontrado |
| 400 | Slug sintácticamente inválido (`INVALID_REQUEST`) |
| 404 | No encontrado, PRIVATE, draft no público, no serializable (`EVENT_NOT_FOUND`) |
| 500 | Error interno (`INTERNAL_ERROR`) — sin detalles al cliente |

Códigos estables: `INVALID_REQUEST`, `EVENT_NOT_FOUND`, `INTERNAL_ERROR`.

PRIVATE / inexistente / no autorizado se responden **igual** (404) para no filtrar existencia.

## Visibilidad

| visibility | Listado | Detalle por slug |
|------------|---------|------------------|
| PUBLIC + publicado | sí | sí |
| UNLISTED + publicado | no | sí |
| PRIVATE / draft | no | 404 |

## Headers

- `Content-Type: application/json; charset=utf-8`
- `X-Content-Type-Options: nosniff`
- `X-Fotorank-Api-Version: v1`
- Éxito: `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`
- Error: `Cache-Control: private, no-store`

## CORS

Los endpoints son **públicos** (sin autenticación), pero **no** se habilita CORS permisivo ni `Access-Control-Allow-Origin: *`.

Consumo previsto: **server-to-server** desde Clickaton (Etapa 08D). No hay `OPTIONS` personalizado. Apps móviles o terceros requerirán política CORS explícita más adelante.

## Caché

Estrategia inicial conservadora (60s + SWR 300s) mientras el payload no incluye inscripción, cupos, consignas ni resultados dinámicos.

Revisar cuando se agreguen: estado de inscripción, consignas, resultados, galería, avisos urgentes.

No cachear 500. Evitar caché prolongada de 404 (posible publicación inmediata de un slug).

Invalidación por tags: pendiente (loaders no usan `fetch` cacheable de Next).

## Runtime

`runtime = "nodejs"` — loaders dependen de Prisma.

## Campos excluidos (siempre)

- PII de organización (`contactEmail`, `phone`, `whatsapp`, `address`)
- `rulesData` (JSON interno de bases)
- Votos, scores, pagos, tokens, secretos, sesiones
- Jurados con perfil no público
- Economía / cupos de participantes

## Capacidades actuales (fijas)

```json
{
  "canRegister": false,
  "canViewResults": false,
  "canViewGallery": false
}
```

`canViewRules` / `canViewJury` / `canViewCategories` dependen del contenido serializado.

## Limitaciones actuales

- Sin paginación, filtros, búsqueda ni orden configurable (orden del loader: `submissionDeadline` asc, `updatedAt` desc)
- Sin inscripción, pagos, resultados ni galería
- Sin tipo `MARATHON`
- Sin rate limiting (pendiente antes de exposición masiva)
- Sin API keys ni auth entre apps
- Clickaton **aún no consume** estos endpoints

## Ejemplos ficticios

```http
GET /api/public/v1/events
```

```http
GET /api/public/v1/events/concurso-demo
```

```http
GET /api/public/v1/events/!!!
→ 400 INVALID_REQUEST
```

```http
GET /api/public/v1/events/slug-que-no-existe
→ 404 EVENT_NOT_FOUND
```

## Self-checks

```sh
pnpm --filter fotorank exec tsx app/lib/public-api/v1/serializers.selfcheck.ts
pnpm --filter fotorank exec tsx app/lib/public-api/v1/http.selfcheck.ts
pnpm --filter fotorank exec tsx app/lib/public-api/v1/routes.selfcheck.ts
```

Nota: si `tsx` no está en el PATH del filtro, usar el binario del monorepo (`node_modules/.../tsx`).

## Próximas etapas

- **08C/08D:** adaptador HTTP en Clickaton (server-to-server), variables de entorno, mapeo a `PublicMarathon`
- Rate limiting, observabilidad, CORS explícito si hace falta navegador
- Endpoints satélite (offer, results, gallery) solo cuando existan datos seguros
