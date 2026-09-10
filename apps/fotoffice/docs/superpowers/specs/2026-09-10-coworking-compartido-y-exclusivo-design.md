# Coworking compartido y uso exclusivo

**Fecha:** 2026-09-10 · **Aplicación:** FOTOFFICE · **Estado:** en revisión

## El problema

El coworking de la SFPR tiene lugar para cuatro personas trabajando juntas, pero FOTOFFICE lo
alquila como si fuera uno solo: la primera reserva de las 10 de la mañana deja el horario
tomado y las otras tres sillas quedan sin vender.

Y hay un caso opuesto y real: un fotógrafo que lleva un cliente a una entrevista **necesita el
espacio para él solo**. Hoy no puede pedirlo, y aunque el sistema lo dejara reservar no habría
nada que impidiera que otro socio se anote en la misma hora.

Las dos cosas son la misma decisión mirada de los dos lados: **cuántos lugares del espacio
ocupa una reserva.**

---

## Parte 0 · Lo que ya existe y no se rehace

| Pieza | Dónde vive | Qué aporta |
|---|---|---|
| Motor de disponibilidad puro | `lib/bookings/availability.ts` | `computeAvailability` y `checkRange` con sus motivos de rechazo |
| Grilla semanal | `lib/bookings/week-grid.ts` | `buildWeekGrid` y `selectRange`, con `CellState` |
| Precio y horas libres | `lib/bookings/pricing.ts`, `free-hours.ts` | `quoteBooking` y el saldo mensual de 2 horas |
| Red de seguridad de la base | `Booking_sin_solapamiento` | Rechaza dos reservas del mismo espacio a la misma hora |
| Incompatibilidad entre espacios | `lib/bookings/conflicts.ts` | El salón sigue bloqueando estudio y coworking |
| Espejo con Google Calendar | `lib/bookings/calendar/` | Ida, vuelta y cancelación por borrado |

**Nada de esto se reemplaza.** La capacidad se agrega como una dimensión más de lo que ya
decide quién puede reservar qué.

---

## Parte 1 · Lo que ve el socio

El flujo cambia en un punto y solo en uno: **antes de ver la grilla, elige el modo.**

```
Coworking
( • ) Compartido — hasta 4 personas          $0 / hora
(   ) Uso exclusivo — el espacio para vos    $0 / hora

[ grilla semanal ]
```

- En **compartido** ve todos los horarios con al menos un lugar libre. Cada celda disponible
  dice cuántos quedan: *«quedan 2 de 4»*.
- En **uso exclusivo** ve únicamente los horarios sin nadie. Un horario con una sola persona
  anotada aparece como no disponible, sin explicar quién está — no es asunto suyo.
- Cambiar de modo recalcula la grilla en el momento. El rango que tenía elegido se descarta si
  dejó de ser válido, y se lo dice.

Un espacio de capacidad 1 —el estudio, el salón— **no muestra el selector**. Siempre es
exclusivo y ofrecer la opción sería ruido.

### Lo que NO hace

- El socio no elige *qué* silla. La numeración es interna; para él el coworking es un lugar
  entre cuatro iguales.
- No hay lista de espera. Si no hay lugar, no hay lugar.
- Nadie desplaza a nadie: quien reservó compartido primero no se entera de que alguien quiso
  exclusividad, y no pierde su lugar.

---

## Parte 2 · Lo que configura la institución

En **Reservas → Espacios**, dentro de cada espacio:

| Campo | Tipo | Cuándo aparece |
|---|---|---|
| Capacidad | entero ≥ 1, default 1 | Siempre |
| Precio exclusivo socio / hora | pesos | Solo si capacidad > 1 |
| Precio exclusivo no socio / hora | pesos | Solo si capacidad > 1 |

Los dos precios exclusivos son **obligatorios cuando la capacidad es mayor que 1**: un espacio
compartible sin precio exclusivo ofrecería la opción a $0 y la regalaría.

**Bajar la capacidad no toca las reservas ya hechas.** Si el coworking pasa de 4 a 2 y había
tres personas anotadas para el jueves, las tres siguen en pie; lo que cambia es que no entra
una cuarta. La alternativa —cancelar a alguien por un cambio de configuración— es peor.

---

## Parte 3 · Los datos

### `BookingSpace`

```prisma
capacity                          Int      @default(1)
exclusiveMemberHourlyPriceArs     Decimal? @db.Decimal(12, 2)
exclusiveNonMemberHourlyPriceArs  Decimal? @db.Decimal(12, 2)
```

### `Booking`

