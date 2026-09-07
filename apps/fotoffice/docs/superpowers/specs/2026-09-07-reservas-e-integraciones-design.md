# Reservas de espacios e Integraciones con Google

**Fecha:** 2026-09-07 · **Aplicación:** FOTOFFICE · **Estado:** aprobado para implementar

## El problema

La SFPR tiene tres espacios que puede alquilar —coworking, salón de eventos y estudio de
fotografía— y hoy no hay ninguna forma de reservarlos ni de cobrarlos. La agenda real vive en
el Google Calendar de la institución, donde la Comisión anota a mano.

Al mismo tiempo aparece una necesidad más general: el dueño de un workspace tiene que poder
vincular sus cuentas de Google —Calendar hoy, Classroom y Drive mañana— desde un solo lugar,
sin que cada módulo invente su propia pantalla de conexión.

Son **dos módulos**, no uno. Integraciones es la base y no depende de Reservas.

---

## Parte 0 · Lo que ya existe y no se rehace

| Pieza | Dónde vive | Qué aporta |
|---|---|---|
| Clave `bookings` reservada | `lib/modules/registry.ts` (status `PLANNED`) | El módulo ya tiene lugar en el catálogo |
| Comisión del 5% por módulo | `WorkspaceModuleFee` + `lib/platform-fee/fee.ts` | El fee es configurable por workspace y módulo, con default 500 bps |
| Libro de deuda del fee | `WorkspaceFeeLedgerEntry` + `lib/platform-fee/ledger.ts` | Lo cobrado fuera de Mercado Pago se devenga y se descuenta después |
| Checkout Pro con `marketplace_fee` | 10 archivos de cobro ya en producción | Modelo marketplace clásico, no Orders API |
| Cifrado AES-256-GCM de tokens | `packages/social-publisher/src/vault.ts` | El patrón exacto para guardar el token de Google |
| Mapa del menú | `docs/fotoffice/ARQUITECTURA-NAVEGACION.md` §4.6 y §5 | Rutas, roles e íconos ya decididos |

**Split (1 a N) sigue desactivado.** Reservas cobra con Checkout Pro contra la cuenta conectada
de la institución, igual que las cuotas. No toca `FOTOFFICE_SPLIT_1N_ENABLED`.

---

## Parte 1 · Módulo de Integraciones

### Enmienda al documento de navegación

`ARQUITECTURA-NAVEGACION.md` §4.6 dice hoy: *«La conexión con el Google Calendar de la
institución es un ajuste dentro de "Tarifas y reglas", no un ítem propio»*. Y §4.1 ubica la
sincronización con Google Contacts como *«ajuste dentro de Datos de la institución»*.

**Las dos decisiones se reemplazan por una sola pantalla de Integraciones.** La razón es que
las cuentas de Google no pertenecen a ningún módulo: el mismo permiso de una cuenta sirve a
Calendar (Reservas), Classroom (Cursos), Contacts (Socios) y Drive. Repartir la conexión entre
las pantallas de cada módulo obliga a conectar la misma cuenta tres veces y deja al dueño sin
un lugar donde ver qué le dio a la plataforma.

Ubicación, respetando **P9** (lo que es de la institución entera tiene su propia sección):

| Sección | Orden | Etiqueta | Ruta | Ícono | Rol |
|---|---:|---|---|---|---|
| §4.10 INSTITUCIÓN | 25 | Integraciones | `/workspace/configuracion/integraciones` | `Plug` | ADMIN+ |

"Tarifas y reglas" de Reservas muestra el estado de Calendar (*conectado / no conectado*) con
un enlace que lleva ahí. Informa, no conecta. **Hay que actualizar el documento** como parte de
esta implementación: §4.6, §4.1 y la tabla de §4.10.

### El login con Google no sirve para esto

FOTOFFICE ya tiene "Ingresar con Google" (`app/api/auth/google/`). Ese flujo **solo verifica
identidad**: pide permisos básicos y no pide acceso sin conexión, así que Google no entrega un
permiso duradero para escribir en un calendario.

