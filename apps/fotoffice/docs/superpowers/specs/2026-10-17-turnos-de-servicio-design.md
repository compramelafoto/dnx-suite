# Turnos de servicio — diseño

Fecha: 17/10/2026 · Estado: aprobado en conversación, pendiente de revisión escrita.

## 1. Qué buscamos

Que el dueño de un negocio de fotografía (independiente, estudio o local) publique una
página donde sus clientes **reserven solos** un turno para un servicio: entrevista
presencial u online, mentoría 1 a 1, sesión en estudio o en exteriores, o lo que el
fotógrafo defina. Los horarios ofrecidos son sólo los que de verdad tiene libres
(según su Google Calendar y la ocupación del estudio), y el turno queda en la Agenda
de FOTOFFICE y en Google Calendar.

Referencia: la página actual de Alboom `dnxfotografia.com.ar/agenda`, con 4 tipos de
turno, cada uno con su texto y un botón «Programar una cita», y aviso de cancelar con
48 h de anticipación.

**Éxito:** un cliente nuevo reserva una entrevista online sin intervención del
fotógrafo y recibe el enlace de Meet; otro reserva una sesión en estudio, paga la seña
por Mercado Pago, y al fotógrafo le aparecen en la Agenda y en Google la cita, el
pedido con la seña cobrada y el estudio bloqueado, sin choques con nada.

### Decisiones tomadas

| Tema | Decisión |
|---|---|
| Cobro | Por tipo de turno: sin cobro, seña (monto o %) o total, por Mercado Pago. |
| Asociación | Etapa 1: el turno **vende** uno o varios productos del catálogo y crea un pedido. Etapa 2 (fuera de este diseño): turnos dentro de una contratación ya existente. |
| Quién atiende | Una sola persona (el dueño), con su Google Calendar. El modelo admite sumar más personas más adelante. |
| Estudio | Un tipo de turno puede **usar un espacio** de Reservas: se exige que esté libre y se lo ocupa. |
| Confirmación | Por tipo: se confirma solo (opción inicial) o lo aprueba el fotógrafo. Si lleva cobro y aprobación, se cobra después de aprobar. |
| Cancelar / reprogramar | El cliente puede hacerlo solo por enlace hasta N horas antes (48 de entrada). La seña nunca se devuelve sola. |
| Arquitectura | Extensión de la **Agenda** (camino 1). No se reutiliza el modo «Turnos con profesionales» de Reservas. |

## 2. Lo que ya existe y se reutiliza (origin/main)

- **Agenda:** `FotofficeCitaTipo`, `FotofficeCita` (con `clientId`, `pedidoId`,
  `consultaLeadId`, `googleEventId`), `FotofficeAgendaAjustes` (calendario de Google
  del negocio y recordatorios). Sincronización en los dos sentidos en
  `lib/agenda/google/{empuje,traida,sincronizar}.ts`; recordatorios en
  `api/cron/agenda-recordatorios`.
- **Reservas:** el cálculo de disponibilidad, puro, en `lib/bookings/availability.ts`
  (`computeAvailability`, `checkRange`), los conflictos entre espacios
  (`conflicts.ts`), el cobro con Checkout Pro y la cuenta MP del negocio
  (`lib/bookings/checkout.ts`, `resolveWorkspaceCollector`) y el webhook propio.
- **Google:** integración `google-calendar` (`lib/integrations/registry.ts`) con los
  permisos `calendar.events` y `calendar.readonly`, que alcanzan para consultar
  disponibilidad (freeBusy) y crear eventos con Meet.
- **Ventas:** `Product` del catálogo, `FotofficePedido` con cuotas
  (`FotofficePedidoCuota`) y cobros (`FotofficeCobro`).
- **CRM:** `ServiceSalesLead` y `FotofficeConsulta`.
- **Correo:** `lib/plantillas/envio.ts` (`enviarCorreo`) sobre Resend.
- **Módulos:** `lib/modules/registry.ts`, `dependencies.ts`, `suggested.ts`.

## 3. Experiencia del cliente

**Página pública** `app/w/[workspaceSlug]/turnos`, que también puede sumarse al menú
del sitio público:

- Título y texto introductorio del fotógrafo.
- Una tarjeta por tipo publicado, con nombre, foto opcional, descripción, duración,
  modalidad (presencial con dirección, u online por Meet) y precio o seña.
