# Clickatón — cobros solo con distribución publicada (V1 Owner)

**Fecha:** 2026-08-11  
**Edición:** Clickatón - Día del Fotógrafo Primavera 2026 - 1° Edición  
**Decisión operativa:** cobros 100 % cuenta Owner Clickatón (V1 publicada). V2 “Tammy 100 %” permanece borrador y no debe afectar cobros.

## Causa raíz

1. **Gate de Finanzas** traducía el bloqueo `DNX Payments no está operativo` cuando `DNX_CLICKATON_DNX_PAYMENTS_CHECKOUT_ENABLED` no era exactamente `"true"` (el runtime acepta también `1` / `yes` / `on`). Eso explica el copy *“El sistema de pagos todavía no está operativo para esta edición”* aunque V1 estuviera publicada y válida.
2. **Riesgo de borrador:** si `currentVersionId` apuntaba a un DRAFT, o si un borrador mutaba `paymentAccountId` de un participante compartido con V1, el readiness/checkout podían quedar sin ACTIVE usable o con cuenta contaminada. Los cobros deben evaluar **solo** la versión `PUBLISHED` vigente.
3. **Readiness UI:** con `active === null`, `[].every(...)` marcaba cuenta “conectada” de forma engañosa.

La inscripción pública con *“No pudimos completar la inscripción”* es el catch-all `UNEXPECTED`; se mejoró el mapeo cuando la falla es financiera (`NO_ACTIVE_DISTRIBUTION`).

## Cambios

| Área | Archivos |
|------|----------|
| Resolver solo PUBLISHED (+ fallback si current apunta a draft) | `resolve-published-for-charges.ts`, `prisma-edition-finance.ts`, `edition-finance-service.ts` |
| No pisar cuenta MP de V1 al guardar borrador | mismo + `shouldFreezeParticipantAccountForDraft` |
| Flag checkout alineado | `edition-finance.ts` actions, `editions/mutations.ts` |
| Logs seguros | `finance-ops-log.ts` + resolve/gate/snapshot |
| Mensajes públicos | `public-registration/domain/errors.ts`, `checkout/domain/errors.ts`, `create-registration-checkout.ts` |
| Tests | `payment-readiness-published-only.test.ts` |
| Verificación | `scripts/verify-published-distribution-checkout.ts` |

**No se modificaron** montos, pagos, inscripciones ni la distribución V1 en datos.

## Tests ejecutados

```text
node --import tsx --test lib/admin/edition-finance/domain/payment-readiness-published-only.test.ts
→ 11 pass (V1+V2 draft, sin publicada, V2 publicada, freeze de cuenta Owner)
```

## Evidencia checkout usa V1

En tests in-memory: con V1 Owner LIVE publicada + V2 Tammy borrador incompleto:

- `resolveActiveDistribution` → version **1** / cuenta Owner  
- `evaluateGate(LIVE)` → **ok**  
- `buildSnapshotForRegistration` → `distributionVersion === 1` y `paymentAccountId` Owner  

Script de verificación (cuando hay red a la DB):

```bash
cd apps/clickaton
npx tsx scripts/verify-published-distribution-checkout.ts --edition-slug=<slug>
```

El dry-run planifica checkout con monto mínimo (100 centavos) **sin** crear preferencia MP. El reporte incluye `distributionVersionId` usado y `verdict.ignoresDraftsForCharges`.

## Verificación producción (esta sesión)

- `DATABASE_URL` de `.env.local` apunta a un entorno con una sola edición (`1er-clickaton`) **sin** `dnxEconomicAgreement` — no es el dataset de Primavera 2026 con V1/V2.
- Flag local: `DNX_CLICKATON_DNX_PAYMENTS_CHECKOUT_ENABLED` ausente → gate reporta *DNX Payments no está operativo* (mismo copy de Finanzas).
- Evidencia de que el checkout usa V1: **tests in-memory 11/11 PASS** (snapshot `distributionVersion === 1` con V2 draft presente).
- Vercel proyecto `clickaton`: último deployment de producción reportado en **ERROR** (revisar deploy aparte).
- **Acción requerida ops post-deploy:**
  1. Confirmar en Production `DNX_CLICKATON_DNX_PAYMENTS_CHECKOUT_ENABLED` truthy y webhook secret.
  2. `npx tsx scripts/verify-published-distribution-checkout.ts --edition-slug=<slug-primavera>` contra DB prod/staging correcta.
  3. Inscripción fixture monto mínimo y log `[clickaton:finance-ops]` → `finance_snapshot_attached` con `distributionVersionId` de V1 Owner.
