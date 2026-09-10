# Coworking compartido y uso exclusivo — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un espacio pueda alquilarse a varias personas a la vez hasta su capacidad, y que quien lo necesite pueda pedirlo de manera exclusiva a un precio propio.

**Architecture:** Una reserva pasa a ocupar un **rango de lugares** `[seatFrom, seatTo)` en vez de ocupar el espacio entero. Una compartida toma un lugar; una exclusiva toma `[0, capacity)`. La restricción de exclusión de Postgres se extiende a comparar ese rango, así que sigue siendo la base —y no el código— la que garantiza que nada se superponga. Con `capacity = 1` el comportamiento es idéntico al actual.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Prisma sobre Neon Postgres, `btree_gist` + `EXCLUDE USING gist`, vitest.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-09-10-coworking-compartido-y-exclusivo-design.md`

## Global Constraints

- **Todos los comandos se corren desde `apps/fotoffice`** salvo los de Prisma, que se corren desde `packages/db`.
- **El dinero adentro de los módulos es entero en centavos.** Se convierte a decimal solo al escribir en la base, con `minorToDecimalString`. Nunca coma flotante.
- **Zona horaria:** `BOOKINGS_TIME_ZONE` (`America/Argentina/Buenos_Aires`). Nunca aritmética ingenua de horas.
- **`schema.prisma` es compartido por 5 bases Neon.** `Booking` y `BookingSpace` **solo existen en la base de FOTOFFICE** (proyecto Neon `compramelafoto`, rama `development`), así que esta migración no se replica en las otras cuatro. Verificarlo antes de dar por cerrada la Tarea 1.
- **El deploy nunca corre `prisma migrate deploy`.** Toda migración se aplica a mano y se registra con `prisma migrate resolve --applied <nombre>`.
- **Los módulos de `lib/bookings/` marcados como PUROS no pueden importar `@repo/db` ni hacer red.** `availability.ts`, `pricing.ts`, `week-grid.ts`, `space-form.ts` y `event-content.ts` son puros y siguen siéndolo.
- **Idioma:** identificadores en inglés, comentarios y textos de interfaz en español rioplatense.
- **`capacity` mínimo 1.** Un espacio de capacidad 1 no muestra el selector de modo ni los campos de precio exclusivo.
- **El precio exclusivo de no socio solo se pide y se valida si `allowsNonMembers` está encendido.**
- **Sesiones compartidas:** este repo lo usan varias sesiones a la vez. **Nunca `git add -A`**; siempre rutas explícitas.

---

## Estructura de archivos

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `packages/db/prisma/schema.prisma` | Columnas nuevas en `BookingSpace` y `Booking` | 1 |
| `packages/db/prisma/migrations/20260912000000_booking_capacidad/migration.sql` | Columnas + reemplazo de la restricción | 1 |
| `lib/bookings/availability.ts` | `BusyInterval`, `capacity`, `mode`, `seatsTakenIn`, `seatsFreeIn`, `SIN_EXCLUSIVIDAD`, `AvailableSlot` | 2, 5 |
| `lib/bookings/busy.ts` (nuevo) | Cuánto ocupa cada cosa que tapa un espacio. Puro | 4 |
| `lib/bookings/seats.ts` (nuevo) | Elegir el lugar libre más bajo. Puro | 3 |
| `lib/bookings/repository.ts` | Leer las columnas nuevas y armar `BusyInterval` | 4 |
| `lib/bookings/week-grid.ts` | `seatsFree` por celda | 5 |
| `lib/bookings/pricing.ts` | Tarifa según modo | 6 |
| `lib/bookings/create.ts` | Asignar lugar y reintentar ante choque | 7 |
| `lib/bookings/space-form.ts` | Validar capacidad y precios exclusivos | 8 |
| `app/(shell)/reservas/espacios/space-form.tsx` | Campos nuevos | 8 |
| `lib/bookings/portal.ts` | Propagar el modo a la oferta | 9 |
| `app/portal/reservas/reservar-form.tsx` · `app/w/[workspaceSlug]/reservas/[spaceId]/public-form.tsx` | Selector de modo | 9 |
| `lib/bookings/calendar/event-content.ts` | El evento dice el modo | 10 |
| `app/(shell)/reservas/nueva/page.tsx` · `app/(shell)/reservas/page.tsx` | Carga manual y panel de la Comisión | 11 |

---

## Task 1: La capacidad y los lugares en la base

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (modelos `BookingSpace` y `Booking`)
- Create: `packages/db/prisma/migrations/20260912000000_booking_capacidad/migration.sql`

**Interfaces:**
- Consumes: nada.
- Produces: `BookingSpace.capacity: Int`, `BookingSpace.exclusiveMemberHourlyPriceArs: Decimal?`, `BookingSpace.exclusiveNonMemberHourlyPriceArs: Decimal?`, `Booking.seatFrom: Int`, `Booking.seatTo: Int`, `Booking.exclusive: Boolean`. Restricción `Booking_sin_solapamiento` extendida con `int4range("seatFrom","seatTo",'[)')`.

- [ ] **Step 1: Agregar las columnas al esquema**

En `packages/db/prisma/schema.prisma`, dentro de `model BookingSpace`, junto a `memberFreeHoursPerMonth`:

```prisma
  /// Cuántas reservas simultáneas admite. 1 = el espacio se alquila entero.
  capacity                         Int      @default(1)
  /// Precio por hora del uso exclusivo. Obligatorio cuando capacity > 1; el de no socio,
  /// además, solo si allowsNonMembers.
  exclusiveMemberHourlyPriceArs    Decimal? @db.Decimal(12, 2)
  exclusiveNonMemberHourlyPriceArs Decimal? @db.Decimal(12, 2)
```

Y dentro de `model Booking`, junto a `customerType`:

```prisma
  /// Rango de lugares que ocupa, semiabierto: [seatFrom, seatTo). Una reserva compartida
  /// toma uno; una exclusiva toma [0, capacity). La restricción de exclusión compara este
  /// rango, así que es la base la que impide que dos reservas se pisen.
  seatFrom  Int     @default(0)
  seatTo    Int     @default(1)
  /// Lo que la persona contrató. Se guarda y no se deduce de seatTo - seatFrom porque la
  /// capacidad del espacio puede cambiar después.
  exclusive Boolean @default(false)
```

- [ ] **Step 2: Escribir la migración**

Crear `packages/db/prisma/migrations/20260912000000_booking_capacidad/migration.sql`:

```sql
-- Un espacio puede alquilarse a varias personas a la vez, y una reserva puede pedirlo
-- entero. Las dos cosas son lo mismo: cuántos lugares ocupa una reserva.

ALTER TABLE "BookingSpace" ADD COLUMN "capacity" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "BookingSpace" ADD COLUMN "exclusiveMemberHourlyPriceArs" DECIMAL(12,2);
ALTER TABLE "BookingSpace" ADD COLUMN "exclusiveNonMemberHourlyPriceArs" DECIMAL(12,2);

-- Las reservas que ya existen ocupan el espacio entero de un espacio de capacidad 1, que
-- es exactamente [0,1) y no exclusivo. Los defaults las dejan bien sin tocar ninguna fila.
ALTER TABLE "Booking" ADD COLUMN "seatFrom" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD COLUMN "seatTo" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Booking" ADD COLUMN "exclusive" BOOLEAN NOT NULL DEFAULT false;

-- Y recién ahora la restricción. Al revés quedaría una ventana con la restricción vieja y
-- columnas nuevas a medio llenar.
--
-- `int4range` es IMMUTABLE, así que el índice se crea sin el problema que tuvo `tstzrange`
-- (ver el comentario en 20260909000000_bookings/migration.sql).
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_sin_solapamiento";

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_sin_solapamiento"
  EXCLUDE USING gist (
    "spaceId" WITH =,
    int4range("seatFrom", "seatTo", '[)') WITH &&,
    tsrange("startAt", "endAt", '[)') WITH &&
  ) WHERE (status IN ('HOLD', 'PENDING_APPROVAL', 'CONFIRMED'));
```

- [ ] **Step 3: Confirmar que la tabla no vive en las otras bases**

Con el MCP de Neon, contra `compramelafoto/production` y `clickaton-production`:

```sql
SELECT count(*) FROM information_schema.tables WHERE table_name IN ('Booking','BookingSpace');
```

Esperado: `0` en las dos. Si diera distinto de cero, **parar** y avisar: habría que aplicar la migración también ahí.

- [ ] **Step 4: Aplicar la migración a la base de FOTOFFICE**

Correr el contenido del `.sql` contra el proyecto Neon `compramelafoto`, rama `development` (`br-old-rain-adwthzng`), sentencia por sentencia.

- [ ] **Step 5: Verificar la restricción contra la base real**

Esto no se puede probar con vitest: la garantía la da Postgres. Insertar filas de prueba y comprobar cada caso. Reemplazar `<SPACE>` por el id del coworking y subirle la capacidad a 4 antes de empezar.

```sql
-- Preparar
UPDATE "BookingSpace" SET capacity = 4 WHERE slug = 'coworking' AND "workspaceId" = 'ws_sfpr_seed';

