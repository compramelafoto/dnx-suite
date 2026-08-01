# Mapa de estados — Jurado y resultados

**Fuente:** `apps/clickaton/lib/jury-results/ui/jury-results-status-presentation.ts`  
No crea estados persistidos. Los enums son los de Prisma/FotoRank / ResultsStatus público CK.

---

## Resultados públicos (Clickatón)

| Interno | Etiqueta | Público | Atención |
|---|---|---|---|
| `not_available` | Resultados no disponibles | no | — |
| `pending` | Resultados en preparación | no | watch |
| `partial` | Resultados parciales | no | action |
| `published` | Resultados publicados | sí | ok |
| `archived` | Resultados archivados | sí | ok |

## Invitación (`FotorankJudgeInvitationStatus`)

| Interno | Etiqueta | Editable | Completo |
|---|---|---|---|
| `DRAFT` | Invitación en borrador | sí | no |
| `SENT` | Invitación enviada | sí | no |
| `OPENED` | Invitación abierta | sí | no |
| `ACCEPTED` | Invitación aceptada | no | sí |
| `REJECTED` | Invitación rechazada | no | sí |
| `EXPIRED` | Invitación vencida | sí | no |
| `REVOKED` | Acceso revocado | no | sí |

## Asignación (`FotorankJudgeAssignmentStatus`)

| Interno | Etiqueta |
|---|---|
| `ASSIGNED` | Asignación creada |
| `INVITATION_SENT` | Invitación pendiente |
| `ACCEPTED` | Participación confirmada |
| `REJECTED` | Asignación rechazada |
| `IN_PROGRESS` | Evaluación en curso |
| `COMPLETED` | Evaluación completada |
| `EXTENDED` | Plazo extendido |
| `REPLACED_BY_BACKUP` | Reemplazada por suplente |

## Evaluación por obra

| Interno | Etiqueta | Editable | Completo |
|---|---|---|---|
| `NOT_STARTED` | Evaluación pendiente | sí | no |
| `IN_PROGRESS` | Evaluación en curso | sí | no |
| `COMPLETED` / `SUBMITTED` | Evaluación completada | varía | sí |
| `LOCKED` | Evaluación cerrada | no | sí |
| `CONFLICT_DECLARED` | Conflicto de interés informado | no | sí |
| `VOIDED` | Evaluación anulada | no | sí |

## Sesión de puntuación

| Interno | Etiqueta | Nota |
|---|---|---|
| `OPEN` | Evaluación abierta | — |
| `CLOSED` | Evaluaciones cerradas | **No publica** resultados |
| `LOCKED` | Sesión bloqueada | — |
| `PAUSED` | Evaluación en pausa | — |

## Lote de resultados

| Interno | Etiqueta | Público |
|---|---|---|
| `GENERATED` | Resultados preliminares | no |
| `READY_TO_FINALIZE` | Listos para confirmar | no |
| `FINALIZED` | Resultados confirmados | no |
| `PUBLISHED` | Resultados publicados | sí |
| `REVIEW_REQUIRED` | Resultados con revisión pendiente | no |

## Ranking entry

| Interno | Etiqueta (preliminar) | Etiqueta (cerrado) |
|---|---|---|
| `WINNER` | Primera posición provisoria | Ganadora |
| `FINALIST` | Finalista provisional | Finalista |
| `TIED` | Empate a revisar | Empate a revisar |
| `RANKED` | Posición provisoria | Posición confirmada |

## Hand-off lote admisión → jurado

| Batch | Etiqueta |
|---|---|
| `FROZEN` | Lista para el jurado |
| `CLOSED` | Lote cerrado · pendiente de congelar |
| prep / draft | Preparación técnica en curso |
| ausente | Sin lote listo para el jurado |

---

## Pantallas Clickatón

- Admisión técnica (handoff)
- Detalle de edición (handoff + vínculo)
- Integraciones
- Resultados públicos de maratón
- Perfiles públicos de jurado

## Casos no contemplados en Clickatón

1. UI de evaluación / ballot.  
2. Guardado de puntajes.  
3. Invitaciones operativas.  
4. Desempate ejecutable.  
5. Publicación real de resultados.  
6. Reapertura de evaluaciones (solo label documentado).
