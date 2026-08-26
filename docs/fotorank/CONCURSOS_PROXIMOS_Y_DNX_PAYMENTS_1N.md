# Concursos próximos en FotoRank y plan de integración con DNX Payments (split 1:N)

Estado: **borrador técnico**. Ningún cobro está habilitado todavía.

> **Actualización 2026-08-26 — alcance de este documento.**
> "El País que Miramos" **no usa Split 1:N**: el organizador y quien cobra son la
> misma cuenta, así que no hay nada que repartir. Ese concurso va por
> **Checkout Pro sin split** (`apps/fotorank/app/lib/fotorank/checkout/`), y la
> homologación de Split 1:N **dejó de bloquearlo**.
>
> Lo que sigue aplica a concursos que sí reparten el cobro entre varios
> receivers — hoy, el caso de Clickatón. El modelo de cobro de cada concurso se
> declara en `ContestPaymentModel` (`DIRECT` | `SPLIT_1N`) y determina qué exige
> el gate de apertura de inscripciones.

Este documento describe (1) qué quedó implementado y (2) exactamente qué falta
para conectar DNX Payments con distribución 1:N sin rediseñar el concurso.

---

## 1. Qué quedó implementado

### Ciclo de vida del concurso

El enum `FotorankContestStatus` se amplió de forma **aditiva**. Los siete valores
históricos (`DRAFT`, `SETUP_IN_PROGRESS`, `READY_TO_PUBLISH`, `PUBLISHED`,
`ACTIVE`, `CLOSED`, `ARCHIVED`) conservan su semántica exacta; ningún concurso
existente cambió de estado.

Se agregaron las fases operativas: `UPCOMING`, `REGISTRATION_OPEN`,
`SUBMISSIONS_CLOSED`, `ADMISSION`, `JUDGING`, `FINALISTS`, `COMPLETED`,
`CANCELLED`.

La fuente de verdad de transiciones y capacidades es
`apps/fotorank/app/lib/fotorank/upcoming/lifecycle.ts`. Ahí se decide, por fase,
si el concurso es público, si acepta registro de interés, si acepta pagos, si
acepta carga de obras y si puede enviar correos reales.

**Invariante clave:** `allowsPayments` responde sólo por la fase. El cobro real
exige además que DNX Payments esté habilitado — ver `canAcceptPayments`.

### Registro de interés ("Notificarme")

| Modelo | Rol |
|---|---|
| `FotorankContestInterest` | Un registro por `(contestId, userId)`. Restricción única = idempotencia. |
| `FotorankContestInterestAuditEvent` | Auditoría append-only. Cancelar no borra nada. |

Elegibilidad al beneficio: se congela en el primer registro y **no se extiende**
al repetir la acción.

### Precios escalonados

| Modelo | Rol |
|---|---|
| `FotorankContestPricePhase` | Ventana de fechas + audiencia (`INTEREST_EXCLUSIVE` / `GENERAL`). |
| `FotorankContestPriceTier` | Monto por paquete, en **minor units enteras** (centavos). |

`apps/fotorank/app/lib/fotorank/upcoming/pricing.ts` resuelve el precio en el
servidor a partir de (fecha UTC, timezone del concurso, elegibilidad, cantidad).
El importe **nunca** proviene del cliente: `assertClientAmountMatches` sólo sirve
para detectar manipulación y rechazar la operación.

### Comunicaciones

`FotorankContestScheduledCommunication` es un calendario **declarativo**: define
qué se envía y cuándo, pero no dispara nada. El despacho pasa por
`communications.ts`, que bloquea en este orden:

1. Concurso en `DRAFT` → nunca hay envío real.
2. Entorno distinto de producción → nunca hay envío real.
3. Evento que depende de pagos y `DNX_PAYMENTS_ENABLED != 1` → bloqueado.
4. Sin consentimiento válido (o dado de baja) → bloqueado.
5. Clave de idempotencia ya usada → bloqueado.

---

## 2. Puntos de integración con DNX Payments

El core de pagos ya existe en `packages/payments` con su modelo de acuerdos y
distribución. **No se inventaron campos financieros nuevos**: la integración se
apoya en lo que ya está.

