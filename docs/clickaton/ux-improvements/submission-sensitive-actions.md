# Acciones sensibles — Entregas y admisión técnica

Solo presentación/confirmación UI. La lógica de `adminReviewSubmissionAction` y actions de lote **no** se modificó.

---

## Entregas (`/envios`)

| Acción UI | Acción interna | Consecuencia | Riesgo | Confirmación | Efecto participante | FotoRank | Reversión | Dependencias |
|---|---|---|---|---|---|---|---|---|
| Aceptar técnicamente | `APPROVE` | `validationResult=PASS`; si estaba REJECTED vuelve a PENDING_CONFIRMATION | Confundir con jurado | Sí | Puede verse como aceptada técnica | Actualiza manualReview/technicalSummary si hay entry | Sí (otra decisión) | `adminReviewSubmissionAction` |
| Marcar como no válida | `REJECT` | `status=REJECTED`, `validationResult=FAIL`, notes → failureMessage | Descalificación incorrecta | Sí + motivo | Mensaje/motivo | Entry puede pasar a REJECTED | Sí (APPROVE) | Motivo opcional en form |
| Solicitar revisión | `MANUAL_REVIEW` | `validationResult=MANUAL_REVIEW` | Cola incorrecta | Sí | Revisión técnica | FR manualReview PENDING | Sí | — |
| Preparar configuración de carga | `ensureUploadConfigAction` | Upsert config (uploadsEnabled false por defecto) | Bajo | No | Ninguno directo | Ninguno | — | Config edición |

## Admisión (`/admision`)

| Acción UI | Acción interna | Consecuencia | Riesgo | Confirmación | Participante | FotoRank | Reversión |
|---|---|---|---|---|---|---|---|
| Crear o abrir lote en preparación | `ensureDraftBatchAction` | Crea/obtiene batch DRAFT | Bajo | No | Ninguno | Batch FR | — |
| Evaluar y aceptar técnicamente las elegibles | `evaluatePendingBulkAction` | Evalúa + admite elegibles | Admitir incorrecto | Sí | Puede notificar WORK_ADMITTED (lógica existente) | Vincula batch | Parcial vía reopen/exclude |
| Cerrar lote | `closeBatchAction` | Cierra ciclo | Operativo | Sí | Ninguno directo | Batch CLOSED | Reabrir con motivo |
| Congelar para el jurado | `freezeBatchAction` | Congela para jurado | Irreversible práctico | Sí | Ninguno de scoring aquí | Batch FROZEN | No reopen si frozen |
| Reabrir lote | `reopenBatchAction` | Vuelve a DRAFT si no frozen | Bypass proceso | Sí + motivo obligatorio | Ninguno directo | Batch DRAFT | — |
| Exportar organización/jurado | GET export | Descarga CSV | Datos | No | Ninguno | Lectura | — |

---

## Reglas de UX aplicadas

- Verbos específicos en español.  
- Confirmación con consecuencias reales.  
- Disclaimer: no es decisión del jurado.  
- No se inventaron campos de motivo.  
- No se ejecutaron acciones reales en producción durante esta implementación.
