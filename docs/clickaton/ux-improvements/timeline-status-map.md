# Mapa de estados — Cronograma y consignas

**Fuente:** `apps/clickaton/lib/timeline/ui/timeline-status-presentation.ts`

---

## Versión de cronograma

| Interno | Etiqueta | Visible participantes | Editable | Próxima acción |
|---|---|---|---|---|
| `DRAFT` | Borrador | no | sí | Completar y publicar |
| `ACTIVE` | Cronograma publicado | sí (vía hitos) | no in-place | — |
| pausado | Pausado | no (automáticas detenidas) | — | Revisar motivo |
| ausente | Sin cronograma publicado | no | sí | Crear borrador |

---

## Hitos (milestone)

| Interno | Etiqueta | Descripción |
|---|---|---|
| `PENDING_CONFIG` | Sin horario definido | Falta fecha |
| `UPCOMING` | Programada | Automática en fecha |
| `OPEN` | En curso | Abierta ahora |
| `CLOSED` | Finalizada | Período terminó |
| `RELEASED` | Liberada | Ya liberada |

---

## Consignas (admin)

| Interno | Etiqueta | Visible | Editable |
|---|---|---|---|
| `DRAFT` | En preparación | no | sí |
| `READY` | Lista para programar | no | sí |
| `LOCKED` | Programada · oculta | no | sí |
| `RELEASED` | Disponible para participantes | sí | no (operativo) |
| `CLOSED` | Finalizada | no | no |
| `CANCELLED` | Cancelada | no | no |

---

## Visibilidad pública (DTO)

| Interno | Etiqueta |
|---|---|
| `LOCKED` | Oculta para participantes |
| `RELEASED` | Visible para participantes |
| `CLOSED` | Cerrada para nuevas entregas |

---

## Automatizaciones (si aparecen)

| Interno | Etiqueta |
|---|---|
| PENDING/QUEUED/SCHEDULED | Pendiente de ejecución |
| PROCESSING | Procesando |
| COMPLETED/SUCCESS | Completado |
| FAILED/ERROR | No se pudo completar |

---

## Pantallas

- Cronograma admin
- Consignas admin

## Casos no contemplados

1. UI de cola/cron genérica (no existe en estas rutas).
2. Reapertura de consignas (sin acción UI).
3. Edición de fechas capture/upload desde formulario actual (no expuestas en upsert UI).
4. Social scheduler (fuera de alcance profundo).
