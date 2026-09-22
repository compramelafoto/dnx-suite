# Regalar una inscripción de Clickatón a un amigo

Fecha: 2026-09-21
Estado: diseño aprobado, pendiente de implementación
Plataforma: Clickatón (`apps/clickaton`)

## 1. Qué problema resuelve

Hoy sólo puede inscribirse la persona que va a participar: el wizard exige foto
de perfil, usuario de Instagram, documento, contacto de emergencia, talle de
remera, sede y la aceptación de las bases. Nada de eso lo puede completar un
tercero.

Queremos que alguien pueda **comprar un lugar y regalarlo**: paga, recibe un
voucher con código único, se lo manda al amigo por email o WhatsApp, y el amigo
entra con ese link y completa su propia inscripción sin pagar nada.

## 2. Por qué no alcanza con un cupón

Los cupones (`DnxPromotion`, por ejemplo `VOLVI50`) son **códigos genéricos y
compartidos**: el mismo texto sirve para todo el mundo y se puede usar tantas
veces como permita el límite. Un regalo necesita lo contrario: un código
**único, de un solo uso, atado a un pago concreto y anulable**.

Son dos cosas distintas y conviven sin fricción:

> **`VOLVI50` sigue funcionando dentro del regalo.** La compra de regalo pasa
> por el mismo motor de precios y promociones (`@repo/promotions`) que la
> inscripción normal. Si el regalador es veterano y aplica su código, el
> descuento se calcula igual. No requiere código especial.

## 3. Decisión central: el regalo ES una inscripción, no una venta paralela

En lugar de construir un circuito de venta nuevo, **la compra del regalo crea
una `ClickatonRegistration` real desde el primer momento**, con los datos del
comprador como contacto y marcada como regalo. Cuando el amigo activa el
voucher, no se crea nada nuevo: se **completa esa misma inscripción** con sus
datos.

Es el equivalente a vender una entrada "a nombre de a designar" y completar el
nombre después.

Ventajas concretas:

- Reserva de cupo (`ClickatonCapacityHold`), cobro por DNX Payments / Mercado
  Pago, cupones, fases de precio, numeración visible, QR, credencial, placa de
  bienvenida y sincronización con FotoRank: **todo se reusa tal cual está**.
- El conteo de cupo disponible hoy es `registraciones CONFIRMED + holds ACTIVE`
  (`prisma-public-registration-repository.ts:63`). Si el regalo pagado y sin
  canjear conserva su hold en estado `ACTIVE`, **el cupo se descuenta solo, sin
  tocar una sola consulta de disponibilidad**.
- Ya existe `signRegistrationAccessToken` / `verifyRegistrationAccessToken`
  (`lib/public-registration/domain/access-token.ts`) y una pantalla de
  activación post-pago (`/maratones/[slug]/inscripcion/activar/[registrationId]`),
  de las que copiamos el patrón.
- Ya existe el estado `TRANSFERRED_TO_NEXT_EDITION`, pensado para trasladar una
  inscripción no usada a la edición siguiente: es exactamente lo que necesita un
  voucher que no vence.

## 4. Decisiones de producto acordadas

| Decisión | Elegido |
|---|---|
| ¿Cuándo se reserva el cupo? | Al acreditarse el pago del regalo |
| ¿Quién elige sede y talle? | El amigo, al activar |
| ¿El voucher vence? | No: si no se activa, pasa como crédito a la edición siguiente |
| ¿El regalador necesita sesión? | No |
| ¿Cuántos vouchers por compra? | Uno (varios quedan para una etapa 2) |
| ¿Quién puede activar? | Quien tenga el link, como una gift card |

### 4.1 Cómo se concilia "reserva cupo" con "no vence"

Las dos cosas juntas, literales, llenarían la edición de lugares fantasma. La
regla es:

1. El cupo queda reservado **hasta que cierren las inscripciones de esa
   edición** (`registrationCloseAt`).
2. Si el amigo no activó para entonces, el cupo se libera **pero el voucher no
   se pierde**: la inscripción pasa a `TRANSFERRED_TO_NEXT_EDITION` y el voucher
   queda apuntando a la edición siguiente en cuanto exista.
3. El voucher cubre **una inscripción completa equivalente**, no un monto en
   pesos. Si la edición siguiente sale más cara, el amigo no paga diferencia.
   Es la misma lógica que ya usa el Pack 4 maratones (créditos = inscripciones).

### 4.2 Beneficio de remera de los primeros N

