# Clickatón — cupones con comisión para el fotógrafo (Split 1:N)

Fecha: 2026-10-01 · Pedido por Daniel.

## 1. Qué se pide

Un fotógrafo comparte un código con su comunidad. Quien lo usa recibe un descuento
(ej. 10%) y el fotógrafo cobra una comisión (ej. 10%) **en el mismo pago**, por Mercado
Pago Split 1:N, sin transferencias manuales.

Definiciones de Daniel (01/10/2026):

1. La comisión se calcula **sobre el precio de la inscripción antes del descuento**
   (precio de lista de la fase; nunca incluye el envío del kit).
2. La comisión de Mercado Pago la **absorben ambas partes**, en proporción a lo que recibe
   cada una.
3. Si hay reembolso o anulación, **el fotógrafo pierde la comisión**.
4. Facturación: se consulta con el contador (fuera de este software).

Ejemplo: inscripción $30.000, código 10% + 10%. El participante paga $27.000. Comisión
bruta del fotógrafo: $3.000. Si MP cobra 6%, el fotógrafo recibe $3.000 − 6% = $2.820 y
DNX recibe el resto ($24.180), del que MP descuenta su parte.

## 2. Hallazgos que condicionan el diseño

- **No existe cobro Split 1:N en producción en ninguna app.** Todo lo de Orders 1:N corre
  en sandbox (homologación). Clickatón cobra en producción con Checkout Pro y un único
  cobrador (cuenta DNX, `providerUserId 97484805`, `pa_ba733fa7a35f4326`).
- El **permiso del receptor** (split-consent) es por cuenta cobradora: como toda la suite
  cobra a la cuenta DNX, un fotógrafo que acepta una vez sirve para todos los productos.
  Cada base tiene sus propias filas: Clickatón necesita sus `DnxSplitConsent`.
- **No hay webhook de Orders productivo** (la URL única vive en CLF y sólo observa
  sandbox; además la firma está sin resolver). La confirmación tiene que salir del estado
  inmediato del cobro con tarjeta + la consulta servidor a servidor (página de éxito,
  rescate, conciliación).
- **Se desconoce cómo reparte MP su comisión en un split.** Se resuelve por
  configuración (ver §5) y se verifica con el primer cobro real.
- Clickatón **no hace reembolsos monetarios**; sólo recibe el estado REFUNDED de MP y
  permite anular desde el panel.

## 3. Decisión de arquitectura

**Sólo las inscripciones con un código de fotógrafo vinculado pagan con el formulario de
tarjeta (Card Brick) y Orders 1:N en producción.** Todas las demás siguen con Checkout Pro,
sin cambios. Así el riesgo queda acotado a las ventas con comisión.

Si el reparto no se puede hacer (interruptor apagado, fotógrafo sin permiso activo en MP,
monto que no alcanza), la inscripción **paga igual por Checkout Pro** y la comisión queda
**anotada como "a pagar a mano"**. Nadie se queda sin inscribirse y nadie sin cobrar.

### 3.1 Piezas

1. **Afiliados** (`ClickatonAffiliate`): el fotógrafo, con su usuario DNX, el email de su
   cuenta de MP y el estado del permiso de split. El permiso se guarda en `DnxSplitConsent`
   (`recipientId` → `DnxPaymentRecipient` tipo `AFFILIATE`), igual que espera el paquete
   de pagos.
2. **Invitación de MP**: desde el panel (y desde Mi cuenta del fotógrafo) se envía la
   invitación `POST /v1/split-consent` con el token de la cuenta DNX; MP le manda el link;
   se refresca el estado con `GET /v1/split-consent?receiver_id=<uuid>` (corrigiendo el
   bug de FOTOFFICE que consultaba con el id numérico).
3. **Cupón con dueño**: `DnxPromotion.metadata.affiliate = { affiliateId, commissionBps }`.
   Va en `metadata` (no columna) porque la tabla es compartida por tres bases y una
   columna sin aplicar rompe todo el modelo.
4. **Libro de comisiones** (`ClickatonAffiliateCommission`, una por inscripción): base,
   porcentaje, bruto, parte de la comisión MP, neto, modo (SPLIT / MANUAL) y estado:
   `PENDING` (reservada) → `PAID_BY_SPLIT` | `OWED` (cobrada por Checkout Pro, se debe)
   → `PAID_OUT` (transferida a mano) · `REVERSED` (reembolso/anulación/vencimiento).
5. **Cobro dividido en producción**: un puente compuesto en el runtime de pagos de
   Clickatón que usa Orders 1:N (producción, token de la cuenta DNX, permiso real del
   fotógrafo) cuando la inscripción trae plan de reparto y tarjeta; si no, Checkout Pro.
6. **Panel**: en Promociones, crear un código con dueño y comisión; sección
   "Comisiones" con lo cobrado por split, lo adeudado y marcar transferido.
7. **Mi cuenta del fotógrafo**: sus códigos, ventas, comisiones y el estado de su
   vinculación con MP (con el link de la invitación).

## 4. Cálculo (función pura)

```
base      = precio de lista de la inscripción (subtotal − envío)
bruto     = round(base × commissionBps / 10000)
parteMP   = round(bruto × mpFeeBps / 10000)        // proporcional
neto      = bruto − parteMP
dueño     = total cobrado − neto
```

- Si `neto <= 0` o `dueño <= 0` (por ejemplo, un código del 100%), no hay reparto: se
  anota la comisión y se paga a mano.
- El neto va como **monto fijo** al fotógrafo; el dueño se calcula como resto.

## 5. Comisión de Mercado Pago

`mpFeeBps` se toma de la configuración de la edición (`ClickatonEditionResultSettings.
mpProcessingFeeBps`, la misma que usa "Números"). Si no está cargada, se usa un valor por
defecto configurable por variable de entorno. **Se verifica con el primer cobro real**: si
MP ya prorratea su comisión entre receptores, se pone `mpFeeBps = 0` para no cobrarle dos
veces al fotógrafo.

## 6. Confirmación y reversa

- Pago aprobado (inmediato, página de éxito, rescate o conciliación) → la inscripción se
  confirma como siempre y la comisión pasa a `PAID_BY_SPLIT` u `OWED`.
- Reserva vencida, anulación desde el panel o REFUNDED de MP → `REVERSED`. Si estaba
  `PAID_BY_SPLIT`, queda marcada para recuperar (MP devuelve en proporción al reembolsar
  una orden; lo verificamos con el primer caso).

## 7. Interruptores (todo nace apagado)

- `DNX_CLICKATON_AFFILIATE_SPLIT_ENABLED`: habilita el cobro dividido en producción.
- `DNX_MP_SPLIT_CONSENT_PRODUCTION_ENABLED` (ya existe): habilita enviar invitaciones.
- Con el primero apagado, los códigos con dueño funcionan y la comisión se anota para
  pagar a mano.

## 8. Fuera de alcance

- Webhook productivo de Orders (se confirma por consulta directa).
- Reembolsos iniciados desde Clickatón.
- Otros productos (FotoRank, CLF): el diseño es reutilizable, pero esta etapa es Clickatón.

## 9. Primer cobro real (procedimiento)

1. Daniel acepta la invitación con una cuenta de MP propia de prueba (o un fotógrafo de
   confianza).
2. Código al 10% + 10% sobre una inscripción real.
3. Verificar en MP: montos a cada receptor, comisión descontada a cada uno.
4. Ajustar `mpFeeBps` según lo observado.
