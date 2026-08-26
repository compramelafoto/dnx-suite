# DNX Partners — ETAPA 03 / IMPLEMENTACIÓN 02 — Resultado

**Fecha:** 2026-08-03  
**Estado:** `DONE` (auto-sync cableado; flags off; sin deploy/commit; sin escrituras en prod)

---

## Resumen

Se conectó el motor de elegibilidad/materialización (Stage 02 Imp 02) a cambios estables de Clickatón mediante:

1. Encolado soft-fail post-mutación  
2. Outbox durable reutilizado (`ClickatonIntegrationOutboxEvent`)  
3. Procesador idempotente (shadow / apply)  
4. Cron protegido `/api/cron/partner-benefit-sync`  
5. Admin `/admin/sponsors/sincronizacion`

FotoOffice no recalcula elegibilidad: solo consume accesos materializados.

---

## Estrategia elegida

**Outbox Clickatón existente** + cron (mismo patrón FotoRank/welcome), no tabla nueva ni bus genérico.

Flujo:

```text
Mutación Clickatón → enqueue (idempotencyKey) → cron/admin process
  → resolve scope → preview|applyBenefitAccessSync → auditoría
```

No se escribe `DnxPartnerBenefitAccess` desde webhooks/UI directamente.

---

## Eventos auditados / hooks

| Evento | Hook |
|--------|------|
| `CLICKATON_REGISTRATION_CONFIRMED` | `apply-payment-event` (paid), `confirm-free-registration`, admin `confirm_admin` |
| `CLICKATON_PAYMENT_CONFIRMED` | post-`confirmPaid` webhook |
| `CLICKATON_PAYMENT_REVERSED` | `markPaymentStatus` refund/cancel/chargeback |
| `CLICKATON_REGISTRATION_CANCELLED` | admin cancel + refund path |
| `CLICKATON_REGISTRATION_USER_LINKED` | `linkRegistrationIdentity` (solo si no estaba linkeado) |
| `CLICKATON_REGISTRATION_CATEGORY_CHANGED` | `confirmPromptSubmission` (categoryId del prompt) |
| `CLICKATON_WINNER_*` | Helpers listos; **sin write path TS** de `ClickatonPrizeAssignment` aún |
| `PARTNER_BENEFIT_ACTIVATED/PAUSED/ARCHIVED` | edition-partners service |

---

## Alcance

Funciones puras en `@repo/partners`:

- `resolveAffectedBenefitsForRegistrationEvent`
- `resolveAffectedBenefitsForPaymentEvent`
- `resolveAffectedBenefitsForWinnerEvent`
- `resolveAffectedSubjectsForBenefitChange`
- `resolveAffectedBenefitsFromPayload`

Pago → solo audiencias comprador. Ganador → `WINNERS`. Beneficio → un id.

---

## Feature flags (default OFF)

```bash
DNX_PARTNER_BENEFIT_AUTO_SYNC_ENABLED=false
DNX_PARTNER_BENEFIT_AUTO_SYNC_WRITES_ENABLED=false
```

| ENABLED | WRITES | Cron |
|---------|--------|------|
| false | * | no procesa |
| true | false | shadow (preview, sin materializar) |
| true | true | apply |

---

## Idempotencia / retries / concurrencia

- `idempotencyKey` único = `buildPartnerBenefitSyncEventKey`
- Claim atómico `updateMany` PENDING/FAILED → PROCESSING
- Backoff + max attempts → `DEAD`
- Soft-lock SyncRun del apply existente se mantiene
- Accesos: clave `accessKey`; manuals no se tocan

---

## Admin

`/admin/sponsors/sincronizacion`: flags, filtros, procesar (shadow/apply), reintentar, descartar.

Fallback manual previo (preview/apply por beneficio y edición) intacto.

---

## Migración

`20260803180000_dnx_partner_benefit_auto_sync_caps` — solo capabilities nuevas.  
**No aplicada en producción.** Outbox: sin migración (reuso).

---

## Compatibilidad FotoOffice

Sin cambios de elegibilidad. Tras apply, la próxima consulta refleja accesos. Flags de publicación FO siguen off.

---

## Activación progresiva recomendada

1. Staging: ENABLED=true, WRITES=false (shadow)  
2. Comparar planes vs estado  
3. WRITES=true en staging  
4. Checklist legal + aprobación humana  
5. Producción solo después

---

## Riesgos / deuda

- Proxy comprador sin `buyerUserId`  
- Winners sin write path  
- Soft-lock SyncRun (no advisory PG)  
- Categoría competitiva vía submission (no ticket)  
- Enum capabilities requiere migrate deploy por entorno  

## Próxima implementación

Cablear `CLICKATON_WINNER_*` cuando exista mutación canónica de `ClickatonPrizeAssignment`, o redención/QR tras gate legal.
