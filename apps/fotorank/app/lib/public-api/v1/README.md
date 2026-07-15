# FotoRank Public API — V1 (serialización + HTTP)

**Etapa 08A** — contratos, serializers, loaders, visibility.  
**Etapa 08B** — Route Handlers HTTP (`/api/public/v1/events`).  
**Etapa 08C** — `distributionChannel` + filtro `?channel=`.  
**Etapa 09A** — contratos de inscripción free/paid + merchandising (sin cobros reales).

## Frontera

```
Prisma / dominio interno
  → loaders (select seguro)
    → serializePublicEventV1 / ListItemV1
      → FotorankPublicEventV1
        → Route Handler + envelope HTTP V1
          → adaptador Clickaton (`?channel=clickaton` + validación defensiva)
```

Doc HTTP: `apps/fotorank/app/api/public/v1/README.md`.

## Qué expone

- Identidad del evento con `experienceType`: `contest` | `marathon` (Etapa 09A)
- Organización sin email/teléfono/dirección
- Categorías ACTIVE
- Jurados con perfil `isPublic`
- Bases como texto (`rulesText`) — **nunca** `rulesData`
- Fechas existentes + estados derivados
- Capabilities honestas (`canRegister` / `canViewResults` / `canViewGallery` = false hoy)
- Canal de distribución (`distributionChannel`: `fotorank` \| `clickaton` \| `null`)
- Tipos de inscripción pública (contratos 09A pagos/merch): `FotorankPublicRegistrationV1` + stub helper; campo `registration?` aún opcional
- Helper `buildPublicRegistrationStubV1` (stub free / sin checkout)

## Discriminadores independientes

| Campo | Significado | Clickatón oficial |
|-------|-------------|-------------------|
| `experienceType` | Formato (concurso / maratón) | Debe ser `marathon` |
| `distributionChannel` | Portal de publicación | Debe ser `clickaton` |
| `visibility` / `status` | Visibilidad y ciclo de vida | Independientes |

`?channel=clickaton` filtra `distributionChannel=CLICKATON` **y** `experienceType=MARATHON`.

## Qué no inventa / no ejecuta en 09A

Timezone, consignas, cupos, galería, GPS/EXIF, ranking público.  
**No** procesar pagos reales ni split. Checkout/MP/webhook/órdenes = 09B.  
**No** filtrar `rulesData` / economía interna simulada como precio público.  
El canal **no** habilita inscripción, pagos, resultados ni permisos por sí mismo.

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