```prisma
/// Rango de lugares que ocupa, semiabierto: [seatFrom, seatTo).
/// Compartida toma uno; exclusiva toma [0, capacity).
seatFrom  Int     @default(0)
seatTo    Int     @default(1)
/// Lo que la persona contrató, no lo que se deduce hoy de la capacidad.
exclusive Boolean @default(false)
```

`exclusive` se guarda y no se deduce de `seatTo - seatFrom == capacity` por la misma razón que
`BookingExtraLine.nameSnapshot`: si mañana la capacidad cambia, una reserva vieja tiene que
seguir diciendo lo que la persona pidió y pagó.

### La red de seguridad de la base

Esta es la pieza delicada. La restricción actual rechaza **cualquier** superposición en el
mismo espacio. Se reemplaza por una que además compara el rango de lugares:

```sql
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_sin_solapamiento";

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_sin_solapamiento"
  EXCLUDE USING gist (
    "spaceId" WITH =,
    int4range("seatFrom", "seatTo", '[)') WITH &&,
    tsrange("startAt", "endAt", '[)') WITH &&
  ) WHERE (status IN ('HOLD', 'PENDING_APPROVAL', 'CONFIRMED'));
```

Lo que garantiza, sin depender de que ningún código se acuerde de chequear:

| Caso | Qué pasa | Por qué |
|---|---|---|
| Dos compartidas en el mismo lugar y hora | rechazada la segunda | los rangos `[0,1)` se solapan |
| Dos compartidas en lugares distintos | conviven | `[0,1)` y `[1,2)` no se solapan |
| Exclusiva contra cualquier compartida | rechazada | `[0,4)` se solapa con todo |
| Dos exclusivas | rechazada la segunda | `[0,4)` contra `[0,4)` |
| Estudio y salón (capacidad 1) | igual que hoy | toda reserva es `[0,1)` |

**El estudio y el salón no cambian de comportamiento.** Con capacidad 1 el rango de lugares es
siempre `[0,1)` y la restricción se reduce exactamente a la de hoy.

`int4range` es inmutable, así que el índice se crea sin el problema que tuvo `tstzrange` (ver
el comentario en `20260909000000_bookings/migration.sql`).

### La migración

Es una tabla que **solo existe en la base de FOTOFFICE**, así que no hay que replicarla en las
otras cuatro. Orden:

1. Agregar las columnas con sus defaults — las reservas existentes quedan `[0,1)` y
   `exclusive = false`, que es exactamente lo que son.
2. Recién entonces reemplazar la restricción. Al revés, dejaría una ventana con la restricción
   vieja y columnas nuevas a medio llenar.
3. Registrarla con `prisma migrate resolve --applied` (el deploy no corre `migrate deploy`).

---

## Parte 4 · El motor de disponibilidad

Hoy `busy` es una lista de intervalos ocupados y alcanza porque ocupado es sí o no. Con
capacidad hay que saber **cuánto** ocupa cada cosa.

```ts
export type BusyInterval = Interval & {
  /** Cuántos lugares del espacio consume. */
  seats: number;
};

export type SpaceRules = {
  // …lo de hoy…
  capacity: number;
};

export type AvailabilityInput = {
  // …lo de hoy…
  mode: "SHARED" | "EXCLUSIVE";
  busy: BusyInterval[];
};
```

De dónde sale `seats` en cada caso, decidido en `loadAvailabilityContext`. Los cierres por
feriado no entran acá: viajan aparte en `closures` y siguen cerrando el espacio entero.

| Origen | `seats` | Por qué |
|---|---|---|
| Reserva del mismo espacio | `seatTo - seatFrom` | uno si es compartida, todos si es exclusiva |
| Reserva de un espacio incompatible (salón) | `capacity` | ocupa el espacio físico entero |
| Bloqueo traído del calendario | `capacity` | **decisión:** un evento cargado a mano en el calendario del coworking se lee como que la sala está en uso, no como una silla. Es la lectura conservadora, y es la que evita que FOTOFFICE venda una silla en una reunión que la Secretaría anotó a mano |

`checkRange` pasa a rechazar cuando **los lugares pedidos no entran**:

- compartido pide 1 lugar → rechaza si `ocupados + 1 > capacity`
- exclusivo pide `capacity` lugares → rechaza si `ocupados > 0`

Motivos de rechazo: `OCUPADO` se conserva para el compartido sin lugar, y se agrega
**`SIN_EXCLUSIVIDAD`** para el caso propio del exclusivo — *«Ese horario ya tiene gente
anotada. Elegí otro, o reservalo compartido.»* Decir "ocupado" cuando en realidad hay tres
sillas libres sería mentirle.

