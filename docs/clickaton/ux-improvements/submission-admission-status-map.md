# Mapa de estados — Entregas y admisión técnica

**Fuente:**  
`apps/clickaton/lib/photo-upload/ui/submission-status-presentation.ts`  
`apps/clickaton/lib/technical-admission/ui/admission-status-presentation.ts`

No crea estados persistidos. No altera enums.

---

## Entrega (`ClickatonPhotoSubmissionStatus`)

| Interno | Etiqueta | Descripción | Variante | Próxima acción | Revisión humana | → FotoRank | Reversible |
|---|---|---|---|---|---|---|---|
| `UPLOAD_PENDING` | Pendiente de carga | Carga incompleta | neutral | Esperar participante | no | no | sí |
| `UPLOADING` | Cargando | Recibiendo archivo | info | — | no | no | sí |
| `UPLOADED` | Archivo recibido | Espera procesamiento | info | Esperar análisis | no | no | sí |
| `PROCESSING` | Analizando fotografía | Comprobando archivo | info | Esperar | no | no | no |
| `READY_FOR_REVIEW` | Lista para revisión | Lista para revisión técnica | warning | Revisar requisitos | sí | no | sí |
| `PENDING_CONFIRMATION` | Pendiente de confirmación | Esperando cierre del proceso | warning | Revisar alertas | no | sí | sí |
| `CONFIRMED` | Aceptada técnicamente | Cumple requisitos técnicos | success | Verificar FotoRank | no | sí | sí |
| `REJECTED` | No cumple los requisitos | No continúa | danger | Revisar motivo | sí | no | sí |
| `FAILED` | Error al procesar | Falló el análisis | danger | Revisar / nueva carga | sí | no | sí |
| `REPLACED` | Reemplazada | Versión sustituida | neutral | — | no | no | no |
| `WITHDRAWN` | Retirada | No continúa | neutral | — | no | no | no |

## Validación (`ClickatonPhotoValidationResult`)

| Interno | Etiqueta | Revisión humana | → FotoRank |
|---|---|---|---|
| `PASS` | Cumple requisitos técnicos | no | sí |
| `WARNING` | Advertencias técnicas | sí | sí |
| `FAIL` | No cumple los requisitos técnicos | sí | no |
| `MANUAL_REVIEW` | Requiere revisión técnica | sí | no |
| (null) | Pendiente de validación | no | no |

## Síntesis operativa (solo UI)

| Key | Etiqueta |
|---|---|
| `ready_to_continue` | Lista para continuar |
| `needs_review` | Requiere revisión |
| `missing_info` | Falta información |
| `does_not_meet` | No cumple los requisitos |
| `fotorank_pending` | Pendiente de FotoRank |
| `processing` | Analizando fotografía |
| `pending_validation` | Pendiente de validación |
| `withdrawn` / `replaced` | Retirada / Reemplazada |

## FotoRank (derivado)

| Condición | Etiqueta |
|---|---|
| `fotorankEntryId` presente | Disponible en FotoRank |
| procesando / cargando | Pendiente de envío |
| rejected/failed/withdrawn | Sin envío a FotoRank |
| resto sin entry | Pendiente de enviar a FotoRank |

## Admisión (`AdmissionStatus`)

| Interno | Etiqueta | Revisión | → FotoRank | Reversible |
|---|---|---|---|---|
| `NOT_EVALUATED` | Sin evaluar | no | no | sí |
| `PENDING_AUTOMATIC_REVIEW` | En revisión automática | no | no | sí |
| `PENDING_MANUAL_REVIEW` | Requiere revisión técnica | sí | no | sí |
| `ELIGIBLE` | Elegible | no | sí | sí |
| `ADMITTED` | Aceptada técnicamente | no | sí | sí |
| `REJECTED` | No admitida | sí | no | sí |
| `EXCLUDED` | Excluida | sí | no | sí |
| `WITHDRAWN` | Retirada | no | no | no |
| `REPLACED` | Reemplazada | no | no | no |
| `FROZEN_FOR_JURY` | Lista para el jurado | no | sí | no |

## Lote

| Interno | Etiqueta |
|---|---|
| `DRAFT` | Lote en preparación |
| `PROCESSING` | Lote en procesamiento |
| `REVIEW_REQUIRED` | Lote con revisiones pendientes |
| `READY_TO_CLOSE` | Listo para cerrar |
| `CLOSED` | Lote cerrado |
| `FROZEN` | Congelado para jurado |
| `CANCELLED` | Lote cancelado |

---

## Pantallas

- Admin envíos (`/envios`)
- Admin admisión (`/admision`)

## Casos no contemplados

1. Proxy autenticado de vista previa privada.  
2. UI de reintento de sync FotoRank (no existe acción en estas rutas).  
3. Comparador visual de duplicados (no había herramienta previa).  
4. Página de detalle con ruta propia.  
5. Jurado / puntajes / ranking (fuera de alcance).
