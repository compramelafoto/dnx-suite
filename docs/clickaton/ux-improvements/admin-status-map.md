# Mapa de estados administrativos — Inscripciones

**Etapa:** 02 Imp. 02  
**Fuente de código:** `apps/clickaton/lib/admin-registration/ui/admin-status-presentation.ts`  
**Derivado de:** `status-labels.ts` + `lib/public-ux/status-presentation.ts`  
**Nota:** presentación pura; no persiste estados nuevos.

---

## Criterios de síntesis operativa (`presentAdminOperationalSummary`)

| Clave | Etiqueta | Criterio |
|---|---|---|
| `cancelled` | Cancelada / inactiva | `CANCELLED`, `REFUNDED`, `DISQUALIFIED` o `EXPIRED` |
| `waitlisted` | Lista de espera | `WAITLISTED` |
| `payment_review` | Requiere atención | Pago `FAILED` o `MANUAL_REVIEW` |
| `incomplete` | Inscripción incompleta | Borrador / pago pendiente / `PROCESSING` |
| `kit_pending` | Kit pendiente | Confirmada + pago OK + kit ≠ entregado/cancelado |
| `all_set` | Todo listo | Confirmada + pago OK (+ kit entregado o sin kit pendiente) |
| `needs_attention` | Requiere atención | Resto |

**Acreditación:** el listado admin actual **no** incluye check-in. La síntesis no inventa estado de acreditación. En listado/detalle se indica que se opera en el módulo de sede.

---

## Inscripción

| Enum interno | Etiqueta admin | Descripción breve | Variante | Atención | Acción sugerida | Pantallas |
|---|---|---|---|---|---|---|
| `DRAFT` | Borrador | Todavía no operativa | warning/neutral* | watch | Revisar o confirmar | listado, detalle |
| `PENDING_PAYMENT` | Pago pendiente | Reserva sin cobro acreditado | warning | action | Revisar pago | listado, detalle |
| `CONFIRMED` | Confirmada | Lista para operar en sede | success | ok | Revisar kit/placa | listado, detalle |
| `WAITLISTED` | Lista de espera | Espera cupo | warning | action | Gestionar cupo | listado, detalle |
| `CANCELLED` | Cancelada | Ya no activa | danger | blocked | — | listado, detalle |
| `REFUNDED` | Reembolsada | Figura reembolsada | neutral | blocked | — | listado, detalle |
| `DISQUALIFIED` | Descalificada | Participación descalificada | danger | blocked | — | listado, detalle |
| `EXPIRED` | Vencida | Reserva/intento vencido | warning | blocked | Pedir nueva inscripción | listado, detalle |
| `REFUND_REQUESTED` | Reembolso solicitado | Pedido en curso | warning | action | Revisar caso | listado, detalle |
| `TRANSFERRED_TO_NEXT_EDITION` | Transferida | Trasladada a otra edición | neutral | watch | — | detalle |

\*Tone desde `registrationStatusTone` en `status-labels.ts`.

**Vs texto público:** el público enfatiza al participante (“Tu inscripción…”); el admin enfatiza operación (“puede operarse en sede”).

---

## Pago

| Enum | Etiqueta admin | Descripción | Variante | Atención | Acción sugerida |
|---|---|---|---|---|---|
| `NOT_REQUIRED` | No requiere pago | Sin cobro | success | ok | — |
| `PENDING` | Pendiente | Sin cobro acreditado | warning | action | Completar/revisar pago |
| `PROCESSING` | En proceso | No forzar segundo cobro | info | watch | Esperar y actualizar |
| `APPROVED` | Aprobado / acreditado* | Pago OK | success | ok | — |
| `FAILED` | Fallido | Cobro no completado | danger | action | Revisar / nuevo intento |
| `EXPIRED` | Vencido | Intento vencido | warning | action | — |
| `CANCELLED` | Cancelado | Cobro cancelado | warning | blocked | — |
| `REFUNDED` | Reembolsado | Cobro reembolsado | neutral | blocked | — |
| `PARTIALLY_REFUNDED` | Reembolso parcial | Parcial | neutral | watch | — |
| `MANUAL_REVIEW` | Revisión manual | Inconsistencia | warning | action | Revisar antes de operar |

\*Label exacto desde `paymentStatusLabel`.

---

## Entrega de kit

| Enum | Etiqueta | Descripción | Variante | Atención | Acción sugerida |
|---|---|---|---|---|---|
| `PENDING` | Pendiente de entrega | Sin registro de entrega | warning | action | Marcar como entregado |
| `READY` | Listo para entregar | Preparado en sede | info | action | Entregar y registrar |
| `DELIVERED` | Entregado | Ya entregado | success | ok | — |
| `CANCELLED` | Entrega cancelada | Ítem cancelado | neutral | blocked | — |
| `RETURNED` | Devuelto | Figura devuelto | warning | watch | — |

---

## Placa de bienvenida

| Enum (aprox.) | Etiqueta admin | Variante | Atención |
|---|---|---|---|
| `PENDING` / vacío | Placa pendiente | warning | watch |
| `GENERATED` | Placa disponible | success | ok |
| `FAILED` | Placa con error | danger | action |

Publicación: `PUBLISHED`, `SCHEDULED`, `PENDING`/`QUEUED`, `FAILED` → etiquetas en español (`presentAdminPublicationStatus`).

---

## Correo / Resend (clasificación)

| Clasificación | Etiqueta |
|---|---|
| `DELIVERED` | Entregado al buzón |
| `SENT` | Enviado |
| `DELIVERY_DELAYED` | Entrega demorada |
| `BOUNCED` | Rebotó |
| `SUPPRESSED` | Bloqueado por el proveedor |
| `FAILED` | Falló el envío |
| `UNKNOWN` | Sin confirmación de entrega |

Cola: `SENT`/`DELIVERED`, `FAILED`/`BOUNCED`, `PENDING`/`QUEUED`.

---

## FotoRank sync

| Estado | Etiqueta |
|---|---|
| `SYNCED` / `COMPLETED` / `SUCCESS` | Sincronizado con FotoRank |
| `FAILED` / `ERROR` | Error de sincronización |
| `PENDING` / `RETRY_PENDING` | Sincronización pendiente |
| vacío | Sin sincronización |

---

## Casos no contemplados / limitaciones

1. **Check-in / acreditación** no viene en el DTO del listado ni del detalle de inscripción admin; se opera en `/admin/ediciones/[editionId]/acreditacion`.
2. **Código promocional** no está expuesto como campo dedicado en el detalle admin; solo se muestra descuento monetario.
3. Labels de historial usan mapas de inscripción/pago; `source` del historial no se muestra como enum crudo en UI principal (queda fuera del texto principal).
4. Errores de proveedor (`lastErrorCode`) viven en **Información técnica**.

---

## Diferencias con texto público

| Concepto | Público | Admin |
|---|---|---|
| Confirmada | “Tu inscripción está confirmada” | “Inscripción confirmada” / operativa en sede |
| Pago en proceso | Evitar segundo pago (tono participante) | “No fuerces un segundo cobro” (tono operador) |
| Placa `GENERATED` | Puede decir “lista para compartir” | “Placa disponible” |
| Síntesis | Participante | Operativa (`Todo listo`, `Kit pendiente`, etc.) |
