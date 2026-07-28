# Clickatón — Ediciones y sedes (Etapa 10C)

Modelo de dominio, CRUD admin y migración **aditiva** para operar ediciones de marca y sus sedes.

## Modelo Prisma

Sección `CLICKATON ADMIN` al final de `packages/db/prisma/schema.prisma`:

| Modelo | Descripción |
|--------|-------------|
| `ClickatonEdition` | Producto de marca: fechas, estado, publicación, capacidad default, referencia opcional FotoRank |
| `ClickatonVenue` | Sede 1..N por edición: ubicación, contacto, capacidad, ventana horaria |

### Estados de edición (`ClickatonEditionStatus`)

- `DRAFT` — borrador editable; única condición para borrar edición vacía
- `REGISTRATION_OPEN` / `REGISTRATION_CLOSED` — operación de inscripciones (futuro)
- `IN_PROGRESS` / `COMPLETED` / `CANCELLED`

### Relaciones

- Una edición → muchas sedes (`onDelete: Restrict` en FK)
- **Sin franquicias**, **sin exclusividad territorial**
- `fotorankContestId`: string opaco, **sin FK** a FotoRank

## Migración

Archivo manual (no aplicado a Neon shared en 10C):

```
packages/db/prisma/migrations/20260718120000_clickaton_editions_and_venues/migration.sql
```

Contiene `CREATE TYPE`, `CREATE TABLE`, índices y FK `RESTRICT`. No destructiva.

**Estado:** preparada en repo; **no ejecutada** contra Neon compartido. Hasta aplicarla, el panel captura el error y muestra aviso “Migración pendiente” sin romper la UI.

## Capa de dominio (`apps/clickaton/lib/admin/`)

| Módulo | Responsabilidad |
|--------|-----------------|
| `slug.ts` | `slugify`, `normalizeSlug`, validación `[a-z0-9-]+` |
| `db.ts` | `withClickatonDb()` — tolera tablas inexistentes |
| `editions/` | types, validation, queries, mutations |
| `venues/` | types, validation, queries, mutations |

Todas las **mutations** invocan `requireClickatonAdmin()`.

### Validación (MVP)

- Nombre obligatorio; slug único (global edición / por edición en sede)
- Fechas: fin ≥ inicio; cierre inscripción ≥ apertura; coherencia con fin de edición
- Capacidad ≥ 0 o null
- Email de contacto válido si presente
- `coverImageUrl`: solo `http(s)` sin credenciales
- `fotorankContestId`: cuid/slug opaco

### Eliminación segura

| Entidad | Regla |
|---------|--------|
| Edición | Solo `DRAFT` **sin sedes** |
| Sede | Edición `DRAFT`, o sede `isActive=false` sin dependencias futuras (sin inscripciones aún) |
| Alternativa | Desactivar sede (`isActive=false`); despublicar edición (`isPublished=false`) |

## Rutas UI

### Ediciones

| Ruta | Función |
|------|---------|
| `/admin/ediciones` | Listado + empty state |
| `/admin/ediciones/nueva` | Alta |
| `/admin/ediciones/[editionId]` | Detalle + sedes hijas |
| `/admin/ediciones/[editionId]/editar` | Edición |
| `/admin/ediciones/[editionId]/sedes/nueva` | Alta sede (edición fija) |

### Sedes

| Ruta | Función |
|------|---------|
| `/admin/sedes` | Listado + filtros edición/activa |
| `/admin/sedes/nueva` | Alta |
| `/admin/sedes/[venueId]` | Detalle + acciones |
| `/admin/sedes/[venueId]/editar` | Edición |

Server Actions en `app/admin/(panel)/ediciones/actions.ts` y `.../sedes/actions.ts`.

## Dashboard `/admin`

Métricas reales cuando la DB responde:

- Total ediciones
- Ediciones operativas (`REGISTRATION_OPEN` \| `IN_PROGRESS`)
- Próxima edición por `startAt`
- Total sedes
- Capacidad total (suma `venue.capacity` o fallback `defaultCapacity`)

**No** se muestran inscriptos, recaudación ni kits.

## Frontera FotoRank

Clickatón administra el **producto de marca** (ediciones/sedes). FotoRank ejecuta consignas, fotos, jurados y rankings.

- `fotorankContestId` + flags `fotoRankSync*` vinculan la edición a un `FotorankContest`.
- Sync postpago de participantes: **Etapa 7** — ver `docs/clickaton/CLICKATON_FOTORANK_SYNC.md`.
- Seed Argentina 2026 deja sync **OFF** / `NOT_CONFIGURED` hasta validación admin.

## Autochecks

```bash
pnpm --filter clickaton selfcheck:admin-editions-validation
pnpm --filter clickaton selfcheck:admin-venues-validation
```

## Próxima etapa sugerida

Inscripciones operativas (10D+) y vínculo real con FotoRank / DNX Payments cuando exista contrato de sync.
