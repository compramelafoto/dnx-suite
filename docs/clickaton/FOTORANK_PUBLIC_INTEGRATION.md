# Clickaton ↔ FotoRank — integración pública HTTP (Etapa 08D)

Documento de la conexión **Clickaton → FotoRank Public API V1** (server-to-server).  
Contrato servidor FR: `apps/fotorank/app/lib/public-api/v1/` · HTTP: `apps/fotorank/app/api/public/v1/README.md`.

## Arquitectura

```
Páginas /maratones
  → service.ts
    → PublicMarathonDataSource
      → fixture (local-source)
      → FotorankHttpPublicMarathonDataSource (fotorank-http-source)
           → fotorank-public-client (fetch + timeout + revalidate)
                → GET /api/public/v1/events
                → GET /api/public/v1/events/[slug]
```

Clickaton **no** importa Prisma ni loaders internos de FotoRank.  
Las páginas **no** hacen `fetch` a FotoRank.

## Data sources

| Kind | Implementación | Uso |
|------|----------------|-----|
| `fixture` | `local-source` + fixture demo | **default** (dev/build) |
| `fotorank` | HTTP + mapper + hybrid (`/maratones/demo` local) | preview/prod configurado |

```env
CLICKATON_PUBLIC_DATA_SOURCE=fixture
# Solo si source=fotorank (privada, server-only):
# FOTORANK_PUBLIC_API_BASE_URL=http://localhost:3000
```

- Default: `fixture`.
- Con `fotorank` sin base URL: error explícito.
- URL solo `http`/`https`; sin credenciales embebidas; sin slash final.
- Fallo HTTP/timeout: `PublicMarathonSourceUnavailableError` (**no** fixture automático).
- Timeout: **8000ms**.
- Caché fetch / ISR: `revalidate: 60`.

## Política de `eventType` (08D)

V1 expone solo `eventType: "contest"`.

| Acción | Comportamiento |
|--------|----------------|
| Mapper | Puede mapear a `PublicMarathon` con `modality: "Concurso fotográfico"` |
| `listListed` | **Vacío** para contests (no aparecen en `/maratones`) |
| `getBySlug` | Contest remoto → `null` → `notFound()` |
| CTA inscripción | Respeta `canRegister` (hoy false en FR) |
| Demo | `/maratones/demo` sigue siendo fixture local (hybrid) |

Sin discriminador de canal/marca todavía. Los concursos FotoRank **no** se presentan como maratones oficiales Clickatón.

## Hybrid

Solo excepción documentada: slug `demo` desde fixture local cuando la fuente es `fotorank`.  
No mezcla listados remotos con fixtures arbitrarios.

## Self-check

```sh
cd apps/clickaton
# `--conditions=react-server` usa el export vacío oficial de `server-only` (Next).
pnpm exec tsx --conditions=react-server --tsconfig tsconfig.json \
  data/public-marathons/fotorank-adapter.selfcheck.ts
```

`import "server-only"` usa el paquete oficial resuelto por Next (sin shim en `tsconfig.paths`). El marcador real falla en Client Components.

## Limitaciones

- Sin inscripción/pagos/auth
- Sin results/gallery payload
- Sin discriminador de canal (pendiente)
- Contests no publicables como maratones
- UNLISTED futuros: sin endpoint de slugs routables