El beneficio "remera oficial para los primeros 100 con pago confirmado"
(`lib/catalog/domain/first-n-benefit.ts`) se evalúa por **la fecha de pago del
regalo**, no por la fecha de activación. De otro modo el regalador paga temprano
y el amigo pierde la remera por tardar dos días en abrir el mail.

El talle se elige al activar, contra el stock disponible en ese momento. El
regalo **no reserva talle**, sólo cupo.

### 4.3 Sede

El cupo se reserva a nivel edición / tipo de entrada, sin sede
(`ClickatonCapacityHold.venueId` es nullable). Al activar, el amigo elige entre
las sedes con lugar. Si la edición tiene una sola sede, esto es invisible.

Si el tipo de entrada comprado ya está atado a una sede
(`ClickatonTicketType.venueId`), la sede viene fija desde la compra y el paso se
saltea.

## 5. Modelo de datos

### 5.1 Tabla nueva: `ClickatonGiftVoucher`

Relación 1:1 con la inscripción que representa.

```prisma
enum ClickatonGiftVoucherStatus {
  PENDING_PAYMENT   // creado, esperando que se acredite el pago
  ACTIVE            // pagado, listo para que el amigo lo active
  REDEEMED          // el amigo lo activó; la inscripción es suya
  CARRIED_OVER      // no se activó a tiempo; vale para la edición siguiente
  CANCELLED         // anulado por el regalador o por administración
  REFUNDED          // devuelto
}

model ClickatonGiftVoucher {
  id                   String                     @id @default(cuid())
  /// Código humano único: REGALO-XXXX-XXXX (base32 sin caracteres ambiguos).
  code                 String                     @unique
  status               ClickatonGiftVoucherStatus @default(PENDING_PAYMENT)
  editionId            String
  /// Inscripción "a designar" que el voucher representa (1:1).
  registrationId       String                     @unique

  // Quien regala (snapshot; puede no tener cuenta DNX).
  buyerUserId          Int?
  buyerFirstName       String
  buyerLastName        String
  buyerEmail           String
  buyerPhone           String?

  // Quien recibe. Ambos opcionales: puede compartirse sólo por link.
  recipientName        String?
  recipientEmail       String?
  /// Dedicatoria libre del regalador (texto plano, límite 500).
  giftMessage          String?

  // Ciclo de vida.
  paidAt               DateTime?
  /// Cierre de inscripción de la edición comprada; informativo para la UI.
  redeemableUntil      DateTime?
  redeemedAt           DateTime?
  cancelledAt          DateTime?
  /// Edición a la que se trasladó si no se activó a tiempo.
  carriedOverToEditionId String?
  carriedOverAt        DateTime?

  /// Veces que se reemitió el código (el anterior queda inválido).
  reissueCount         Int                        @default(0)
  /// Envíos de email al amigo (para cortar abuso de reenvío).
  recipientEmailSentAt DateTime?
  recipientEmailCount  Int                        @default(0)

  createdAt            DateTime                   @default(now())
  updatedAt            DateTime                   @updatedAt

  edition              ClickatonEdition           @relation(fields: [editionId], references: [id], onDelete: Restrict)
  registration         ClickatonRegistration      @relation(fields: [registrationId], references: [id], onDelete: Restrict)
  carriedOverToEdition ClickatonEdition?          @relation("GiftVoucherCarriedOverEdition", fields: [carriedOverToEditionId], references: [id], onDelete: SetNull)

  @@index([editionId, status])
  @@index([buyerEmail])
  @@index([recipientEmail])
  @@index([status, redeemableUntil])
}
```

El dinero, el cupón aplicado, la fase de precio y las referencias de pago **no
se duplican acá**: viven en la `ClickatonRegistration`, como en cualquier
inscripción.

### 5.2 Cambios en `ClickatonRegistration`

```prisma
  /// true si esta inscripción nació como regalo.
  isGift               Boolean                @default(false)
  giftVoucher          ClickatonGiftVoucher?
```

### 5.3 Interruptor por edición, en `ClickatonEdition`

```prisma
  /// Habilita la compra de regalos en esta edición. Nace apagado.
  giftVouchersEnabled  Boolean                @default(false)
```

Nace apagado a propósito: encender un módulo son siempre dos cosas, el código
publicado y el dato en la base. Con esto el trabajo se puede ir fusionando sin
alterar la venta en curso.

### 5.4 Estado nuevo en `ClickatonRegistrationStatus`

```prisma
  /// Regalo pagado, esperando que la persona destinataria lo active.
  GIFT_AWAITING_REDEMPTION
```

Se agrega **al final del enum** para no alterar el orden existente.

### 5.5 Migración