-- 1) Dos compartidas en lugares distintos: CONVIVEN
INSERT INTO "Booking" (id,"workspaceId","spaceId","startAt","endAt",status,"contactName","contactEmail","customerType","billedMinutes","freeMinutesUsed","hourlyPriceArs","totalArs","paymentMethod","paymentStatus","seatFrom","seatTo")
VALUES ('t1','ws_sfpr_seed','<SPACE>','2027-01-04 12:00','2027-01-04 13:00','CONFIRMED','P1','p1@x.com','MEMBER',60,0,0,0,'SIN_CARGO','NOT_REQUIRED',0,1);
INSERT INTO "Booking" (id,"workspaceId","spaceId","startAt","endAt",status,"contactName","contactEmail","customerType","billedMinutes","freeMinutesUsed","hourlyPriceArs","totalArs","paymentMethod","paymentStatus","seatFrom","seatTo")
VALUES ('t2','ws_sfpr_seed','<SPACE>','2027-01-04 12:00','2027-01-04 13:00','CONFIRMED','P2','p2@x.com','MEMBER',60,0,0,0,'SIN_CARGO','NOT_REQUIRED',1,2);
```

Esperado: las dos entran.

```sql
-- 2) Una tercera en un lugar ya tomado: RECHAZADA (23P01)
INSERT INTO "Booking" (id,"workspaceId","spaceId","startAt","endAt",status,"contactName","contactEmail","customerType","billedMinutes","freeMinutesUsed","hourlyPriceArs","totalArs","paymentMethod","paymentStatus","seatFrom","seatTo")
VALUES ('t3','ws_sfpr_seed','<SPACE>','2027-01-04 12:00','2027-01-04 13:00','CONFIRMED','P3','p3@x.com','MEMBER',60,0,0,0,'SIN_CARGO','NOT_REQUIRED',0,1);
```

Esperado: error `23P01` sobre `Booking_sin_solapamiento`.

```sql
-- 3) Una exclusiva sobre horario con gente: RECHAZADA
INSERT INTO "Booking" (id,"workspaceId","spaceId","startAt","endAt",status,"contactName","contactEmail","customerType","billedMinutes","freeMinutesUsed","hourlyPriceArs","totalArs","paymentMethod","paymentStatus","seatFrom","seatTo","exclusive")
VALUES ('t4','ws_sfpr_seed','<SPACE>','2027-01-04 12:00','2027-01-04 13:00','CONFIRMED','P4','p4@x.com','MEMBER',60,0,0,0,'SIN_CARGO','NOT_REQUIRED',0,4,true);
```

Esperado: error `23P01`.

```sql
-- 4) Adyacente sin solaparse: ENTRA (media abierta)
INSERT INTO "Booking" (id,"workspaceId","spaceId","startAt","endAt",status,"contactName","contactEmail","customerType","billedMinutes","freeMinutesUsed","hourlyPriceArs","totalArs","paymentMethod","paymentStatus","seatFrom","seatTo")
VALUES ('t5','ws_sfpr_seed','<SPACE>','2027-01-04 13:00','2027-01-04 14:00','CONFIRMED','P5','p5@x.com','MEMBER',60,0,0,0,'SIN_CARGO','NOT_REQUIRED',0,1);

-- Limpiar
DELETE FROM "Booking" WHERE id IN ('t1','t2','t3','t4','t5');
```

- [ ] **Step 6: Registrar la migración**

```bash
cd packages/db && set -a && . ../../apps/fotoffice/.env.local && set +a && npx prisma migrate resolve --applied 20260912000000_booking_capacidad
```

Después comprobar con el MCP de Neon:

```sql
SELECT migration_name FROM "_prisma_migrations" WHERE migration_name = '20260912000000_booking_capacidad';
```

- [ ] **Step 7: Regenerar el cliente y comprobar que compila**

```bash
cd packages/db && npx prisma generate && cd ../../apps/fotoffice && npx tsc --noEmit -p tsconfig.json
```

- [ ] **Step 8: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20260912000000_booking_capacidad/migration.sql
git commit -m "Una reserva ocupa lugares, no el espacio entero"
```

---

## Task 2: El motor de disponibilidad cuenta lugares

**Files:**
- Modify: `lib/bookings/availability.ts`
- Test: `lib/bookings/availability.test.ts`

**Interfaces:**
- Consumes: `Interval`, `overlaps`, `expandInterval` de `./time` (ya existen).
- Produces:
  - `export type BusyInterval = Interval & { seats: number }`
  - `SpaceRules` gana `capacity: number`
  - `AvailabilityInput` gana `mode: BookingMode` y su `busy` pasa a `BusyInterval[]`
  - `export type BookingMode = "SHARED" | "EXCLUSIVE"`
  - `export function seatsRequested(mode: BookingMode, capacity: number): number`
  - `export function seatsTakenIn(range: Interval, input: Omit<AvailabilityInput, "range">): number`
  - `export function seatsFreeIn(range: Interval, input: Omit<AvailabilityInput, "range">): number`
  - `BookingRejection` gana `"SIN_EXCLUSIVIDAD"`

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `lib/bookings/availability.test.ts`. Copiar el helper `base` que ya usa el archivo y agregarle `capacity` y `mode`; si el helper existente no los tiene, definir uno propio:

```ts
import { seatsFreeIn, seatsRequested, seatsTakenIn } from "./availability";

const cowork = {
  space: {
    slotMinutes: 60,
    minBookingMinutes: 60,
    maxBookingMinutes: null,
    bufferMinutes: 0,
    minAdvanceHours: 0,
    maxAdvanceDays: 90,
    capacity: 4,
  },
  weeklyHours: [{ weekday: 5, startMinute: 540, endMinute: 720 }],
  closures: [],
  busy: [],
  mode: "SHARED" as const,
  now: new Date("2027-01-01T12:00:00Z"),
  timeZone: "America/Argentina/Buenos_Aires",
};

const alasDiez = {
  startAt: new Date("2027-01-08T13:00:00Z"),
  endAt: new Date("2027-01-08T14:00:00Z"),
};

describe("cuántos lugares ocupa y cuántos quedan", () => {
  it("un espacio vacío tiene todos los lugares libres", () => {
    expect(seatsTakenIn(alasDiez, cowork)).toBe(0);
    expect(seatsFreeIn(alasDiez, cowork)).toBe(4);
  });

  it("suma los lugares de lo que se solapa, no la cantidad de reservas", () => {
    const input = {
      ...cowork,
      busy: [
        { ...alasDiez, seats: 1 },
        { ...alasDiez, seats: 2 },
      ],
    };
    expect(seatsTakenIn(alasDiez, input)).toBe(3);
    expect(seatsFreeIn(alasDiez, input)).toBe(1);
  });

  it("lo que no se solapa no ocupa", () => {
    const otroDia = {
      startAt: new Date("2027-01-15T13:00:00Z"),
      endAt: new Date("2027-01-15T14:00:00Z"),
      seats: 4,
    };
    expect(seatsTakenIn(alasDiez, { ...cowork, busy: [otroDia] })).toBe(0);
  });

  it("nunca informa lugares libres negativos", () => {
    const input = { ...cowork, busy: [{ ...alasDiez, seats: 9 }] };
    expect(seatsFreeIn(alasDiez, input)).toBe(0);
  });

  it("compartido pide un lugar; exclusivo pide todos", () => {
    expect(seatsRequested("SHARED", 4)).toBe(1);
    expect(seatsRequested("EXCLUSIVE", 4)).toBe(4);
    expect(seatsRequested("SHARED", 1)).toBe(1);
    expect(seatsRequested("EXCLUSIVE", 1)).toBe(1);
  });
});

describe("compartido y exclusivo al validar un rango", () => {
  it("compartido entra mientras quede un lugar", () => {
    const input = { ...cowork, busy: [{ ...alasDiez, seats: 3 }] };
    expect(checkRange(alasDiez, input)).toEqual({ ok: true });
  });

  it("compartido se rechaza cuando está lleno", () => {
    const input = { ...cowork, busy: [{ ...alasDiez, seats: 4 }] };
    expect(checkRange(alasDiez, input)).toEqual({ ok: false, reason: "OCUPADO" });
  });

  it("exclusivo se rechaza con una sola persona anotada, y con su propio motivo", () => {
    // Decir "ocupado" sería mentir: hay tres sillas libres.
    const input = { ...cowork, mode: "EXCLUSIVE" as const, busy: [{ ...alasDiez, seats: 1 }] };
    expect(checkRange(alasDiez, input)).toEqual({ ok: false, reason: "SIN_EXCLUSIVIDAD" });
  });

  it("exclusivo entra si el horario está entero libre", () => {
    const input = { ...cowork, mode: "EXCLUSIVE" as const };
    expect(checkRange(alasDiez, input)).toEqual({ ok: true });
  });

  it("un espacio de capacidad 1 se comporta igual que antes", () => {
    const solo = { ...cowork, space: { ...cowork.space, capacity: 1 } };
    expect(checkRange(alasDiez, solo)).toEqual({ ok: true });
    expect(checkRange(alasDiez, { ...solo, busy: [{ ...alasDiez, seats: 1 }] })).toEqual({
      ok: false,
      reason: "OCUPADO",
    });
  });

  it("el buffer de limpieza sigue contando", () => {
    const antes = {
      startAt: new Date("2027-01-08T12:00:00Z"),
      endAt: new Date("2027-01-08T13:00:00Z"),
      seats: 4,
    };
    const input = { ...cowork, space: { ...cowork.space, bufferMinutes: 30 }, busy: [antes] };
    expect(checkRange(alasDiez, input)).toEqual({ ok: false, reason: "OCUPADO" });
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

```bash
npx vitest run lib/bookings/availability
```

Esperado: FALLA con `seatsTakenIn is not a function` y errores de tipo por `capacity`/`mode` faltantes.

- [ ] **Step 3: Implementar**

En `lib/bookings/availability.ts`:

```ts
export type BookingMode = "SHARED" | "EXCLUSIVE";

/** Un intervalo ocupado y cuántos lugares del espacio consume. */
export type BusyInterval = Interval & { seats: number };
```

Agregar a `SpaceRules`:

```ts
  /** Cuántas reservas simultáneas admite. 1 = el espacio se alquila entero. */
  capacity: number;
