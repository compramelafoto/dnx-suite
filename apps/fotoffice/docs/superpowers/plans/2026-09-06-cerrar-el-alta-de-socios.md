# Cerrar el alta de socios — Plan de implementación

El circuito hoy termina a la mitad: la solicitud se recibe, la Secretaría aprueba y el socio
queda creado con sus cuotas. Ahí se corta. Nadie le avisa nada a nadie, el aprobado no tiene
cómo entrar a pagar, y los estados `COMPLETADA` y `VENCIDA` existen en el enum sin que ningún
código los escriba: los 30 días de `expiresAt` son decorativos.

Este plan cierra el ciclo entero: **avisar, dar acceso, cobrar, cerrar y vencer.**

## Global Constraints

- **No se toca el `schema.prisma`.** Un campo nuevo hay que aplicarlo a mano en las cinco bases
  Neon que comparten el schema. Todo lo que sigue se resuelve con las columnas que ya existen:
  `MembershipApplication.status`, `expiresAt`, `memberId`; `MemberAudit` con `source = SYSTEM`,
  que el schema ya reservó para "una baja por falta de pago"; y `SentEmailLog`, cuyo `userId`
  es opcional y por lo tanto admite a un aspirante que todavía no tiene cuenta.
- **Los emails se arman en funciones puras** y se envían por `sendTransactionalEmail`, igual
  que la invitación y el aviso de carnet. Nada de plantillas nuevas ni de un segundo transporte.
- **Ningún aviso puede deshacer un hecho.** Aprobar, acreditar un pago y vencer una solicitud
  ocurren en su transacción; el email sale después y su fracaso se registra, no se propaga.
- **Nada de invitaciones al padrón migrado.** Todo lo de acá dispara sobre solicitudes nuevas,
  una por una. Los 135 socios existentes no reciben nada.

## Tareas

### 1. Cuándo hay que recordar y cuándo vencer — `lib/membership/application-lifecycle.ts`

Función pura sobre `expiresAt` y `now`: `VIGENTE`, `RECORDAR` (faltan 7 días o menos, en una
ventana de 24 h) o `VENCIDA`. La ventana es lo que evita repetir el recordatorio todos los días
sin necesidad de una columna nueva. Tests de los bordes.

### 2. Los seis emails del circuito — `lib/membership/application-emails.ts`

Puras, sin red ni base: solicitud recibida, aviso a la Secretaría, aprobación (con importe,
plazo y enlace de activación), rechazo (con el motivo), recordatorio, vencimiento y bienvenida
al quedar paga. Se escapa el HTML, el texto plano se arma aparte y la firma institucional entra
una sola vez.

### 3. Registro de los envíos — `lib/communications/email-log.ts`

`recordEmailAttempt`, hermano del que ya registra los de prueba, sin `userId`: el aspirante no
tiene cuenta. Sirve para responder "¿le avisamos o no?" sin adivinar.

### 4. Invitar sin pasar por la pantalla — `lib/members/invite-member.ts`

Se extrae el núcleo de `inviteOneMember` a un módulo `server-only` con el cuerpo del email
parametrizable. La aprobación lo reutiliza para que el socio nuevo reciba **un solo email**:
el que le dice que fue aceptado y le da el enlace para activar su cuenta y pagar.

### 5. Los tres avisos de la resolución — `app/actions/membership-applications.ts`

Enviar el acuse al aspirante y el aviso a la Secretaría al recibir la solicitud; invitar y
avisar al aprobar; comunicar el motivo al rechazar.

### 6. Pagó: se cierra el ingreso — `lib/membership/complete-application.ts`

Al acreditarse un pago, si los cargos de ingreso quedaron saldados: la solicitud pasa a
`COMPLETADA`, se emite el carnet digital y sale el email de bienvenida. Se engancha donde ya se
liberan las tarjetas impresas: `credit-payment.ts` y `manual-payment.ts`.

### 7. No pagó: vence — `lib/membership/expire-applications.ts` + `app/api/cron/solicitudes`

Recordatorio a los 7 días del plazo y vencimiento al cumplirse: `VENCIDA`, baja del socio con
`source = SYSTEM` y motivo, revocación de la invitación pendiente y aviso a la persona.

### 8. El carnet, avisado de punta a punta — `lib/carnet/notify.ts`

El aviso al socio se extrae a un módulo y se usa también desde `releasePaidPrintOrders`, que
hasta ahora movía la tarjeta a la cola sin decir nada. Se suma `EN_COLA` a los estados que se
avisan: confirma que el pago llegó, que es lo que el socio está esperando saber.

---

## Estado: ejecutado el 6/9/2026

Las ocho tareas están implementadas y probadas. Dos cosas que aparecieron al hacerlo y no
estaban en el plan:

- **El cruce de la credencial pagada.** Quien subía su foto ANTES de pagar no disparaba nada
  —el cargo todavía tenía saldo— y al pagar tampoco había ninguna tarjeta pendiente que
  liberar: la credencial pagada no se emitía nunca. El cierre del ingreso ahora pasa por
  `issuePrepaidPrintedCard`, así que los dos órdenes posibles terminan igual.
- **Un tercer canal en la respuesta de la pantalla** (`warn`). Aprobar y no poder avisar no es
  ni un éxito ni un fracaso: pintarlo de verde escondería que el socio quedó sin acceso, y de
  rojo haría pensar que la aprobación no se hizo.

Lo que **no** se tocó, y por qué: el carnet digital de los socios que ya están en el padrón
sigue emitiéndose por tanda manual desde la pantalla de carnets. La emisión automática que se
agregó dispara al cerrarse un ingreso, así que alcanza solo a las altas nuevas. Cambiar eso
para los 135 socios existentes es una decisión aparte, y hoy hay una razón para no tomarla: el
padrón todavía se está revisando.
