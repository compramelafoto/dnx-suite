# Cómo probar el descuento de fee con saldo de referidos

Cuando un fotógrafo **referidor** (tiene saldo de comisiones por referidos) hace una **venta propia**, ese saldo se usa para descontar el fee de la plataforma en esa venta (hasta el monto del fee). Al aprobarse el pago, los earnings usados se marcan como "aplicados" y dejan de contar para su saldo disponible.

---

## 1. Prueba rápida con script (sin pagar)

### Crear datos de prueba y simular descuento

```bash
npx tsx scripts/test-referral-fee-discount.ts --seed
```

Esto crea:

- Usuario **referidor** (`referrer-fee-discount@test.com`) con un `ReferralEarning` de 500 centavos (saldo disponible).
- Usuario **referido** y atribución activa.
- Un **PrintOrder** del referidor con fee de 800 centavos.

Luego calcula y guarda el descuento: min(800, 500) = 500 → fee final 300 centavos y `referralFeeDiscountCents = 500` en el pedido.

### Verificar un pedido existente

Si ya tienes un `PrintOrder` cuyo fotógrafo tiene saldo de referidos:

```bash
# Solo ver qué pasaría (no escribe en DB)
npx tsx scripts/test-referral-fee-discount.ts --dry-run <PrintOrderId>

# Ver y aplicar el descuento en el pedido
npx tsx scripts/test-referral-fee-discount.ts <PrintOrderId>
```

---

## 2. Prueba manual del flujo completo (create-preference + webhook)

### Requisitos

- App en marcha (`npm run dev`).
- Usuario **referidor** con saldo (p. ej. el creado con `--seed` o uno real que ya tenga `ReferralEarning` con `paidOutAt`, `reversedAt` y `appliedAt` en null).
- Ese mismo usuario es el fotógrafo/vendedor de un pedido (PrintOrder o álbum).

### Paso A: Create-preference (descuento al crear el pago)

1. Con el referidor logueado, crear un pedido de impresión (o álbum) y llegar al paso de pago.
2. Al llamar a **Crear preferencia** (botón de pagar con Mercado Pago), el backend:
   - Calcula el fee del pedido.
   - Obtiene el saldo de referidos del vendedor (solo earnings con `paidOutAt`, `reversedAt` y `appliedAt` en null).
   - Hace descuento = min(fee, saldo), reduce el fee y guarda `referralFeeDiscountCents` en el pedido.

**Comprobar:**

- En base de datos, el `PrintOrder` o `Order` debe tener `referralFeeDiscountCents` > 0.
- El `marketplace_fee` que se envía a Mercado Pago debe ser menor que el fee original (o 0 si el saldo cubre todo el fee).

**Alternativa con curl (reemplaza `ORDER_ID` y el host):**

```bash
curl -X POST http://localhost:3000/api/payments/mp/create-preference \
  -H "Content-Type: application/json" \
  -H "Cookie: <tu cookie de sesión>" \
  -d '{"orderId": ORDER_ID, "orderType": "PRINT_ORDER"}'
```

Revisar en DB que ese pedido tenga `referralFeeDiscountCents` y que la respuesta incluya `init_point` (y en MP el fee sea el ya descontado).

### Paso B: Webhook (consumir earnings al aprobar)

Cuando el pago de ese pedido pasa a **approved** (pago real en sandbox o simulación de webhook), el webhook debe:

1. Actualizar el pedido a PAID.
2. Si `referralFeeDiscountCents` > 0: llamar a `consumeReferralEarningsForDiscount` para el vendedor (referidor), marcando earnings con `appliedAt`, `appliedToOrderId` y `appliedToOrderType`.

**Comprobar:**

- En `ReferralEarning`: los registros usados para el descuento tienen `appliedAt` no null, `appliedToOrderId` = id del pedido, `appliedToOrderType` = "PRINT_ORDER" o "ALBUM_ORDER".
- El **saldo** del referidor (GET `/api/referrals/me` o solicitud de cobro) debe haber bajado: esos earnings ya no cuentan (se excluyen con `appliedAt: null`).

### Simular webhook approved a mano (opcional)

Si no quieres pagar en sandbox, puedes:

1. Marcar el pedido como PAID en DB y, en otro script o en un one-off, llamar a la misma lógica que usa el webhook para consumir earnings (o ejecutar solo la parte de `consumeReferralEarningsForDiscount` con el `referrerUserId`, `discountCents`, `orderId` y `orderType` correctos).
2. Verificar después en DB que los `ReferralEarning` tengan `appliedAt` y que el saldo en `/api/referrals/me` sea el esperado.

---

## 3. Resumen de qué revisar

| Dónde | Qué comprobar |
|-------|----------------|
| **create-preference** | Fee reducido; `referralFeeDiscountCents` guardado en el pedido. |
| **Webhook (approved)** | Earnings del referidor marcados con `appliedAt` / `appliedToOrderId` / `appliedToOrderType`. |
| **GET /api/referrals/me** | Saldo = solo earnings con `paidOutAt`, `reversedAt` y **appliedAt** en null. |
| **POST request-payout** | Mismo criterio de saldo; no permite cobrar earnings ya aplicados. |
| **Admin mark-paid** | Solo marca como pagados earnings con `appliedAt: null`. |