### Asignar el lugar

En `createBooking`, dentro de la transacción que ya existe:

- **Exclusiva:** `[0, capacity)`.
- **Compartida:** el índice libre más bajo, calculado sobre las reservas activas que se
  solapan.

Y un cambio importante en el manejo del choque. Hoy un `23P01` significa "ocupado" y se le
informa así. Ahora un choque en una compartida puede significar solo que **otro tomó ese lugar
un instante antes**: se recalcula el índice y se reintenta, hasta `capacity` veces. Recién
cuando no queda ningún índice libre se informa que no hay lugar.

`isOverlapConstraintError` ya reconoce el error tal como llega de verdad y se reutiliza sin
cambios.

---

## Parte 5 · La grilla

`GridCell` gana un dato y `CellState` no cambia:

```ts
export type GridCell = {
  // …lo de hoy…
  /** Lugares libres en esa celda. En un espacio de capacidad 1 es 0 o 1. */
  seatsFree: number;
};
```

El modo se aplica **al construir** la grilla, así que `FREE` y `TAKEN` siguen significando lo
mismo para quien la dibuja: en exclusivo, una celda con `seatsFree < capacity` es `TAKEN`.
`selectRange` no se toca — sigue exigiendo que todas las celdas del rango sean `FREE`.

La celda muestra el remanente solo cuando aporta: en compartido y si `capacity > 1`.

---

## Parte 6 · El precio

`quoteBooking` recibe el modo y las dos tarifas nuevas. La tarifa aplicada sale de una tabla
de cuatro:

| | Compartido | Exclusivo |
|---|---|---|
| Socio | `memberHourlyPriceArs` | `exclusiveMemberHourlyPriceArs` |
| No socio | `nonMemberHourlyPriceArs` | `exclusiveNonMemberHourlyPriceArs` |

**Las 2 horas libres del socio no cambian de cantidad, sí de valor.** Son 2 horas por mes, no
2 horas de coworking compartido: si las usa en exclusivo, se le descuentan las mismas 2 horas y
lo que se ahorra es más. Es lo coherente con el beneficio tal como está escrito, y no obliga al
socio a entender dos saldos distintos.

El 5% de la plataforma se calcula sobre el total, igual que hoy.

---

## Parte 7 · Lo que arrastra

**El evento del calendario** dice el modo, porque de eso depende que la Secretaría meta o no a
alguien más:

```
Coworking (exclusivo) — Daniel Andrés Cuart · N° 556
```

y en la descripción, `Uso exclusivo` o `Compartido · 1 de 4 lugares`.

**El panel de la Comisión** (`/reservas`) muestra el modo y la ocupación de cada franja, que
hoy es una fila por reserva y pasa a poder ser cuatro.

**La carga manual de reservas** por parte de la Comisión ofrece el mismo selector.

---

## Parte 8 · Cómo se prueba

Módulos puros, con tests de tabla:

- `availability.ts`: capacidad 4 con 0, 1, 3 y 4 lugares tomados, en los dos modos; un salón
  ocupado bloqueando el coworking entero; capacidad 1 comportándose como hoy.
- `week-grid.ts`: `seatsFree` correcto; una celda parcial que es `FREE` en compartido y `TAKEN`
  en exclusivo.
- `pricing.ts`: las cuatro tarifas; las 2 horas libres aplicadas sobre la tarifa exclusiva.
- `create.ts`: elección del índice libre más bajo; reintento ante choque; agotamiento tras
  `capacity` intentos.

Y **una verificación contra la base real**, como se hizo con la restricción original: insertar
dos compartidas en lugares distintos (conviven), una tercera en un lugar tomado (rechazada),
una exclusiva sobre una compartida (rechazada), y borrar las filas de prueba.

---

## Decisiones registradas

1. **El exclusivo solo se ofrece si el horario está entero libre.** Nadie desplaza a nadie.
2. **Precio exclusivo propio y configurable**, socio y no socio, en la configuración del
   espacio. No un multiplicador ni capacidad × precio.
3. **Un bloqueo del calendario ocupa el espacio entero**, no una silla.
4. **Bajar la capacidad no cancela reservas.**
5. **Las horas libres son horas, no horas-compartidas.**
6. **La garantía sigue en la base.** La capacidad no se enforza solo desde el código.

## Lo que queda afuera

Lista de espera, elección de silla por parte del socio, capacidad por franja horaria (una
capacidad distinta a la mañana que a la tarde) y precio por persona en vez de por hora. Ninguna
hace falta para el caso que existe.
