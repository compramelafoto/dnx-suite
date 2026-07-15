# FotoRank Public API — V1 (serialización servidor)

**Etapa 08A.** Capa de contratos y serializers públicos. **Sin Route Handlers HTTP** (llegan en 08B/08C).

## Frontera

```
Prisma / dominio interno
  → loaders (opcional)
  → serializePublicEventV1 / ListItemV1
  → FotorankPublicEventV1
  → (futuro) GET /api/public/v1/...
  → (futuro) adaptador Clickaton
```

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

Validación: `pnpm --filter fotorank check-types`.  
Self-check opcional (si tenés `tsx` en PATH): `tsx app/lib/public-api/v1/serializers.selfcheck.ts`.

## Visibilidad

| visibility | listed | routable |
|------------|--------|----------|
| PUBLIC + PUBLISHED/ACTIVE | sí | sí |
| UNLISTED + PUBLISHED/ACTIVE | no | sí |
| PRIVATE / draft | no | no |
