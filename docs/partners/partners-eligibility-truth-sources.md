# Elegibilidad Clickatón — fuentes de verdad (Stage 02 Imp 02)

Documento de decisiones. Complementa `PARTNERS_STAGE_02_IMPLEMENTATION_02_RESULT.md`.

## Principio

| Capa | Qué es |
|------|--------|
| Audiencia | Regla declarada en `DnxPartnerBenefitAudience` |
| Elegibilidad | Resultado calculado (subjects + reason codes) |
| Acceso | Fila en `DnxPartnerBenefitAccess` |
| Redención | Fuera de alcance (no implementar) |

## Mapa

| Concepto | Tabla / campo | Notas |
|----------|---------------|-------|
| Usuario DNX | `User` | Solo ids conocidos |
| Comprador | Proxy sobre `ClickatonRegistration.paymentStatus` | Sin `buyerUserId` |
| Orden pagada | Soft via `paymentOrderId` / status APPROVED | No se copia a access |
| Inscripción | `ClickatonRegistration` | Snapshot PII no se copia a access |
| Participante | Misma inscripción | |
| Confirmada | `status=CONFIRMED` | |
| Manual / promo | Statuses de inscripción existentes | Cancelados excluidos |
| Invitado | Guest (`userId` null) hasta resolve | Pending identity |
| Categoría | Prompt `categoryId` + submissions | ≠ ticket |
| Ganador | `ClickatonPrizeAssignment.winnerRegistrationId` | |
| Finalista | Diferido | |
| Staff / organizador | Diferido | |

## Identidad

1. `registration.userId` / winner userId si existe en `User`
2. Email exacto normalizado unívoco → `User.id`
3. No resolver

## Idempotencia de access

- Manual: `manual:{benefitId}:{userId}`
- Automático: `auto:{benefitId}:{userId}:{sourceType}:{sourceId}`
- Pendiente: `pending:{benefitId}:{sourceType}:{sourceId}`
