# DNX Partners — ETAPA 03 / IMPLEMENTACIÓN 03 — Resultado

**Fecha:** 2026-08-03  
**Estado:** `DONE` (write path canónico de ganadores + outbox; flags off; sin deploy/commit; sin escrituras en prod)

---

## Resumen

Se cerró el auto-sync de ganadores/premios Clickatón:

1. Write path canónico sobre `ClickatonPrizeBundle` + `ClickatonPrizeAssignment`.
2. Eventos `CLICKATON_WINNER_CONFIRMED` / `CLICKATON_WINNER_REVOKED` en la misma transacción.
3. Reevaluación acotada a audiencias WINNERS (y variantes tipadas).
4. Detección de eventos obsoletos (STALE) por `winnerVersion`.
5. UI admin `/admin/ediciones/[editionId]/premios` + filtros en sincronización.

Clickatón sigue siendo la fuente de verdad de premios/ganadores. Partners solo materializa accesos.

---

## Write path canónico

**Servicio:** `apps/clickaton/lib/admin/prize-assignments/service.ts`

| Operación | Función |
|-----------|---------|
| Confirmar | `confirmClickatonPrizeWinner` |
| Revocar | `revokeClickatonPrizeWinner` |
| Reemplazar | `replaceClickatonPrizeWinner` |
| Cancelar | `cancelClickatonPrizeAssignment` |
| Entregar | `markClickatonPrizeDelivered` (sin evento elegibilidad) |
| Slots | `ensureEditionPrizeBundles` |
| Disponible | `markPrizeBundleAvailable` |

Server actions en `mutations.ts` delegan al servicio (sin lógica de negocio en UI).

No existía write path TS previo; no se creó tabla espejo.

---

## Estados de ganador

| Bundle status | winnerRegistrationId | Semántica | Evento Partners |
|---------------|----------------------|-----------|-----------------|
| DRAFT | null | Propuesto / no listo | — |
| AVAILABLE | null | Listo para confirmar | — |
| ASSIGNED | set | Ganador confirmado | CONFIRMED |
| DELIVERED | set | Entregado (sigue ganador) | — (entrega) |
| REPLACED | null | Cancelado / invalidado | REVOKED si había confirmado |

Versión monotónica en `auditJson.winnerVersion`.

---

## Eventos e idempotencia

Claves:

```text
winner-confirmed:{prizeAssignmentId}:{versionToken}
winner-revoked:{prizeAssignmentId}:{versionToken}
```

`versionToken` = `v{n}` o `v{n}:replaced-old` / `v{n}:replaced-new`.

Reemplazo: REVOKED (old) + CONFIRMED (new) en la misma txn.

Payload mínimo: ids + `winnerVersion`; sin PII.

---

## Audiencias de ganador

- `WINNERS` / `EDITION_WINNERS` — todos los ganadores confirmados de la edición
- `CATEGORY_WINNERS` — `metadata.categoryId`
- `PRIZE_BUNDLE_WINNERS` — `metadata.prizeBundleId`

---

## Identidad

1. `userId` de inscripción  
2. Email exacto normalizado unívoco  
3. Si no: `PENDING_IDENTITY` (no bloquea confirmación deportiva)

---

## Materialización / preservación

- Automáticos por `CLICKATON_PRIZE_ASSIGNMENT` + `accessKey`
- Manuales preservados
- Otras fuentes preservadas vía plan de sync (revoke por accessKey automático)
- Shadow/apply vía flags existentes (default off)

---

## Transaccionalidad

```text
Txn: update assignment/bundle + auditJson + outbox
Commit → worker/cron → preview|apply
```

Fallo Partners no revierte el ganador.

---

## UI

- `/admin/ediciones/[editionId]/premios`
- `/admin/sponsors/sincronizacion` (filtros winner)
- Módulo «Premios» en ficha de edición

---

## Migración

- `20260803120000_dnx_partner_benefit_eligibility` (accessKey, SyncRun, statuses)
- `20260803180000_dnx_partner_benefit_auto_sync_caps`
- Schema Prisma alineado (aditivo)

**No aplicada en producción en esta implementación.**

---

## FotoOffice

Sin cambios de motor. Consume `listAccessibleBenefitsForUser` / `canUserAccessBenefit`.

---

## Riesgos / deuda

- Schema/assets de partners aún puede requerir migraciones de assets no reaplicadas en todos los entornos
- Finalistas sin fuente canónica
- Soft-lock SyncRun (no advisory PG)
- Flags deben permanecer off hasta checklist legal

## Próxima implementación recomendada

Gate legal + activación shadow en staging; o redención/QR tras aprobación (fuera de esta etapa).
