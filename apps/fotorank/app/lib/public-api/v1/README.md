# FotoRank Public API — V1 (serialización + HTTP)

**Etapa 08A** — contratos, serializers, loaders, visibility.  
**Etapa 08B** — Route Handlers HTTP (`/api/public/v1/events`).  
**Etapa 08C** — `distributionChannel` + filtro `?channel=`.  
**Etapa 09A** — inscripción pública operativa: `registration` serializado (mode/status/precio/merch/URL handoff).  
**Etapa 09B** — `checkoutUrl` cuando pagos operativos; órdenes/webhook en app (no en Public API).

## Frontera

```
Prisma / dominio interno
  → loaders (select seguro)
    → serializePublicEventV1 / ListItemV1
      → FotorankPublicEventV1 (incluye registration)
        → Route Handler + envelope HTTP V1
          → adaptador Clickaton (`?channel=clickaton` + validación defensiva)
```

Doc HTTP: `apps/fotorank/app/api/public/v1/README.md`.  
Handoff Clickatón: `docs/clickaton/REGISTRATION_HANDOFF.md`.

## Qué expone

- Identidad del evento con `experienceType`: `contest` | `marathon`
- Organización sin email/teléfono/dirección
- Categorías ACTIVE
- Jurados con perfil `isPublic`
- Bases como texto (`rulesText`) — **nunca** `rulesData`
- Fechas existentes + estados derivados
- Capabilities alineadas con `registration.canRegister`
- Canal de distribución (`distributionChannel`: `fotorank` \| `clickaton` \| `null`)
- **`registration`**: `mode`, `status`, `canRegister`, `displayPrice`, `hasOptionalMerchandise`, `registrationUrl`, `checkoutUrl` (solo si flags+MP operativos; apunta a `/checkout`), ventanas y cupos públicos
- Fuente única: `resolvePublicRegistrationState` / `serializePublicRegistrationV1`

## Discriminadores independientes

| Campo | Significado | Clickatón oficial |
|-------|-------------|-------------------|
| `experienceType` | Formato (concurso / maratón) | Debe ser `marathon` |
| `distributionChannel` | Portal de publicación | Debe ser `clickaton` |
| `visibility` / `status` | Visibilidad y ciclo de vida | Independientes |
| `registration.*` | Inscripción pública | Independiente del canal |

`?channel=clickaton` filtra `distributionChannel=CLICKATON` **y** `experienceType=MARATHON`.

## Qué no inventa / no ejecuta en 09A

Timezone, consignas, galería, GPS/EXIF, ranking público.  
**No** procesar pagos reales ni split. Checkout/MP/webhook/órdenes = 09B.  
**No** filtrar `rulesData` / economía interna.  
El canal **no** habilita inscripción por sí mismo (`registrationEnabled` + fechas + URL).

## Uso

```ts
import {
  getPublicEventV1BySlug,
  listPublicEventsV1,
  serializePublicEventV1,
  resolvePublicRegistrationState,
} from "../public-api/v1";
```

HTTP:

- `GET /api/public/v1/events`
- `GET /api/public/v1/events/[slug]`

Validación: `pnpm --filter fotorank check-types`.  
Self-checks:

```sh
pnpm --filter fotorank exec tsx app/lib/public-api/v1/serializers.selfcheck.ts
pnpm --filter fotorank exec tsx app/lib/public-api/v1/registration.selfcheck.ts
pnpm --filter fotorank exec tsx app/lib/public-api/v1/http.selfcheck.ts
pnpm --filter fotorank exec tsx app/lib/public-api/v1/routes.selfcheck.ts
```

## Visibilidad

| visibility | listed | routable |
|------------|--------|----------|
| PUBLIC + PUBLISHED/ACTIVE | sí | sí |
| UNLISTED + PUBLISHED/ACTIVE | no | sí |
