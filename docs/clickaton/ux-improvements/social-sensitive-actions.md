# Acciones sensibles — placas, social y comunicaciones

Documento de presentación. **No se crearon acciones nuevas.** No se ejecutaron publicaciones ni correos reales en esta etapa.

---

## Volver a generar placa

| Campo | Valor |
|---|---|
| Confirmación | Sí — nueva versión con datos actuales |
| Duplicación | No publica; descargas previas pueden quedar desactualizadas |
| Envío automático | No afirmado |
| Reversible | Generando otra versión |
| `LEGAL_REVIEW` | Uso de imagen / nombre |

## Aprobar / rechazar placa

| Confirmación | Sí |
| Destino | Flujo editorial de la placa |
| Publicación automática | No afirmada |

## Aprobar publicación social

| Confirmación | Sí — revisar preview |
| Efecto | Pasa a APPROVED/SCHEDULED según lógica existente |
| LIVE off | No publica a Meta automáticamente (worker dry-run) |

## Volver a intentar publicación

| Confirmación | Sí — riesgo de duplicado |
| Destino | Cuenta Instagram / plataforma |
| Efecto sobre publicado | Incierto; revisar cuenta antes |

## Programar / cancelar / duplicar / rechazar

| Confirmación | Sí |
| Duplicar | Crea preparación PENDING_APPROVAL; no publica sola |

## Reenviar correo

| Confirmación | Sí — muestra destinatario |
| Duplicación | Posible si ya recibió el mensaje |
| Idempotencia | Sin cambios en lógica |

## Elementos `LEGAL_REVIEW`

- Generación automática de placas
- Publicación de nombre e Instagram
- Etiquetado
- Posteos colaborativos (no habilitados en UI)
- Uso de imagen / fotografías
- Publicación en redes
- Revocación / eliminación / reutilización comercial
- Envíos promocionales (no transaccionales)
