# Cupones con comisión para fotógrafos (Clickatón)

Un fotógrafo comparte un código: quien lo usa tiene descuento y el fotógrafo cobra una
comisión. Con el reparto encendido, la comisión le llega **en el mismo pago** por Mercado
Pago Split 1:N; si no, queda anotada para transferirle a mano.

## Reglas (definidas el 01/10/2026)

- La comisión se calcula sobre el **precio de la inscripción antes del descuento** (nunca
  incluye el envío del kit).
- La comisión de Mercado Pago la absorben **las dos partes**, proporcional: al fotógrafo
  se le descuenta el % de MP de la edición (Ediciones → Números → comisión de
  procesamiento; si no está cargado, `DNX_CLICKATON_AFFILIATE_DEFAULT_MP_FEE_BPS`).
- Reembolso, anulación o reserva vencida: **el fotógrafo pierde la comisión**.
- Ejemplo: $30.000, código 10% + 10%, MP 6% → paga $27.000, fotógrafo $2.820.

## Cómo se usa

1. **Panel → Fotógrafos con código**: alta del fotógrafo (necesita cuenta DNX) con el email
   de su cuenta de Mercado Pago. "Enviar invitación de Mercado Pago": MP le manda un link,
   él acepta recibir cobros de DNX. Una vez y para siempre. "Actualizar estado" lo pasa a
   Activo.
2. **Panel → Códigos promocionales**: al crear el código, elegir el fotógrafo y el % de
   comisión (o asignarlo a un código existente).
3. **Panel → Comisiones de fotógrafos**: lo cobrado por reparto, lo que hay que
   transferir a mano ("Marcar transferida" con la referencia) y lo anulado.
4. **Mi cuenta del fotógrafo**: sus códigos, usos, comisiones y el estado de su
   vinculación con MP.

## Cómo cobra

- Inscripción **sin** código de fotógrafo: igual que siempre (Checkout Pro).
- Inscripción **con** código, reparto encendido, fotógrafo con MP activo: paga con el
  formulario de tarjeta y la orden sale dividida: el neto del fotógrafo como monto fijo,
  el resto a la cuenta DNX.
- Si algo de eso falta: Checkout Pro y la comisión queda "a transferir".

## Interruptores (todo nace apagado)

| Variable | Para qué |
|---|---|
| `DNX_MP_SPLIT_CONSENT_PRODUCTION_ENABLED` | Permite enviar invitaciones de MP en producción |
| `DNX_CLICKATON_AFFILIATE_SPLIT_ENABLED` | Cobro dividido en producción |
| `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` o `MERCADOPAGO_LIVE_PUBLIC_KEY` | Clave pública **productiva de la cuenta DNX** para el formulario de tarjeta |
| `DNX_CLICKATON_AFFILIATE_DEFAULT_MP_FEE_BPS` | % de MP por defecto (en puntos básicos, 600 = 6%) |

## Límites conocidos

- No hay webhook productivo de Orders: el pago se confirma al volver a la página de
  éxito, por el rescate o por la conciliación.
- Los reembolsos de órdenes con reparto se hacen desde Mercado Pago; Clickatón anula la
  comisión al recibir el estado reembolsado.
- **Primer cobro real**: verificar en MP cuánto recibió cada parte y cómo repartió MP su
  comisión. Si MP ya la prorratea, poner el % de MP en 0 para no descontarla dos veces.

## Base de datos

Migración `20261001150000_clickaton_afiliados` (aditiva, idempotente):
`ClickatonAffiliate`, `ClickatonAffiliateCommission` y dos enums. El dueño del cupón va en
`DnxPromotion.metadata.affiliate` (sin columnas nuevas en tablas compartidas).