Una sola migración SQL con: el enum nuevo, el valor nuevo del enum de estado,
las dos columnas en `ClickatonRegistration`, el interruptor en `ClickatonEdition`
y la tabla `ClickatonGiftVoucher`
con sus índices.

Dos cuidados propios de este monorepo, ya conocidos:

- El schema de Prisma es compartido: la migración hay que **aplicarla a mano en
  las 5 bases Neon**, y registrarla en `_prisma_migrations` con el checksum de
  una base sana.
- El deploy de Clickatón **no corre `prisma migrate deploy`**. Si la migración no
  se aplica antes de publicar el código, la aplicación rompe con `P2021`.

## 6. Máquina de estados

| Momento | `Registration.status` | `Registration.paymentStatus` | `CapacityHold.status` | `Voucher.status` |
|---|---|---|---|---|
| Regalador confirma la compra | `DRAFT` | `PENDING` | `ACTIVE` (vence en `holdMinutes`) | `PENDING_PAYMENT` |
| Se acredita el pago | `GIFT_AWAITING_REDEMPTION` | `APPROVED` | `ACTIVE` (vence en `registrationCloseAt`) | `ACTIVE` |
| El amigo activa | `CONFIRMED` | `APPROVED` | `CONSUMED` | `REDEEMED` |
| No se activó y cerró la inscripción | `TRANSFERRED_TO_NEXT_EDITION` | `APPROVED` | `RELEASED` | `CARRIED_OVER` |
| El regalador anula antes de activarse | `CANCELLED` | `APPROVED` / `REFUNDED` | `RELEASED` | `CANCELLED` |
| El pago nunca llega | `CANCELLED` (cron de expiración) | `EXPIRED` | `EXPIRED` | `CANCELLED` |

Mientras el voucher está en `GIFT_AWAITING_REDEMPTION` **no** se asigna
`visibleCode` ni `sequenceNumber`: el número de participante se emite recién al
activar, igual que en cualquier confirmación.

## 7. Flujos

### 7.1 Comprar un regalo

Ruta: `/maratones/[slug]/regalar`

1. Botón **"Es un regalo para un amigo"** en la página de inscripción, que lleva
   a la ruta nueva.
2. Elige el pack (mismo catálogo y misma fase de precio que la compra normal).
   No hay paso de sede ni de talle.
3. Completa **sus** datos: nombre, apellido, email, teléfono.
4. Opcionalmente: nombre y email del amigo, y una dedicatoria.
5. Aplica cupón si tiene (`VOLVI50` u otro).
6. Acepta las bases **como comprador** (queda registrado en
   `acceptedTermsAt` / `termsVersion`).
7. Paga por el circuito existente (`createRegistrationCheckoutUseCase`).

### 7.2 Se acredita el pago

En `apply-payment-event.ts`, cuando la inscripción tiene `isGift = true`:

- No se dispara el email de confirmación de participante.
- El estado va a `GIFT_AWAITING_REDEMPTION`, no a `CONFIRMED`.
- El hold se **prolonga** hasta `registrationCloseAt` en lugar de consumirse.
- Se genera el código del voucher y pasa a `ACTIVE`.
- Salen los emails de la sección 8.

### 7.3 Activar el regalo

Ruta: `/regalo/[code]`

1. Pantalla de bienvenida: quién se lo regaló, la dedicatoria, qué incluye, la
   fecha y el lugar de la Clickatón.
2. Botón **"Activar mi lugar"**.
3. Wizard de inscripción habitual — sede (si hay más de una), talle, datos
   personales, foto de perfil, Instagram, bases — **sin paso de pago ni de
   precio**.
4. Al confirmar: la inscripción pasa a `CONFIRMED`, se emite número visible, QR,
   credencial y placa de bienvenida, y sale el email de confirmación de siempre.
5. Al regalador le llega el aviso "tu amigo activó el regalo".

### 7.4 Compartir

El email al regalador y la pantalla de "gracias" incluyen:

- El código del voucher, legible y copiable.
- El link directo.
- Un botón **"Enviar por WhatsApp"** (`https://wa.me/?text=...`) con el mensaje
  ya redactado, incluyendo el link.
- Un botón "Copiar link".
- Un campo para cargar o corregir el email del amigo y reenviarle el voucher
  (con tope de reenvíos).

## 8. Emails

Cuatro correos nuevos, con el mismo mecanismo que los actuales
(`lib/registration/notifications/participant-email.ts`, `sendIdentityEmail` de
`@repo/auth`, respetando `resolveRecipient` para no spamear en staging):

