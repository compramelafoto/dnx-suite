# FotoRank — modelo de producto: experiencia y canal (Etapa 09A)

Documento de dominio para discriminar **qué tipo de experiencia** es un evento y **en qué canal público** se publica.  
Complementa: [FOTORANK_PUBLIC_INTEGRATION.md](./FOTORANK_PUBLIC_INTEGRATION.md) · API `apps/fotorank/app/api/public/v1/README.md`.

## Principio

No mezclar:

| Concepto | Campo | Responsabilidad |
|----------|-------|-----------------|
| Motor interno | `FotorankContest` | Tabla/engine operativo |
| Visibilidad | `visibility` | PUBLIC / UNLISTED / PRIVATE |
| Experiencia | `experienceType` | CONTEST / MARATHON |
| Canal | `distributionChannel` | FOTORANK / CLICKATON / null |
| Organización | `organization` | Quién produce (no es la marca Clickaton) |
| Modalidad | UI / futuro | individual / grupal (no es el canal) |

## Valores

### `experienceType` (NOT NULL, default `CONTEST`)

- `CONTEST` — concurso tradicional FotoRank
- `MARATHON` — maratón fotográfica (formato de experiencia)

### `distributionChannel` (nullable)

- `null` — portal general FotoRank (compatibilidad legacy)
- `FOTORANK` — canal FotoRank explícito
- `CLICKATON` — canal Clickaton

**Clickaton nunca es default.**

## Regla oficial Clickaton

```text
experienceType = MARATHON
AND
distributionChannel = CLICKATON
```

Cualquier otra combinación **no** es maratón oficial Clickaton.

### Combinaciones

| Experiencia | Canal | ¿Clickaton oficial? |
|-------------|-------|---------------------|
| CONTEST | null / FOTORANK | No |
| CONTEST | CLICKATON | **Inválida** (UI + servidor rechazan) |
| MARATHON | null / FOTORANK | No (maratón FotoRank) |
| MARATHON | CLICKATON | **Sí** |

## Legacy

Filas existentes:

- reciben `experienceType = CONTEST` por default de migración;
- conservan `distributionChannel = null` (migración de canal sin backfill a CLICKATON).

## API pública V1

Payload:

- `experienceType`: `"contest" | "marathon"`
- `distributionChannel`: `"fotorank" | "clickaton" | null`

Query:

- `GET /api/public/v1/events?channel=clickaton` → solo MARATHON + CLICKATON
- sin `channel` → listado genérico; cada ítem trae discriminadores

## Adaptador Clickaton

1. Llama con `?channel=clickaton`
2. Revalida con `isOfficialClickatonMarathon`

## Capacidades

`canRegister` / `canViewResults` / `canViewGallery` siguen `false`.  
El discriminador no activa inscripción, pagos, resultados ni galería.

## Migraciones (no aplicadas en esta etapa)

1. `20260715150000_fotorank_public_event_channel`
2. `20260715160000_fotorank_experience_type`

Ambas aditivas. No usar `db push` ni deploy a producción desde este cierre.