| Concepto | Dónde vive hoy |
|---|---|
| Concurso | `FotorankContest.id` → `scopeId` del acuerdo económico |
| Alcance | `scopeType = "CONTEST"` |
| Organizador | `FotorankContest.organizationId` → participante del acuerdo |
| Paquete | cantidad de fotografías (1\|2\|3) → `productKey` |
| Precio aplicado | `FotorankContestPriceTier.amountMinor` resuelto por el servidor |
| Etapa de precio | `FotorankContestPricePhase.code` → snapshot de la orden |
| Beneficio de interesado | `FotorankContestInterest.benefitEligible` + `benefitDeadlineAt` |
| Orden futura | `DnxPaymentOrder.id` → `FotorankContestRegistration.paymentOrderId` (soft ref **ya existente**) |
| Estado del pago | `FotorankContestRegistration.paymentStatus` |
| Distribución 1:N | `DnxDistributionVersion` (PUBLISHED) + `DnxDistributionRule` (bps o fijo) |
| Comisiones de plataforma | `FotorankContest.platformFeeBps` / `ContestOrganization.platformFeeBps` |
| Conciliación | `DnxOrderDistributionSnapshot.engineInputHash` |
| Auditoría | `FotorankPlatformAuditEvent` + auditoría propia del core de pagos |
| Idempotencia | `ContestOrderIntent.idempotencyKey` por (concurso, usuario, intento) |

El contrato del adaptador está en
`apps/fotorank/app/lib/fotorank/upcoming/payments-integration.ts`:

```ts
export type ContestPaymentAdapter = {
  createOrder(intent: ContestOrderIntent): Promise<ContestOrderResult>;
};
```

Hoy el adaptador vigente es `disabledContestPaymentAdapter`, que **rechaza
siempre**. Sustituirlo es el único punto que hay que tocar para habilitar el cobro.

---

## 3. Plan técnico para conectar el cobro

### Etapa A — Acuerdo económico

1. Crear un `DnxEconomicAgreement` con `scopeType = "CONTEST"` y
   `scopeId = <FotorankContest.id>`.
2. Dar de alta los participantes del acuerdo (organizador, plataforma y, si los
   hubiera, sponsors o terceros).
3. Crear una `DnxDistributionVersion` en `DRAFT` con sus `DnxDistributionRule`
   (porcentaje en basis points o monto fijo en minor units) y publicarla.
   Una versión `PUBLISHED` es inmutable.

### Etapa B — Adaptador de órdenes

4. Implementar `ContestPaymentAdapter.createOrder`:
   - Volver a resolver el precio con `resolveServerPrice` (nunca confiar en el
     importe recibido).
   - Verificar `assertPaymentsAvailable` (fase + bandera habilitada).
   - Resolver el acuerdo y su versión publicada.
   - Persistir un `DnxOrderDistributionSnapshot` con `engineInputHash`.
   - Crear la orden en el proveedor con la clave de idempotencia del intent.
5. Guardar `paymentOrderId` en `FotorankContestRegistration`.

### Etapa C — Webhook y habilitación

6. Procesar el webhook de aprobación con verificación de firma e idempotencia.
7. Recién con el pago aprobado: pasar `paymentStatus` a `PAID`, confirmar la
   inscripción y **habilitar la carga de fotografías**.
8. Marcar el interés como `CONVERTED` (`convertedAt`, `convertedRegistrationId`,
   `selectedPackageCode`) para que el panel de interesados muestre la conversión
   y la recaudación real.

### Etapa D — Reembolsos y conciliación

9. Definir la política de cancelación y reembolso **antes** de habilitar pagos:
   es un requisito del gate `REGISTRATION_OPEN`.
10. Conciliar contra `DnxOrderDistributionSnapshot`.

### Etapa E — Habilitación

11. Setear `DNX_PAYMENTS_ENABLED=1` y declararla en `turbo.json`.
12. Completar en el panel: `dnxSplitConfigValidated`, `purchaseTestApproved`,
    `photoEnablementTestApproved`, `transactionalEmailsValidated`.
13. Recién entonces el gate `REGISTRATION_OPEN` deja de bloquear.

---

## 4. Qué NO hacer

- No tomar el precio del cliente bajo ninguna circunstancia.
- No habilitar la carga de fotografías antes del webhook de pago aprobado.
- No convertir el beneficio para interesados en un código público compartible:
  está asociado al par (usuario, concurso).
- No enviar comunicaciones promocionales a participantes de otros concursos sin
  consentimiento válido para éste o consentimiento general vigente.
