# Pago a referidores (split con Mercado Pago)

**Convención del sistema:** Los campos llamados `*Cents` en referidos (p. ej. `referralAmountCents`, `balanceCents`, `amountCents`) almacenan **PESOS**, no centavos. Al mostrar montos en la UI no se divide por 100.

**Quién puede referir:** Cualquier tipo de usuario (fotógrafo, laboratorio, cliente, organizador) puede tener link de referidos y recomendar. **Comisión:** solo se paga cuando el **referido es un FOTÓGRAFO** que hace ventas. Si el referido es laboratorio u organizador, no hay comisión (el registro con `?ref=` es de fotógrafos).

## Cómo funciona hoy

- **Al crear la preferencia**: La plataforma cobra el **100%** del fee de marketplace (`marketplace_fee`). Mercado Pago solo permite repartir entre **2 partes** en una misma transacción: el vendedor (fotógrafo/lab) y el marketplace (nosotros). No hay un tercer receptor “referidor” en el mismo pago.

- **Cuando se aprueba el pago (webhook)**: Se crea un registro `ReferralEarning` con:
  - `referralAmountCents`: 50% del fee → lo que corresponde al referidor.
  - `platformNetCents`: 50% del fee → lo que se queda la plataforma.

Es decir: el dinero del fee entra **todo** a la cuenta de la plataforma. En la base queda registrado cuánto es para el referidor y cuánto para la plataforma.

## Cómo pagar al referidor

### Flujo implementado: "Solicitar cobro" + pago por vos

1. **En el panel del referidor** (Configuración → Referidos): ve su **saldo disponible** y el botón **"Solicitar cobro"**.
2. Al hacer clic se crea una **solicitud de cobro** (`ReferralPayoutRequest`) con estado PENDING.
3. **Vos (admin)** entrás a **Admin → Cobros referidos** (`/admin/referral-payouts`), ves las solicitudes pendientes y pagás al referidor por MP o transferencia.
4. Hacés clic en **"Marcar como pagada"**: se setea `paidOutAt` en los earnings y el referidor ve su saldo actualizado.

### Para automatizar el envío (opcional)

La parte del referidor **no** se envía sola a su cuenta MP en el momento del pago del cliente, porque el Split de MP solo tiene 2 partes. Para que al tocar "Solicitar cobro" el dinero vaya automáticamente de tu cuenta a la del referidor podés:

1. **Consultar a MP** si tu cuenta tiene API para "transferir a usuario" o "disbursement".
2. **Transferencia a CBU**: La API de Payouts de MP permite enviar a una cuenta bancaria; si los referidores cargan CBU, se podría llamar a esa API al solicitar cobro (requiere habilitar el producto en MP).

Opciones manuales (ya cubiertas por el flujo de solicitud):

1. **Pago manual**: Desde Admin → Cobros referidos ves quién pidió cobro y cuánto; les pagás por MP o transferencia y marcás como pagada.
2. **Automatizar con MP**: Si Mercado Pago ofrece en el futuro (o en algún producto específico) una API para que el marketplace envíe dinero a un usuario (por ejemplo por `user_id` / `collector_id`), se podría llamar a esa API en el webhook justo después de crear el `ReferralEarning`, enviando `referralAmountCents` al referidor. Habría que consultar en la documentación o con soporte de MP por “transferencia desde marketplace” o “disbursement”.
3. **Otros medios**: Integrar con otro proveedor de pagos que sí permita envíos automáticos a terceros (ej. otra pasarela con API de transfer/payout).

## Resumen

| Momento              | Qué pasa                                                                 |
|----------------------|--------------------------------------------------------------------------|
| Cliente paga         | Fotógrafo recibe (total − comisión MP − fee). Plataforma recibe (fee 100%). |
| Webhook approved     | Se crea `ReferralEarning`: 50% referidor, 50% plataforma (solo contabilidad). |
| Pago al referidor    | Manual o con API de transfer cuando exista; hoy se basa en `ReferralEarning`. |

Los porcentajes están definidos y registrados; la limitación es solo de **envío automático** al referidor por la restricción de 2 partes en el Split de Mercado Pago.