- Botón «Elegir día y hora».

**Flujo de reserva** `turnos/[tipoId]`:

1. **Calendario** con los días que tienen lugar; al elegir un día, sus horarios
   libres. Todo en hora de Argentina.
2. **Datos:** nombre, correo y teléfono obligatorios, más las preguntas propias del
   tipo. No hace falta cuenta.
3. **Resultado:**
   - sin cobro y confirmación sola: confirmado;
   - con cobro y confirmación sola: se guarda el horario mientras paga, va a Mercado
     Pago y se confirma al acreditarse;
   - con aprobación: «Recibimos tu pedido». Si lleva cobro, el enlace de pago llega
     cuando el fotógrafo aprueba.

**Correos al cliente:** confirmación (fecha, hora, lugar o Meet, botón «Agregar a mi
calendario» con un archivo `.ics`, y enlaces para reprogramar y cancelar), solicitud
recibida, aprobado con enlace de pago, rechazado, reprogramado, cancelado y
recordatorio.

**Gestión por enlace** `turnos/gestion/[token]`: el cliente ve su turno y puede
reprogramarlo (elige otro horario libre del mismo tipo) o cancelarlo hasta el plazo.
Pasado el plazo se le muestra un mensaje para que escriba al fotógrafo.

## 4. Experiencia del fotógrafo

**Configuración** (Agenda → Turnos, `app/workspace/configuracion/turnos`):

- **Ajustes generales:** texto de la página, plazo para cancelar o reprogramar (48 h),
  margen entre turnos, anticipación mínima (24 h) y máxima (60 días), y minutos que
  se guarda un horario mientras se paga (15).
- **Por tipo de cita**, con el interruptor «Publicar»:
  - descripción y foto, duración;
  - franjas semanales en que se ofrece;
  - modalidad (ONLINE, ESTUDIO o DIRECCIÓN);
  - espacio de Reservas que usa (opcional);
  - productos asociados (uno o varios, con cantidad);
  - cobro (NINGUNO, SEÑA_MONTO, SEÑA_PORCENTAJE o TOTAL);
  - confirmación (AUTOMÁTICA o APROBACIÓN);
  - preguntas adicionales;
  - si abre una consulta en el CRM.

**Día a día:**

- Los turnos son citas de la Agenda con el distintivo «reservado por el cliente», y
  se sincronizan con Google como cualquier cita.
- **Bandeja de solicitudes** (`app/(shell)/agenda/turnos`) con los turnos por aprobar
  (Aprobar o Rechazar con motivo), los próximos turnos y los cancelados que tienen la
  seña cobrada («resolver»).
- Al fotógrafo le llega un correo en cada reserva, cancelación o reprogramación.
- La ficha del turno muestra los datos del cliente, sus respuestas, el pago, el
  pedido, la consulta y la reserva del estudio.

**Módulo:** clave nueva `appointments` (nombre visible «Turnos»), que depende de `agenda`, de `orders` (pedidos) cuando se usan
productos y de la integración `google-calendar`. Se sugiere para los tipos freelance,
estudio y local, y no para asociaciones.

## 5. Modelo de datos

Todo lleva `workspaceId` y se borra en cascada con el negocio. La migración se aplica a
mano y se registra con `resolve`, como el resto de FOTOFFICE.

- **`FotofficeTurnosAjustes`** (uno por negocio): `pageTitle`, `pageIntro`,
  `cancelWindowHours` (48), `bufferMinutes` (0), `minAdvanceHours` (24),
  `maxAdvanceDays` (60), `holdMinutes` (15), `notifyEmail` (opcional; si falta, el
  correo del dueño).
- **`FotofficeCitaTipo`**, columnas nuevas, todas opcionales o con valor por defecto
  para no romper los tipos actuales:
  - `isBookable` (false), `publicDescription`, `imageUrl`;
  - `durationMinutes`, `modality` (ONLINE | ESTUDIO | DIRECCION), `address`;
  - `bookingSpaceId` → `BookingSpace`;
  - `chargeMode` (NINGUNO | SENA_MONTO | SENA_PORCENTAJE | TOTAL), `chargeValue`;
  - `confirmationMode` (AUTOMATICA | APROBACION), `opensConsulta` (false);
  - `questions` (JSON: lista de `{id, label, kind: texto|fecha|opcion, required, options?}`).