```

Cambiar `AvailabilityInput`:

```ts
export type AvailabilityInput = {
  space: SpaceRules;
  range: Interval;
  weeklyHours: WeeklyHour[];
  closures: Interval[];
  /** Reservas del espacio, de sus incompatibles, y bloqueos del calendario, con su peso. */
  busy: BusyInterval[];
  /** Qué se está pidiendo: un lugar o el espacio entero. */
  mode: BookingMode;
  now: Date;
  timeZone: string;
};
```

Agregar `"SIN_EXCLUSIVIDAD"` a `BookingRejection` y su mensaje a `MOTIVOS`:

```ts
  SIN_EXCLUSIVIDAD:
    "Ese horario ya tiene gente anotada. Elegí otro, o reservalo compartido.",
```

Reemplazar la función `ocupado` por estas tres:

```ts
/**
 * Cuántos lugares pide una reserva.
 *
 * Una exclusiva pide el espacio entero, así que choca con cualquier otra cosa. En un
 * espacio de capacidad 1 las dos formas piden lo mismo, que es por qué el estudio y el
 * salón no cambian de comportamiento.
 */
export function seatsRequested(mode: BookingMode, capacity: number): number {
  const cupo = Number.isFinite(capacity) && capacity > 0 ? Math.floor(capacity) : 1;
  return mode === "EXCLUSIVE" ? cupo : 1;
}

/** Cuántos lugares están tomados en ese rango, contando el buffer de limpieza. */
export function seatsTakenIn(
  range: Interval,
  input: Omit<AvailabilityInput, "range">,
): number {
  return input.busy.reduce(
    (suma, b) =>
      overlaps(range, expandInterval(b, input.space.bufferMinutes))
        ? suma + Math.max(0, b.seats)
        : suma,
    0,
  );
}

/** Cuántos quedan. Nunca negativo: una capacidad que bajó no informa lugares de menos. */
export function seatsFreeIn(range: Interval, input: Omit<AvailabilityInput, "range">): number {
  const cupo = seatsRequested("EXCLUSIVE", input.space.capacity);
  return Math.max(0, cupo - seatsTakenIn(range, input));
}
```

En `checkRange`, reemplazar la línea `if (ocupado(range, input)) return { ok: false, reason: "OCUPADO" };` por:

```ts
  // El motivo distingue los dos casos porque el consejo es distinto: al compartido no le
  // queda lugar, al exclusivo le sobra lugar pero le falta soledad.
  const pedidos = seatsRequested(input.mode, input.space.capacity);
  if (seatsTakenIn(range, input) + pedidos > seatsRequested("EXCLUSIVE", input.space.capacity)) {
    return {
      ok: false,
      reason: input.mode === "EXCLUSIVE" ? "SIN_EXCLUSIVIDAD" : "OCUPADO",
    };
  }
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

```bash
npx vitest run lib/bookings/availability
```

Esperado: PASA. Los tests viejos del archivo van a fallar por falta de `capacity` y `mode` en sus objetos de entrada: agregarles `capacity: 1` y `mode: "SHARED"`, y a cada elemento de `busy` un `seats: 1`. Eso es exactamente el comportamiento de hoy y por eso los valores esperados no cambian.

- [ ] **Step 5: Commit**

```bash
git add lib/bookings/availability.ts lib/bookings/availability.test.ts
git commit -m "La disponibilidad cuenta lugares en vez de responder ocupado o libre"
```

---

## Task 3: Elegir el lugar libre más bajo

**Files:**
- Create: `lib/bookings/seats.ts`
- Test: `lib/bookings/seats.test.ts`

**Interfaces:**
- Consumes: `Interval`, `overlaps` de `./time`; `BookingMode` de `./availability`.
- Produces: `export function pickSeatRange(input: {...}): { seatFrom: number; seatTo: number } | null`

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/bookings/seats.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { pickSeatRange } from "./seats";

const rango = {
  startAt: new Date("2027-01-08T13:00:00Z"),
  endAt: new Date("2027-01-08T14:00:00Z"),
};
const otroRango = {
  startAt: new Date("2027-01-09T13:00:00Z"),
  endAt: new Date("2027-01-09T14:00:00Z"),
};