Integraciones es un **segundo flujo de OAuth, separado**, con `access_type=offline` y
`prompt=consent`, que sí obtiene el permiso renovable. Comparten las credenciales de la
aplicación de Google (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`) y nada más. Un usuario puede
haber entrado con Google y no tener ninguna integración conectada; son cosas distintas.

Las dos URLs de retorno tienen que estar declaradas en la consola de Google Cloud.

### Catálogo de integraciones

`lib/integrations/registry.ts`, con la misma forma que el catálogo de módulos: describe qué
integraciones **existen**, no cuáles están conectadas.

```ts
type IntegrationDefinition = {
  key: string;              // "google-calendar"
  provider: "GOOGLE";
  label: string;            // "Google Calendar"
  description: string;      // qué habilita, en una línea
  scopes: readonly string[];
  requiredByModules: readonly string[]; // ["bookings"]
  status: "AVAILABLE" | "PLANNED";
};
```

Entradas iniciales:

| key | scopes | Requerida por | Status |
|---|---|---|---|
| `google-calendar` | `calendar.events`, `calendar.readonly` | `bookings` | AVAILABLE |
| `google-classroom` | `classroom.courses`, `classroom.rosters` | `courses-sales` | PLANNED |
| `google-drive` | `drive.file` | — | PLANNED |
| `google-contacts` | `contacts` | `members` | PLANNED |

Solo `google-calendar` se implementa de punta a punta. Las otras tres aparecen en el catálogo
pero **no se ofrecen como botón**, con el mismo criterio que los módulos `PLANNED`: nada que no
funcione se le ofrece al usuario.

### Modelo de datos

```prisma
/// Cuenta de un tercero vinculada a un workspace (Google hoy).
/// El refresh token va cifrado con AES-256-GCM. Nunca en claro, nunca en logs.
model WorkspaceIntegration {
  id                String    @id @default(cuid())
  workspaceId       String
  /// "GOOGLE". Texto y no enum: agregar un proveedor no debe migrar un tipo.
  provider          String
  /// Cuenta concreta: el email de Google. Sirve para que el dueño reconozca cuál conectó.
  accountEmail      String
  accountExternalId String?
  /// Scopes efectivamente otorgados por Google, no los pedidos. Google puede dar menos.
  grantedScopes     String[]
  /// Refresh token cifrado. Las tres columnas son inseparables.
  ciphertext        String
  nonce             String
  authTag           String
  keyVersion        String
  status            String    @default("ACTIVE") // ACTIVE | REVOKED | NEEDS_RECONSENT
  connectedByUserId Int?
  connectedAt       DateTime  @default(now())
  lastUsedAt        DateTime?
  revokedAt         DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  workspace         Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@unique([workspaceId, provider, accountEmail])
  @@index([workspaceId, status])
}

/// Estado anti-CSRF del ida y vuelta con Google. Se borra al usarse.
model WorkspaceIntegrationOAuthState {
  id          String   @id @default(cuid())
  state       String   @unique
  workspaceId String
  integrationKey String
  userId      Int
  redirectPath String?
  createdAt   DateTime @default(now())
  expiresAt   DateTime

  @@index([expiresAt])
  @@index([workspaceId])
}
```

### Cómo se guarda el token

- Clave maestra propia: `DNX_INTEGRATIONS_VAULT_MASTER_KEY` (32 bytes en base64). **No** se
  reutiliza la de social ni la de pagos: una clave por dominio, para que rotar una no obligue a
  rotar las otras.
- **Sin clave configurada no se guarda nada.** Se corta con un error claro que nombra la
  variable faltante, nunca su valor, y jamás se cae a texto plano como alternativa.
- El código de cifrado se copia del patrón de `vault.ts` a `lib/integrations/vault.ts`. No se
  importa `@repo/social-publisher`: son dominios distintos que no deben quedar atados.
- Ningún camino del módulo escribe el token, el `code` de OAuth ni el `state` en los registros.
  Los errores se sanitizan con `sanitizeError` de `lib/payments/connect/log.ts`.

### Renovación

El *refresh token* de Google no vence; el *access token* dura una hora. Se pide uno nuevo **en
el momento de usarlo**, con un margen de 5 minutos, y no se persiste. **No hace falta ningún
proceso programado.**

Si Google responde `invalid_grant` (el dueño revocó el permiso desde su cuenta), la integración
pasa a `NEEDS_RECONSENT`, la pantalla lo muestra en rojo y Reservas sigue funcionando sin
espejo en el calendario. Un permiso caído nunca puede impedir una reserva.

### La pantalla

`/workspace/configuracion/integraciones` — una tarjeta por integración `AVAILABLE`:

- **Conectada:** cuenta de Google, fecha de conexión, qué módulos la usan, botón *Desconectar*
  (pide confirmación y explica qué deja de funcionar).
- **Sin conectar:** qué habilita, qué permisos pide en castellano llano, botón *Conectar*.
- **Necesita reconexión:** aviso rojo y botón *Volver a conectar*.

Desconectar borra la fila y revoca el permiso contra Google. Las reservas ya creadas **no se
tocan**: pierden el espejo en el calendario, nada más.

---

## Parte 2 · Módulo de Reservas

### Alcance

Los tres espacios de la SFPR —coworking, salón, estudio— no son categorías del sistema: son
**tres filas** de una tabla de espacios que el dueño da de alta, con sus horarios, sus precios y
sus reglas. Agregar el laboratorio o el estudio de streaming (previstos en `CONTEXTO-SFPR.md`
21 y 22) no requiere código.

### Rutas y menú — ya definidos en §4.6

| Orden | Etiqueta | Ruta | Ícono | Rol |
|---:|---|---|---|---|
| 10 | Agenda | `/reservas` | `CalendarDays` | STAFF+ |
| 20 | Espacios | `/reservas/espacios` | `DoorOpen` | ADMIN+ |
| 30 | Tarifas y reglas | `/reservas/configuracion` | `Settings` | ADMIN+ |

Portal del socio: `/portal/reservas`, orden 60, ya declarado en `lib/portal/menu.ts` como
"Próximamente" — pasa a `built: true`.

Público (no socios): `/w/[slug]/reservas`, dentro del sitio público de la institución.

El menú de S1 está escrito a mano en `components/shell/shell-nav.tsx`: hay que agregar la
sección ahí. Registrar el módulo en `lib/modules/registry.ts` con `route` lo hace aparecer
además en S2 (panel de negocio), que es lo correcto: un fotógrafo con estudio propio también
alquila horas.

### Modelo de datos

```prisma
model BookingSpace {
  id          String   @id @default(cuid())
  workspaceId String
  name        String            // "Estudio de fotografía"
  slug        String            // "estudio"
  description String?
  imageUrl    String?
  active      Boolean  @default(true)
  order       Int      @default(0)

  /// Reglas de agenda
  slotMinutes        Int @default(60)  // grilla: 60 = por hora, 30 = media hora
  minBookingMinutes  Int @default(60)
  maxBookingMinutes  Int?              // null = sin tope
  bufferMinutes      Int @default(0)   // limpieza entre reservas
  minAdvanceHours    Int @default(2)
  maxAdvanceDays     Int @default(90)
  requiresApproval   Boolean @default(false)

  /// Tarifas — en pesos por hora. El precio de socio ES el precio promocional.
  memberHourlyPriceArs    Decimal @db.Decimal(12, 2)
  nonMemberHourlyPriceArs Decimal @db.Decimal(12, 2)
  /// Horas bonificadas por mes para socios. 0 = el espacio no bonifica.
  memberFreeHoursPerMonth Int @default(0)
  /// Si el espacio acepta reservas de no socios.
  allowsNonMembers        Boolean @default(true)

  /// Espejo en Google Calendar. Un calendario por espacio (ver más abajo).
  googleCalendarId String?
  calendarSyncToken String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([workspaceId, slug])
  @@index([workspaceId, active])
}

/// Horario semanal: "lunes de 9 a 13" es una fila. Varios tramos por día.
model BookingSpaceHours {
  id          String @id @default(cuid())
  spaceId     String
  weekday     Int    // 0 domingo … 6 sábado
  startMinute Int    // minutos desde medianoche: 540 = 9:00
  endMinute   Int    // 780 = 13:00. Siempre > startMinute.

  @@index([spaceId, weekday])
}

/// Feriados, vacaciones, mantenimiento. spaceId null = toda la institución.
model BookingClosure {
  id          String   @id @default(cuid())
  workspaceId String
  spaceId     String?
  startAt     DateTime
  endAt       DateTime
  reason      String

  @@index([workspaceId, startAt])
}

/// Par de espacios que SÍ pueden estar ocupados a la vez. Todo par ausente de esta
/// tabla es incompatible: el defecto es bloquear. Ver "la regla de exclusividad".
/// Se guarda una sola fila por par, siempre con spaceAId < spaceBId.
model BookingSpaceCompatibility {
  id       String @id @default(cuid())
  spaceAId String
  spaceBId String

  @@unique([spaceAId, spaceBId])
}

model Booking {
  id          String   @id @default(cuid())
  workspaceId String
  spaceId     String
  startAt     DateTime
  endAt       DateTime

  /// HOLD | PENDING_APPROVAL | CONFIRMED | CANCELLED | EXPIRED
  status      String
  /// Vencimiento del bloqueo mientras no está pago. Null si ya está confirmada.
  holdExpiresAt DateTime?

  /// Quién reserva. memberId para socios; userId para cualquiera con cuenta.
  memberId    String?
  userId      Int?
  contactName  String
  contactEmail String
  contactPhone String?
  /// MEMBER | NON_MEMBER — congelado al reservar: si después se asocia, esta reserva no cambia.
  customerType String

  /// Dinero, todo congelado en el momento de reservar.
  billedMinutes    Int      // minutos cobrados (total menos los bonificados)
  freeMinutesUsed  Int      @default(0)
  hourlyPriceArs   Decimal  @db.Decimal(12, 2)
  totalArs         Decimal  @db.Decimal(12, 2)
  feeBps           Int
  feeArs           Decimal  @db.Decimal(12, 2)

  /// MERCADO_PAGO | TRANSFERENCIA | SIN_CARGO
  paymentMethod  String
  /// PENDING | PAID | NOT_REQUIRED
  paymentStatus  String
  mpPreferenceId String?
  mpPaymentId    String?
  paidAt         DateTime?
  /// Quién confirmó una transferencia, para poder explicarlo meses después.
  confirmedByUserId Int?

  googleEventId String?
  notes         String?
  cancelledAt   DateTime?
  cancelledByUserId Int?
  cancelReason  String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([workspaceId, startAt])
  @@index([spaceId, startAt])
  @@index([memberId, startAt])
  @@index([status, holdExpiresAt])
}

/// Evento traído de Google que ocupa un espacio. No lo creó FOTOFFICE.
model BookingCalendarBlock {
  id            String   @id @default(cuid())
  spaceId       String
  googleEventId String
  startAt       DateTime
  endAt         DateTime
  summary       String?
  syncedAt      DateTime @default(now())

  @@unique([spaceId, googleEventId])
  @@index([spaceId, startAt])
}
```

**Nota de despliegue.** `packages/db/prisma/schema.prisma` es compartido por las cinco bases
Neon de la suite y ningún build corre `prisma migrate deploy`. Estas son **seis tablas nuevas**,
puramente aditivas: no tocan ninguna columna existente, así que no pueden romper las escrituras
de las otras aplicaciones. Hay que aplicarlas a mano en la base de FOTOFFICE, y dejar registrado
en `ESTADO-ACTUAL.md` que las otras bases quedan sin ellas hasta que las necesiten.

### La regla de exclusividad

**Por defecto un espacio bloquea a todos los demás.** El dueño marca explícitamente con cuáles
*sí* puede convivir, y eso es lo único que se guarda: `BookingSpaceCompatibility` tiene una fila
por cada par que puede coexistir. Lo que no está en la tabla es incompatible. No se guarda nada
derivado — un espacio nuevo nace bloqueando a todos sin que haya que recalcular nada.

Se elige el valor por defecto que falla cerrado: un espacio nuevo mal configurado va a producir
"no hay horarios disponibles", que se nota y se corrige en dos minutos. El defecto contrario
produce dos alquileres del mismo salón a la misma hora, que se nota cuando llegan las dos
personas.

Para la SFPR queda: salón incompatible con estudio y con coworking; estudio y coworking
compatibles entre sí.

### Espacios que requieren aprobación

`requiresApproval` existe para el salón de eventos: hay alquileres que la Comisión quiere mirar
antes de aceptar. Cuando está activo, la reserva nace en `PENDING_APPROVAL` **sin cobrar nada**
y ocupa el horario mientras se decide.

- El equipo aprueba desde la Agenda. Recién ahí se le manda al solicitante el enlace de pago, y
  la reserva pasa a `HOLD` con su vencimiento.
- Si el equipo rechaza, pasa a `CANCELLED` con el motivo y se libera el horario.
- Si nadie decide antes del vencimiento de aprobación (el mismo plazo configurable que el
  bloqueo por pago), vence sola. Un pedido olvidado no puede tener un horario tomado para
  siempre.

Para la SFPR arranca activo en el salón y apagado en el estudio y el coworking.

### Precios y horas bonificadas

Tres reglas, ninguna en el checkout:

1. **Precio por hora congelado.** Se copia a la reserva al crearla. Un aumento de tarifa no
   cambia lo ya reservado.
2. **Socio paga el precio de socio.** Es el mismo mecanismo para el descuento del estudio y para
   el "precio promocional" del salón: una sola columna, dos usos.
3. **Horas bonificadas por espacio y por mes.** El estudio da 2 horas; el coworking y el salón,
   0. Todo configurable por el dueño desde "Tarifas y reglas".

**No se acumulan, y no hace falta ninguna tabla para lograrlo:** las horas usadas se calculan
sumando `freeMinutesUsed` de las reservas del socio en ese espacio dentro del mes calendario
(estados `HOLD` y `CONFIRMED`). El 1° el contador arranca de cero solo.

La bonificación se aplica **al principio de la reserva**: 4 horas de estudio con 2 bonificadas
disponibles son 2 horas gratis y 2 al precio de socio. Si la reserva queda enteramente cubierta,
`totalArs` es 0, `paymentMethod` es `SIN_CARGO` y se confirma sin pasar por ningún pago ni
generar comisión.

Una cancelación **devuelve las horas bonificadas a la bolsa del mes** solo si se cancela dentro
del mismo mes calendario en que se usaron. Cancelar el 2 de octubre una reserva de septiembre no
devuelve nada: ese mes ya cerró.

### El motor de disponibilidad

`lib/bookings/availability.ts` — **módulo puro: sin base de datos y sin red.** Recibe todo
resuelto y devuelve los huecos libres:

```ts
computeAvailability(input: {
  space: SpaceRules;
  range: { from: Date; to: Date };
  weeklyHours: SpaceHours[];
  closures: Closure[];
  bookings: BusyInterval[];       // del espacio Y de los incompatibles
  calendarBlocks: BusyInterval[];
  now: Date;
  timeZone: string;
}): Slot[]
```

Es el corazón del módulo y por eso va aislado: el caso difícil —"el salón está tomado el sábado
de 18 a 23, entonces el estudio y el coworking no aparecen disponibles en esa franja"— se prueba
sin levantar nada.

**Zona horaria.** Todo se guarda en UTC y se muestra en `America/Argentina/Buenos_Aires`. Los
horarios semanales, los cierres y el corte del mes calendario se interpretan en esa zona. Es un
parámetro del motor, no una constante escondida: un workspace de otra provincia va a necesitar
la suya.

### Contra la doble reserva

La verdad la tiene la base de FOTOFFICE, no Google.

1. La confirmación corre dentro de una transacción que **vuelve a verificar** el solapamiento
   contra el espacio y contra todos sus incompatibles.
2. Además, una restricción en la propia base hace **imposible** guardar dos reservas activas
   superpuestas del mismo espacio:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Booking" ADD CONSTRAINT booking_no_overlap
  EXCLUDE USING gist (
    "spaceId" WITH =,
    tstzrange("startAt", "endAt", '[)') WITH &&
  ) WHERE (status IN ('HOLD', 'PENDING_APPROVAL', 'CONFIRMED'));
```

Prisma no genera esto: va como migración SQL escrita a mano. Es media hora de trabajo y elimina
de raíz el error más caro del módulo. Dos personas apretando "Reservar" en el mismo segundo:
una entra, la otra ve *"ese horario se acaba de ocupar"*.

La restricción cubre un espacio contra sí mismo. Los conflictos **entre** espacios los resuelve
la transacción, no la base: expresarlos como restricción exigiría una tabla de ocupación
derivada, y no vale la complejidad.

### Google Calendar en las dos direcciones

**Un calendario de Google por espacio.** Es la única forma de que, al leer un evento, se sepa
qué espacio ocupa: si el salón y el estudio comparten calendario, "Reunión 18 a 20" es ambiguo.
La pantalla de Espacios lista los calendarios de la cuenta conectada y el dueño elige uno, o
crea uno nuevo desde ahí.

**De ida.** Al pasar a `CONFIRMED` se crea el evento; al cancelarse, se borra. El evento lleva
`extendedProperties.private.fotofficeBookingId` — así se reconoce lo propio en la vuelta.

**De vuelta.** Sincronización incremental con el `syncToken` de Google, guardado en el espacio:

- Un proceso programado cada 10 minutos (`/api/cron/reservas-calendar-sync`, con el mismo
  `isAuthorizedCronRequest` que usan los crons actuales).
- Y también al abrir la agenda o el calendario del portal, con un tiempo máximo corto: si Google
  tarda, se muestra lo que hay y se sigue.
- Los eventos **sin** `fotofficeBookingId` se guardan como `BookingCalendarBlock` y tapan el
  horario. Los propios se ignoran, para que la sincronización no se muerda la cola.
- Si Google invalida el `syncToken` (error 410), se borra y se recarga la ventana completa
  desde hoy hasta `maxAdvanceDays`.

**Google es un reflejo, no el registro.** Si está caído, desconectado o el permiso fue revocado,
las reservas siguen funcionando: el espejo queda pendiente y se reintenta. Lo que nunca pasa es
que una falla de Google impida reservar o cobrar.

### El cobro

Se engancha con el circuito que ya está en producción; no se inventa nada.

| Medio | Qué pasa con el horario | Qué pasa con el 5% |
|---|---|---|
| **Mercado Pago** | `HOLD` hasta que el webhook acredita; ahí pasa a `CONFIRMED` | Mercado Pago lo retiene en la misma operación (`marketplace_fee`) |
| **Transferencia** | `HOLD` con `holdExpiresAt`; el dueño confirma desde el panel | No pasa por MP: se **devenga** como deuda de la institución (`recordAccrual`) |
| **Sin cargo** (horas bonificadas) | `CONFIRMED` directo | No hay comisión: no entró plata |

- El fee sale de `WorkspaceModuleFee` con `moduleKey: "bookings"`, y sin fila configurada rige
  el 5% por defecto. Se congela en `feeBps` al crear la reserva.
- La comisión se calcula siempre sobre **lo efectivamente cobrado**, nunca sobre el precio de
  lista: dos horas bonificadas y dos pagas generan comisión sobre las dos pagas.
- `external_reference` viaja como `booking:<id>`. El webhook existente
  (`/api/payments/mercadopago/webhook`) aprende a derivar por prefijo: hoy resuelve cuotas e
  inscripciones, mañana también reservas.
- **Vencimiento del bloqueo:** configurable por workspace, 24 horas por defecto, y nunca más
  tarde que el comienzo de la reserva. Un proceso programado
  (`/api/cron/reservas-expirar-holds`, cada 15 minutos) pasa a `EXPIRED` lo vencido y libera el
  horario. Es idempotente: correrlo de más no rompe nada.

### Cancelaciones

- El socio puede cancelar solo hasta **N horas antes** (configurable, 24 por defecto). Después,
  solo la institución.
- Cancelar libera el horario y borra el evento del calendario, siempre.
- Las horas bonificadas vuelven a la bolsa si es el mismo mes calendario (ver arriba).
- **La devolución del dinero no es automática.** Si la reserva estaba paga, la institución
  resuelve la devolución por fuera y la anota en la reserva. Devolver por Mercado Pago desde el
  sistema es un circuito propio, con su propio manejo de errores, y no entra en esta etapa.
  La pantalla se lo dice al socio antes de cancelar, con todas las letras.

### Las pantallas

**Agenda** (`/reservas`, STAFF+) — vista semanal con una columna por espacio. Cada reserva
muestra quién, qué medio de pago y su estado. Las bloqueadas esperando pago se ven distintas de
las confirmadas. Los bloqueos venidos de Google se muestran atenuados y con el nombre del
evento. Filtro por espacio y salto a otra semana. Desde acá el equipo también carga una reserva
a mano (para quien llama por teléfono) y confirma transferencias.

**Espacios** (`/reservas/espacios`, ADMIN+) — alta y edición: nombre, foto, horarios semanales,
grilla, anticipación mínima y máxima, con qué espacios puede convivir, y qué calendario de
Google lo espeja. Un espacio se desactiva, no se borra: borrarlo dejaría reservas huérfanas.

**Tarifas y reglas** (`/reservas/configuracion`, ADMIN+) — precio por hora de socio y de no
socio por espacio, horas bonificadas por mes, vencimiento del bloqueo por transferencia, plazo
de cancelación, cierres institucionales, y el estado de la conexión con Google Calendar (con
enlace a Integraciones).

**Portal del socio** (`/portal/reservas`) — elige espacio, ve el calendario con los huecos
reales, elige el rango, y ve el precio desglosado antes de confirmar:

> 4 h de Estudio · sábado 20/09 de 14:00 a 18:00
> 2 h bonificadas por ser socio — $0
> 2 h × $3.000 (precio de socio) — $6.000
> **Total: $6.000**
> Te quedan 0 de 2 horas bonificadas este mes.

Abajo, sus reservas: las que vienen (con botón de cancelar cuando corresponde) y las pasadas.

**Público** (`/w/[slug]/reservas`) — el no socio ve los espacios que aceptan no socios, con la
tarifa plena. Reservar exige registrarse con email o con Google; ahí se le explica que
asociándose paga menos. Solo Mercado Pago: la transferencia exige a alguien que la concilie, y
para un desconocido eso es un horario bloqueado sin garantía.

---

## Cómo se prueba

Siguiendo lo que ya hace el repositorio (1.209 tests en 99 archivos, vitest):

| Qué | Cómo |
|---|---|
| Motor de disponibilidad | Tests puros: solapamientos, bordes exactos, buffers, cierres, incompatibilidad entre espacios, cambio de mes, horario de verano |
| Precio y horas bonificadas | Tests puros: bonificación parcial, total, bolsa agotada, cancelación que devuelve, cancelación de otro mes |
| Comisión | Que el fee salga sobre lo cobrado y no sobre el precio de lista; que las horas bonificadas no generen comisión; que la transferencia devengue deuda |
| Doble reserva | Test de integración con dos transacciones concurrentes: una entra, la otra falla con el error esperado |
| Vencimiento de bloqueos | Idempotencia: correr el proceso dos veces deja el mismo resultado |
| Google | Cliente detrás de una interfaz, con doble de prueba. Ningún test toca la red |
| Tokens | Que ni el token ni el `code` aparezcan en ningún log; que sin clave maestra falle cerrado |
| Navegación | Que el módulo apagado no aparezca en ningún menú; que la ruta directa redirija |

---

## Etapas

| # | Qué | Deja funcionando |
|---|---|---|
| 1 | Integraciones: catálogo, modelo, cifrado, OAuth, pantalla | El dueño conecta el Google Calendar de la institución |
| 2 | Modelo de reservas + motor de disponibilidad | Nada visible. Toda la lógica difícil, probada |
| 3 | Espacios y Tarifas y reglas | El dueño configura los tres espacios de verdad |
| 4 | Agenda del equipo + carga manual | La Comisión ve y gestiona la ocupación |
| 5 | Portal del socio: reservar, bonificadas, cobrar | El socio reserva y paga |
| 6 | Espejo con Google Calendar, en las dos direcciones | Lo cargado a mano en Calendar bloquea horarios |
| 7 | Reserva pública para no socios | La institución alquila a terceros |

Cada etapa deja el sistema entero y desplegable. La 6 puede posponerse sin bloquear nada: hasta
que exista, FOTOFFICE es la única fuente de verdad de la agenda.

## Lo que queda explícitamente afuera

- Devoluciones automáticas por Mercado Pago.
- Reservas recurrentes ("todos los martes").
- Descuentos por cantidad de horas o por temporada.
- Classroom, Drive y Contacts implementados (quedan declarados en el catálogo).
- Facturación electrónica de la reserva.
