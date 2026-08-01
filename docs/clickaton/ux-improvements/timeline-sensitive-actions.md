# Acciones sensibles — Cronograma y consignas

No se crearon acciones nuevas. No se ejecutaron publicaciones reales.

---

## Publicar cronograma

| Campo | Valor |
|---|---|
| UI | Publicar cronograma |
| Riesgo | Alto |
| Confirmación | Sí |
| Efecto | Activa versión DRAFT → ACTIVE |
| Participantes | Ven hitos según fechas publicadas |
| Entregas | No las borra |
| Reversible | No in-place; requiere nuevo borrador |
| Técnico | `activateTimelineAction` |

---

## Publicar consigna ahora

| Campo | Valor |
|---|---|
| UI | Publicar ahora |
| Riesgo | Alto — revela contenido antes del horario |
| Confirmación | Sí |
| Efecto | `releasePromptManual` |
| Participantes | Ven título e indicaciones de inmediato |
| Entregas | No elimina existentes |
| Reversible | Sin UI de “ocultar de nuevo” |
| `LEGAL_REVIEW` | Plazos / condiciones de entrega |

---

## Pausar por contingencia

| Campo | Valor |
|---|---|
| UI | Pausar por contingencia |
| Riesgo | Alto — detiene automáticas |
| Confirmación | Sí |
| Efecto | `pauseTimeline` |
| Reversible | Depende de flujos existentes (sin botón “reanudar” en UI) |

---

## Pasar hitos futuros a un nuevo borrador

| Campo | Valor |
|---|---|
| UI | Pasar hitos futuros a un nuevo borrador |
| Riesgo | Medio-alto |
| Confirmación | Sí |
| Efecto | Crea DRAFT con desplazamiento; no muta ACTIVE in-place |
| No mueve | Eventos ejecutados / consignas liberadas |

---

## Guardar cambios

| Campo | Valor |
|---|---|
| Riesgo | Bajo-medio |
| Confirmación | No |
| Efecto | Persiste nombre/fechas o contenido |
| No publica | Solo |

---

## Crear borrador de cronograma

| Campo | Valor |
|---|---|
| Riesgo | Bajo |
| Confirmación | No |
| Efecto | `ensureDraftTimeline` |

---

## Dependencias técnicas

Jobs/crons de liberación automática no se modificaron. La publicación manual de consigna no garantiza idempotencia adicional más allá de la lógica existente.