- **`FotofficeCitaTipoFranja`**: `typeId`, `weekday`, `startMinute`, `endMinute`. Es el
  mismo formato que `BookingSpaceHours`, para entregárselo tal cual al cálculo.
- **`FotofficeCitaTipoProducto`**: `typeId`, `productId`, `quantity`, `order`.
- **`FotofficeTurno`** (la reserva del cliente):
  - `typeId`, `startAt`, `endAt`, `hostUserId` (el dueño; deja preparado el caso de
    varias personas);
  - `status`: RETENIDO | PENDIENTE_APROBACION | PENDIENTE_PAGO | CONFIRMADO |
    CANCELADO | RECHAZADO | VENCIDO, y `holdExpiresAt`;
  - `contactName`, `contactEmail`, `contactPhone`, `answers` (JSON);
  - copia de lo cobrado: `chargeModeSnapshot`, `chargeArs`, `totalArs` y `itemsSnapshot`
    (JSON con los productos y precios al momento de reservar);
  - `paymentStatus`, `mpPreferenceId`, `mpPaymentId`;
  - `manageTokenHash` (único: SHA-256 del enlace de gestión);
  - vínculos: `citaId` (único), `pedidoId`, `clientId`, `consultaLeadId`, `bookingId`
    (único);
  - `cancelledAt`, `cancelledBy` (CLIENTE | FOTOGRAFO), `cancelledInWindow`,
    `refundResolution` (PENDIENTE | DEVUELTA | RETENIDA, sólo si había cobro),
    `rejectReason`;
  - índices por `[workspaceId, status]`, `[workspaceId, startAt]` y `[holdExpiresAt]`.
- **`Booking`**: columna nueva `turnoId` (opcional, única), para saber que esa reserva
  del estudio la creó un turno y no ofrecerla como alquiler cancelable.

## 6. Cómo funciona por dentro

Código nuevo en `lib/turnos/`, en unidades chicas y probables por separado:

- **`disponibilidad.ts`** (puro): recibe las franjas del tipo, la duración, los
  ajustes, la hora actual y una lista `ocupado` ya armada, y devuelve los horarios
  libres, delegando en `computeAvailability`. No toca la base ni Google.
- **`ocupacion.ts`**: arma la lista `ocupado` uniendo cuatro fuentes:
  1. las citas de la Agenda del dueño que no están anuladas;
  2. los `FotofficeTurno` en RETENIDO no vencido, PENDIENTE_APROBACION o
     PENDIENTE_PAGO;
  3. **Google freeBusy** de los calendarios del dueño (el principal y el de FOTOFFICE),
     con un caché corto por negocio para no consultar a Google en cada clic;
  4. si el tipo usa un espacio, su ocupación según Reservas (reservas propias, de
     espacios incompatibles y bloqueos de Google del espacio).
  Si Google no responde o la integración no está ACTIVE, devuelve «sin
  disponibilidad» con el motivo: nunca ofrece horarios a ciegas.
- **`precio.ts`** (puro): a partir de los productos y el modo de cobro calcula el
  total y lo que se cobra ahora, redondeando a pesos.
- **`reservar.ts`**: crea el turno. Dentro de una transacción, con un bloqueo por
  negocio (`pg_advisory_xact_lock`), vuelve a verificar el horario con `checkRange` y
  lo inserta. Si el horario se ocupó, devuelve «ese horario se acaba de ocupar».
- **`ciclo.ts`**: las transiciones de estado (aprobar, rechazar, pagar, confirmar,
  cancelar, reprogramar, vencer), cada una con su chequeo de estado de origen.
- **`confirmar.ts`**: al pasar a CONFIRMADO, en una transacción:
  1. busca o crea el `Client` por correo;
  2. si `opensConsulta`, crea el `ServiceSalesLead` y la `FotofficeConsulta`;
  3. si hay productos, crea el `FotofficePedido` con los ítems copiados. Con seña se
     arman dos cuotas (seña y saldo), sin seña una sola, y lo pagado se registra como
     `FotofficeCobro` en la cuota de la seña;
  4. crea la `FotofficeCita` con su cliente, pedido y consulta;
  5. si usa un espacio, crea un `Booking` CONFIRMED, `SIN_CARGO`, con `turnoId`.

  Después de la transacción, la cita se sube a Google con el empuje existente, que
  se amplía para pedir el Meet (`conferenceData.createRequest`) cuando la modalidad es
  ONLINE. Por último salen los correos.
