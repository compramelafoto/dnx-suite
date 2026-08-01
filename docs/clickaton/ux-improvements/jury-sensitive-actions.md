# Acciones sensibles — Jurado y resultados

## En Clickatón (esta implementación)

| Acción UI | Consecuencia real | Confirmación | Jurados | Participantes | Resultados | Público | Reversible | Dependencia |
|---|---|---|---|---|---|---|---|---|
| Congelar para el jurado | Batch → FROZEN + snapshots anónimos | Sí (Imp. 05) | Habilita circuito FR | No muestra ranking | No publica | no | No reopen si frozen | `freezeBatchAction` |
| Cerrar lote | Batch CLOSED | Sí | Indirecto | no | no | no | Reabrir con motivo | `closeBatchAction` |
| Reabrir lote | Batch DRAFT si no frozen | Sí + motivo | Indirecto | no | no | no | — | `reopenBatchAction` |
| Exportar para jurado | CSV anónimo | No | Lectura | no PII | no | no | — | export API |
| Abrir FotoRank | Navegación | No | — | — | — | — | — | URL config |

## Documentadas (FotoRank — sin ejecutar desde Clickatón)

| Acción (label) | Riesgo | Efecto típico | LEGAL_REVIEW |
|---|---|---|---|
| Guardar evaluación | Bajo | Persiste puntajes parciales | no |
| Completar evaluación | Medio | Marca obra evaluada | no |
| Cerrar evaluaciones | Alto | Bloquea cambios de jurado | sí |
| Reabrir evaluaciones | Alto | Puede invalidar cálculos | sí |
| Informar conflicto de interés | Alto | Saca obra del jurado | sí |
| Actualizar resultados preliminares | Medio | Recalcula sin publicar | no |
| Confirmar resultados | Alto | Cierra ranking org | sí |
| Publicar resultados | Crítico | Visible a participantes | sí |
| Revisar desempate | Alto | Afecta posiciones | sí |
| Revocar acceso | Alto | Pierde acceso jurado | sí |

**No se ejecutaron** invitaciones, revocaciones, puntajes, cierres de scoring, recálculos ni publicaciones reales en esta implementación.
