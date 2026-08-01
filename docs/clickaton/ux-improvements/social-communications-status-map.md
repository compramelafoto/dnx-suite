# Mapa de estados — placas, social y comunicaciones

Fuente: `lib/social-communications/ui/social-communications-status-presentation.ts` + extensiones en `admin-status-presentation.ts`.  
**No son estados persistidos nuevos.**

---

## Publicación social

| Interno | Etiqueta | Listo | Enviado/publicado | Atención | Reintento | Duplicación | Pantallas |
|---|---|---|---|---|---|---|---|
| PENDING_APPROVAL | Listo para revisar | Sí | No | action | No | No | `/admin/social`, detalle |
| APPROVED | Aprobada | Sí | No | watch | No | No | social |
| SCHEDULED | Programada | Sí | No | watch | No | No | social |
| PUBLISHED | Publicada | Sí | Sí | ok | No | Sí | social, detalle |
| FAILED | No pudimos confirmar… | No | No* | action | Sí | Sí | social |
| CANCELLED | Cancelada | No | No | ok | No | No | social |
| REJECTED | Rechazada | No | No | watch | No | No | social |
| NOT_SCHEDULED | Sin programación | No | No | watch | No | No | detalle placa |
| PENDING/QUEUED | En cola | No | No | watch | No | No | social |

\* FAILED no afirma publicación; advierte posible envío parcial.

## Modo LIVE

| Condición | Etiqueta | canPublishNow |
|---|---|---|
| env ≠ true | Publicación automática desactivada | false |
| env === true | Publicación automática habilitada | true |

## Placa (admin)

| Interno | Etiqueta |
|---|---|
| PENDING / vacío | Placa pendiente |
| GENERATED | Placa disponible |
| FAILED | Placa con error |

## Correo (cola)

| Interno | Etiqueta |
|---|---|
| PENDING/QUEUED | Preparando envío |
| SENT | Correo enviado |
| DELIVERED | Correo entregado |
| BOUNCED | No pudo entregarse |
| FAILED | No pudimos enviar el correo |

## Acreditación (motivo)

READY → Lista para acreditar; WINDOW_CLOSED → Fuera de horario; CREDENTIAL_MISSING → Falta la credencial; etc.

## Casos no contemplados

- Carrusel multi-pieza en cola (no modelado en UI actual).
- Post colaborativo Meta (no se muestra opción).
- “Publicar ahora” (no existe acción; no se inventa con LIVE off).