describe("elegir el lugar de una reserva", () => {
  it("en un espacio vacío toma el primero", () => {
    expect(pickSeatRange({ mode: "SHARED", capacity: 4, range: rango, taken: [] })).toEqual({
      seatFrom: 0,
      seatTo: 1,
    });
  });

  it("toma el más bajo que esté libre, no el siguiente al último", () => {
    // Que se libere el 0 y se vuelva a usar mantiene los números juntos y hace legible
    // cualquier consulta a mano sobre la tabla.
    const taken = [
      { ...rango, seatFrom: 1, seatTo: 2 },
      { ...rango, seatFrom: 2, seatTo: 3 },
    ];
    expect(pickSeatRange({ mode: "SHARED", capacity: 4, range: rango, taken })).toEqual({
      seatFrom: 0,
      seatTo: 1,
    });
  });

  it("saltea los tomados", () => {
    const taken = [{ ...rango, seatFrom: 0, seatTo: 1 }];
    expect(pickSeatRange({ mode: "SHARED", capacity: 4, range: rango, taken })).toEqual({
      seatFrom: 1,
      seatTo: 2,
    });
  });

  it("devuelve null cuando no queda ninguno", () => {
    const taken = [{ ...rango, seatFrom: 0, seatTo: 4 }];
    expect(pickSeatRange({ mode: "SHARED", capacity: 4, range: rango, taken })).toBeNull();
  });

  it("ignora lo que no se solapa con el rango pedido", () => {
    const taken = [{ ...otroRango, seatFrom: 0, seatTo: 4 }];
    expect(pickSeatRange({ mode: "SHARED", capacity: 4, range: rango, taken })).toEqual({
      seatFrom: 0,
      seatTo: 1,
    });
  });

  it("una exclusiva toma el espacio entero", () => {
    expect(pickSeatRange({ mode: "EXCLUSIVE", capacity: 4, range: rango, taken: [] })).toEqual({
      seatFrom: 0,
      seatTo: 4,
    });
  });

  it("una exclusiva no entra si hay alguien, aunque sobren lugares", () => {
    const taken = [{ ...rango, seatFrom: 3, seatTo: 4 }];
    expect(pickSeatRange({ mode: "EXCLUSIVE", capacity: 4, range: rango, taken })).toBeNull();
  });

  it("en un espacio de capacidad 1 los dos modos dan el mismo lugar", () => {
    expect(pickSeatRange({ mode: "SHARED", capacity: 1, range: rango, taken: [] })).toEqual({
      seatFrom: 0,
      seatTo: 1,
    });
    expect(pickSeatRange({ mode: "EXCLUSIVE", capacity: 1, range: rango, taken: [] })).toEqual({
      seatFrom: 0,
      seatTo: 1,
    });
  });

  it("excluye un lugar que ya se intentó y chocó", () => {
    // Lo usa el reintento de `createBooking` cuando otro tomó el lugar en el medio.
    const r = pickSeatRange({ mode: "SHARED", capacity: 4, range: rango, taken: [], exclude: [0] });
    expect(r).toEqual({ seatFrom: 1, seatTo: 2 });
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
npx vitest run lib/bookings/seats
```

Esperado: FALLA con `Failed to resolve import "./seats"`.

- [ ] **Step 3: Implementar**

Crear `lib/bookings/seats.ts`:

```ts
import type { BookingMode } from "./availability";
import { type Interval, overlaps } from "./time";

/**
 * Qué lugar del espacio le toca a una reserva. Módulo PURO: sin base y sin red.
 *
 * La numeración es interna: para quien reserva el coworking es un lugar entre cuatro
 * iguales. Se elige el más bajo libre y no el siguiente al último para que los números se
 * mantengan juntos y una consulta a mano sobre la tabla siga siendo legible.
 *
 * Quien elige NO garantiza nada: la garantía la da la restricción de exclusión de la base.
 * Esta función propone, y si la base rechaza se vuelve a preguntar excluyendo lo que chocó.
 */
export function pickSeatRange(input: {
  mode: BookingMode;
  capacity: number;
  range: Interval;
  /** Reservas activas que ya tienen lugar asignado. */
  taken: (Interval & { seatFrom: number; seatTo: number })[];
  /** Lugares que ya se intentaron y la base rechazó. */
  exclude?: readonly number[];
}): { seatFrom: number; seatTo: number } | null {
  const cupo =
    Number.isFinite(input.capacity) && input.capacity > 0 ? Math.floor(input.capacity) : 1;

  const ocupados = new Set<number>(input.exclude ?? []);
  for (const t of input.taken) {
    if (!overlaps(input.range, t)) continue;
    for (let s = t.seatFrom; s < t.seatTo; s += 1) ocupados.add(s);
  }

  if (input.mode === "EXCLUSIVE") {
    // El espacio entero o nada: alcanza con que haya un solo lugar tomado para que no entre.
    for (let s = 0; s < cupo; s += 1) if (ocupados.has(s)) return null;
    return { seatFrom: 0, seatTo: cupo };
  }

  for (let s = 0; s < cupo; s += 1) {
    if (!ocupados.has(s)) return { seatFrom: s, seatTo: s + 1 };
  }
  return null;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
npx vitest run lib/bookings/seats
```

Esperado: PASA (9 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/bookings/seats.ts lib/bookings/seats.test.ts
git commit -m "Qué lugar del espacio le toca a una reserva"
```

---

## Task 4: El repositorio informa cuánto ocupa cada cosa

**Files:**
- Modify: `lib/bookings/repository.ts` (`SpaceRecord`, `FilaEspacio`, `toRecord`, `loadAvailabilityContext`)
- Create: `lib/bookings/busy.ts`
- Test: `lib/bookings/busy.test.ts`

**Interfaces:**
- Consumes: `BusyInterval` de `./availability`.
- Produces:
  - `export function busyFromSources(input: {...}): BusyInterval[]` en `lib/bookings/busy.ts`
  - `SpaceRecord` gana `capacity: number`, `exclusiveMemberHourlyPriceMinor: number | null`, `exclusiveNonMemberHourlyPriceMinor: number | null`
  - `loadAvailabilityContext(workspaceId, spaceId, range, now, mode)` — el `mode` es el quinto parámetro, con default `"SHARED"`

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/bookings/busy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { busyFromSources } from "./busy";

const r = (h: number) => ({
  startAt: new Date(`2027-01-08T${String(h).padStart(2, "0")}:00:00Z`),
  endAt: new Date(`2027-01-08T${String(h + 1).padStart(2, "0")}:00:00Z`),
});

describe("cuánto ocupa cada cosa que tapa un espacio", () => {
  it("una reserva del mismo espacio ocupa los lugares que tomó", () => {
    const out = busyFromSources({
      capacity: 4,
      spaceId: "cowork",
      bookings: [{ ...r(13), spaceId: "cowork", seatFrom: 1, seatTo: 2 }],
      calendarBlocks: [],
    });
    expect(out).toEqual([{ ...r(13), seats: 1 }]);
  });

  it("una reserva exclusiva del mismo espacio ocupa todo", () => {
    const out = busyFromSources({
      capacity: 4,
      spaceId: "cowork",
      bookings: [{ ...r(13), spaceId: "cowork", seatFrom: 0, seatTo: 4 }],
      calendarBlocks: [],
    });
    expect(out[0].seats).toBe(4);
  });

  it("una reserva de un espacio incompatible ocupa el espacio ENTERO", () => {
    // El salón no comparte lugares con el coworking: comparte el espacio físico.
    const out = busyFromSources({
      capacity: 4,
      spaceId: "cowork",
      bookings: [{ ...r(13), spaceId: "salon", seatFrom: 0, seatTo: 1 }],
      calendarBlocks: [],
    });
    expect(out[0].seats).toBe(4);
  });

  it("un bloqueo del calendario ocupa el espacio entero, no una silla", () => {
    // Si la Secretaría anota "reunión de comisión" a mano, no se venden tres sillas ahí.
    const out = busyFromSources({
      capacity: 4,
      spaceId: "cowork",
      bookings: [],
      calendarBlocks: [r(13)],
    });
    expect(out).toEqual([{ ...r(13), seats: 4 }]);
  });

  it("junta todo en una sola lista", () => {
    const out = busyFromSources({
      capacity: 4,
      spaceId: "cowork",
      bookings: [
        { ...r(13), spaceId: "cowork", seatFrom: 0, seatTo: 1 },
        { ...r(15), spaceId: "salon", seatFrom: 0, seatTo: 1 },
      ],
      calendarBlocks: [r(17)],
    });
    expect(out.map((b) => b.seats)).toEqual([1, 4, 4]);
  });

  it("en un espacio de capacidad 1 todo ocupa 1", () => {
    const out = busyFromSources({
      capacity: 1,
      spaceId: "estudio",
      bookings: [{ ...r(13), spaceId: "estudio", seatFrom: 0, seatTo: 1 }],
      calendarBlocks: [r(15)],
    });
    expect(out.map((b) => b.seats)).toEqual([1, 1]);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
npx vitest run lib/bookings/busy
```

Esperado: FALLA con `Failed to resolve import "./busy"`.

- [ ] **Step 3: Implementar el módulo puro**

Crear `lib/bookings/busy.ts`:

```ts
import type { BusyInterval } from "./availability";
import type { Interval } from "./time";

/**
 * Traduce lo que tapa un espacio a cuántos lugares consume. Módulo PURO: sin base y sin red.
 *
 * Vive afuera del repositorio para poder probar la regla difícil —que un espacio
 * incompatible y un evento cargado a mano ocupan el espacio ENTERO y no una silla— sin
 * tocar la base.
 */
export function busyFromSources(input: {
  capacity: number;
  /** El espacio que se está mirando. Las reservas de OTROS espacios lo tapan entero. */
  spaceId: string;
  bookings: (Interval & { spaceId: string; seatFrom: number; seatTo: number })[];
  calendarBlocks: Interval[];
}): BusyInterval[] {
  const cupo =
    Number.isFinite(input.capacity) && input.capacity > 0 ? Math.floor(input.capacity) : 1;

  const deReservas: BusyInterval[] = input.bookings.map((b) => ({
    startAt: b.startAt,
    endAt: b.endAt,
    // Una reserva de otro espacio llega acá porque los dos comparten el lugar físico. Sus
    // números de lugar son de su propio espacio y no significan nada acá: tapa todo.
    seats: b.spaceId === input.spaceId ? Math.max(1, b.seatTo - b.seatFrom) : cupo,
  }));

  // Un evento cargado a mano se lee como que la sala está en uso. Es la lectura
  // conservadora, y la que evita vender una silla en una reunión que alguien anotó.
  const deCalendario: BusyInterval[] = input.calendarBlocks.map((b) => ({
    startAt: b.startAt,
    endAt: b.endAt,
    seats: cupo,
  }));

  return [...deReservas, ...deCalendario];
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
npx vitest run lib/bookings/busy
```

Esperado: PASA (6 tests).

- [ ] **Step 5: Leer las columnas nuevas en el repositorio**

En `lib/bookings/repository.ts`:

En `SpaceRecord`, junto a `memberFreeHoursPerMonth`:

```ts
  capacity: number;
  exclusiveMemberHourlyPriceMinor: number | null;
  exclusiveNonMemberHourlyPriceMinor: number | null;
```

En `FilaEspacio`, junto a `memberFreeHoursPerMonth`:

```ts
  capacity: number;
  exclusiveMemberHourlyPriceArs: { toString(): string } | null;
  exclusiveNonMemberHourlyPriceArs: { toString(): string } | null;
```

En `toRecord`, dentro de `rules` agregar `capacity: fila.capacity`, y junto a los otros precios:

```ts
    capacity: fila.capacity,
    exclusiveMemberHourlyPriceMinor:
      fila.exclusiveMemberHourlyPriceArs === null
        ? null
        : decimalArsToMinor(fila.exclusiveMemberHourlyPriceArs),
    exclusiveNonMemberHourlyPriceMinor:
      fila.exclusiveNonMemberHourlyPriceArs === null
        ? null
        : decimalArsToMinor(fila.exclusiveNonMemberHourlyPriceArs),
```

- [ ] **Step 6: Pasar el modo y los lugares en `loadAvailabilityContext`**

Cambiar la firma:

```ts
export async function loadAvailabilityContext(
  workspaceId: string,
  spaceId: string,
  range: Interval,
  now: Date = new Date(),
  mode: BookingMode = "SHARED",
): Promise<Omit<AvailabilityInput, "range"> | null> {
```

En el `select` de `prisma.booking.findMany`, agregar los campos que hacen falta para pesar cada reserva:

```ts
      select: { startAt: true, endAt: true, spaceId: true, seatFrom: true, seatTo: true },
```

Y reemplazar el `return` por:

```ts
  return {
    space: espacio.rules,
    weeklyHours: espacio.weeklyHours,
    closures: cierresFilas.map((c) => ({ startAt: c.startAt, endAt: c.endAt })),
    busy: busyFromSources({
      capacity: espacio.capacity,
      spaceId,
      bookings: ocupacion,
      calendarBlocks: bloqueosDeCalendario,
    }),
    mode,
    now,
    timeZone: BOOKINGS_TIME_ZONE,
  };
}
```

Agregar los imports: `import { busyFromSources } from "./busy";` y `BookingMode` al import que ya trae `AvailabilityInput` de `./availability`.

- [ ] **Step 7: Comprobar que compila y que la suite sigue verde**

```bash
npx tsc --noEmit -p tsconfig.json && npx vitest run lib/bookings
```

Esperado: sin errores de tipo. Si algún llamador de `computeAvailability` o `checkRange` protesta por `mode`, dejarlo para la tarea que le corresponde y anotarlo; no arreglarlo acá con un `as any`.

- [ ] **Step 8: Commit**

```bash
git add lib/bookings/busy.ts lib/bookings/busy.test.ts lib/bookings/repository.ts
git commit -m "Lo que tapa un espacio dice cuántos lugares ocupa"
```

---

## Task 5: La grilla muestra los lugares libres

**Files:**
- Modify: `lib/bookings/week-grid.ts`, `lib/bookings/availability.ts`
- Test: `lib/bookings/week-grid.test.ts`

**Interfaces:**
- Consumes: `seatsFreeIn` de `./availability` (Tarea 2).
- Produces:
  - `export type AvailableSlot = Interval & { seatsFree: number }`
  - `computeAvailability(input): AvailableSlot[]` — cambia el tipo de retorno
  - `GridCell` gana `seatsFree: number`
  - `buildWeekGrid` gana `capacity: number` en su input y su `freeSlots` pasa a `AvailableSlot[]`

- [ ] **Step 1: Escribir los tests que fallan**

Agregar a `lib/bookings/week-grid.test.ts`:

```ts
describe("lugares libres en la grilla", () => {
  const lunes = new Date("2027-01-04T03:00:00Z"); // lunes 00:00 en Rosario
  const base = {
    weekStart: lunes,
    weeklyHours: [{ weekday: 1, startMinute: 540, endMinute: 720 }],
    now: new Date("2027-01-01T12:00:00Z"),
    timeZone: "America/Argentina/Buenos_Aires",
    slotMinutes: 60,
    minAdvanceHours: 0,
    capacity: 4,
  };

  const alas9 = {
    startAt: new Date("2027-01-04T12:00:00Z"),
    endAt: new Date("2027-01-04T13:00:00Z"),
  };

  it("cada celda libre informa cuántos lugares quedan", () => {
    const grid = buildWeekGrid({ ...base, freeSlots: [{ ...alas9, seatsFree: 2 }] });
    const celda = grid.days[1].cells.find((c) => c.startISO === alas9.startAt.toISOString());
    expect(celda?.state).toBe("FREE");
    expect(celda?.seatsFree).toBe(2);
  });

  it("una celda que no está entre los libres queda tomada y sin lugares", () => {
    const grid = buildWeekGrid({ ...base, freeSlots: [] });
    const celda = grid.days[1].cells.find((c) => c.startISO === alas9.startAt.toISOString());
    expect(celda?.state).toBe("TAKEN");
    expect(celda?.seatsFree).toBe(0);
  });

  it("en un espacio de capacidad 1 una celda libre informa un lugar", () => {
    const grid = buildWeekGrid({
      ...base,
      capacity: 1,
      freeSlots: [{ ...alas9, seatsFree: 1 }],
    });
    const celda = grid.days[1].cells.find((c) => c.startISO === alas9.startAt.toISOString());
    expect(celda?.seatsFree).toBe(1);
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

```bash
npx vitest run lib/bookings/week-grid
```

Esperado: FALLA porque `seatsFree` no existe en `GridCell`.

- [ ] **Step 3: Devolver los lugares libres desde el motor**

En `lib/bookings/availability.ts`, agregar el tipo y cambiar `computeAvailability`:

```ts
/** Un turno ofrecible y cuántos lugares le quedan. */
export type AvailableSlot = Interval & { seatsFree: number };
```

En `computeAvailability`, cambiar el tipo de retorno a `AvailableSlot[]`, la declaración del mapa a `new Map<number, AvailableSlot>()`, y la línea que guarda el candidato:

```ts
      if (checkRange(candidato, input).ok) {
        porComienzo.set(cursor.getTime(), { ...candidato, seatsFree: seatsFreeIn(candidato, input) });
      }
```

- [ ] **Step 4: Agregar `seatsFree` a la celda**

En `lib/bookings/week-grid.ts`:

En `GridCell`:

```ts
  /** Lugares libres en esa celda. 0 cuando no se puede reservar. */
  seatsFree: number;
```

En el input de `buildWeekGrid`, cambiar `freeSlots: Interval[]` por `freeSlots: AvailableSlot[]` y agregar `capacity: number`. Importar `AvailableSlot` de `./availability`.

Reemplazar el `Set` de libres por un `Map` que además guarde el remanente:

```ts
  // Los libres, indexados por instante, para no recorrer la lista en cada casillero.
  const libres = new Map(input.freeSlots.map((s) => [s.startAt.getTime(), s.seatsFree]));
```

Y donde se arma cada celda, en el objeto que se devuelve, agregar:

```ts
      seatsFree: libres.get(startAt.getTime()) ?? 0,
```

Cambiar la condición que hoy pregunta `libres.has(...)` por `libres.has(startAt.getTime())` — el `Map` conserva ese método, así que la lógica de `CellState` no cambia. **`selectRange` no se toca:** sigue exigiendo que todas las celdas del rango sean `FREE`.

- [ ] **Step 5: Correr los tests y verificar que pasan**

```bash
npx vitest run lib/bookings/week-grid lib/bookings/availability
```

Esperado: PASA. Los tests viejos de `week-grid` necesitan `capacity` en su input y `seatsFree` en sus `freeSlots`.

- [ ] **Step 6: Commit**

```bash
git add lib/bookings/week-grid.ts lib/bookings/week-grid.test.ts lib/bookings/availability.ts lib/bookings/availability.test.ts
git commit -m "La grilla dice cuántos lugares quedan en cada franja"
```

---

## Task 6: El precio conoce el modo

**Files:**
- Modify: `lib/bookings/pricing.ts`
- Test: `lib/bookings/pricing.test.ts`

**Interfaces:**
- Consumes: `BookingMode` de `./availability`.
- Produces: `quoteBooking` gana `mode`, `exclusiveMemberHourlyPriceMinor` y `exclusiveNonMemberHourlyPriceMinor`. `Quote` no cambia de forma: `hourlyPriceMinor` sigue siendo la tarifa aplicada.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar a `lib/bookings/pricing.test.ts`:

```ts
const tarifas = {
  memberHourlyPriceMinor: 100_000,
  nonMemberHourlyPriceMinor: 250_000,
  exclusiveMemberHourlyPriceMinor: 200_000,
  exclusiveNonMemberHourlyPriceMinor: 400_000,
};

describe("tarifa según el modo", () => {
  it("socio compartido paga la tarifa de socio", () => {
    const q = quoteBooking({
      minutes: 60,
      customerType: "MEMBER",
      mode: "SHARED",
      freeMinutesAvailable: 0,
      ...tarifas,
    });
    expect(q.hourlyPriceMinor).toBe(100_000);
    expect(q.totalMinor).toBe(100_000);
  });

  it("socio exclusivo paga la tarifa exclusiva de socio", () => {
    const q = quoteBooking({
      minutes: 60,
      customerType: "MEMBER",
      mode: "EXCLUSIVE",
      freeMinutesAvailable: 0,
      ...tarifas,
    });
    expect(q.hourlyPriceMinor).toBe(200_000);
  });

  it("no socio exclusivo paga la tarifa exclusiva de no socio", () => {
    const q = quoteBooking({
      minutes: 60,
      customerType: "NON_MEMBER",
      mode: "EXCLUSIVE",
      freeMinutesAvailable: 0,
      ...tarifas,
    });
    expect(q.hourlyPriceMinor).toBe(400_000);
  });

  it("las horas libres son horas, no horas compartidas: valen más en exclusivo", () => {
    // 3 horas exclusivas con 2 bonificadas: se descuentan las mismas 2 horas y lo que se
    // ahorra es más, porque la tarifa es más alta.
    const q = quoteBooking({
      minutes: 180,
      customerType: "MEMBER",
      mode: "EXCLUSIVE",
      freeMinutesAvailable: 120,
      ...tarifas,
    });
    expect(q.freeMinutesUsed).toBe(120);
    expect(q.billedMinutes).toBe(60);
    expect(q.totalMinor).toBe(200_000);
  });

  it("sin precio exclusivo cargado, el exclusivo NO se regala: cae en la tarifa normal", () => {
    // Es una red por si un espacio quedó a medio configurar. El formulario ya lo impide.
    const q = quoteBooking({
      minutes: 60,
      customerType: "MEMBER",
      mode: "EXCLUSIVE",
      freeMinutesAvailable: 0,
      ...tarifas,
      exclusiveMemberHourlyPriceMinor: null,
    });
    expect(q.hourlyPriceMinor).toBe(100_000);
  });

  it("el desglose dice que es exclusivo", () => {
    const q = quoteBooking({
      minutes: 60,
      customerType: "MEMBER",
      mode: "EXCLUSIVE",
      freeMinutesAvailable: 0,
      ...tarifas,
    });
    expect(describeQuote(q, 60, "EXCLUSIVE").join(" ")).toContain("exclusivo");
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

```bash
npx vitest run lib/bookings/pricing
```

Esperado: FALLA por `mode` desconocido en el input.

- [ ] **Step 3: Implementar**

En `lib/bookings/pricing.ts`, agregar al input de `quoteBooking`:

```ts
  mode: BookingMode;
  /** null cuando el espacio no tiene precio exclusivo cargado. */
  exclusiveMemberHourlyPriceMinor?: number | null;
  exclusiveNonMemberHourlyPriceMinor?: number | null;
```

Reemplazar el cálculo de `hourlyPriceMinor` por:

```ts
  // Cuatro tarifas: socio y no socio, compartido y exclusivo. Un precio exclusivo sin
  // cargar cae en la tarifa normal y no en cero: un espacio a medio configurar tiene que
  // cobrar de menos, nunca regalar. El formulario del espacio ya impide llegar así.
  const normal =
    input.customerType === "MEMBER"
      ? input.memberHourlyPriceMinor
      : input.nonMemberHourlyPriceMinor;
  const exclusiva =
    input.customerType === "MEMBER"
      ? input.exclusiveMemberHourlyPriceMinor
      : input.exclusiveNonMemberHourlyPriceMinor;
  const hourlyPriceMinor =
    input.mode === "EXCLUSIVE" && typeof exclusiva === "number" && exclusiva > 0
      ? exclusiva
      : normal;
```

Y cambiar `describeQuote` para que reciba el modo:

```ts
export function describeQuote(quote: Quote, minutes: number, mode: BookingMode): string[] {
  const lineas: string[] = [];

  if (mode === "EXCLUSIVE") lineas.push("Uso exclusivo del espacio");
```

Importar `BookingMode` de `./availability`.

- [ ] **Step 4: Correr los tests y verificar que pasan**

```bash
npx vitest run lib/bookings/pricing
```

Esperado: PASA. Los tests viejos necesitan `mode: "SHARED"` y el tercer argumento de `describeQuote`.

- [ ] **Step 5: Commit**

```bash
git add lib/bookings/pricing.ts lib/bookings/pricing.test.ts
git commit -m "El precio por hora depende de si el espacio se comparte o no"
```

---

## Task 7: Crear la reserva elige un lugar y reintenta

**Files:**
- Modify: `lib/bookings/create.ts`
- Test: `lib/bookings/create.test.ts`

**Interfaces:**
- Consumes: `pickSeatRange` de `./seats` (Tarea 3); `checkRange`, `seatsRequested` de `./availability` (Tarea 2); `busyFromSources` de `./busy` (Tarea 4); `quoteBooking` con `mode` (Tarea 6).
- Produces: `CreateBookingInput` gana `mode: BookingMode`. La reserva se guarda con `seatFrom`, `seatTo` y `exclusive`.

- [ ] **Step 1: Escribir el test que falla**

Agregar a `lib/bookings/create.test.ts`:

```ts
import { nextSeatAttempt } from "./create";

describe("reintentar cuando otro tomó el lugar en el medio", () => {
  it("acumula los lugares que chocaron y pide el siguiente", () => {
    // Un choque en una compartida no significa "no hay lugar": significa que ESE lugar se
    // ocupó un instante antes. Recién cuando no queda ninguno se informa que está lleno.
    expect(nextSeatAttempt({ mode: "SHARED", capacity: 4, intentados: [] })).toEqual([]);
    expect(nextSeatAttempt({ mode: "SHARED", capacity: 4, intentados: [0] })).toEqual([0]);
    // Un choque en el lugar 1 excluye el 1, no el primero de la lista.
    expect(nextSeatAttempt({ mode: "SHARED", capacity: 4, intentados: [1] })).toEqual([1]);
  });

  it("se rinde después de tantos intentos como lugares", () => {
    expect(nextSeatAttempt({ mode: "SHARED", capacity: 4, intentados: [0, 1, 2, 3] })).toBeNull();
  });

  it("una exclusiva no reintenta: si chocó, hay alguien y no va a dejar de haber", () => {
    expect(nextSeatAttempt({ mode: "EXCLUSIVE", capacity: 4, intentados: [0] })).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
npx vitest run lib/bookings/create
```

Esperado: FALLA con `nextSeatAttempt is not a function`.

- [ ] **Step 3: Implementar el reintento**

En `lib/bookings/create.ts`, agregar la función exportada:

```ts
/**
 * ¿Vale la pena volver a intentar, y excluyendo qué?
 *
 * Devuelve la lista de lugares a excluir en el próximo intento, o `null` para rendirse.
 *
 * Una compartida que choca no está llena: alguien tomó ESE lugar entre que se calculó y se
 * insertó. Se prueba con otro, hasta agotar la capacidad. Una exclusiva que choca sí está
 * perdida — pidió el espacio entero y hay alguien —, así que no reintenta.
 */
export function nextSeatAttempt(input: {
  mode: BookingMode;
  capacity: number;
  intentados: readonly number[];
}): number[] | null {
  if (input.mode === "EXCLUSIVE") return input.intentados.length === 0 ? [] : null;
  const cupo =
    Number.isFinite(input.capacity) && input.capacity > 0 ? Math.floor(input.capacity) : 1;
  return input.intentados.length >= cupo ? null : [...input.intentados];
}
```

- [ ] **Step 4: Usar el modo y el lugar al crear**

En `CreateBookingInput`, agregar `mode: BookingMode`.

En la validación temprana, después del control de `allowsNonMembers`:

```ts
  // Un espacio que no se comparte no admite pedidos de exclusividad: no significan nada y
  // aceptarlos cobraría la tarifa exclusiva por lo mismo que ya se alquila entero.
  const modo: BookingMode = espacio.capacity > 1 ? input.mode : "SHARED";
```

Pasarle `mode: modo` y las dos tarifas exclusivas a `quoteBooking`:

```ts
    mode: modo,
    exclusiveMemberHourlyPriceMinor: espacio.exclusiveMemberHourlyPriceMinor,
    exclusiveNonMemberHourlyPriceMinor: espacio.exclusiveNonMemberHourlyPriceMinor,
```

Envolver la transacción en el bucle de reintento. Reemplazar el `try { const creada = await prisma.$transaction(...) }` por:

```ts
  const intentados: number[] = [];
  let ultimoError: unknown = null;

  for (;;) {
    // El lugar que se va a intentar en esta vuelta. Se anota adentro de la transacción y
    // se lee en el catch: excluir `intentados.length` en vez del lugar real haría que un
    // choque en el lugar 1 excluyera el 0, que ya estaba tomado, y la vuelta siguiente
    // volvería a proponer el 1 para siempre.
    let intentado: number | null = null;
    const excluir = nextSeatAttempt({ mode: modo, capacity: espacio.capacity, intentados });
    if (excluir === null) {
      // Se agotaron los lugares. El motivo que corresponde según el modo, no un genérico.
      if (ultimoError !== null && !isOverlapConstraintError(ultimoError)) throw ultimoError;
      return {
        ok: false,
        error: rejectionMessage(modo === "EXCLUSIVE" ? "SIN_EXCLUSIVIDAD" : "OCUPADO"),
      };
    }

    try {
      const creada = await prisma.$transaction(async (tx) => {
        const ocupacion = await tx.booking.findMany({
          where: {
            workspaceId: input.workspaceId,
            spaceId: { in: bloquean },
            status: { in: [...ACTIVE_BOOKING_STATUSES] },
            startAt: { lt: input.range.endAt },
            endAt: { gt: input.range.startAt },
          },
          select: { startAt: true, endAt: true, spaceId: true, seatFrom: true, seatTo: true },
        });

        const cierres = await tx.bookingClosure.findMany({
          where: {
            workspaceId: input.workspaceId,
            OR: [{ spaceId: null }, { spaceId: input.spaceId }],
            startAt: { lt: input.range.endAt },
            endAt: { gt: input.range.startAt },
          },
          select: { startAt: true, endAt: true },
        });

        const veredicto = checkRange(input.range, {
          space: espacio.rules,
          weeklyHours: espacio.weeklyHours,
          closures: cierres,
          busy: busyFromSources({
            capacity: espacio.capacity,
            spaceId: input.spaceId,
            bookings: ocupacion,
            calendarBlocks: [],
          }),
          mode: modo,
          now,
          timeZone: BOOKINGS_TIME_ZONE,
        });
        if (!veredicto.ok) throw new BookingRejected(rejectionMessage(veredicto.reason));

        // Solo los lugares del PROPIO espacio son elegibles: los de un espacio incompatible
        // son números de otra numeración y ya taparon todo en `busyFromSources`.
        const lugar = pickSeatRange({
          mode: modo,
          capacity: espacio.capacity,
          range: input.range,
          taken: ocupacion.filter((o) => o.spaceId === input.spaceId),
          exclude: excluir,
        });
        if (lugar === null) {
          throw new BookingRejected(
            rejectionMessage(modo === "EXCLUSIVE" ? "SIN_EXCLUSIVIDAD" : "OCUPADO"),
          );
        }
        intentado = lugar.seatFrom;

        const reserva = await tx.booking.create({
          data: {
            // …todo lo que ya estaba, sin cambios…
            seatFrom: lugar.seatFrom,
            seatTo: lugar.seatTo,
            exclusive: modo === "EXCLUSIVE",
          },
          select: { id: true },
        });

        // …el resto de la transacción, sin cambios (extras, etc.)…

        return { id: reserva.id, seatFrom: lugar.seatFrom };
      });

      return { ok: true, bookingId: creada.id };
    } catch (error) {
      // Un choque de la base en una compartida puede ser solo que ese lugar se ocupó recién.
      if (isOverlapConstraintError(error)) {
        ultimoError = error;
        // Se excluye el lugar que realmente se intentó, no un contador.
        intentados.push(intentado ?? intentados.length);
        continue;
      }
      throw error;
    }
  }
```

**Nota para quien implemente:** el bloque `catch` que hoy traduce `BookingRejected` y `isOverlapConstraintError` a `{ ok: false, error }` sigue existiendo alrededor del bucle. No duplicarlo: mover el bucle **adentro** del `try` externo que ya está, y dejar el `catch` externo tal como está.

- [ ] **Step 5: Correr los tests y verificar que pasan**

```bash
npx vitest run lib/bookings && npx tsc --noEmit -p tsconfig.json
```

Esperado: PASA. Los llamadores de `createBooking` van a protestar por `mode`: agregarles `mode: "SHARED"` por ahora; la Tarea 9 los conecta al selector de verdad.

- [ ] **Step 6: Commit**

```bash
git add lib/bookings/create.ts lib/bookings/create.test.ts
git commit -m "Crear una reserva elige su lugar, y reintenta si otro lo tomó primero"
```

---

## Task 8: La institución configura capacidad y precio exclusivo

**Files:**
- Modify: `lib/bookings/space-form.ts`, `app/(shell)/reservas/espacios/space-form.tsx`, `app/(shell)/reservas/actions.ts`
- Test: `lib/bookings/space-form.test.ts`

**Interfaces:**
- Consumes: `parseArsToMinor` (ya existe en el mismo archivo).
- Produces: `SpaceFormValues` gana `capacity: number`, `exclusiveMemberHourlyPriceMinor: number | null`, `exclusiveNonMemberHourlyPriceMinor: number | null`.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar a `lib/bookings/space-form.test.ts`. Reutilizar el helper que arma el `FormData` válido que ya tiene el archivo; si se llama distinto, adaptar el nombre:

```ts
describe("capacidad y precio exclusivo", () => {
  it("sin capacidad declarada asume 1: el espacio se alquila entero", () => {
    const r = parseSpaceForm(formularioValido());
    expect(r.ok && r.values.capacity).toBe(1);
  });

  it("capacidad 0 o negativa no se acepta", () => {
    const fd = formularioValido();
    fd.set("capacity", "0");
    const r = parseSpaceForm(fd);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("capacidad");
  });

  it("con capacidad mayor que 1 exige el precio exclusivo de socio", () => {
    const fd = formularioValido();
    fd.set("capacity", "4");
    const r = parseSpaceForm(fd);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("exclusivo");
  });

  it("con capacidad mayor que 1 y los precios cargados, entra", () => {
    const fd = formularioValido();
    fd.set("capacity", "4");
    fd.set("exclusiveMemberHourlyPriceArs", "20.000");
    fd.set("exclusiveNonMemberHourlyPriceArs", "40.000");
    fd.set("allowsNonMembers", "on");
    const r = parseSpaceForm(fd);
    expect(r.ok).toBe(true);
    expect(r.ok && r.values.exclusiveMemberHourlyPriceMinor).toBe(2_000_000);
    expect(r.ok && r.values.exclusiveNonMemberHourlyPriceMinor).toBe(4_000_000);
  });

  it("si el espacio NO admite no socios, no pide el precio exclusivo de no socio", () => {
    // El coworking es solo para socios: pedir ese dato sería pedir algo que no significa nada.
    const fd = formularioValido();
    fd.set("capacity", "4");
    fd.set("exclusiveMemberHourlyPriceArs", "20.000");
    fd.delete("allowsNonMembers");
    const r = parseSpaceForm(fd);
    expect(r.ok).toBe(true);
    expect(r.ok && r.values.exclusiveNonMemberHourlyPriceMinor).toBeNull();
  });

  it("con capacidad 1 los precios exclusivos se descartan", () => {
    const fd = formularioValido();
    fd.set("capacity", "1");
    fd.set("exclusiveMemberHourlyPriceArs", "20.000");
    const r = parseSpaceForm(fd);
    expect(r.ok && r.values.exclusiveMemberHourlyPriceMinor).toBeNull();
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

```bash
npx vitest run lib/bookings/space-form
```

Esperado: FALLA porque `capacity` no existe en `SpaceFormValues`.

- [ ] **Step 3: Implementar la validación**

En `lib/bookings/space-form.ts`, agregar a `SpaceFormValues`:

```ts
  capacity: number;
  exclusiveMemberHourlyPriceMinor: number | null;
  exclusiveNonMemberHourlyPriceMinor: number | null;
```

Y en `parseSpaceForm`, después de leer los dos precios normales:

```ts
  const capacity = entero(formData.get("capacity") as string | null, 1);
  if (capacity < 1) {
    return { ok: false, error: "La capacidad tiene que ser de al menos una persona." };
  }

  const admiteNoSocios = formData.get("allowsNonMembers") !== null;

  // Los precios exclusivos solo existen donde el espacio se comparte. En un espacio de
  // capacidad 1 se descartan: guardarlos dejaría un dato que nada lee y que la próxima
  // persona que abra el formulario no sabría interpretar.
  let exclusiveMemberHourlyPriceMinor: number | null = null;
  let exclusiveNonMemberHourlyPriceMinor: number | null = null;

  if (capacity > 1) {
    exclusiveMemberHourlyPriceMinor = parseArsToMinor(
      String(formData.get("exclusiveMemberHourlyPriceArs") ?? ""),
    );
    if (exclusiveMemberHourlyPriceMinor === null) {
      return {
        ok: false,
        error:
          "Un espacio que se comparte necesita un precio de uso exclusivo para socios; sin él, se regalaría.",
      };
    }

    if (admiteNoSocios) {
      exclusiveNonMemberHourlyPriceMinor = parseArsToMinor(
        String(formData.get("exclusiveNonMemberHourlyPriceArs") ?? ""),
      );
      if (exclusiveNonMemberHourlyPriceMinor === null) {
        return {
          ok: false,
          error:
            "Este espacio admite no socios, así que también necesita un precio de uso exclusivo para ellos.",
        };
      }
    }
  }
```

Agregarlos al objeto `values` que devuelve.

- [ ] **Step 4: Correr los tests y verificar que pasan**

```bash
npx vitest run lib/bookings/space-form
```

Esperado: PASA.

- [ ] **Step 5: Agregar los campos a la pantalla**

En `app/(shell)/reservas/espacios/space-form.tsx`, junto a los campos de precio que ya están:

```tsx
<label className="fo-label" htmlFor="capacity">
  Capacidad
  <input
    id="capacity"
    name="capacity"
    type="number"
    min={1}
    defaultValue={espacio?.capacity ?? 1}
    className="fo-input"
  />
  <span className="fo-helper">
    Cuántas personas pueden usarlo a la vez. 1 significa que se alquila entero.
  </span>
</label>

<label className="fo-label" htmlFor="exclusiveMemberHourlyPriceArs">
  Precio exclusivo socio, por hora
  <input
    id="exclusiveMemberHourlyPriceArs"
    name="exclusiveMemberHourlyPriceArs"
    defaultValue={
      espacio?.exclusiveMemberHourlyPriceMinor === null ||
      espacio?.exclusiveMemberHourlyPriceMinor === undefined
        ? ""
        : formatMinorArsPlain(espacio.exclusiveMemberHourlyPriceMinor)
    }
    className="fo-input"
  />
  <span className="fo-helper">
    Lo que sale pedir el espacio para uso exclusivo. Solo hace falta si la capacidad es mayor que 1.
  </span>
</label>
```

Y el equivalente para `exclusiveNonMemberHourlyPriceArs`. Usar el mismo formateador que ya usan los campos de precio del formulario; si el archivo tiene un helper local en vez de `formatMinorArsPlain`, usar ese.

- [ ] **Step 6: Guardar los campos nuevos en la acción**

En `app/(shell)/reservas/actions.ts`, en las acciones de crear y de editar espacio, agregar al `data` de Prisma:

```ts
        capacity: values.capacity,
        exclusiveMemberHourlyPriceArs:
          values.exclusiveMemberHourlyPriceMinor === null
            ? null
            : minorToDecimalString(values.exclusiveMemberHourlyPriceMinor),
        exclusiveNonMemberHourlyPriceArs:
          values.exclusiveNonMemberHourlyPriceMinor === null
            ? null
            : minorToDecimalString(values.exclusiveNonMemberHourlyPriceMinor),
```

- [ ] **Step 7: Verificar en el navegador**

Levantar el servidor con `preview_start` (`fotoffice-dev`), entrar a `/reservas/espacios`, editar el coworking, poner capacidad 4 sin precio exclusivo y guardar. Esperado: el mensaje de que falta el precio exclusivo. Después cargarlo y guardar. Esperado: guarda.

- [ ] **Step 8: Commit**

```bash
git add lib/bookings/space-form.ts lib/bookings/space-form.test.ts "app/(shell)/reservas/espacios/space-form.tsx" "app/(shell)/reservas/actions.ts"
git commit -m "La institución fija la capacidad y el precio del uso exclusivo"
```

---

## Task 9: El selector de modo en el portal y en la pantalla pública

**Files:**
- Modify: `lib/bookings/portal.ts`, `app/portal/reservas/page.tsx`, `app/portal/reservas/reservar-form.tsx`, `app/portal/reservas/actions.ts`, `app/w/[workspaceSlug]/reservas/[spaceId]/page.tsx`, `app/w/[workspaceSlug]/reservas/[spaceId]/public-form.tsx`, `app/w/[workspaceSlug]/reservas/actions.ts`
- Test: `lib/bookings/portal.test.ts`

**Interfaces:**
- Consumes: `loadAvailabilityContext` con `mode` (Tarea 4); `computeAvailability` devolviendo `AvailableSlot[]` (Tarea 5); `buildWeekGrid` con `capacity` (Tarea 5); `quoteBooking` con `mode` (Tarea 6); `createBooking` con `mode` (Tarea 7).
- Produces: `loadPortalOffer` gana `mode: BookingMode` en su input; `PortalBookingOffer` gana `capacity: number` y `mode: BookingMode`.

- [ ] **Step 1: Nada que probar con vitest en esta tarea**

`portal.ts` y las pantallas son pegamento sobre base y sobre Next: lo que hay que probar
—qué tarifa se aplica, qué lugar toca, cuándo se rechaza— ya está cubierto por los tests
puros de las Tareas 2, 3, 6 y 7. Acá la verificación es en el navegador (Step 6). No
inventar dobles de Prisma para esta tarea: costarían más de lo que protegen.

- [ ] **Step 2: Propagar el modo en `loadPortalOffer`**

En `lib/bookings/portal.ts`: agregar `mode: BookingMode` al input, pasarlo como quinto argumento de `loadAvailabilityContext`, pasarlo a `quoteBooking` junto a las dos tarifas exclusivas del espacio, y agregar `capacity: space.capacity` y `mode` al objeto que devuelve.

- [ ] **Step 3: Leer el modo de la URL en las dos pantallas**

En `app/portal/reservas/page.tsx` y en `app/w/[workspaceSlug]/reservas/[spaceId]/page.tsx`, agregar `modo` a `searchParams`:

```ts
  // El modo va en la URL y no en estado del cliente: así la grilla se recalcula en el
  // servidor con los mismos datos que después valida la reserva, y el enlace se puede
  // compartir tal como se está viendo.
  const mode: BookingMode = query.modo === "exclusivo" ? "EXCLUSIVE" : "SHARED";
```

Pasarlo a `loadPortalOffer` y a `buildWeekGrid` (que además necesita `capacity: oferta.space.capacity`).

- [ ] **Step 4: Dibujar el selector**

En `reservar-form.tsx` y en `public-form.tsx`, arriba de la grilla y solo si `capacity > 1`:

```tsx
{capacity > 1 ? (
  <div className="flex flex-wrap gap-2" role="group" aria-label="Cómo querés usar el espacio">
    <Link
      href={`?modo=compartido&semana=${semanaISO}`}
      aria-current={mode === "SHARED" ? "true" : undefined}
      className={mode === "SHARED" ? "fo-btn fo-btn-primary" : "fo-btn fo-btn-secondary"}
    >
      Compartido — hasta {capacity} personas
    </Link>
    <Link
      href={`?modo=exclusivo&semana=${semanaISO}`}
      aria-current={mode === "EXCLUSIVE" ? "true" : undefined}
      className={mode === "EXCLUSIVE" ? "fo-btn fo-btn-primary" : "fo-btn fo-btn-secondary"}
    >
      Uso exclusivo — el espacio para vos
    </Link>
  </div>
) : null}
```

Son enlaces y no botones a propósito: el modo vive en la URL.

Cambiar de modo recarga la pantalla y **descarta el rango que estaba elegido**. Que no
desaparezca en silencio: debajo del selector, cuando la URL trae `modo` y no hay rango
elegido, mostrar `<p className="fo-helper">Cambiaste de modo, así que elegí el horario de
nuevo.</p>`.

En cada celda `FREE`, cuando `mode === "SHARED"` y `capacity > 1`, mostrar el remanente:

```tsx
{cell.state === "FREE" && mode === "SHARED" && capacity > 1 ? (
  <span className="text-[10px] text-[var(--fo-muted)]">
    {cell.seatsFree} de {capacity}
  </span>
) : null}
```

- [ ] **Step 5: Actualizar a quien llama a `describeQuote`**

Su firma pasó a `describeQuote(quote, minutes, mode)` en la Tarea 6. Buscar los llamadores
y pasarles el modo:

```bash
grep -rn 'describeQuote' --include='*.ts' --include='*.tsx' lib app | grep -v '.test.'
```

- [ ] **Step 6: Mandar el modo al reservar**

En los dos formularios agregar `<input type="hidden" name="modo" value={mode === "EXCLUSIVE" ? "exclusivo" : "compartido"} />`, y en las dos acciones (`app/portal/reservas/actions.ts` y `app/w/[workspaceSlug]/reservas/actions.ts`) leerlo y pasarlo a `createBooking`:

```ts
  const mode: BookingMode = String(formData.get("modo") ?? "") === "exclusivo" ? "EXCLUSIVE" : "SHARED";
```

- [ ] **Step 7: Verificar en el navegador**

Con el coworking en capacidad 4 y precios exclusivos cargados:

1. Entrar al portal, elegir el coworking. Esperado: aparece el selector.
2. En compartido, reservar una hora. Esperado: entra y la celda pasa a decir "3 de 4".
3. Cambiar a exclusivo. Esperado: esa celda aparece no disponible.
4. Elegir otra hora entera libre en exclusivo. Esperado: cotiza con la tarifa exclusiva.
5. Entrar al estudio. Esperado: **no** aparece el selector.

Sacar captura de la grilla en los dos modos.

- [ ] **Step 8: Commit**

```bash
git add lib/bookings/portal.ts app/portal/reservas app/w
git commit -m "El socio elige compartido o exclusivo, y la grilla se recalcula"
```

---

## Task 10: El evento del calendario dice el modo

**Files:**
- Modify: `lib/bookings/calendar/event-content.ts`, `lib/bookings/calendar/sync.ts`
- Test: `lib/bookings/calendar/event-content.test.ts`

**Interfaces:**
- Consumes: `CalendarEventData` (ya existe).
- Produces: `CalendarEventData` gana `exclusive: boolean`, `capacity: number` y `seats: number`.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar a `lib/bookings/calendar/event-content.test.ts`:

```ts
describe("el evento dice si el espacio queda ocupado entero", () => {
  const compartida = { ...socio, capacity: 4, seats: 1, exclusive: false };
  const exclusiva = { ...socio, capacity: 4, seats: 4, exclusive: true };

  it("el título de una exclusiva lo avisa", () => {
    // De esto depende que la Secretaría no meta a nadie más en ese horario.
    expect(buildEventSummary(exclusiva)).toContain("(exclusivo)");
  });

  it("el título de una compartida no dice nada del modo", () => {
    expect(buildEventSummary(compartida)).not.toContain("exclusivo");
  });

  it("la descripción de una compartida dice cuántos lugares toma", () => {
    expect(buildEventDescription(compartida)).toContain("Compartido · 1 de 4 lugares");
  });

  it("la descripción de una exclusiva lo dice sin números", () => {
    expect(buildEventDescription(exclusiva)).toContain("Uso exclusivo");
  });

  it("en un espacio de capacidad 1 no se menciona el modo: sería ruido", () => {
    const solo = { ...socio, capacity: 1, seats: 1, exclusive: false };
    expect(buildEventSummary(solo)).not.toContain("exclusivo");
    expect(buildEventDescription(solo)).not.toContain("Compartido");
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

```bash
npx vitest run lib/bookings/calendar/event-content
```

Esperado: FALLA por los campos nuevos.

- [ ] **Step 3: Implementar**

En `lib/bookings/calendar/event-content.ts`, agregar a `CalendarEventData`:

```ts
  /** Capacidad del espacio. Con 1 no se menciona el modo: sería ruido. */
  capacity: number;
  seats: number;
  exclusive: boolean;
```

En `buildEventSummary`, después de calcular `socio`:

```ts
  const modo = data.capacity > 1 && data.exclusive ? " (exclusivo)" : "";
  return `${data.spaceName}${modo} — ${data.contactName}${socio}`;
```

En `buildEventDescription`, después de la línea del email:

```ts
  if (data.capacity > 1) {
    lineas.push(
      data.exclusive
        ? "Uso exclusivo — no anotar a nadie más en este horario"
        : `Compartido · ${data.seats} de ${data.capacity} lugares`,
    );
  }
```

- [ ] **Step 4: Alimentarlo desde el sincronizador**

En `lib/bookings/calendar/sync.ts`, agregar al `select` de `pushPendingEvents`:

```ts
      seatFrom: true,
      seatTo: true,
      exclusive: true,
      space: { select: { name: true, googleCalendarId: true, capacity: true } },
```

Y al objeto `contenido`:

```ts
        capacity: r.space.capacity,
        seats: Math.max(1, r.seatTo - r.seatFrom),
        exclusive: r.exclusive,
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

```bash
npx vitest run lib/bookings/calendar && npx tsc --noEmit -p tsconfig.json
```

Esperado: PASA. Los tests viejos de `event-content` necesitan `capacity: 1, seats: 1, exclusive: false` en su objeto base.

- [ ] **Step 6: Commit**

```bash
git add lib/bookings/calendar/event-content.ts lib/bookings/calendar/event-content.test.ts lib/bookings/calendar/sync.ts
git commit -m "El evento del calendario avisa si el espacio queda ocupado entero"
```

---

## Task 11: La Comisión ve y carga el modo

**Files:**
- Modify: `app/(shell)/reservas/page.tsx`, `app/(shell)/reservas/nueva/page.tsx`, `app/(shell)/reservas/actions.ts`, `lib/bookings/repository.ts` (`BookingRow`)

**Interfaces:**
- Consumes: `createBooking` con `mode` (Tarea 7); `listBookingsInRange` (ya existe).
- Produces: `BookingRow` gana `seatFrom: number`, `seatTo: number`, `exclusive: boolean`.

- [ ] **Step 1: Leer el modo en el repositorio**

En `lib/bookings/repository.ts`, agregar a `BookingRow` los tres campos y al `select` de `listBookingsInRange` los tres nombres.

- [ ] **Step 2: Mostrarlo en el panel**

En `app/(shell)/reservas/page.tsx`, en cada fila de reserva, junto al nombre del espacio:

```tsx
{reserva.exclusive ? (
  <span className="rounded bg-[var(--fo-accent-soft)] px-1.5 py-0.5 text-[10px] font-medium">
    exclusivo
  </span>
) : null}
```

- [ ] **Step 3: Ofrecer el selector en la carga manual**

En `app/(shell)/reservas/nueva/page.tsx`, agregar un `<select name="modo">` con "Compartido" y "Uso exclusivo", visible solo para los espacios de capacidad mayor que 1. En `app/(shell)/reservas/actions.ts`, leerlo y pasarlo a `createBooking` igual que en la Tarea 9.

- [ ] **Step 4: Verificar en el navegador**

Cargar a mano una reserva exclusiva del coworking. Esperado: aparece con la etiqueta "exclusivo" en el panel, y ninguna otra reserva entra en ese horario.

- [ ] **Step 5: Correr toda la suite y comprobar tipos**

```bash
npx vitest run lib/ && npx tsc --noEmit -p tsconfig.json
```

Esperado: todo verde salvo `lib/template-v2/access.test.ts`, que está roto desde el commit 35c52837 y es ajeno a esto.

- [ ] **Step 6: Commit**

```bash
git add "app/(shell)/reservas" lib/bookings/repository.ts
git commit -m "La Comisión ve y carga reservas exclusivas"
```

---

## Verificación final, ya con todo junto

- [ ] **Paso 1: Cargar la configuración real**

Coworking: capacidad 4, precio exclusivo de socio a criterio de la institución. Sigue siendo solo para socios (`allowsNonMembers` apagado), así que no lleva precio exclusivo de no socio.

- [ ] **Paso 2: La prueba que importa, con dos personas de verdad**

1. Socio A reserva el coworking compartido, jueves 10 a 11. Esperado: entra en el lugar 0.
2. Socio B reserva el mismo horario compartido. Esperado: entra en el lugar 1, y la celda dice "2 de 4".
3. Socio C pide ese horario exclusivo. Esperado: aparece no disponible.
4. Socio C pide el viernes 10 a 11 exclusivo. Esperado: entra, con la tarifa exclusiva.
5. Socio D intenta el viernes 10 a 11 compartido. Esperado: no disponible.

Comprobar en la base:

```sql
SELECT s.name, b."contactName", b."seatFrom", b."seatTo", b.exclusive, b."totalArs"
FROM "Booking" b JOIN "BookingSpace" s ON s.id = b."spaceId"
WHERE b."workspaceId" = 'ws_sfpr_seed' AND b.status IN ('HOLD','PENDING_APPROVAL','CONFIRMED')
ORDER BY b."startAt", b."seatFrom";
```

- [ ] **Paso 3: El calendario**

Esperar una corrida del cron (10 minutos) o disparar la sincronización. Esperado: en el calendario del coworking aparecen dos eventos para el jueves —uno por socio, cada uno diciendo "Compartido · 1 de 4 lugares"— y uno solo el viernes, con "(exclusivo)" en el título.

- [ ] **Paso 4: Que el estudio y el salón no cambiaron**

Reservar el estudio. Esperado: no aparece el selector, y una segunda reserva del mismo horario se rechaza como siempre.
