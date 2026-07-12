# Workflow editorial genérico (Info Spot)

## Arquitectura

```
lib/editorial/
  types.ts                     # EditorialContentType = ARTICLE | EVENT
  editorial-status.ts          # Estados + labels genéricos
  editorial-workflow-core.ts   # Reglas de transición (sin Prisma)
  article-adapter.ts           # Adaptador ARTICLE
  event-adapter.ts             # Adaptador EVENT
  event-adapter.contract.md
  index.ts

app/actions/editorial-workflow.ts       # Persistencia Article
app/actions/event-editorial-workflow.ts # Persistencia Event
```

## Orígenes de eventos

| Origen | Estado inicial |
|--------|----------------|
| Redacción | `DRAFT` |
| `/publicar-evento` | `IN_REVIEW` |
| CLF (futuro) | `DRAFT` |

## Migración de estados legacy

| Antes | Después |
|-------|---------|
| `PENDING_REVIEW` | `IN_REVIEW` |
| `REJECTED` | `DRAFT` (+ observación / internalNotes) |

`InfoSpotEventSubmissionStatus` conserva `PENDING_REVIEW` / `APPROVED` / `REJECTED` (intake).
