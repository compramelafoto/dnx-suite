# FotoRank Public API — V1 (serialización + HTTP)

**Etapa 08A** — contratos, serializers, loaders, visibility.  
**Etapa 08B** — Route Handlers HTTP (`/api/public/v1/events`).

## Frontera

```
Prisma / dominio interno
  → loaders (select seguro)
    → serializePublicEventV1 / ListItemV1
      → FotorankPublicEventV1
        → Route Handler + envelope HTTP V1
          → (futuro) adaptador Clickaton server-to-server
```

Doc HTTP: `apps/fotorank/app/api/public/v1/README.md`.

## Qué expone

- Identidad del concurso (`contest` tipado como `eventType: "contest"`)
- Organización sin email/teléfono/dirección
- Categorías ACTIVE
- Jurados con perfil `isPublic`
- Bases como texto (`rulesText`) — **nunca** `rulesData`
- Fechas existentes + estados derivados
- Capabilities honestas (`canRegister` / `canViewResults` / `canViewGallery` = false hoy)

## Qué no inventa

Maratón, timezone, inscripción, pagos, consignas, cupos, galería, GPS/EXIF, ranking público.

## Uso

```ts
import {
  getPublicEventV1BySlug,
  listPublicEventsV1,
  serializePublicEventV1,
} from "../public-api/v1"; // o path relativo desde el caller
```

HTTP:

- `GET /api/public/v1/events`
- `GET /api/public/v1/events/[slug]`

Validación: `pnpm --filter fotorank check-types`.  
Self-checks:

```sh
pnpm --filter fotorank exec tsx app/lib/public-api/v1/serializers.selfcheck.ts
pnpm --filter fotorank exec tsx app/lib/public-api/v1/http.selfcheck.ts
pnpm --filter fotorank exec tsx app/lib/public-api/v1/routes.selfcheck.ts
```

## Visibilidad

| visibility | listed | routable |
|------------|--------|----------|
| PUBLIC + PUBLISHED/ACTIVE | sí | sí |
| UNLISTED + PUBLISHED/ACTIVE | no | sí |
| PRIVATE / draft | no | no |