- **`cobro.ts`**: preferencia de Checkout Pro con la cuenta MP del negocio,
  `external_reference` `turno:<id>`, un vencimiento igual al tiempo de retención y la
  misma comisión de plataforma que Reservas. Webhook propio
  `api/payments/mp/turnos-webhook`, idempotente por `mpPaymentId`.
- **`correos.ts`**: plantillas con `enviarCorreo`, más el archivo `.ics` adjunto.
- **Cron `api/cron/turnos-vencimientos`**: vence los RETENIDO y PENDIENTE_PAGO cuyo
  `holdExpiresAt` ya pasó y libera el horario. Para el PENDIENTE_PAGO que viene de una
  aprobación, la retención es de 48 h, porque el cliente paga desde el correo.
- **Recordatorios:** se reutiliza `agenda-recordatorios`, porque el turno confirmado
  ya es una cita.

**Reprogramar:** verifica el nuevo horario con el mismo bloqueo y, en una
transacción, mueve el turno, la cita y el `Booking`; luego empuja la cita a Google. El
pago y el pedido no se tocan.

**Cancelar:** el turno pasa a CANCELADO, la cita a ANULADA y se cancela el `Booking`.
Si había cobro, `refundResolution = PENDIENTE` y aparece en la bandeja. El pedido no
se borra: queda para que el fotógrafo decida, igual que la seña.

**Si el fotógrafo borra o mueve el evento en Google:** la sincronización de la Agenda
ya trae ese cambio a la cita. Si la cita queda anulada, el turno se marca CANCELADO por
el FOTOGRAFO y se avisa al cliente.

## 7. Casos límite

| Caso | Comportamiento |
|---|---|
| Dos clientes eligen el mismo horario a la vez | Bloqueo por negocio y nueva verificación: el segundo recibe «se acaba de ocupar». |
| No paga dentro del tiempo de retención | VENCIDO por el cron; el horario se libera. |
| El pago llega después de vencido | Si el horario sigue libre, se confirma igual; si no, queda PENDIENTE para devolver y se avisa a los dos. |
| Google desconectado o caído | La página muestra «no hay turnos disponibles por el momento» y el fotógrafo recibe un aviso. |
| Sin Mercado Pago conectado | No se puede publicar un tipo que cobra (validado al guardar y al reservar). |
| Producto del catálogo borrado o archivado | El tipo sigue con los demás; si no queda ninguno y cobra, se despublica con aviso. |
| Espacio de Reservas cerrado ese día | Lo resuelven los cierres del espacio dentro de la ocupación. |
| Cambio de horario de verano | No aplica: Argentina no lo usa; todo se calcula con `America/Argentina/Buenos_Aires`. |
| Abuso (reservas falsas en masa) | Límite por correo y por IP (máx. 3 turnos activos por correo), y el horario retenido vence. |

## 8. Pruebas

- Unitarias de `disponibilidad.ts` (cada fuente de ocupación, margen, anticipación,
  franjas y bordes de día) y de `precio.ts` (cada modo de cobro y redondeo).
- `ciclo.ts`: todas las transiciones válidas y el rechazo de las inválidas.
- Reserva simultánea: dos llamadas en paralelo sobre la base en memoria de circuitos
  (`lib/circuitos/base-en-memoria.ts`); sólo una se crea.
- Webhook idempotente: la misma notificación dos veces genera un solo cobro.
- Prueba completa en local con `next dev --webpack`: reservar una entrevista online
  (Meet creado), una sesión en estudio con seña (MP de prueba), aprobar una solicitud,
  reprogramar y cancelar desde el enlace, y verificar la Agenda, Google, el pedido y
  Reservas.

## 9. Fuera de alcance

- Turnos dentro de una contratación o un contrato existente (etapa 2: enlace privado
  desde el pedido, sin cobro, unido a `FotofficeProductoCita`).
- Varias personas que atienden, cada una con su Google Calendar.
- Devolución automática de señas.
- Pago por transferencia en los turnos (sólo Mercado Pago en esta etapa).