| Destinatario | Cuándo | Contenido |
|---|---|---|
| Regalador | Pago acreditado | Código, link, botón de WhatsApp, instrucciones |
| Amigo | Pago acreditado, si hay email | El regalo, quién se lo hace, la dedicatoria, botón "Activar mi lugar" |
| Regalador | El amigo activó | Confirmación y nombre de quien activó |
| Amigo | Falta poco para el cierre, si no activó | Recordatorio con el link |

El recordatorio se despacha desde el cron existente de Clickatón.

## 9. Panel de administración

Pantalla nueva **Regalos** dentro de la edición:

- Listado con código, comprador, destinatario, estado, fecha de pago y monto.
- Acciones: reenviar el email al amigo, cambiar el email del destinatario,
  reemitir el código (invalida el anterior), anular el voucher y liberar el
  cupo.
- Contador: vendidos / activados / pendientes.

Toda acción queda registrada en `ClickatonRegistrationAudit`.

## 10. Casos borde

| Caso | Resolución |
|---|---|
| El amigo ya está inscripto en esa edición | Se avisa y se ofrece trasladar el regalo a la edición siguiente, o cambiar el destinatario |
| El link se filtra y lo activa otra persona | Es el comportamiento de una gift card. El regalador puede reemitir el código antes de que se active |
| El voucher se reemite | El código viejo deja de resolver; sube `reissueCount` |
| El regalador pide devolución antes de que se active | Reembolso por el circuito normal; voucher a `CANCELLED` y cupo liberado |
| El regalador pide devolución después de activado | No corresponde: la inscripción ya es del amigo. Se responde por administración |
| Se cae el pago y nunca se acredita | El cron de expiración lo cancela igual que cualquier reserva |
| El regalo se paga después de cerrada la inscripción | La compra se bloquea antes, con el mismo control de ventana de inscripción |
| El amigo activa el último día | Vale mientras `registrationCloseAt` no haya pasado |

## 11. Riesgo conocido: el estado nuevo

Agregar `GIFT_AWAITING_REDEMPTION` obliga a revisar **todos** los lugares que
filtran por estado, porque un regalo pagado no debe contarse como participante
confirmado pero sí debe ocupar cupo. Lugares a auditar explícitamente:

- Conteos de cupo y de fase de precio (`prisma-public-registration-repository.ts`).
- Conteo del beneficio de remera de los primeros N.
- Listados y métricas del panel de administración.
- Sincronización con FotoRank (no debe sincronizar un regalo sin activar).
- Acreditación y credenciales (no debe emitir QR sin activar).
- Cron de expiración de reservas pendientes (no debe cancelar un regalo pagado).

Cada uno de estos puntos lleva su prueba.

## 12. Pruebas

- **Unitarias**: generación y validación del código, máquina de estados del
  voucher, cálculo del beneficio de remera por fecha de pago, regla de traslado
  al cierre de inscripciones.
- **De integración**: compra de regalo → acreditación → activación completa;
  compra con `VOLVI50` aplicado; anulación con liberación de cupo; intento de
  activar dos veces el mismo código.
- **De cupo**: verificar que un regalo pagado y sin activar descuenta cupo y que
  al activarse no lo descuenta dos veces.
- **End to end** (Playwright, ya configurado en el proyecto): el recorrido
  completo del regalador y el del amigo.

## 13. Fuera de alcance de esta etapa

- Regalar varios vouchers en una sola compra.
- Regalo con fecha de entrega programada ("que llegue el 24 de diciembre").
- Placa o tarjeta de regalo diseñada como imagen descargable.
- Regalar productos de la tienda (sólo inscripciones).

## 14. Orden de construcción propuesto

1. Migración y modelo de datos.
2. Dominio del voucher: código, estados, reglas de canje (con pruebas, sin UI).
3. Alta de regalo y su cobro, reusando el checkout existente.
4. Acreditación del pago y emisión del voucher.
5. Pantalla de activación y wizard sin pago.
6. Los cuatro emails y el botón de WhatsApp.
7. Auditoría del estado nuevo en los puntos de la sección 11.
8. Panel de administración.
9. Traslado automático a la edición siguiente al cerrar inscripciones.

## 15. Advertencias de despliegue

- Esto toca el corazón de la venta, que **está vendiendo ahora mismo** para la
  edición del 12/12. Cada etapa tiene que quedar detrás de un interruptor por
  edición y se enciende recién cuando el circuito completo pasó las pruebas.
- La migración va primero, a mano, en las 5 bases.
- El cobro hay que probarlo con un pago real de monto bajo antes de encender.
