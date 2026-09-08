# Reservas (núcleo) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la institución dé de alta sus espacios —con horarios, tarifas, reglas de convivencia y los extras que se alquilan junto con ellos— y que el equipo vea y gestione la ocupación desde una agenda, reemplazando la planilla. Todavía sin cobro online.

**Architecture:** El corazón es un motor de disponibilidad **puro** (sin base y sin red) que recibe horarios, cierres, ocupación e incompatibilidades y devuelve los huecos libres. Alrededor, un modelo de datos con una restricción en la propia base que hace imposible guardar dos reservas superpuestas, y pantallas que solo orquestan.

**Tech Stack:** Next.js 16 (App Router, Server Components y Server Actions), Prisma sobre Postgres (Neon), vitest, TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-07-reservas-e-integraciones-design.md` (Parte 2)

**Plan hermano:** el cobro, las horas bonificadas del socio y la reserva desde el portal van en un segundo plan. Este deja el sistema entero y usable sin ellos.

## Global Constraints

- **Directorio de trabajo:** `apps/fotoffice`. Rutas relativas a ahí, salvo `packages/db/prisma/schema.prisma`.
- **Tests:** `pnpm test`. Solo levanta `lib/**/*.test.ts` y `app/**/*.test.ts`.
- **Dinero en centavos y con enteros.** Nunca coma flotante. Se guarda `Decimal(12,2)` en la base y se opera en centavos con los helpers de `lib/membership/money.ts` (`decimalArsToMinor`, `minorToDecimalString`, `formatMinorArs`).
- **Tiempo:** todo se guarda en UTC. Se muestra e interpreta en `America/Argentina/Buenos_Aires`. La zona es un **parámetro**, nunca una constante escondida en el medio de un cálculo.
- **Estilos:** clases del design system (`fo-card`, `fo-btn`, `fo-input`, `fo-label`, `fo-alert-*`) y variables `--fo-*`. Nunca colores crudos de Tailwind.
- **Permisos:** Agenda es STAFF+; Espacios y Tarifas son ADMIN+. Se verifica **en el servidor, en cada request**. Esconder el link no es control de acceso.
- **Idioma:** comentarios, errores y pantallas en castellano rioplatense.
- **Commits:** una oración que dice qué queda funcionando. Firma:
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  ```

---

### Task 1: Reglas de tiempo

Convertir un instante a "qué día de la semana y qué minuto del día es en Rosario" es el cálculo del que dependen todos los demás. Va aislado y probado, incluso contra el cambio de horario.

**Files:**
- Create: `lib/bookings/time.ts`
- Test: `lib/bookings/time.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `BOOKINGS_TIME_ZONE = "America/Argentina/Buenos_Aires"`
  - `type LocalMoment = { weekday: number; minuteOfDay: number; ymd: string }`
  - `type Interval = { startAt: Date; endAt: Date }`
  - `localMoment(at: Date, timeZone: string): LocalMoment`
  - `monthKeyOf(at: Date, timeZone: string): string` — `"2026-09"`
  - `overlaps(a: Interval, b: Interval): boolean`
  - `expandInterval(i: Interval, bufferMinutes: number): Interval`
  - `addMinutes(at: Date, minutes: number): Date`
  - `minuteOfDayToLabel(minute: number): string` — `540 → "09:00"`

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/bookings/time.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  BOOKINGS_TIME_ZONE,
  addMinutes,
  expandInterval,
  localMoment,
  minuteOfDayToLabel,
  monthKeyOf,
  overlaps,
} from "./time";

const tz = BOOKINGS_TIME_ZONE;

describe("el instante visto desde Rosario", () => {
  it("un sábado a las 14 de Rosario es sábado a las 14", () => {
    // 2026-09-19T17:00Z = sábado 19/09 14:00 en Argentina (UTC-3).
    const m = localMoment(new Date("2026-09-19T17:00:00Z"), tz);
    expect(m.weekday).toBe(6);
    expect(m.minuteOfDay).toBe(14 * 60);
    expect(m.ymd).toBe("2026-09-19");
  });

  it("el domingo es 0 y el lunes es 1", () => {
    expect(localMoment(new Date("2026-09-20T15:00:00Z"), tz).weekday).toBe(0);
    expect(localMoment(new Date("2026-09-21T15:00:00Z"), tz).weekday).toBe(1);
  });

  it("las 23:30 UTC del domingo todavía son domingo en Rosario", () => {
    // Sin la conversión, un cálculo hecho en UTC diría lunes y correría el horario un día.
    const m = localMoment(new Date("2026-09-21T02:00:00Z"), tz);
    expect(m.weekday).toBe(0);
    expect(m.minuteOfDay).toBe(23 * 60);
  });

  it("la medianoche exacta es el minuto cero", () => {
    expect(localMoment(new Date("2026-09-19T03:00:00Z"), tz).minuteOfDay).toBe(0);
  });
});

describe("el mes al que pertenece un instante", () => {
  it("usa el mes de Rosario, no el de UTC", () => {
    // 2026-10-01T01:00Z es todavía 30 de septiembre en Argentina.
    expect(monthKeyOf(new Date("2026-10-01T01:00:00Z"), tz)).toBe("2026-09");
    expect(monthKeyOf(new Date("2026-10-01T05:00:00Z"), tz)).toBe("2026-10");
  });
});

describe("solapamiento", () => {
  const r = (a: string, b: string) => ({ startAt: new Date(a), endAt: new Date(b) });

  it("dos rangos que se pisan se detectan", () => {
    expect(overlaps(r("2026-09-19T14:00:00Z", "2026-09-19T16:00:00Z"), r("2026-09-19T15:00:00Z", "2026-09-19T17:00:00Z"))).toBe(true);
  });

  it("uno adentro del otro también", () => {
    expect(overlaps(r("2026-09-19T14:00:00Z", "2026-09-19T18:00:00Z"), r("2026-09-19T15:00:00Z", "2026-09-19T16:00:00Z"))).toBe(true);
  });

  it("pegados NO se pisan: de 14 a 16 y de 16 a 18 conviven", () => {
    expect(overlaps(r("2026-09-19T14:00:00Z", "2026-09-19T16:00:00Z"), r("2026-09-19T16:00:00Z", "2026-09-19T18:00:00Z"))).toBe(false);
  });

  it("separados no se pisan", () => {
    expect(overlaps(r("2026-09-19T14:00:00Z", "2026-09-19T15:00:00Z"), r("2026-09-19T16:00:00Z", "2026-09-19T17:00:00Z"))).toBe(false);
  });
});

describe("el tiempo de limpieza entre reservas", () => {
  it("agranda el rango para los dos lados", () => {
    const e = expandInterval(
      { startAt: new Date("2026-09-19T14:00:00Z"), endAt: new Date("2026-09-19T16:00:00Z") },
      30,
    );
    expect(e.startAt.toISOString()).toBe("2026-09-19T13:30:00.000Z");
    expect(e.endAt.toISOString()).toBe("2026-09-19T16:30:00.000Z");
  });

  it("sin tiempo de limpieza el rango no cambia", () => {
    const original = { startAt: new Date("2026-09-19T14:00:00Z"), endAt: new Date("2026-09-19T16:00:00Z") };
    expect(expandInterval(original, 0)).toEqual(original);
  });
});

describe("etiquetas", () => {
  it("el minuto del día se lee como hora", () => {
    expect(minuteOfDayToLabel(540)).toBe("09:00");
    expect(minuteOfDayToLabel(0)).toBe("00:00");
    expect(minuteOfDayToLabel(1290)).toBe("21:30");
  });

  it("sumar minutos no rompe el cruce de día", () => {
    expect(addMinutes(new Date("2026-09-19T23:30:00Z"), 60).toISOString()).toBe(
      "2026-09-20T00:30:00.000Z",
    );
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
pnpm test lib/bookings/time.test.ts
```

Esperado: FALLA con `Failed to resolve import "./time"`.

- [ ] **Step 3: Escribir la implementación**

Crear `lib/bookings/time.ts`:

```ts
/**
 * Reglas de tiempo de las reservas. Módulo PURO: sin base y sin red.
 *
 * Todo se guarda en UTC y se interpreta en la zona de la institución. La conversión no es
 * un detalle cosmético: "los sábados de 9 a 13" es una regla escrita en hora local, y
 * evaluarla en UTC corre el horario tres horas y, cerca de la medianoche, un día entero.
 *
 * La zona viaja como parámetro en vez de estar clavada acá. Hoy hay una sola institución y
 * es de Rosario; el día que haya una de otra provincia, esto no se toca.
 */

export const BOOKINGS_TIME_ZONE = "America/Argentina/Buenos_Aires";

export type Interval = { startAt: Date; endAt: Date };

export type LocalMoment = {
  /** 0 domingo … 6 sábado, en la zona pedida. */
  weekday: number;
  /** Minutos desde la medianoche local. 540 = 09:00. */
  minuteOfDay: number;
  /** "2026-09-19", en la zona pedida. */
  ymd: string;
};

const DIAS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Se usa `Intl` y no aritmética de husos porque Argentina cambió de huso más de una vez y
 * podría volver a hacerlo. La base de datos de zonas horarias sabe eso; una resta de tres
 * horas escrita a mano, no.
 */
export function localMoment(at: Date, timeZone: string): LocalMoment {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(at).map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  // `hour12: false` puede devolver "24" para la medianoche según el entorno.
  const hour = Number(parts.hour) % 24;
  const minute = Number(parts.minute);

  return {
    weekday: Math.max(0, DIAS.indexOf(parts.weekday)),
    minuteOfDay: hour * 60 + minute,
    ymd: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

/** "2026-09". El mes al que pertenece un instante EN LA ZONA LOCAL. */
export function monthKeyOf(at: Date, timeZone: string): string {
  return localMoment(at, timeZone).ymd.slice(0, 7);
}

/**
 * Rango medio abierto `[inicio, fin)`: dos reservas pegadas NO se pisan.
 *
 * Es la convención que hace que "de 14 a 16" y "de 16 a 18" puedan convivir, que es lo que
 * cualquiera espera de una agenda. La restricción de la base usa el mismo criterio.
 */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.startAt.getTime() < b.endAt.getTime() && b.startAt.getTime() < a.endAt.getTime();
}

/** El tiempo de limpieza ocupa a los dos lados de la reserva. */
export function expandInterval(interval: Interval, bufferMinutes: number): Interval {
  if (bufferMinutes <= 0) return interval;
  return {
    startAt: addMinutes(interval.startAt, -bufferMinutes),
    endAt: addMinutes(interval.endAt, bufferMinutes),
  };
}

export function addMinutes(at: Date, minutes: number): Date {
  return new Date(at.getTime() + minutes * 60_000);
}

export function minuteOfDayToLabel(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
pnpm test lib/bookings/time.test.ts
```

Esperado: PASA, 13 tests.

- [ ] **Step 5: Commitear**

```bash
git add lib/bookings/time.ts lib/bookings/time.test.ts
git commit -m "$(cat <<'MSG'
Los horarios se leen en la hora de Rosario, no en la del servidor

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 2: El motor de disponibilidad

El corazón del módulo. Recibe todo resuelto y devuelve los huecos libres. Sin base y sin red, para que el caso difícil —"el salón tomado tapa también al estudio"— se pruebe sin levantar nada.

**Files:**
- Create: `lib/bookings/availability.ts`
- Test: `lib/bookings/availability.test.ts`

**Interfaces:**
- Consumes: `Interval`, `localMoment`, `overlaps`, `expandInterval`, `addMinutes` (Task 1).
- Produces:
  - `type SpaceRules = { slotMinutes: number; minBookingMinutes: number; maxBookingMinutes: number | null; bufferMinutes: number; minAdvanceHours: number; maxAdvanceDays: number }`
  - `type WeeklyHour = { weekday: number; startMinute: number; endMinute: number }`
  - `type AvailabilityInput = { space: SpaceRules; range: Interval; weeklyHours: WeeklyHour[]; closures: Interval[]; busy: Interval[]; now: Date; timeZone: string }`
  - `computeAvailability(input: AvailabilityInput): Interval[]`
  - `type RangeCheck = { ok: true } | { ok: false; reason: BookingRejection }`
  - `type BookingRejection = "FUERA_DE_HORARIO" | "OCUPADO" | "CERRADO" | "MUY_SOBRE_LA_HORA" | "DEMASIADO_LEJOS" | "DURACION_INVALIDA" | "RANGO_INVALIDO"`
  - `checkRange(range: Interval, input: Omit<AvailabilityInput, "range">): RangeCheck`
  - `rejectionMessage(reason: BookingRejection): string`

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/bookings/availability.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { BOOKINGS_TIME_ZONE } from "./time";
import { checkRange, computeAvailability, rejectionMessage } from "./availability";

const tz = BOOKINGS_TIME_ZONE;

/** Sábado 19/09/2026. En Argentina (UTC-3) las 09:00 locales son las 12:00Z. */
const local = (dia: number, hora: number, minuto = 0) =>
  new Date(Date.UTC(2026, 8, dia, hora + 3, minuto));

const espacio = {
  slotMinutes: 60,
  minBookingMinutes: 60,
  maxBookingMinutes: null,
  bufferMinutes: 0,
  minAdvanceHours: 2,
  maxAdvanceDays: 90,
};

/** Sábado de 9 a 13. */
const horarios = [{ weekday: 6, startMinute: 9 * 60, endMinute: 13 * 60 }];

const base = {
  space: espacio,
  weeklyHours: horarios,
  closures: [],
  busy: [],
  now: local(15, 10),
  timeZone: tz,
};

const sabado = { startAt: local(19, 0), endAt: local(20, 0) };

describe("los huecos de un día", () => {
  it("el sábado de 9 a 13 da cuatro horas libres", () => {
    const huecos = computeAvailability({ ...base, range: sabado });
    expect(huecos).toHaveLength(4);
    expect(huecos[0].startAt.toISOString()).toBe(local(19, 9).toISOString());
    expect(huecos[3].endAt.toISOString()).toBe(local(19, 13).toISOString());
  });

  it("un día sin horario declarado no tiene huecos", () => {
    const domingo = { startAt: local(20, 0), endAt: local(21, 0) };
    expect(computeAvailability({ ...base, range: domingo })).toHaveLength(0);
  });

  it("una reserva existente tapa su hora y solo esa", () => {
    const huecos = computeAvailability({
      ...base,
      range: sabado,
      busy: [{ startAt: local(19, 10), endAt: local(19, 11) }],
    });
    expect(huecos).toHaveLength(3);
    expect(huecos.some((h) => h.startAt.getTime() === local(19, 10).getTime())).toBe(false);
  });

  it("la ocupación de un espacio incompatible tapa igual que la propia", () => {
    // El salón tomado de 10 a 12 llega acá dentro de `busy`: el motor no distingue de
    // quién es la ocupación, y por eso la regla de incompatibilidad no lo complica.
    const huecos = computeAvailability({
      ...base,
      range: sabado,
      busy: [{ startAt: local(19, 10), endAt: local(19, 12) }],
    });
    expect(huecos.map((h) => h.startAt.getTime())).toEqual([
      local(19, 9).getTime(),
      local(19, 12).getTime(),
    ]);
  });

  it("el tiempo de limpieza también tapa", () => {
    const huecos = computeAvailability({
      ...base,
      range: sabado,
      space: { ...espacio, bufferMinutes: 30 },
      busy: [{ startAt: local(19, 10), endAt: local(19, 11) }],
    });
    // De 9:30 a 11:30 queda ocupado, así que se caen las horas de 9 y de 11.
    expect(huecos.map((h) => h.startAt.getTime())).toEqual([local(19, 12).getTime()]);
  });

  it("un cierre institucional tapa el día entero", () => {
    const huecos = computeAvailability({
      ...base,
      range: sabado,
      closures: [{ startAt: local(19, 0), endAt: local(20, 0) }],
    });
    expect(huecos).toHaveLength(0);
  });

  it("no se ofrece nada antes de la anticipación mínima", () => {
    const huecos = computeAvailability({
      ...base,
      range: sabado,
      now: local(19, 10, 30),
    });
    // Con 2 horas de anticipación, desde las 10:30 lo primero disponible es a las 13 —
    // que ya está fuera de horario. No queda nada.
    expect(huecos).toHaveLength(0);
  });

  it("no se ofrece nada más allá de la anticipación máxima", () => {
    const huecos = computeAvailability({
      ...base,
      range: sabado,
      space: { ...espacio, maxAdvanceDays: 1 },
    });
    expect(huecos).toHaveLength(0);
  });

  it("con grilla de media hora hay ocho huecos", () => {
    const huecos = computeAvailability({
      ...base,
      range: sabado,
      space: { ...espacio, slotMinutes: 30, minBookingMinutes: 30 },
    });
    expect(huecos).toHaveLength(8);
  });

  it("dos tramos en el mismo día se respetan por separado", () => {
    const huecos = computeAvailability({
      ...base,
      range: sabado,
      weeklyHours: [
        { weekday: 6, startMinute: 9 * 60, endMinute: 11 * 60 },
        { weekday: 6, startMinute: 16 * 60, endMinute: 18 * 60 },
      ],
    });
    expect(huecos.map((h) => h.startAt.getTime())).toEqual([
      local(19, 9).getTime(),
      local(19, 10).getTime(),
      local(19, 16).getTime(),
      local(19, 17).getTime(),
    ]);
  });
});

describe("validar un rango pedido", () => {
  const contexto = { ...base };

  it("un rango dentro del horario y libre se acepta", () => {
    expect(checkRange({ startAt: local(19, 9), endAt: local(19, 11) }, contexto)).toEqual({
      ok: true,
    });
  });

  it("un rango que se sale del horario se rechaza", () => {
    expect(checkRange({ startAt: local(19, 12), endAt: local(19, 14) }, contexto)).toEqual({
      ok: false,
      reason: "FUERA_DE_HORARIO",
    });
  });

  it("un rango sobre una reserva existente se rechaza", () => {
    const r = checkRange({ startAt: local(19, 9), endAt: local(19, 11) }, {
      ...contexto,
      busy: [{ startAt: local(19, 10), endAt: local(19, 11) }],
    });
    expect(r).toEqual({ ok: false, reason: "OCUPADO" });
  });

  it("un rango dentro de un cierre se rechaza", () => {
    const r = checkRange({ startAt: local(19, 9), endAt: local(19, 11) }, {
      ...contexto,
      closures: [{ startAt: local(19, 8), endAt: local(19, 20) }],
    });
    expect(r).toEqual({ ok: false, reason: "CERRADO" });
  });

  it("un rango más corto que el mínimo se rechaza", () => {
    const r = checkRange({ startAt: local(19, 9), endAt: local(19, 9, 30) }, contexto);
    expect(r).toEqual({ ok: false, reason: "DURACION_INVALIDA" });
  });

  it("un rango más largo que el máximo se rechaza", () => {
    const r = checkRange({ startAt: local(19, 9), endAt: local(19, 13) }, {
      ...contexto,
      space: { ...espacio, maxBookingMinutes: 120 },
    });
    expect(r).toEqual({ ok: false, reason: "DURACION_INVALIDA" });
  });

  it("un rango que no cae en la grilla se rechaza", () => {
    const r = checkRange({ startAt: local(19, 9, 15), endAt: local(19, 10, 15) }, contexto);
    expect(r).toEqual({ ok: false, reason: "DURACION_INVALIDA" });
  });

  it("un rango al revés o vacío se rechaza", () => {
    expect(checkRange({ startAt: local(19, 11), endAt: local(19, 9) }, contexto)).toEqual({
      ok: false,
      reason: "RANGO_INVALIDO",
    });
    expect(checkRange({ startAt: local(19, 9), endAt: local(19, 9) }, contexto)).toEqual({
      ok: false,
      reason: "RANGO_INVALIDO",
    });
  });

  it("un rango sobre la hora se rechaza con su propio motivo", () => {
    const r = checkRange({ startAt: local(19, 9), endAt: local(19, 11) }, {
      ...contexto,
      now: local(19, 8),
    });
    expect(r).toEqual({ ok: false, reason: "MUY_SOBRE_LA_HORA" });
  });

  it("cada motivo de rechazo tiene un texto que el socio entiende", () => {
    for (const motivo of [
      "FUERA_DE_HORARIO",
      "OCUPADO",
      "CERRADO",
      "MUY_SOBRE_LA_HORA",
      "DEMASIADO_LEJOS",
      "DURACION_INVALIDA",
      "RANGO_INVALIDO",
    ] as const) {
      const texto = rejectionMessage(motivo);
      expect(texto, motivo).toBeTruthy();
      expect(texto.length).toBeGreaterThan(10);
      expect(texto).not.toContain("_");
    }
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
pnpm test lib/bookings/availability.test.ts
```

Esperado: FALLA con `Failed to resolve import "./availability"`.

- [ ] **Step 3: Escribir la implementación**

Crear `lib/bookings/availability.ts`:

```ts
import {
  type Interval,
  addMinutes,
  expandInterval,
  localMoment,
  overlaps,
} from "./time";

/**
 * Motor de disponibilidad. Módulo PURO: sin base y sin red.
 *
 * Recibe TODO resuelto —los horarios del espacio, los cierres, la ocupación y la ventana
 * pedida— y devuelve los huecos libres. Quien llama es responsable de haber juntado en
 * `busy` la ocupación del espacio Y la de los espacios incompatibles: acá no se distingue
 * de quién es cada rango ocupado, y eso es lo que mantiene simple la regla de convivencia.
 */

export type SpaceRules = {
  /** Grilla de la agenda, en minutos. 60 = por hora. */
  slotMinutes: number;
  minBookingMinutes: number;
  /** null = sin tope. */
  maxBookingMinutes: number | null;
  /** Tiempo de limpieza que ocupa a los dos lados de cada reserva. */
  bufferMinutes: number;
  minAdvanceHours: number;
  maxAdvanceDays: number;
};

export type WeeklyHour = {
  /** 0 domingo … 6 sábado, en la zona de la institución. */
  weekday: number;
  startMinute: number;
  endMinute: number;
};

export type AvailabilityInput = {
  space: SpaceRules;
  range: Interval;
  weeklyHours: WeeklyHour[];
  closures: Interval[];
  /** Reservas del espacio, de sus incompatibles, y bloqueos traídos del calendario. */
  busy: Interval[];
  now: Date;
  timeZone: string;
};

export type BookingRejection =
  | "FUERA_DE_HORARIO"
  | "OCUPADO"
  | "CERRADO"
  | "MUY_SOBRE_LA_HORA"
  | "DEMASIADO_LEJOS"
  | "DURACION_INVALIDA"
  | "RANGO_INVALIDO";

export type RangeCheck = { ok: true } | { ok: false; reason: BookingRejection };

const MINUTO = 60_000;

/** ¿El rango entero cae dentro de un mismo tramo de horario semanal? */
function dentroDelHorario(range: Interval, input: Omit<AvailabilityInput, "range">): boolean {
  const inicio = localMoment(range.startAt, input.timeZone);
  const duracion = (range.endAt.getTime() - range.startAt.getTime()) / MINUTO;
  const fin = inicio.minuteOfDay + duracion;

  // Se compara contra el día del COMIENZO: una reserva que cruzara la medianoche no cabría
  // en ningún tramo y quedaría rechazada, que es el comportamiento correcto mientras los
  // horarios se declaren por día.
  return input.weeklyHours.some(
    (h) => h.weekday === inicio.weekday && inicio.minuteOfDay >= h.startMinute && fin <= h.endMinute,
  );
}

function ocupado(range: Interval, input: Omit<AvailabilityInput, "range">): boolean {
  return input.busy.some((b) => overlaps(range, expandInterval(b, input.space.bufferMinutes)));
}

function cerrado(range: Interval, input: Omit<AvailabilityInput, "range">): boolean {
  return input.closures.some((c) => overlaps(range, c));
}

/**
 * ¿Se puede reservar exactamente este rango?
 *
 * El orden de los motivos importa: primero lo que está mal en el pedido mismo (rango
 * inválido, duración), después lo que depende del reloj, y al final lo que depende de otros.
 * Así el mensaje que recibe la persona habla de lo que ella puede corregir.
 */
export function checkRange(
  range: Interval,
  input: Omit<AvailabilityInput, "range">,
): RangeCheck {
  const duracion = (range.endAt.getTime() - range.startAt.getTime()) / MINUTO;
  if (!Number.isFinite(duracion) || duracion <= 0) return { ok: false, reason: "RANGO_INVALIDO" };

  const { space } = input;
  if (duracion < space.minBookingMinutes) return { ok: false, reason: "DURACION_INVALIDA" };
  if (space.maxBookingMinutes !== null && duracion > space.maxBookingMinutes) {
    return { ok: false, reason: "DURACION_INVALIDA" };
  }
  if (duracion % space.slotMinutes !== 0) return { ok: false, reason: "DURACION_INVALIDA" };

  const desde = input.now.getTime() + space.minAdvanceHours * 60 * MINUTO;
  if (range.startAt.getTime() < desde) return { ok: false, reason: "MUY_SOBRE_LA_HORA" };

  const hasta = input.now.getTime() + space.maxAdvanceDays * 24 * 60 * MINUTO;
  if (range.startAt.getTime() > hasta) return { ok: false, reason: "DEMASIADO_LEJOS" };

  if (!dentroDelHorario(range, input)) return { ok: false, reason: "FUERA_DE_HORARIO" };
  if (cerrado(range, input)) return { ok: false, reason: "CERRADO" };
  if (ocupado(range, input)) return { ok: false, reason: "OCUPADO" };

  return { ok: true };
}

/**
 * Los huecos libres dentro de la ventana pedida.
 *
 * Se recorre la grilla del espacio y se pregunta por cada casillero. Es el camino más
 * lento posible y también el único que no puede discrepar de `checkRange`: la pantalla
 * ofrece exactamente lo que la validación después acepta. Para una ventana de un mes con
 * grilla de media hora son ~1.500 evaluaciones, que es nada.
 */
export function computeAvailability(input: AvailabilityInput): Interval[] {
  const { space, range } = input;
  const paso = space.slotMinutes;
  const duracion = Math.max(space.minBookingMinutes, paso);

  const huecos: Interval[] = [];
  let cursor = range.startAt;

  // Tope de seguridad: una grilla mal configurada no puede colgar el servidor.
  const maximo = 20_000;
  let vueltas = 0;

  while (cursor.getTime() < range.endAt.getTime() && vueltas < maximo) {
    vueltas += 1;
    const candidato = { startAt: cursor, endAt: addMinutes(cursor, duracion) };
    if (checkRange(candidato, input).ok) huecos.push(candidato);
    cursor = addMinutes(cursor, paso);
  }

  return huecos;
}

const MOTIVOS: Record<BookingRejection, string> = {
  FUERA_DE_HORARIO: "Ese horario está fuera de los días y horas en que el espacio se alquila.",
  OCUPADO: "Ese horario se acaba de ocupar. Elegí otro.",
  CERRADO: "La institución está cerrada en esa fecha.",
  MUY_SOBRE_LA_HORA: "Falta muy poco para ese horario. Elegí uno con más anticipación.",
  DEMASIADO_LEJOS: "Todavía no se puede reservar con tanta anticipación.",
  DURACION_INVALIDA: "Esa duración no está permitida para este espacio.",
  RANGO_INVALIDO: "El horario de fin tiene que ser posterior al de inicio.",
};

export function rejectionMessage(reason: BookingRejection): string {
  return MOTIVOS[reason];
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
pnpm test lib/bookings/availability.test.ts
```

Esperado: PASA, 20 tests.

- [ ] **Step 5: Commitear**

```bash
git add lib/bookings/availability.ts lib/bookings/availability.test.ts
git commit -m "$(cat <<'MSG'
El sistema sabe qué horas están libres y por qué las otras no

Un espacio ocupado tapa también a los que no pueden convivir con él: el motor
recibe toda la ocupación junta y no distingue de quién es cada rango.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 3: Precio y horas bonificadas

Cuánto sale una reserva. Puro, en centavos y con enteros. Se usa desde la carga manual del equipo y —en el plan siguiente— desde el portal del socio.

**Files:**
- Create: `lib/bookings/pricing.ts`
- Test: `lib/bookings/pricing.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type CustomerType = "MEMBER" | "NON_MEMBER"`
  - `type Quote = { freeMinutesUsed: number; billedMinutes: number; hourlyPriceMinor: number; totalMinor: number }`
  - `quoteBooking(input: { minutes: number; customerType: CustomerType; memberHourlyPriceMinor: number; nonMemberHourlyPriceMinor: number; freeMinutesAvailable: number }): Quote`
  - `describeQuote(quote: Quote, minutes: number): string[]` — las líneas del desglose que ve la persona

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/bookings/pricing.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { describeQuote, quoteBooking } from "./pricing";

const precios = { memberHourlyPriceMinor: 300_000, nonMemberHourlyPriceMinor: 500_000 };

describe("cuánto sale una reserva", () => {
  it("el no socio paga la tarifa plena y no tiene bonificación", () => {
    const q = quoteBooking({
      minutes: 120,
      customerType: "NON_MEMBER",
      ...precios,
      freeMinutesAvailable: 120,
    });
    expect(q.freeMinutesUsed).toBe(0);
    expect(q.billedMinutes).toBe(120);
    expect(q.hourlyPriceMinor).toBe(500_000);
    expect(q.totalMinor).toBe(1_000_000);
  });

  it("el socio paga la tarifa de socio", () => {
    const q = quoteBooking({
      minutes: 120,
      customerType: "MEMBER",
      ...precios,
      freeMinutesAvailable: 0,
    });
    expect(q.totalMinor).toBe(600_000);
  });

  it("la bonificación se aplica al principio: 4 horas con 2 bonificadas pagan 2", () => {
    const q = quoteBooking({
      minutes: 240,
      customerType: "MEMBER",
      ...precios,
      freeMinutesAvailable: 120,
    });
    expect(q.freeMinutesUsed).toBe(120);
    expect(q.billedMinutes).toBe(120);
    expect(q.totalMinor).toBe(600_000);
  });

  it("una reserva enteramente cubierta no cuesta nada", () => {
    const q = quoteBooking({
      minutes: 120,
      customerType: "MEMBER",
      ...precios,
      freeMinutesAvailable: 120,
    });
    expect(q.billedMinutes).toBe(0);
    expect(q.totalMinor).toBe(0);
  });

  it("no se consumen más minutos bonificados que los que dura la reserva", () => {
    const q = quoteBooking({
      minutes: 60,
      customerType: "MEMBER",
      ...precios,
      freeMinutesAvailable: 500,
    });
    expect(q.freeMinutesUsed).toBe(60);
    expect(q.totalMinor).toBe(0);
  });

  it("media hora cuesta la mitad de la hora", () => {
    const q = quoteBooking({
      minutes: 30,
      customerType: "MEMBER",
      ...precios,
      freeMinutesAvailable: 0,
    });
    expect(q.totalMinor).toBe(150_000);
  });

  it("un precio que no parte exacto se redondea al centavo, sin colas", () => {
    // $1.000,01 la hora, 20 minutos: 100001 * 20 / 60 = 33333,67 → 33334.
    const q = quoteBooking({
      minutes: 20,
      customerType: "MEMBER",
      memberHourlyPriceMinor: 100_001,
      nonMemberHourlyPriceMinor: 200_000,
      freeMinutesAvailable: 0,
    });
    expect(q.totalMinor).toBe(33_334);
    expect(Number.isInteger(q.totalMinor)).toBe(true);
  });

  it("un saldo bonificado negativo o absurdo se trata como cero", () => {
    const q = quoteBooking({
      minutes: 60,
      customerType: "MEMBER",
      ...precios,
      freeMinutesAvailable: -10,
    });
    expect(q.freeMinutesUsed).toBe(0);
    expect(q.totalMinor).toBe(300_000);
  });

  it("una duración inválida no genera un precio inventado", () => {
    const q = quoteBooking({
      minutes: 0,
      customerType: "MEMBER",
      ...precios,
      freeMinutesAvailable: 120,
    });
    expect(q.billedMinutes).toBe(0);
    expect(q.freeMinutesUsed).toBe(0);
    expect(q.totalMinor).toBe(0);
  });
});

describe("el desglose que lee la persona", () => {
  it("dice qué parte es bonificada y qué parte se paga", () => {
    const q = quoteBooking({
      minutes: 240,
      customerType: "MEMBER",
      ...precios,
      freeMinutesAvailable: 120,
    });
    const lineas = describeQuote(q, 240);
    expect(lineas.join(" | ")).toContain("2 h bonificadas");
    expect(lineas.join(" | ")).toContain("$");
  });

  it("cuando no hay bonificación no habla de bonificación", () => {
    const q = quoteBooking({
      minutes: 60,
      customerType: "NON_MEMBER",
      ...precios,
      freeMinutesAvailable: 0,
    });
    expect(describeQuote(q, 60).join(" ")).not.toContain("bonificada");
  });

  it("una reserva sin cargo lo dice con todas las letras", () => {
    const q = quoteBooking({
      minutes: 120,
      customerType: "MEMBER",
      ...precios,
      freeMinutesAvailable: 120,
    });
    expect(describeQuote(q, 120).join(" ")).toContain("Sin cargo");
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
pnpm test lib/bookings/pricing.test.ts
```

Esperado: FALLA con `Failed to resolve import "./pricing"`.

- [ ] **Step 3: Escribir la implementación**

Crear `lib/bookings/pricing.ts`:

```ts
import { formatMinorArs } from "@/lib/membership/money";

/**
 * Cuánto sale una reserva. Módulo PURO: sin base y sin red.
 *
 * Todo en centavos y con enteros, por la misma razón por la que el resto del dinero de
 * FotoOffice no se calcula en coma flotante.
 *
 * La bonificación se aplica **al principio** de la reserva: cuatro horas con dos
 * bonificadas disponibles son dos gratis y dos al precio de socio. Aplicarla al final daría
 * el mismo total pero haría más difícil explicarle a alguien qué parte de su reserva
 * consumió el beneficio.
 */

export type CustomerType = "MEMBER" | "NON_MEMBER";

export type Quote = {
  freeMinutesUsed: number;
  billedMinutes: number;
  /** El precio por hora que se aplicó. Se congela en la reserva. */
  hourlyPriceMinor: number;
  totalMinor: number;
};

export function quoteBooking(input: {
  minutes: number;
  customerType: CustomerType;
  memberHourlyPriceMinor: number;
  nonMemberHourlyPriceMinor: number;
  /** Minutos bonificados que le quedan al socio este mes. Cero para un no socio. */
  freeMinutesAvailable: number;
}): Quote {
  const hourlyPriceMinor =
    input.customerType === "MEMBER" ? input.memberHourlyPriceMinor : input.nonMemberHourlyPriceMinor;

  const minutos = Number.isFinite(input.minutes) && input.minutes > 0 ? Math.floor(input.minutes) : 0;
  if (minutos === 0) {
    return { freeMinutesUsed: 0, billedMinutes: 0, hourlyPriceMinor, totalMinor: 0 };
  }

  // Un no socio no tiene bolsa, sin importar lo que le pasen. Que la regla viva acá y no
  // en quien llama evita que una pantalla nueva se olvide de aplicarla.
  const disponibles =
    input.customerType === "MEMBER" && Number.isFinite(input.freeMinutesAvailable)
      ? Math.max(0, Math.floor(input.freeMinutesAvailable))
      : 0;

  const freeMinutesUsed = Math.min(minutos, disponibles);
  const billedMinutes = minutos - freeMinutesUsed;

  // Se multiplica primero y se divide después: dividir el precio por 60 antes de
  // multiplicar arrastraría el redondeo a cada minuto.
  const totalMinor = Math.round((hourlyPriceMinor * billedMinutes) / 60);

  return { freeMinutesUsed, billedMinutes, hourlyPriceMinor, totalMinor };
}

function horas(minutos: number): string {
  const h = minutos / 60;
  const texto = Number.isInteger(h) ? String(h) : h.toFixed(1).replace(".", ",");
  return `${texto} h`;
}

/** Las líneas del desglose, en el orden en que se leen. */
export function describeQuote(quote: Quote, minutes: number): string[] {
  const lineas: string[] = [];

  if (quote.freeMinutesUsed > 0) {
    lineas.push(`${horas(quote.freeMinutesUsed)} bonificadas por ser socio — sin cargo`);
  }

  if (quote.billedMinutes > 0) {
    lineas.push(
      `${horas(quote.billedMinutes)} × ${formatMinorArs(quote.hourlyPriceMinor)} por hora — ${formatMinorArs(quote.totalMinor)}`,
    );
  }

  lineas.push(
    quote.totalMinor === 0
      ? "Sin cargo"
      : `Total: ${formatMinorArs(quote.totalMinor)} por ${horas(minutes)}`,
  );

  return lineas;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
pnpm test lib/bookings/pricing.test.ts
```

Esperado: PASA, 12 tests. Si falla el formato del importe, mirar qué devuelve `formatMinorArs` en `lib/membership/money.ts` y ajustar **el test**, no el helper: el formato de moneda ya está decidido para toda la aplicación.

- [ ] **Step 5: Commitear**

```bash
git add lib/bookings/pricing.ts lib/bookings/pricing.test.ts
git commit -m "$(cat <<'MSG'
El precio de una reserva se calcula en centavos y se puede explicar

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 4: Modelo de datos

Diez tablas nuevas, puramente aditivas, más una restricción escrita a mano que Prisma no sabe generar.

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/20260909000000_bookings/migration.sql`

**Interfaces:**
- Consumes: nada.
- Produces: `prisma.bookingSpace`, `prisma.bookingSpaceHours`, `prisma.bookingClosure`, `prisma.bookingSpaceCompatibility`, `prisma.booking`, `prisma.bookingSettings`, `prisma.bookingResource`, `prisma.bookingExtra`, `prisma.bookingExtraSpace`, `prisma.bookingExtraLine`.

- [ ] **Step 1: Agregar los modelos al schema**

En `packages/db/prisma/schema.prisma`, dentro del modelo `Workspace`, junto a `integrations`:

```prisma
  bookingSpaces               BookingSpace[]
  bookings                    Booking[]
  bookingClosures             BookingClosure[]
  bookingSettings             BookingSettings?
  bookingResources            BookingResource[]
  bookingExtras               BookingExtra[]
```

Y después de `WorkspaceIntegrationOAuthState`:

```prisma
/// Un espacio alquilable: coworking, salón, estudio, laboratorio…
/// No son categorías del sistema: son filas que el dueño da de alta.
model BookingSpace {
  id          String  @id @default(cuid())
  workspaceId String
  name        String
  slug        String
  description String?
  imageUrl    String?
  active      Boolean @default(true)
  order       Int     @default(0)

  /// Grilla de la agenda, en minutos. 60 = por hora.
  slotMinutes       Int  @default(60)
  minBookingMinutes Int  @default(60)
  /// null = sin tope.
  maxBookingMinutes Int?
  /// Tiempo de limpieza que ocupa a los dos lados de cada reserva.
  bufferMinutes     Int  @default(0)
  minAdvanceHours   Int  @default(2)
  maxAdvanceDays    Int  @default(90)
  /// El salón de eventos: la Comisión mira antes de aceptar.
  requiresApproval  Boolean @default(false)

  /// Tarifas por hora. El precio de socio ES el precio promocional.
  memberHourlyPriceArs    Decimal @default(0) @db.Decimal(12, 2)
  nonMemberHourlyPriceArs Decimal @default(0) @db.Decimal(12, 2)
  /// Horas bonificadas por mes para socios. 0 = este espacio no bonifica.
  memberFreeHoursPerMonth Int     @default(0)
  allowsNonMembers        Boolean @default(true)

  /// Calendario de Google que espeja este espacio. Uno por espacio: ver la especificación.
  googleCalendarId  String?
  calendarSyncToken String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  workspace      Workspace                   @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  hours          BookingSpaceHours[]
  bookings       Booking[]
  closures       BookingClosure[]
  compatibleAsA  BookingSpaceCompatibility[] @relation("CompatibilidadA")
  compatibleAsB  BookingSpaceCompatibility[] @relation("CompatibilidadB")
  extras         BookingExtraSpace[]

  @@unique([workspaceId, slug])
  @@index([workspaceId, active])
}

/// "Lunes de 9 a 13" es una fila. Varios tramos por día.
model BookingSpaceHours {
  id          String @id @default(cuid())
  spaceId     String
  /// 0 domingo … 6 sábado, en la zona de la institución.
  weekday     Int
  /// Minutos desde la medianoche local. 540 = 09:00. Siempre endMinute > startMinute.
  startMinute Int
  endMinute   Int

  space BookingSpace @relation(fields: [spaceId], references: [id], onDelete: Cascade)

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
  createdAt   DateTime @default(now())

  workspace Workspace     @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  space     BookingSpace? @relation(fields: [spaceId], references: [id], onDelete: Cascade)

  @@index([workspaceId, startAt])
}

/// Par de espacios que SÍ pueden estar ocupados a la vez.
///
/// Todo par ausente de esta tabla es INCOMPATIBLE: el defecto es bloquear. Un espacio nuevo
/// nace bloqueando a todos, y el error posible es "no me deja reservar" —que se nota y se
/// corrige en dos minutos— en lugar de "vendí dos veces el mismo salón".
///
/// Se guarda una sola fila por par, siempre con spaceAId < spaceBId.
model BookingSpaceCompatibility {
  id       String @id @default(cuid())
  spaceAId String
  spaceBId String

  spaceA BookingSpace @relation("CompatibilidadA", fields: [spaceAId], references: [id], onDelete: Cascade)
  spaceB BookingSpace @relation("CompatibilidadB", fields: [spaceBId], references: [id], onDelete: Cascade)

  @@unique([spaceAId, spaceBId])
  @@index([spaceBId])
}

model Booking {
  id          String   @id @default(cuid())
  workspaceId String
  spaceId     String
  startAt     DateTime
  endAt       DateTime

  /// HOLD | PENDING_APPROVAL | CONFIRMED | CANCELLED | EXPIRED
  status        String
  /// Vencimiento del bloqueo mientras no está pago ni aprobado. Null si ya está confirmada.
  holdExpiresAt DateTime?

  /// Quién reserva. `memberId` para socios; `userId` para cualquiera con cuenta.
  memberId     String?
  userId       Int?
  contactName  String
  contactEmail String
  contactPhone String?
  /// MEMBER | NON_MEMBER. Congelado al reservar: si después se asocia, esta reserva no cambia.
  customerType String

  /// Dinero, todo congelado en el momento de reservar.
  billedMinutes   Int
  freeMinutesUsed Int     @default(0)
  hourlyPriceArs  Decimal @db.Decimal(12, 2)
  totalArs        Decimal @db.Decimal(12, 2)
  /// Puntos básicos: 500 = 5%. Entero, nunca porcentaje decimal.
  feeBps          Int     @default(0)
  feeArs          Decimal @default(0) @db.Decimal(12, 2)

  /// MERCADO_PAGO | TRANSFERENCIA | SIN_CARGO | PRESENCIAL
  paymentMethod String
  /// PENDING | PAID | NOT_REQUIRED
  paymentStatus String
  mpPreferenceId String?
  mpPaymentId    String?
  paidAt         DateTime?
  /// Quién confirmó una transferencia o aprobó el pedido. Para poder explicarlo meses después.
  decidedByUserId Int?

  googleEventId String?
  notes         String?
  /// Quién la cargó, cuando la carga el equipo y no la persona.
  createdByUserId   Int?
  cancelledAt       DateTime?
  cancelledByUserId Int?
  cancelReason      String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  workspace  Workspace          @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  space      BookingSpace       @relation(fields: [spaceId], references: [id], onDelete: Cascade)
  member     Member?            @relation(fields: [memberId], references: [id], onDelete: SetNull)
  extraLines BookingExtraLine[]

  @@index([workspaceId, startAt])
  @@index([spaceId, startAt])
  @@index([memberId, startAt])
  @@index([status, holdExpiresAt])
}

/// El inventario real. Solo para lo que hay que contar.
///
/// Existe separado de `BookingExtra` porque lo que se VENDE no es lo que EXISTE: "Flash
/// adicional" y "Pack de 2 flashes" son dos cosas vendibles que salen del mismo par de
/// flashes. Sin esta separación el sistema vendería un suelto y un pack el mismo sábado:
/// tres flashes de los dos que hay. Es la doble reserva del salón con otro disfraz.
model BookingResource {
  id          String   @id @default(cuid())
  workspaceId String
  name        String
  quantity    Int
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  workspace Workspace      @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  extras    BookingExtra[]

  @@index([workspaceId])
}

/// Lo que el socio elige y paga junto con el espacio. Nunca se alquila solo.
model BookingExtra {
  id          String  @id @default(cuid())
  workspaceId String
  name        String
  description String?
  active      Boolean @default(true)
  order       Int     @default(0)

  /// PER_BOOKING (una vez) | PER_HOUR (por cada hora de la reserva)
  priceMode         String  @default("PER_BOOKING")
  memberPriceArs    Decimal @default(0) @db.Decimal(12, 2)
  nonMemberPriceArs Decimal @default(0) @db.Decimal(12, 2)

  /// Qué consume del inventario. SIN recurso, la cantidad no se controla: así es como
  /// "controlar solo algunos" deja de ser una regla aparte.
  resourceId    String?
  unitsConsumed Int     @default(1)

  /// Necesita coordinar con una persona antes de comprometerlo (una modelo). Fuerza la
  /// reserva a PENDING_APPROVAL y no se cobra hasta que la institución decida.
  requiresConfirmation Boolean @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  workspace Workspace           @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  resource  BookingResource?    @relation(fields: [resourceId], references: [id], onDelete: SetNull)
  spaces    BookingExtraSpace[]
  lines     BookingExtraLine[]

  @@index([workspaceId, active])
}

/// En qué espacios se ofrece cada extra. El humo sirve al estudio y al salón.
model BookingExtraSpace {
  id      String @id @default(cuid())
  extraId String
  spaceId String

  extra BookingExtra @relation(fields: [extraId], references: [id], onDelete: Cascade)
  space BookingSpace @relation(fields: [spaceId], references: [id], onDelete: Cascade)

  @@unique([extraId, spaceId])
  @@index([spaceId])
}

/// Los extras de una reserva concreta, con el precio congelado.
model BookingExtraLine {
  id        String @id @default(cuid())
  bookingId String
  extraId   String
  /// Copia del nombre al reservar: si después se renombra el extra, la reserva vieja sigue
  /// diciendo lo que la persona contrató.
  nameSnapshot  String
  priceMode     String
  unitPriceArs  Decimal @db.Decimal(12, 2)
  unitsConsumed Int
  amountArs     Decimal @db.Decimal(12, 2)
  /// PENDING_CONFIRMATION | CONFIRMED | REMOVED
  status        String
  createdAt     DateTime @default(now())

  booking Booking      @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  /// Restrict y no Cascade: borrar un extra no puede borrar el registro de lo que alguien
  /// contrató y pagó. Un extra se desactiva, no se borra.
  extra   BookingExtra @relation(fields: [extraId], references: [id], onDelete: Restrict)

  @@index([bookingId])
  @@index([extraId])
}

/// Reglas del módulo que son de la institución entera, no de un espacio.
model BookingSettings {
  id          String @id @default(cuid())
  workspaceId String @unique
  /// Cuánto vive un bloqueo esperando pago por transferencia o esperando aprobación.
  holdHours   Int    @default(24)
  /// Hasta cuántas horas antes puede cancelar solo quien reservó.
  cancelWindowHours Int @default(24)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
}
```

En el modelo `Member`, agregar la relación inversa junto a las que ya tiene (`memberCards`,
`audits`, etc.):

```prisma
  bookings Booking[]
```

- [ ] **Step 2: Escribir la migración**

Crear `packages/db/prisma/migrations/20260909000000_bookings/migration.sql`:

```sql
-- Reservas de espacios y sus extras. Puramente aditiva: diez tablas nuevas, ninguna columna
-- existente modificada.

CREATE TABLE "BookingSpace" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "slotMinutes" INTEGER NOT NULL DEFAULT 60,
    "minBookingMinutes" INTEGER NOT NULL DEFAULT 60,
    "maxBookingMinutes" INTEGER,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 0,
    "minAdvanceHours" INTEGER NOT NULL DEFAULT 2,
    "maxAdvanceDays" INTEGER NOT NULL DEFAULT 90,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "memberHourlyPriceArs" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "nonMemberHourlyPriceArs" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "memberFreeHoursPerMonth" INTEGER NOT NULL DEFAULT 0,
    "allowsNonMembers" BOOLEAN NOT NULL DEFAULT true,
    "googleCalendarId" TEXT,
    "calendarSyncToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BookingSpace_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BookingSpace_workspaceId_slug_key" ON "BookingSpace"("workspaceId", "slug");
CREATE INDEX "BookingSpace_workspaceId_active_idx" ON "BookingSpace"("workspaceId", "active");
ALTER TABLE "BookingSpace" ADD CONSTRAINT "BookingSpace_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BookingSpaceHours" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    CONSTRAINT "BookingSpaceHours_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BookingSpaceHours_spaceId_weekday_idx" ON "BookingSpaceHours"("spaceId", "weekday");
ALTER TABLE "BookingSpaceHours" ADD CONSTRAINT "BookingSpaceHours_spaceId_fkey"
    FOREIGN KEY ("spaceId") REFERENCES "BookingSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BookingClosure" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "spaceId" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookingClosure_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BookingClosure_workspaceId_startAt_idx" ON "BookingClosure"("workspaceId", "startAt");
ALTER TABLE "BookingClosure" ADD CONSTRAINT "BookingClosure_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingClosure" ADD CONSTRAINT "BookingClosure_spaceId_fkey"
    FOREIGN KEY ("spaceId") REFERENCES "BookingSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BookingSpaceCompatibility" (
    "id" TEXT NOT NULL,
    "spaceAId" TEXT NOT NULL,
    "spaceBId" TEXT NOT NULL,
    CONSTRAINT "BookingSpaceCompatibility_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BookingSpaceCompatibility_spaceAId_spaceBId_key"
    ON "BookingSpaceCompatibility"("spaceAId", "spaceBId");
CREATE INDEX "BookingSpaceCompatibility_spaceBId_idx" ON "BookingSpaceCompatibility"("spaceBId");
ALTER TABLE "BookingSpaceCompatibility" ADD CONSTRAINT "BookingSpaceCompatibility_spaceAId_fkey"
    FOREIGN KEY ("spaceAId") REFERENCES "BookingSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingSpaceCompatibility" ADD CONSTRAINT "BookingSpaceCompatibility_spaceBId_fkey"
    FOREIGN KEY ("spaceBId") REFERENCES "BookingSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "holdExpiresAt" TIMESTAMP(3),
    "memberId" TEXT,
    "userId" INTEGER,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "customerType" TEXT NOT NULL,
    "billedMinutes" INTEGER NOT NULL,
    "freeMinutesUsed" INTEGER NOT NULL DEFAULT 0,
    "hourlyPriceArs" DECIMAL(12,2) NOT NULL,
    "totalArs" DECIMAL(12,2) NOT NULL,
    "feeBps" INTEGER NOT NULL DEFAULT 0,
    "feeArs" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paymentMethod" TEXT NOT NULL,
    "paymentStatus" TEXT NOT NULL,
    "mpPreferenceId" TEXT,
    "mpPaymentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "decidedByUserId" INTEGER,
    "googleEventId" TEXT,
    "notes" TEXT,
    "createdByUserId" INTEGER,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByUserId" INTEGER,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Booking_workspaceId_startAt_idx" ON "Booking"("workspaceId", "startAt");
CREATE INDEX "Booking_spaceId_startAt_idx" ON "Booking"("spaceId", "startAt");
CREATE INDEX "Booking_memberId_startAt_idx" ON "Booking"("memberId", "startAt");
CREATE INDEX "Booking_status_holdExpiresAt_idx" ON "Booking"("status", "holdExpiresAt");
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_spaceId_fkey"
    FOREIGN KEY ("spaceId") REFERENCES "BookingSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "BookingResource" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BookingResource_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BookingResource_workspaceId_idx" ON "BookingResource"("workspaceId");
ALTER TABLE "BookingResource" ADD CONSTRAINT "BookingResource_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BookingExtra" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "priceMode" TEXT NOT NULL DEFAULT 'PER_BOOKING',
    "memberPriceArs" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "nonMemberPriceArs" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "resourceId" TEXT,
    "unitsConsumed" INTEGER NOT NULL DEFAULT 1,
    "requiresConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BookingExtra_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BookingExtra_workspaceId_active_idx" ON "BookingExtra"("workspaceId", "active");
ALTER TABLE "BookingExtra" ADD CONSTRAINT "BookingExtra_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingExtra" ADD CONSTRAINT "BookingExtra_resourceId_fkey"
    FOREIGN KEY ("resourceId") REFERENCES "BookingResource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "BookingExtraSpace" (
    "id" TEXT NOT NULL,
    "extraId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    CONSTRAINT "BookingExtraSpace_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BookingExtraSpace_extraId_spaceId_key" ON "BookingExtraSpace"("extraId", "spaceId");
CREATE INDEX "BookingExtraSpace_spaceId_idx" ON "BookingExtraSpace"("spaceId");
ALTER TABLE "BookingExtraSpace" ADD CONSTRAINT "BookingExtraSpace_extraId_fkey"
    FOREIGN KEY ("extraId") REFERENCES "BookingExtra"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingExtraSpace" ADD CONSTRAINT "BookingExtraSpace_spaceId_fkey"
    FOREIGN KEY ("spaceId") REFERENCES "BookingSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BookingExtraLine" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "extraId" TEXT NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "priceMode" TEXT NOT NULL,
    "unitPriceArs" DECIMAL(12,2) NOT NULL,
    "unitsConsumed" INTEGER NOT NULL,
    "amountArs" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookingExtraLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BookingExtraLine_bookingId_idx" ON "BookingExtraLine"("bookingId");
CREATE INDEX "BookingExtraLine_extraId_idx" ON "BookingExtraLine"("extraId");
ALTER TABLE "BookingExtraLine" ADD CONSTRAINT "BookingExtraLine_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- RESTRICT y no CASCADE: borrar un extra no puede borrar el registro de lo que alguien
-- contrató y pagó. Un extra se desactiva, no se borra.
ALTER TABLE "BookingExtraLine" ADD CONSTRAINT "BookingExtraLine_extraId_fkey"
    FOREIGN KEY ("extraId") REFERENCES "BookingExtra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "BookingSettings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "holdHours" INTEGER NOT NULL DEFAULT 24,
    "cancelWindowHours" INTEGER NOT NULL DEFAULT 24,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BookingSettings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BookingSettings_workspaceId_key" ON "BookingSettings"("workspaceId");
ALTER TABLE "BookingSettings" ADD CONSTRAINT "BookingSettings_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── La restricción que hace imposible la doble reserva ──
--
-- Dos personas apretando "Reservar" en el mismo segundo pueden pasar las dos por cualquier
-- verificación hecha en la aplicación: entre el "¿está libre?" y el "guardar" hay un hueco.
-- Esto lo cierra en la base, que es el único lugar donde no hay hueco.
--
-- Cubre un espacio contra sí mismo. Los conflictos ENTRE espacios los resuelve la
-- transacción: expresarlos acá exigiría una tabla de ocupación derivada, y no vale la pena.
--
-- El rango es medio abierto '[)': de 14 a 16 y de 16 a 18 conviven, igual que en `time.ts`.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_sin_solapamiento"
  EXCLUDE USING gist (
    "spaceId" WITH =,
    tstzrange("startAt", "endAt", '[)') WITH &&
  ) WHERE (status IN ('HOLD', 'PENDING_APPROVAL', 'CONFIRMED'));
```

- [ ] **Step 3: Regenerar el cliente y verificar tipos**

```bash
cd ../../packages/db && npx prisma generate && cd ../../apps/fotoffice && npx tsc --noEmit
```

Esperado: `prisma generate` termina bien y `tsc` sin errores nuevos.

- [ ] **Step 4: Aplicar la migración**

**Confirmar primero a qué base apunta la conexión.** `packages/db/.env` apunta a la base de PRODUCCIÓN de FotoOffice (workspace SFPR, 159 socios). Es aditiva, pero es producción: pedir autorización antes de correrla.

Aplicar el `migration.sql` contra esa base y después registrarla:

```bash
cd ../../packages/db && npx prisma migrate resolve --applied 20260909000000_bookings
```

Verificación:

```sql
SELECT to_regclass('"BookingSpace"'), to_regclass('"Booking"'), to_regclass('"BookingSettings"'),
       to_regclass('"BookingResource"'), to_regclass('"BookingExtra"'),
       to_regclass('"BookingExtraSpace"'), to_regclass('"BookingExtraLine"');
SELECT conname FROM pg_constraint WHERE conname = 'Booking_sin_solapamiento';
```

Esperado: las siete tablas consultadas existen y la restricción aparece. **Si `btree_gist` no se puede crear**, parar y avisar: sin esa extensión la restricción no existe y el módulo pierde su única garantía real contra la doble reserva. No seguir sin ella ni "dejarlo para después".

- [ ] **Step 5: Commitear**

```bash
git add ../../packages/db/prisma/schema.prisma ../../packages/db/prisma/migrations/20260909000000_bookings
git commit -m "$(cat <<'MSG'
Los espacios y sus reservas tienen dónde vivir

La base rechaza por sí sola dos reservas superpuestas del mismo espacio: entre
el "¿está libre?" y el "guardar" hay un hueco que solo se cierra ahí.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 5: Quién bloquea a quién

Traducir la tabla de compatibilidades a "qué espacios tapan a este". Es la regla que hace que el salón tome también el estudio y el coworking, y va aparte porque su defecto —bloquear— es la decisión de seguridad del módulo.

**Files:**
- Create: `lib/bookings/conflicts.ts`
- Test: `lib/bookings/conflicts.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type CompatibilityPair = { spaceAId: string; spaceBId: string }`
  - `normalizePair(a: string, b: string): CompatibilityPair` — siempre con el menor primero
  - `blockingSpaceIds(spaceId: string, allSpaceIds: readonly string[], compatibilities: readonly CompatibilityPair[]): string[]`
  - `compatibleSpaceIds(spaceId: string, compatibilities: readonly CompatibilityPair[]): string[]`
  - `pairsForSpace(spaceId: string, compatibleWith: readonly string[]): CompatibilityPair[]`

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/bookings/conflicts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { blockingSpaceIds, compatibleSpaceIds, normalizePair, pairsForSpace } from "./conflicts";

const salon = "salon";
const estudio = "estudio";
const coworking = "coworking";
const todos = [salon, estudio, coworking];

/** Estudio y coworking conviven; el salón no convive con nadie. */
const compatibilidades = [normalizePair(estudio, coworking)];

describe("un par se guarda siempre igual", () => {
  it("el orden en que se escribe no cambia la fila", () => {
    expect(normalizePair("b", "a")).toEqual(normalizePair("a", "b"));
  });

  it("el menor va primero", () => {
    expect(normalizePair("b", "a")).toEqual({ spaceAId: "a", spaceBId: "b" });
  });
});

describe("qué espacios tapan a este", () => {
  it("el espacio se tapa a sí mismo", () => {
    expect(blockingSpaceIds(salon, todos, compatibilidades)).toContain(salon);
  });

  it("el salón tapa a todos porque no convive con nadie", () => {
    expect(blockingSpaceIds(salon, todos, compatibilidades).sort()).toEqual(
      [coworking, estudio, salon].sort(),
    );
  });

  it("el estudio no es tapado por el coworking, con el que sí convive", () => {
    const bloquean = blockingSpaceIds(estudio, todos, compatibilidades);
    expect(bloquean).toContain(salon);
    expect(bloquean).toContain(estudio);
    expect(bloquean).not.toContain(coworking);
  });

  it("un espacio nuevo bloquea a todos hasta que alguien diga lo contrario", () => {
    // Es EL defecto del módulo: el error posible pasa a ser "no me deja reservar",
    // que se nota, en lugar de "vendí dos veces el mismo salón", que se nota tarde.
    const nuevo = "laboratorio";
    const bloquean = blockingSpaceIds(nuevo, [...todos, nuevo], compatibilidades);
    expect(bloquean.sort()).toEqual([...todos, nuevo].sort());
  });

  it("sin ninguna compatibilidad declarada, todos se bloquean entre sí", () => {
    expect(blockingSpaceIds(estudio, todos, []).sort()).toEqual(todos.slice().sort());
  });
});

describe("con quiénes convive", () => {
  it("devuelve el otro lado del par, sin importar de qué lado esté", () => {
    expect(compatibleSpaceIds(estudio, compatibilidades)).toEqual([coworking]);
    expect(compatibleSpaceIds(coworking, compatibilidades)).toEqual([estudio]);
  });

  it("un espacio sin compatibilidades devuelve la lista vacía", () => {
    expect(compatibleSpaceIds(salon, compatibilidades)).toEqual([]);
  });
});

describe("guardar las compatibilidades de un espacio", () => {
  it("arma un par normalizado por cada espacio elegido", () => {
    expect(pairsForSpace(estudio, [coworking, salon])).toEqual([
      normalizePair(estudio, coworking),
      normalizePair(estudio, salon),
    ]);
  });

  it("un espacio no puede ser compatible consigo mismo", () => {
    expect(pairsForSpace(estudio, [estudio, coworking])).toEqual([
      normalizePair(estudio, coworking),
    ]);
  });

  it("elegir dos veces el mismo no duplica el par", () => {
    expect(pairsForSpace(estudio, [coworking, coworking])).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
pnpm test lib/bookings/conflicts.test.ts
```

Esperado: FALLA con `Failed to resolve import "./conflicts"`.

- [ ] **Step 3: Escribir la implementación**

Crear `lib/bookings/conflicts.ts`:

```ts
/**
 * Quién bloquea a quién. Módulo PURO: sin base y sin red.
 *
 * ── El defecto es bloquear ──
 *
 * La tabla guarda los pares que SÍ pueden convivir. Todo lo que no está declarado es
 * incompatible. Al revés sería más cómodo de cargar, pero un espacio nuevo mal configurado
 * se alquilaría encima de otro sin que nadie se entere.
 *
 * Elegido así a propósito: el error posible es "no me deja reservar", que la Secretaría
 * nota el primer día y corrige en dos minutos. El error contrario son dos personas
 * llegando el sábado al mismo salón.
 */

export type CompatibilityPair = { spaceAId: string; spaceBId: string };

/** Una sola fila por par, siempre con el menor primero. Sin esto habría duplicados. */
export function normalizePair(a: string, b: string): CompatibilityPair {
  return a <= b ? { spaceAId: a, spaceBId: b } : { spaceAId: b, spaceBId: a };
}

/** Con qué espacios puede convivir. El otro lado del par, mire de donde se mire. */
export function compatibleSpaceIds(
  spaceId: string,
  compatibilities: readonly CompatibilityPair[],
): string[] {
  const salida: string[] = [];
  for (const par of compatibilities) {
    if (par.spaceAId === spaceId) salida.push(par.spaceBId);
    else if (par.spaceBId === spaceId) salida.push(par.spaceAId);
  }
  return salida;
}

/**
 * Qué espacios ocupados tapan a este. **Se incluye a sí mismo**: un espacio siempre se
 * bloquea con sus propias reservas.
 *
 * Es lo que se le pasa al motor de disponibilidad para juntar la ocupación.
 */
export function blockingSpaceIds(
  spaceId: string,
  allSpaceIds: readonly string[],
  compatibilities: readonly CompatibilityPair[],
): string[] {
  const conviven = new Set(compatibleSpaceIds(spaceId, compatibilities));
  return allSpaceIds.filter((id) => id === spaceId || !conviven.has(id));
}

/** Los pares a guardar cuando el dueño elige con quiénes convive un espacio. */
export function pairsForSpace(
  spaceId: string,
  compatibleWith: readonly string[],
): CompatibilityPair[] {
  const vistos = new Set<string>();
  const salida: CompatibilityPair[] = [];
  for (const otro of compatibleWith) {
    if (otro === spaceId || vistos.has(otro)) continue;
    vistos.add(otro);
    salida.push(normalizePair(spaceId, otro));
  }
  return salida;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
pnpm test lib/bookings/conflicts.test.ts
```

Esperado: PASA, 11 tests.

- [ ] **Step 5: Commitear**

```bash
git add lib/bookings/conflicts.ts lib/bookings/conflicts.test.ts
git commit -m "$(cat <<'MSG'
Un espacio nuevo bloquea a todos hasta que se diga lo contrario

Ocupar el salón tiene que tomar también el estudio y el coworking. El defecto
es bloquear: el error posible pasa a ser "no me deja reservar", que se nota.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 6: El repositorio

La única puerta a las tablas de reservas. Junta lo que el motor puro necesita —horarios, cierres, ocupación de los espacios que bloquean— y se lo pasa resuelto.

**Files:**
- Create: `lib/bookings/constants.ts`
- Create: `lib/bookings/repository.ts`
- Test: `lib/bookings/repository.test.ts`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces:
  - `BOOKINGS_MODULE_KEY = "bookings"`
  - `ACTIVE_BOOKING_STATUSES = ["HOLD", "PENDING_APPROVAL", "CONFIRMED"]`
  - `type SpaceRecord` — el espacio con sus horarios y sus compatibilidades ya resueltas
  - `listSpaces(workspaceId: string, options?: { includeInactive?: boolean }): Promise<SpaceRecord[]>`
  - `getSpace(workspaceId: string, spaceId: string): Promise<SpaceRecord | null>`
  - `loadAvailabilityContext(workspaceId: string, spaceId: string, range: Interval): Promise<Omit<AvailabilityInput, "range"> | null>`
  - `listCompatibilities(workspaceId: string): Promise<CompatibilityPair[]>`
  - `listBookingsInRange(workspaceId: string, range: Interval): Promise<BookingRow[]>`
  - `getBookingSettings(workspaceId: string): Promise<{ holdHours: number; cancelWindowHours: number }>`

- [ ] **Step 1: Escribir las constantes**

Crear `lib/bookings/constants.ts`:

```ts
/**
 * Clave interna del módulo de reservas (registro de módulos + interruptor por workspace).
 * Mismo patrón que members/membership-dues/courses-sales.
 *
 * La clave ya estaba reservada como `PLANNED` en `lib/modules/registry.ts` desde antes de
 * que existiera una línea de código del módulo.
 */
export const BOOKINGS_MODULE_KEY = "bookings";

/**
 * Los estados que OCUPAN el espacio.
 *
 * Es la misma lista que usa la restricción `Booking_sin_solapamiento` de la base. Si las
 * dos se separan, la base y la aplicación empiezan a discrepar sobre qué es "ocupado".
 */
export const ACTIVE_BOOKING_STATUSES = ["HOLD", "PENDING_APPROVAL", "CONFIRMED"] as const;

export type BookingStatus =
  | (typeof ACTIVE_BOOKING_STATUSES)[number]
  | "CANCELLED"
  | "EXPIRED";
```

- [ ] **Step 2: Escribir el test que falla**

Crear `lib/bookings/repository.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const espacios = vi.fn();
const reservas = vi.fn();
const cierres = vi.fn();
const compatibilidades = vi.fn();
const settings = vi.fn();

vi.mock("@repo/db", () => ({
  prisma: {
    bookingSpace: { findMany: (...a: unknown[]) => espacios(...a) },
    booking: { findMany: (...a: unknown[]) => reservas(...a) },
    bookingClosure: { findMany: (...a: unknown[]) => cierres(...a) },
    bookingSpaceCompatibility: { findMany: (...a: unknown[]) => compatibilidades(...a) },
    bookingSettings: { findUnique: (...a: unknown[]) => settings(...a) },
  },
}));

import { loadAvailabilityContext } from "./repository";

const filaEspacio = (id: string, name: string) => ({
  id,
  workspaceId: "ws-1",
  name,
  slug: name.toLowerCase(),
  description: null,
  imageUrl: null,
  active: true,
  order: 0,
  slotMinutes: 60,
  minBookingMinutes: 60,
  maxBookingMinutes: null,
  bufferMinutes: 0,
  minAdvanceHours: 2,
  maxAdvanceDays: 90,
  requiresApproval: false,
  memberHourlyPriceArs: "3000.00",
  nonMemberHourlyPriceArs: "5000.00",
  memberFreeHoursPerMonth: 0,
  allowsNonMembers: true,
  googleCalendarId: null,
  hours: [{ weekday: 6, startMinute: 540, endMinute: 780 }],
});

const rango = {
  startAt: new Date("2026-09-19T00:00:00Z"),
  endAt: new Date("2026-09-20T00:00:00Z"),
};

describe("el contexto que necesita el motor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    espacios.mockResolvedValue([
      filaEspacio("salon", "Salon"),
      filaEspacio("estudio", "Estudio"),
      filaEspacio("coworking", "Coworking"),
    ]);
    compatibilidades.mockResolvedValue([{ spaceAId: "coworking", spaceBId: "estudio" }]);
    cierres.mockResolvedValue([]);
    reservas.mockResolvedValue([]);
    settings.mockResolvedValue(null);
  });

  it("un espacio que no existe devuelve null", async () => {
    expect(await loadAvailabilityContext("ws-1", "inexistente", rango)).toBeNull();
  });

  it("trae los horarios del espacio pedido", async () => {
    const ctx = await loadAvailabilityContext("ws-1", "estudio", rango);
    expect(ctx?.weeklyHours).toEqual([{ weekday: 6, startMinute: 540, endMinute: 780 }]);
  });

  it("pide las reservas de los espacios que bloquean, no solo las propias", async () => {
    await loadAvailabilityContext("ws-1", "estudio", rango);
    const consulta = reservas.mock.calls[0][0] as { where: { spaceId: { in: string[] } } };
    // El estudio convive con el coworking, así que solo lo bloquean el salón y él mismo.
    expect(consulta.where.spaceId.in.sort()).toEqual(["estudio", "salon"]);
  });

  it("el salón no convive con nadie: lo bloquean los tres", async () => {
    await loadAvailabilityContext("ws-1", "salon", rango);
    const consulta = reservas.mock.calls[0][0] as { where: { spaceId: { in: string[] } } };
    expect(consulta.where.spaceId.in.sort()).toEqual(["coworking", "estudio", "salon"]);
  });

  it("solo cuentan las reservas que ocupan: una cancelada no tapa nada", async () => {
    await loadAvailabilityContext("ws-1", "estudio", rango);
    const consulta = reservas.mock.calls[0][0] as { where: { status: { in: string[] } } };
    expect(consulta.where.status.in).toEqual(["HOLD", "PENDING_APPROVAL", "CONFIRMED"]);
  });

  it("los cierres de toda la institución tapan igual que los del espacio", async () => {
    cierres.mockResolvedValue([
      { startAt: new Date("2026-09-19T12:00:00Z"), endAt: new Date("2026-09-19T14:00:00Z") },
    ]);
    const ctx = await loadAvailabilityContext("ws-1", "estudio", rango);
    expect(ctx?.closures).toHaveLength(1);
    const consulta = cierres.mock.calls[0][0] as { where: { OR: unknown[] } };
    expect(consulta.where.OR).toHaveLength(2);
  });

  it("la ocupación llega al motor como rangos, sin decir de qué espacio es", async () => {
    reservas.mockResolvedValue([
      {
        spaceId: "salon",
        startAt: new Date("2026-09-19T21:00:00Z"),
        endAt: new Date("2026-09-20T02:00:00Z"),
      },
    ]);
    const ctx = await loadAvailabilityContext("ws-1", "estudio", rango);
    expect(ctx?.busy).toEqual([
      { startAt: new Date("2026-09-19T21:00:00Z"), endAt: new Date("2026-09-20T02:00:00Z") },
    ]);
  });

  it("los precios llegan en centavos, no en pesos con coma", async () => {
    const ctx = await loadAvailabilityContext("ws-1", "estudio", rango);
    expect(ctx?.space.slotMinutes).toBe(60);
  });
});
```

- [ ] **Step 3: Correr el test y verificar que falla**

```bash
pnpm test lib/bookings/repository.test.ts
```

Esperado: FALLA con `Failed to resolve import "./repository"`.

- [ ] **Step 4: Escribir la implementación**

Crear `lib/bookings/repository.ts`:

```ts
import "server-only";
import { prisma } from "@repo/db";
import { decimalArsToMinor } from "@/lib/membership/money";
import { ACTIVE_BOOKING_STATUSES } from "./constants";
import { blockingSpaceIds, type CompatibilityPair } from "./conflicts";
import type { AvailabilityInput, SpaceRules, WeeklyHour } from "./availability";
import { BOOKINGS_TIME_ZONE, type Interval } from "./time";

/**
 * Única puerta a las tablas de reservas.
 *
 * Su trabajo es juntar lo que el motor puro necesita y pasárselo resuelto: horarios,
 * cierres y la ocupación de TODOS los espacios que bloquean a este. El motor no sabe de
 * incompatibilidades — las resuelve esta capa, y por eso el motor puede probarse sin base.
 *
 * Toda consulta lleva `workspaceId`.
 */

export type SpaceRecord = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  active: boolean;
  order: number;
  rules: SpaceRules;
  requiresApproval: boolean;
  memberHourlyPriceMinor: number;
  nonMemberHourlyPriceMinor: number;
  memberFreeHoursPerMonth: number;
  allowsNonMembers: boolean;
  googleCalendarId: string | null;
  weeklyHours: WeeklyHour[];
};

type FilaEspacio = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  active: boolean;
  order: number;
  slotMinutes: number;
  minBookingMinutes: number;
  maxBookingMinutes: number | null;
  bufferMinutes: number;
  minAdvanceHours: number;
  maxAdvanceDays: number;
  requiresApproval: boolean;
  memberHourlyPriceArs: { toString(): string };
  nonMemberHourlyPriceArs: { toString(): string };
  memberFreeHoursPerMonth: number;
  allowsNonMembers: boolean;
  googleCalendarId: string | null;
  hours: { weekday: number; startMinute: number; endMinute: number }[];
};

const INCLUIR_HORARIOS = { hours: { orderBy: [{ weekday: "asc" }, { startMinute: "asc" }] } } as const;

function toRecord(fila: FilaEspacio): SpaceRecord {
  return {
    id: fila.id,
    name: fila.name,
    slug: fila.slug,
    description: fila.description,
    imageUrl: fila.imageUrl,
    active: fila.active,
    order: fila.order,
    rules: {
      slotMinutes: fila.slotMinutes,
      minBookingMinutes: fila.minBookingMinutes,
      maxBookingMinutes: fila.maxBookingMinutes,
      bufferMinutes: fila.bufferMinutes,
      minAdvanceHours: fila.minAdvanceHours,
      maxAdvanceDays: fila.maxAdvanceDays,
    },
    requiresApproval: fila.requiresApproval,
    // A centavos apenas sale de la base: adentro del módulo el dinero no vuelve a ser decimal.
    memberHourlyPriceMinor: decimalArsToMinor(fila.memberHourlyPriceArs),
    nonMemberHourlyPriceMinor: decimalArsToMinor(fila.nonMemberHourlyPriceArs),
    memberFreeHoursPerMonth: fila.memberFreeHoursPerMonth,
    allowsNonMembers: fila.allowsNonMembers,
    googleCalendarId: fila.googleCalendarId,
    weeklyHours: fila.hours,
  };
}

export async function listSpaces(
  workspaceId: string,
  options?: { includeInactive?: boolean },
): Promise<SpaceRecord[]> {
  const filas = (await prisma.bookingSpace.findMany({
    where: { workspaceId, ...(options?.includeInactive ? {} : { active: true }) },
    include: INCLUIR_HORARIOS,
    orderBy: [{ order: "asc" }, { name: "asc" }],
  })) as unknown as FilaEspacio[];
  return filas.map(toRecord);
}

export async function getSpace(
  workspaceId: string,
  spaceId: string,
): Promise<SpaceRecord | null> {
  const filas = (await prisma.bookingSpace.findMany({
    where: { workspaceId, id: spaceId },
    include: INCLUIR_HORARIOS,
    take: 1,
  })) as unknown as FilaEspacio[];
  return filas[0] ? toRecord(filas[0]) : null;
}

export async function listCompatibilities(workspaceId: string): Promise<CompatibilityPair[]> {
  const espacios = await prisma.bookingSpace.findMany({
    where: { workspaceId },
    select: { id: true },
  });
  const ids = espacios.map((e) => e.id);
  if (ids.length === 0) return [];
  const filas = await prisma.bookingSpaceCompatibility.findMany({
    where: { spaceAId: { in: ids } },
    select: { spaceAId: true, spaceBId: true },
  });
  return filas;
}

/**
 * Todo lo que el motor necesita para responder sobre un espacio, menos la ventana.
 *
 * Devuelve `null` si el espacio no existe en ese workspace — nunca lanza por eso: pedir un
 * espacio inexistente es algo que puede pasar con una URL vieja, no una falla del sistema.
 */
export async function loadAvailabilityContext(
  workspaceId: string,
  spaceId: string,
  range: Interval,
  now: Date = new Date(),
): Promise<Omit<AvailabilityInput, "range"> | null> {
  const [espacios, compatibilidades] = await Promise.all([
    listSpaces(workspaceId, { includeInactive: true }),
    listCompatibilities(workspaceId),
  ]);

  const espacio = espacios.find((e) => e.id === spaceId);
  if (!espacio) return null;

  const bloquean = blockingSpaceIds(
    spaceId,
    espacios.map((e) => e.id),
    compatibilidades,
  ).sort();

  const [ocupacion, cierresFilas] = await Promise.all([
    prisma.booking.findMany({
      where: {
        workspaceId,
        spaceId: { in: bloquean },
        status: { in: [...ACTIVE_BOOKING_STATUSES] },
        // Una reserva que empieza antes de la ventana pero termina adentro también tapa.
        startAt: { lt: range.endAt },
        endAt: { gt: range.startAt },
      },
      select: { startAt: true, endAt: true },
    }),
    prisma.bookingClosure.findMany({
      where: {
        workspaceId,
        OR: [{ spaceId: null }, { spaceId }],
        startAt: { lt: range.endAt },
        endAt: { gt: range.startAt },
      },
      select: { startAt: true, endAt: true },
    }),
  ]);

  return {
    space: espacio.rules,
    weeklyHours: espacio.weeklyHours,
    closures: cierresFilas.map((c) => ({ startAt: c.startAt, endAt: c.endAt })),
    busy: ocupacion.map((b) => ({ startAt: b.startAt, endAt: b.endAt })),
    now,
    timeZone: BOOKINGS_TIME_ZONE,
  };
}

export type BookingRow = {
  id: string;
  spaceId: string;
  startAt: Date;
  endAt: Date;
  status: string;
  contactName: string;
  customerType: string;
  paymentMethod: string;
  paymentStatus: string;
  totalArs: { toString(): string };
  holdExpiresAt: Date | null;
};

/** Lo que muestra la agenda del equipo. Incluye canceladas para poder explicarlas. */
export async function listBookingsInRange(
  workspaceId: string,
  range: Interval,
): Promise<BookingRow[]> {
  return (await prisma.booking.findMany({
    where: { workspaceId, startAt: { lt: range.endAt }, endAt: { gt: range.startAt } },
    orderBy: [{ startAt: "asc" }],
    select: {
      id: true,
      spaceId: true,
      startAt: true,
      endAt: true,
      status: true,
      contactName: true,
      customerType: true,
      paymentMethod: true,
      paymentStatus: true,
      totalArs: true,
      holdExpiresAt: true,
    },
  })) as unknown as BookingRow[];
}

/** Sin fila configurada rigen los valores por defecto. No se crea nada al leer. */
export async function getBookingSettings(
  workspaceId: string,
): Promise<{ holdHours: number; cancelWindowHours: number }> {
  const fila = await prisma.bookingSettings.findUnique({
    where: { workspaceId },
    select: { holdHours: true, cancelWindowHours: true },
  });
  return { holdHours: fila?.holdHours ?? 24, cancelWindowHours: fila?.cancelWindowHours ?? 24 };
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

```bash
pnpm test lib/bookings/repository.test.ts
```

Esperado: PASA, 8 tests.

- [ ] **Step 6: Commitear**

```bash
git add lib/bookings/constants.ts lib/bookings/repository.ts lib/bookings/repository.test.ts
git commit -m "$(cat <<'MSG'
La ocupación de los espacios que bloquean llega junta al motor

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 7: Crear y cancelar una reserva

La operación crítica. Verifica dentro de una transacción y deja que la base tenga la última palabra.

**Files:**
- Create: `lib/bookings/create.ts`
- Test: `lib/bookings/create.test.ts`

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces:
  - `type CreateBookingInput = { workspaceId: string; spaceId: string; range: Interval; customerType: CustomerType; memberId: string | null; userId: number | null; contactName: string; contactEmail: string; contactPhone: string | null; freeMinutesAvailable: number; paymentMethod: string; notes?: string | null; createdByUserId: number | null; now?: Date }`
  - `type CreateBookingResult = { ok: true; bookingId: string; quote: Quote; status: BookingStatus } | { ok: false; error: string }`
  - `createBooking(input: CreateBookingInput): Promise<CreateBookingResult>`
  - `isOverlapConstraintError(error: unknown): boolean`
  - `cancelBooking(input: { workspaceId: string; bookingId: string; byUserId: number | null; reason: string }): Promise<{ ok: boolean; error?: string }>`

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/bookings/create.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isOverlapConstraintError } from "./create";

describe("el choque que informa la base", () => {
  it("reconoce la violación de la restricción de solapamiento", () => {
    // Postgres devuelve 23P01 (exclusion_violation) y Prisma lo pasa como P2010
    // con el detalle adentro. Reconocerlo es lo que permite responder "ese horario
    // se acaba de ocupar" en vez de un error genérico.
    const error = Object.assign(new Error("boom"), {
      code: "P2010",
      meta: { code: "23P01", message: 'conflicting key value violates exclusion constraint "Booking_sin_solapamiento"' },
    });
    expect(isOverlapConstraintError(error)).toBe(true);
  });

  it("reconoce el código de Postgres aunque venga suelto", () => {
    expect(isOverlapConstraintError(Object.assign(new Error("x"), { code: "23P01" }))).toBe(true);
  });

  it("reconoce el nombre de la restricción en el texto", () => {
    expect(isOverlapConstraintError(new Error('violates constraint "Booking_sin_solapamiento"'))).toBe(
      true,
    );
  });

  it("no confunde otros errores con un choque de horarios", () => {
    expect(isOverlapConstraintError(new Error("la base no responde"))).toBe(false);
    expect(isOverlapConstraintError(Object.assign(new Error("x"), { code: "P2002" }))).toBe(false);
    expect(isOverlapConstraintError(null)).toBe(false);
    expect(isOverlapConstraintError(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
pnpm test lib/bookings/create.test.ts
```

Esperado: FALLA con `Failed to resolve import "./create"`.

- [ ] **Step 3: Escribir la implementación**

Crear `lib/bookings/create.ts`:

```ts
import "server-only";
import { prisma } from "@repo/db";
import { minorToDecimalString } from "@/lib/membership/money";
import { sanitizeError } from "@/lib/payments/connect/log";
import { ACTIVE_BOOKING_STATUSES, type BookingStatus } from "./constants";
import { checkRange, rejectionMessage } from "./availability";
import { blockingSpaceIds } from "./conflicts";
import { quoteBooking, type CustomerType, type Quote } from "./pricing";
import { getBookingSettings, getSpace, listCompatibilities, listSpaces } from "./repository";
import { BOOKINGS_TIME_ZONE, addMinutes, type Interval } from "./time";

/**
 * Crear una reserva.
 *
 * ── Dos defensas, no una ──
 *
 * La primera es esta transacción: vuelve a leer la ocupación y a validar el rango contra
 * el motor, con los datos de este instante y no con los que tenía la pantalla.
 *
 * La segunda es la restricción `Booking_sin_solapamiento` de la base. Hace falta igual:
 * entre el "¿está libre?" y el `INSERT` hay un hueco de milisegundos donde otra
 * transacción puede insertar lo mismo, y ninguna verificación hecha en la aplicación puede
 * cerrarlo. Cuando eso pasa, el `INSERT` falla y acá se traduce a "ese horario se acaba de
 * ocupar" — que es exactamente lo que ocurrió.
 *
 * La transacción no es redundante: sin ella, el choque ENTRE espacios incompatibles (que
 * la restricción no cubre) no se detectaría nunca.
 */

export type CreateBookingInput = {
  workspaceId: string;
  spaceId: string;
  range: Interval;
  customerType: CustomerType;
  memberId: string | null;
  userId: number | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  /** Minutos bonificados que le quedan al socio este mes. Cero para un no socio. */
  freeMinutesAvailable: number;
  /** MERCADO_PAGO | TRANSFERENCIA | SIN_CARGO | PRESENCIAL */
  paymentMethod: string;
  notes?: string | null;
  /** Quién la carga, cuando la carga el equipo. Null si la carga la propia persona. */
  createdByUserId: number | null;
  now?: Date;
};

export type CreateBookingResult =
  | { ok: true; bookingId: string; quote: Quote; status: BookingStatus }
  | { ok: false; error: string };

const CHOQUE = "Ese horario se acaba de ocupar. Elegí otro.";

/**
 * ¿Falló porque otra reserva ganó la carrera?
 *
 * Postgres devuelve `23P01` (exclusion_violation). Prisma lo envuelve como `P2010`, así que
 * se mira el código propio, el de Postgres y el nombre de la restricción en el texto: los
 * tres caminos por los que ese mismo hecho puede llegar hasta acá.
 */
export function isOverlapConstraintError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: unknown; meta?: { code?: unknown; message?: unknown }; message?: unknown };
  if (e.code === "23P01" || e.meta?.code === "23P01") return true;
  const textos = [e.message, e.meta?.message].filter((t): t is string => typeof t === "string");
  return textos.some((t) => t.includes("Booking_sin_solapamiento") || t.includes("23P01"));
}

export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const now = input.now ?? new Date();

  const [espacio, espacios, compatibilidades, settings] = await Promise.all([
    getSpace(input.workspaceId, input.spaceId),
    listSpaces(input.workspaceId, { includeInactive: true }),
    listCompatibilities(input.workspaceId),
    getBookingSettings(input.workspaceId),
  ]);

  if (!espacio) return { ok: false, error: "Ese espacio no existe." };
  if (!espacio.active) return { ok: false, error: "Ese espacio no está disponible." };
  if (input.customerType === "NON_MEMBER" && !espacio.allowsNonMembers) {
    return { ok: false, error: "Este espacio se alquila solo a socios." };
  }

  const bloquean = blockingSpaceIds(input.spaceId, espacios.map((e) => e.id), compatibilidades);

  const minutos = (input.range.endAt.getTime() - input.range.startAt.getTime()) / 60_000;
  const quote = quoteBooking({
    minutes: minutos,
    customerType: input.customerType,
    memberHourlyPriceMinor: espacio.memberHourlyPriceMinor,
    nonMemberHourlyPriceMinor: espacio.nonMemberHourlyPriceMinor,
    freeMinutesAvailable: input.freeMinutesAvailable,
  });

  // Una reserva sin cargo no espera ningún pago; una que requiere aprobación no cobra
  // hasta que alguien decida. El resto nace bloqueada con su vencimiento.
  const sinCargo = quote.totalMinor === 0;
  const status: BookingStatus = espacio.requiresApproval
    ? "PENDING_APPROVAL"
    : sinCargo || input.paymentMethod === "PRESENCIAL"
      ? "CONFIRMED"
      : "HOLD";

  const holdExpiresAt =
    status === "CONFIRMED"
      ? null
      : // Nunca más tarde que el comienzo de la reserva: un bloqueo que vence después de
        // que la reserva empezó no protege nada.
        new Date(
          Math.min(
            addMinutes(now, settings.holdHours * 60).getTime(),
            input.range.startAt.getTime(),
          ),
        );

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
        select: { startAt: true, endAt: true },
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
        busy: ocupacion,
        now,
        timeZone: BOOKINGS_TIME_ZONE,
      });
      if (!veredicto.ok) throw new BookingRejected(rejectionMessage(veredicto.reason));

      return tx.booking.create({
        data: {
          workspaceId: input.workspaceId,
          spaceId: input.spaceId,
          startAt: input.range.startAt,
          endAt: input.range.endAt,
          status,
          holdExpiresAt,
          memberId: input.memberId,
          userId: input.userId,
          contactName: input.contactName,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
          customerType: input.customerType,
          billedMinutes: quote.billedMinutes,
          freeMinutesUsed: quote.freeMinutesUsed,
          hourlyPriceArs: minorToDecimalString(quote.hourlyPriceMinor),
          totalArs: minorToDecimalString(quote.totalMinor),
          paymentMethod: sinCargo ? "SIN_CARGO" : input.paymentMethod,
          paymentStatus: sinCargo ? "NOT_REQUIRED" : "PENDING",
          notes: input.notes ?? null,
          createdByUserId: input.createdByUserId,
        },
        select: { id: true },
      });
    });

    return { ok: true, bookingId: creada.id, quote, status };
  } catch (error) {
    if (error instanceof BookingRejected) return { ok: false, error: error.message };
    if (isOverlapConstraintError(error)) return { ok: false, error: CHOQUE };

    console.error("[fotoffice][reservas] no se pudo crear la reserva", {
      workspaceId: input.workspaceId,
      spaceId: input.spaceId,
      detalle: sanitizeError(error),
    });
    return { ok: false, error: "No pudimos guardar la reserva. Probá de nuevo en un rato." };
  }
}

/** Motivo de negocio, no falla técnica: viaja tal cual a la persona. */
class BookingRejected extends Error {}

/**
 * Cancelar libera el horario. **No devuelve dinero**: si estaba paga, la devolución la
 * resuelve la institución por fuera y queda anotada en el motivo. Devolver por Mercado Pago
 * desde el sistema es un circuito propio y no entra en esta etapa.
 */
export async function cancelBooking(input: {
  workspaceId: string;
  bookingId: string;
  byUserId: number | null;
  reason: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const actualizadas = await prisma.booking.updateMany({
      where: {
        id: input.bookingId,
        workspaceId: input.workspaceId,
        status: { in: [...ACTIVE_BOOKING_STATUSES] },
      },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledByUserId: input.byUserId,
        cancelReason: input.reason.slice(0, 500),
        holdExpiresAt: null,
      },
    });
    if (actualizadas.count === 0) {
      return { ok: false, error: "Esa reserva ya no está activa." };
    }
    return { ok: true };
  } catch (error) {
    console.error("[fotoffice][reservas] no se pudo cancelar", {
      bookingId: input.bookingId,
      detalle: sanitizeError(error),
    });
    return { ok: false, error: "No pudimos cancelar la reserva. Probá de nuevo en un rato." };
  }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
pnpm test lib/bookings/create.test.ts && npx tsc --noEmit
```

Esperado: PASA, 4 tests, y sin errores de tipos.

- [ ] **Step 5: Probar el choque real contra la base**

Los tests de arriba prueban el reconocimiento del error, no la restricción. Esto prueba la restricción de verdad. Crear un archivo temporal `packages/db/prueba-solapamiento.tmp.mjs`:

```js
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const ws = await p.workspace.findFirst({ where: { name: "SFPR" }, select: { id: true } });
const espacio = await p.bookingSpace.create({
  data: {
    workspaceId: ws.id,
    name: "PRUEBA solapamiento",
    slug: `prueba-${Date.now()}`,
    memberHourlyPriceArs: "1000.00",
    nonMemberHourlyPriceArs: "2000.00",
  },
  select: { id: true },
});

const comun = {
  workspaceId: ws.id,
  spaceId: espacio.id,
  status: "CONFIRMED",
  contactName: "Prueba",
  contactEmail: "prueba@example.com",
  customerType: "MEMBER",
  billedMinutes: 60,
  hourlyPriceArs: "1000.00",
  totalArs: "1000.00",
  paymentMethod: "PRESENCIAL",
  paymentStatus: "NOT_REQUIRED",
};

await p.booking.create({
  data: { ...comun, startAt: new Date("2099-01-01T14:00:00Z"), endAt: new Date("2099-01-01T16:00:00Z") },
});
console.log("primera reserva: guardada");

try {
  await p.booking.create({
    data: { ...comun, startAt: new Date("2099-01-01T15:00:00Z"), endAt: new Date("2099-01-01T17:00:00Z") },
  });
  console.log("MAL: la base aceptó una reserva superpuesta");
} catch (e) {
  console.log("BIEN: la base rechazó la superpuesta —", String(e).slice(0, 120));
}

// Pegadas: de 16 a 18 tiene que entrar.
await p.booking.create({
  data: { ...comun, startAt: new Date("2099-01-01T16:00:00Z"), endAt: new Date("2099-01-01T18:00:00Z") },
});
console.log("BIEN: una reserva pegada sí entra");

await p.booking.deleteMany({ where: { spaceId: espacio.id } });
await p.bookingSpace.delete({ where: { id: espacio.id } });
console.log("limpieza hecha");
await p.$disconnect();
```

```bash
cd ../../packages/db && node --env-file=.env ./prueba-solapamiento.tmp.mjs; rm -f ./prueba-solapamiento.tmp.mjs
```

Esperado, en este orden: `primera reserva: guardada`, `BIEN: la base rechazó la superpuesta`, `BIEN: una reserva pegada sí entra`, `limpieza hecha`. **Si aparece "MAL", parar**: la restricción no quedó creada y hay que volver a la Task 4. Verificar además que el espacio de prueba no quedó en la base.

- [ ] **Step 6: Commitear**

```bash
git add lib/bookings/create.ts lib/bookings/create.test.ts
git commit -m "$(cat <<'MSG'
Dos personas no pueden reservar el mismo horario

La transacción cubre el choque entre espacios incompatibles; la restricción de
la base cubre el hueco de milisegundos que ninguna verificación puede cerrar.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```


---

### Task 7.bis: Extras — disponibilidad y precio

Módulo puro. Decide qué extras se pueden ofrecer en un rango y cuánto cuestan. Va antes de las pantallas porque la agenda y el formulario dependen de él.

**Files:**
- Create: `lib/bookings/extras.ts`
- Test: `lib/bookings/extras.test.ts`

**Interfaces:**
- Consumes: `Interval`, `overlaps` (Task 1); `CustomerType` (Task 3).
- Produces:
  - `type ExtraPriceMode = "PER_BOOKING" | "PER_HOUR"`
  - `type ExtraDefinition = { id: string; name: string; priceMode: ExtraPriceMode; memberPriceMinor: number; nonMemberPriceMinor: number; resourceId: string | null; unitsConsumed: number; requiresConfirmation: boolean }`
  - `type ResourceStock = { resourceId: string; quantity: number }`
  - `type Commitment = { resourceId: string; units: number; range: Interval }`
  - `type ExtraOffer = { extra: ExtraDefinition; available: boolean; unitsFree: number | null; amountMinor: number }`
  - `unitsCommitted(resourceId: string, range: Interval, commitments: readonly Commitment[]): number`
  - `offerExtras(input: { extras: readonly ExtraDefinition[]; stock: readonly ResourceStock[]; commitments: readonly Commitment[]; range: Interval; customerType: CustomerType }): ExtraOffer[]`
  - `extrasTotalMinor(offers: readonly ExtraOffer[], chosenIds: readonly string[]): number`
  - `anyRequiresConfirmation(offers: readonly ExtraOffer[], chosenIds: readonly string[]): boolean`

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/bookings/extras.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  anyRequiresConfirmation,
  extrasTotalMinor,
  offerExtras,
  unitsCommitted,
} from "./extras";

const r = (a: string, b: string) => ({ startAt: new Date(a), endAt: new Date(b) });
const sabado14a16 = r("2026-09-19T17:00:00Z", "2026-09-19T19:00:00Z");

const flashSuelto = {
  id: "flash-1",
  name: "Flash adicional",
  priceMode: "PER_BOOKING" as const,
  memberPriceMinor: 100_000,
  nonMemberPriceMinor: 150_000,
  resourceId: "res-flash",
  unitsConsumed: 1,
  requiresConfirmation: false,
};

const packDeDos = {
  ...flashSuelto,
  id: "flash-pack",
  name: "Pack de 2 flashes",
  // Promocional: menos que dos sueltos.
  memberPriceMinor: 160_000,
  nonMemberPriceMinor: 250_000,
  unitsConsumed: 2,
};

const humo = {
  id: "humo",
  name: "Máquina de humo",
  priceMode: "PER_BOOKING" as const,
  memberPriceMinor: 50_000,
  nonMemberPriceMinor: 80_000,
  resourceId: "res-humo",
  unitsConsumed: 1,
  requiresConfirmation: false,
};

const modelo = {
  id: "modelo",
  name: "Modelo",
  priceMode: "PER_HOUR" as const,
  memberPriceMinor: 200_000,
  nonMemberPriceMinor: 300_000,
  resourceId: "res-modelo",
  unitsConsumed: 1,
  requiresConfirmation: true,
};

const fondo = {
  id: "fondo",
  name: "Fondo de papel",
  priceMode: "PER_BOOKING" as const,
  memberPriceMinor: 20_000,
  nonMemberPriceMinor: 30_000,
  // Sin recurso: hay de sobra, no se controla.
  resourceId: null,
  unitsConsumed: 1,
  requiresConfirmation: false,
};

const stock = [
  { resourceId: "res-flash", quantity: 2 },
  { resourceId: "res-humo", quantity: 1 },
  { resourceId: "res-modelo", quantity: 1 },
];

const base = {
  extras: [flashSuelto, packDeDos, humo, modelo, fondo],
  stock,
  commitments: [],
  range: sabado14a16,
  customerType: "MEMBER" as const,
};

describe("unidades ya comprometidas", () => {
  it("suma solo lo que se pisa con el rango pedido", () => {
    const comprometidas = unitsCommitted("res-flash", sabado14a16, [
      { resourceId: "res-flash", units: 1, range: r("2026-09-19T18:00:00Z", "2026-09-19T20:00:00Z") },
      { resourceId: "res-flash", units: 1, range: r("2026-09-19T22:00:00Z", "2026-09-19T23:00:00Z") },
    ]);
    expect(comprometidas).toBe(1);
  });

  it("no mezcla recursos distintos", () => {
    expect(
      unitsCommitted("res-flash", sabado14a16, [
        { resourceId: "res-humo", units: 1, range: sabado14a16 },
      ]),
    ).toBe(0);
  });

  it("dos reservas pegadas no se comprometen entre sí", () => {
    expect(
      unitsCommitted("res-flash", sabado14a16, [
        { resourceId: "res-flash", units: 2, range: r("2026-09-19T19:00:00Z", "2026-09-19T21:00:00Z") },
      ]),
    ).toBe(0);
  });
});

describe("qué extras se pueden ofrecer", () => {
  it("sin nada comprometido, todos están disponibles", () => {
    const ofertas = offerExtras(base);
    expect(ofertas.every((o) => o.available)).toBe(true);
  });

  it("un extra sin recurso siempre está disponible", () => {
    const ofertas = offerExtras({
      ...base,
      commitments: [{ resourceId: "res-flash", units: 2, range: sabado14a16 }],
    });
    expect(ofertas.find((o) => o.extra.id === "fondo")?.available).toBe(true);
    expect(ofertas.find((o) => o.extra.id === "fondo")?.unitsFree).toBeNull();
  });

  it("con un flash tomado, el suelto se puede y el pack no", () => {
    // Este es EL caso que justifica separar recurso de extra: quedó 1 flash libre,
    // así que el suelto entra y el pack de 2 no.
    const ofertas = offerExtras({
      ...base,
      commitments: [{ resourceId: "res-flash", units: 1, range: sabado14a16 }],
    });
    expect(ofertas.find((o) => o.extra.id === "flash-1")?.available).toBe(true);
    expect(ofertas.find((o) => o.extra.id === "flash-pack")?.available).toBe(false);
  });

  it("con los dos flashes tomados, ninguno de los dos se puede", () => {
    const ofertas = offerExtras({
      ...base,
      commitments: [{ resourceId: "res-flash", units: 2, range: sabado14a16 }],
    });
    expect(ofertas.find((o) => o.extra.id === "flash-1")?.available).toBe(false);
    expect(ofertas.find((o) => o.extra.id === "flash-pack")?.available).toBe(false);
  });

  it("el extra agotado se devuelve igual, marcado: se muestra, no se esconde", () => {
    const ofertas = offerExtras({
      ...base,
      commitments: [{ resourceId: "res-humo", units: 1, range: sabado14a16 }],
    });
    const oferta = ofertas.find((o) => o.extra.id === "humo");
    expect(oferta).toBeDefined();
    expect(oferta!.available).toBe(false);
    expect(oferta!.unitsFree).toBe(0);
  });

  it("un recurso sin stock declarado se trata como agotado, no como infinito", () => {
    // Falla cerrado: un recurso mal cargado no puede volverse ilimitado.
    const ofertas = offerExtras({ ...base, stock: [] });
    expect(ofertas.find((o) => o.extra.id === "flash-1")?.available).toBe(false);
    expect(ofertas.find((o) => o.extra.id === "fondo")?.available).toBe(true);
  });
});

describe("cuánto cuestan", () => {
  it("un extra por reserva cuesta lo mismo dure lo que dure", () => {
    const dosHoras = offerExtras(base).find((o) => o.extra.id === "humo")!.amountMinor;
    const cuatroHoras = offerExtras({
      ...base,
      range: r("2026-09-19T17:00:00Z", "2026-09-19T21:00:00Z"),
    }).find((o) => o.extra.id === "humo")!.amountMinor;
    expect(dosHoras).toBe(50_000);
    expect(cuatroHoras).toBe(50_000);
  });

  it("un extra por hora se multiplica por la duración", () => {
    expect(offerExtras(base).find((o) => o.extra.id === "modelo")!.amountMinor).toBe(400_000);
  });

  it("media hora de un extra por hora cuesta la mitad", () => {
    const media = offerExtras({
      ...base,
      range: r("2026-09-19T17:00:00Z", "2026-09-19T17:30:00Z"),
    }).find((o) => o.extra.id === "modelo")!.amountMinor;
    expect(media).toBe(100_000);
  });

  it("el no socio paga la tarifa de no socio", () => {
    const ofertas = offerExtras({ ...base, customerType: "NON_MEMBER" });
    expect(ofertas.find((o) => o.extra.id === "humo")!.amountMinor).toBe(80_000);
  });

  it("el pack sale menos que dos flashes sueltos", () => {
    const ofertas = offerExtras(base);
    const suelto = ofertas.find((o) => o.extra.id === "flash-1")!.amountMinor;
    const pack = ofertas.find((o) => o.extra.id === "flash-pack")!.amountMinor;
    expect(pack).toBeLessThan(suelto * 2);
  });

  it("el total suma solo lo elegido", () => {
    const ofertas = offerExtras(base);
    expect(extrasTotalMinor(ofertas, ["humo", "fondo"])).toBe(70_000);
    expect(extrasTotalMinor(ofertas, [])).toBe(0);
  });

  it("un extra agotado no suma al total aunque venga elegido", () => {
    const ofertas = offerExtras({
      ...base,
      commitments: [{ resourceId: "res-humo", units: 1, range: sabado14a16 }],
    });
    expect(extrasTotalMinor(ofertas, ["humo"])).toBe(0);
  });
});

describe("los que hay que coordinar", () => {
  it("pedir la modelo obliga a que la institución apruebe", () => {
    expect(anyRequiresConfirmation(offerExtras(base), ["modelo"])).toBe(true);
  });

  it("sin extras a confirmar, la reserva sigue su curso normal", () => {
    expect(anyRequiresConfirmation(offerExtras(base), ["humo", "fondo"])).toBe(false);
    expect(anyRequiresConfirmation(offerExtras(base), [])).toBe(false);
  });

  it("un extra a confirmar que está agotado no obliga a nada", () => {
    const ofertas = offerExtras({
      ...base,
      commitments: [{ resourceId: "res-modelo", units: 1, range: sabado14a16 }],
    });
    expect(anyRequiresConfirmation(ofertas, ["modelo"])).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
pnpm test lib/bookings/extras.test.ts
```

Esperado: FALLA con `Failed to resolve import "./extras"`.

- [ ] **Step 3: Escribir la implementación**

Crear `lib/bookings/extras.ts`:

```ts
import { type Interval, overlaps } from "./time";
import type { CustomerType } from "./pricing";

/**
 * Los extras que se alquilan JUNTO con el espacio. Módulo PURO: sin base y sin red.
 *
 * ── Lo que se vende no es lo que existe ──
 *
 * "Flash adicional" y "Pack de 2 flashes" son dos cosas vendibles que salen del mismo par
 * de flashes. Si cada una llevara su propia cuenta, el sistema vendería un suelto y un pack
 * el mismo sábado: tres flashes de los dos que hay.
 *
 * Por eso el stock vive en el RECURSO y cada extra declara cuántas unidades consume. El
 * pack promocional deja de necesitar código: es una fila más.
 *
 * Un extra sin recurso no se controla — el fondo de papel, que hay de sobra. Así
 * "controlar solo algunos" no es una regla aparte.
 */

export type ExtraPriceMode = "PER_BOOKING" | "PER_HOUR";

export type ExtraDefinition = {
  id: string;
  name: string;
  priceMode: ExtraPriceMode;
  memberPriceMinor: number;
  nonMemberPriceMinor: number;
  /** null = no se controla la cantidad. */
  resourceId: string | null;
  unitsConsumed: number;
  requiresConfirmation: boolean;
};

export type ResourceStock = { resourceId: string; quantity: number };

/** Unidades ya apartadas por otra reserva en un rango. */
export type Commitment = { resourceId: string; units: number; range: Interval };

export type ExtraOffer = {
  extra: ExtraDefinition;
  available: boolean;
  /** Unidades libres del recurso en ese rango. null cuando el extra no se controla. */
  unitsFree: number | null;
  amountMinor: number;
};

export function unitsCommitted(
  resourceId: string,
  range: Interval,
  commitments: readonly Commitment[],
): number {
  return commitments
    .filter((c) => c.resourceId === resourceId && overlaps(c.range, range))
    .reduce((total, c) => total + c.units, 0);
}

function precioUnitario(extra: ExtraDefinition, customerType: CustomerType): number {
  return customerType === "MEMBER" ? extra.memberPriceMinor : extra.nonMemberPriceMinor;
}

function importe(extra: ExtraDefinition, customerType: CustomerType, range: Interval): number {
  const unitario = precioUnitario(extra, customerType);
  if (extra.priceMode === "PER_BOOKING") return unitario;
  const minutos = (range.endAt.getTime() - range.startAt.getTime()) / 60_000;
  if (!Number.isFinite(minutos) || minutos <= 0) return 0;
  // Se multiplica antes de dividir, igual que el precio del espacio: dividir primero
  // arrastraría el redondeo a cada minuto.
  return Math.round((unitario * minutos) / 60);
}

/**
 * Qué extras se pueden ofrecer para un rango, y cuánto sale cada uno.
 *
 * **Devuelve también los agotados, marcados.** Esconderlos dejaría a quien reserva sin
 * entender por qué falta algo que vio la semana pasada; verlos agotados le permite mover el
 * horario, que es la decisión que en realidad tiene que tomar.
 */
export function offerExtras(input: {
  extras: readonly ExtraDefinition[];
  stock: readonly ResourceStock[];
  commitments: readonly Commitment[];
  range: Interval;
  customerType: CustomerType;
}): ExtraOffer[] {
  const cantidadPorRecurso = new Map(input.stock.map((s) => [s.resourceId, s.quantity]));

  return input.extras.map((extra) => {
    const amountMinor = importe(extra, input.customerType, input.range);

    if (extra.resourceId === null) {
      return { extra, available: true, unitsFree: null, amountMinor };
    }

    // Un recurso sin stock declarado se trata como agotado, no como ilimitado: falla
    // cerrado, igual que la regla de convivencia entre espacios.
    const total = cantidadPorRecurso.get(extra.resourceId) ?? 0;
    const usadas = unitsCommitted(extra.resourceId, input.range, input.commitments);
    const unitsFree = Math.max(0, total - usadas);

    return { extra, available: unitsFree >= extra.unitsConsumed, unitsFree, amountMinor };
  });
}

/** Solo suma lo elegido Y disponible: un agotado no puede colarse en el total. */
export function extrasTotalMinor(
  offers: readonly ExtraOffer[],
  chosenIds: readonly string[],
): number {
  const elegidos = new Set(chosenIds);
  return offers
    .filter((o) => elegidos.has(o.extra.id) && o.available)
    .reduce((total, o) => total + o.amountMinor, 0);
}

/**
 * ¿Alguno de los elegidos necesita que una persona lo coordine?
 *
 * Si la respuesta es sí, la reserva nace en `PENDING_APPROVAL` y NO se cobra: la Secretaría
 * confirma o quita el extra, y recién ahí sale el enlace de pago con el total definitivo.
 * Reutiliza el mismo estado que ya usa el salón de eventos — sin circuito nuevo.
 */
export function anyRequiresConfirmation(
  offers: readonly ExtraOffer[],
  chosenIds: readonly string[],
): boolean {
  const elegidos = new Set(chosenIds);
  return offers.some((o) => elegidos.has(o.extra.id) && o.available && o.extra.requiresConfirmation);
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
pnpm test lib/bookings/extras.test.ts
```

Esperado: PASA, 18 tests.

- [ ] **Step 5: Commitear**

```bash
git add lib/bookings/extras.ts lib/bookings/extras.test.ts
git commit -m "$(cat <<'MSG'
El pack de dos flashes y el flash suelto salen del mismo par de flashes

El stock vive en el recurso y cada extra declara cuántas unidades consume.
Sin eso, el sistema vendería tres flashes de los dos que hay.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 8: Alta y edición de espacios

Lo que el dueño usa para cargar el coworking, el salón y el estudio con sus horarios, tarifas y convivencias.

**Files:**
- Create: `lib/bookings/space-form.ts` (validación pura)
- Test: `lib/bookings/space-form.test.ts`
- Create: `app/(shell)/reservas/actions.ts`
- Create: `lib/bookings/access.ts`

**Interfaces:**
- Consumes: Tasks 1–7.
- Produces:
  - `type SpaceFormValues = { name: string; description: string | null; slotMinutes: number; minBookingMinutes: number; maxBookingMinutes: number | null; bufferMinutes: number; minAdvanceHours: number; maxAdvanceDays: number; requiresApproval: boolean; memberHourlyPriceMinor: number; nonMemberHourlyPriceMinor: number; memberFreeHoursPerMonth: number; allowsNonMembers: boolean; weeklyHours: WeeklyHour[]; compatibleWith: string[] }`
  - `parseSpaceForm(formData: FormData): { ok: true; values: SpaceFormValues } | { ok: false; error: string }`
  - `parseArsToMinor(raw: string): number | null`
  - Server actions `saveSpaceAction(formData)` y `toggleSpaceActiveAction(formData)`

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/bookings/space-form.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseArsToMinor, parseSpaceForm } from "./space-form";

function form(campos: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) {
    if (Array.isArray(v)) v.forEach((x) => fd.append(k, x));
    else fd.set(k, v);
  }
  return fd;
}

const completo = {
  name: "Estudio de fotografía",
  slotMinutes: "60",
  minBookingMinutes: "60",
  maxBookingMinutes: "",
  bufferMinutes: "0",
  minAdvanceHours: "2",
  maxAdvanceDays: "90",
  memberHourlyPriceArs: "3.000,00",
  nonMemberHourlyPriceArs: "5000",
  memberFreeHoursPerMonth: "2",
  "hours.6": ["09:00-13:00"],
};

describe("importes escritos a mano", () => {
  it("acepta el formato argentino con puntos y coma", () => {
    expect(parseArsToMinor("3.000,50")).toBe(300_050);
  });

  it("acepta un número pelado", () => {
    expect(parseArsToMinor("5000")).toBe(500_000);
  });

  it("acepta el signo pesos y los espacios", () => {
    expect(parseArsToMinor(" $ 1.200 ")).toBe(120_000);
  });

  it("rechaza lo que no es un importe", () => {
    expect(parseArsToMinor("gratis")).toBeNull();
    expect(parseArsToMinor("")).toBeNull();
    expect(parseArsToMinor("-100")).toBeNull();
  });

  it("cero es un importe válido: un espacio puede no cobrarse", () => {
    expect(parseArsToMinor("0")).toBe(0);
  });
});

describe("el formulario de un espacio", () => {
  it("un formulario completo se acepta", () => {
    const r = parseSpaceForm(form(completo));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.values.name).toBe("Estudio de fotografía");
    expect(r.values.memberHourlyPriceMinor).toBe(300_000);
    expect(r.values.nonMemberHourlyPriceMinor).toBe(500_000);
    expect(r.values.memberFreeHoursPerMonth).toBe(2);
    expect(r.values.maxBookingMinutes).toBeNull();
  });

  it("los horarios se leen como día y minutos desde medianoche", () => {
    const r = parseSpaceForm(form(completo));
    expect(r.ok && r.values.weeklyHours).toEqual([
      { weekday: 6, startMinute: 540, endMinute: 780 },
    ]);
  });

  it("varios tramos en el mismo día se aceptan", () => {
    const r = parseSpaceForm(form({ ...completo, "hours.6": ["09:00-13:00", "16:00-21:00"] }));
    expect(r.ok && r.values.weeklyHours).toHaveLength(2);
  });

  it("un tramo que termina antes de empezar se rechaza", () => {
    const r = parseSpaceForm(form({ ...completo, "hours.6": ["13:00-09:00"] }));
    expect(r).toEqual({ ok: false, error: expect.stringContaining("horario") });
  });

  it("un espacio sin nombre se rechaza", () => {
    expect(parseSpaceForm(form({ ...completo, name: "  " }))).toEqual({
      ok: false,
      error: expect.stringContaining("nombre"),
    });
  });

  it("un espacio sin ningún horario se rechaza", () => {
    const sinHoras = { ...completo };
    delete (sinHoras as Record<string, unknown>)["hours.6"];
    expect(parseSpaceForm(form(sinHoras))).toEqual({
      ok: false,
      error: expect.stringContaining("horario"),
    });
  });

  it("un precio ilegible se rechaza y dice cuál", () => {
    const r = parseSpaceForm(form({ ...completo, memberHourlyPriceArs: "tres mil" }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("socios");
  });

  it("una duración mínima que no cae en la grilla se rechaza", () => {
    const r = parseSpaceForm(form({ ...completo, slotMinutes: "60", minBookingMinutes: "45" }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("grilla");
  });

  it("las horas bonificadas por defecto son cero", () => {
    const r = parseSpaceForm(form({ ...completo, memberFreeHoursPerMonth: "" }));
    expect(r.ok && r.values.memberFreeHoursPerMonth).toBe(0);
  });

  it("las compatibilidades llegan como lista de identificadores", () => {
    const r = parseSpaceForm(form({ ...completo, compatibleWith: ["coworking", "salon"] }));
    expect(r.ok && r.values.compatibleWith).toEqual(["coworking", "salon"]);
  });

  it("sin compatibilidades declaradas, la lista queda vacía y el espacio bloquea a todos", () => {
    const r = parseSpaceForm(form(completo));
    expect(r.ok && r.values.compatibleWith).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
pnpm test lib/bookings/space-form.test.ts
```

Esperado: FALLA con `Failed to resolve import "./space-form"`.

- [ ] **Step 3: Escribir la validación**

Crear `lib/bookings/space-form.ts`:

```ts
import type { WeeklyHour } from "./availability";

/**
 * Validación del formulario de un espacio. Módulo PURO: sin base y sin red.
 *
 * Vive fuera de la acción del servidor para poder probar las reglas —incluida la de la
 * grilla, que es la que más se equivoca— sin levantar Next ni tocar la base.
 */

export type SpaceFormValues = {
  name: string;
  description: string | null;
  slotMinutes: number;
  minBookingMinutes: number;
  maxBookingMinutes: number | null;
  bufferMinutes: number;
  minAdvanceHours: number;
  maxAdvanceDays: number;
  requiresApproval: boolean;
  memberHourlyPriceMinor: number;
  nonMemberHourlyPriceMinor: number;
  memberFreeHoursPerMonth: number;
  allowsNonMembers: boolean;
  weeklyHours: WeeklyHour[];
  compatibleWith: string[];
};

export type SpaceFormResult =
  | { ok: true; values: SpaceFormValues }
  | { ok: false; error: string };

/**
 * "3.000,50" → 300050 centavos.
 *
 * Se acepta el formato que la gente escribe de verdad —con punto de miles, con coma
 * decimal, con signo pesos— porque rechazarlo obligaría a la Secretaría a aprender una
 * notación para que la computadora esté cómoda.
 */
export function parseArsToMinor(raw: string): number | null {
  const limpio = raw.replace(/[$\s]/g, "").replace(/\./g, "").replace(",", ".");
  if (limpio === "") return null;
  const numero = Number(limpio);
  if (!Number.isFinite(numero) || numero < 0) return null;
  return Math.round(numero * 100);
}

function entero(raw: string | null, porDefecto: number): number {
  const n = Number((raw ?? "").trim());
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : porDefecto;
}

/** "09:00" → 540. Devuelve null si no es una hora. */
function minutoDelDia(texto: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(texto.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59) return null;
  return h * 60 + min;
}

export function parseSpaceForm(formData: FormData): SpaceFormResult {
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { ok: false, error: "Poné un nombre para el espacio." };

  const memberHourlyPriceMinor = parseArsToMinor(String(formData.get("memberHourlyPriceArs") ?? ""));
  if (memberHourlyPriceMinor === null) {
    return { ok: false, error: "El precio por hora para socios no se entiende." };
  }
  const nonMemberHourlyPriceMinor = parseArsToMinor(
    String(formData.get("nonMemberHourlyPriceArs") ?? ""),
  );
  if (nonMemberHourlyPriceMinor === null) {
    return { ok: false, error: "El precio por hora para no socios no se entiende." };
  }

  const slotMinutes = entero(formData.get("slotMinutes") as string | null, 60);
  if (slotMinutes <= 0) return { ok: false, error: "La grilla tiene que ser mayor que cero." };

  const minBookingMinutes = entero(formData.get("minBookingMinutes") as string | null, slotMinutes);
  if (minBookingMinutes % slotMinutes !== 0) {
    return { ok: false, error: "La duración mínima tiene que ser múltiplo de la grilla." };
  }

  const maxCrudo = String(formData.get("maxBookingMinutes") ?? "").trim();
  const maxBookingMinutes = maxCrudo === "" ? null : entero(maxCrudo, 0);
  if (maxBookingMinutes !== null && maxBookingMinutes < minBookingMinutes) {
    return { ok: false, error: "La duración máxima no puede ser menor que la mínima." };
  }

  const weeklyHours: WeeklyHour[] = [];
  for (let weekday = 0; weekday <= 6; weekday += 1) {
    for (const crudo of formData.getAll(`hours.${weekday}`)) {
      const texto = String(crudo).trim();
      if (texto === "") continue;
      const [desde, hasta] = texto.split("-");
      const startMinute = minutoDelDia(desde ?? "");
      const endMinute = minutoDelDia(hasta ?? "");
      if (startMinute === null || endMinute === null || endMinute <= startMinute) {
        return { ok: false, error: `Revisá el horario "${texto}": tiene que ser como 09:00-13:00.` };
      }
      weeklyHours.push({ weekday, startMinute, endMinute });
    }
  }
  if (weeklyHours.length === 0) {
    return { ok: false, error: "Cargá al menos un horario: sin horarios el espacio no se puede reservar." };
  }

  return {
    ok: true,
    values: {
      name,
      description: String(formData.get("description") ?? "").trim() || null,
      slotMinutes,
      minBookingMinutes,
      maxBookingMinutes,
      bufferMinutes: entero(formData.get("bufferMinutes") as string | null, 0),
      minAdvanceHours: entero(formData.get("minAdvanceHours") as string | null, 2),
      maxAdvanceDays: entero(formData.get("maxAdvanceDays") as string | null, 90),
      requiresApproval: formData.get("requiresApproval") === "on",
      memberHourlyPriceMinor,
      nonMemberHourlyPriceMinor,
      memberFreeHoursPerMonth: entero(formData.get("memberFreeHoursPerMonth") as string | null, 0),
      allowsNonMembers: formData.get("allowsNonMembers") !== "off",
      weeklyHours,
      compatibleWith: formData.getAll("compatibleWith").map((v) => String(v)),
    },
  };
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
pnpm test lib/bookings/space-form.test.ts
```

Esperado: PASA, 17 tests.

- [ ] **Step 5: Escribir las acciones del servidor**

Crear `app/(shell)/reservas/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { minorToDecimalString } from "@/lib/membership/money";
import { sanitizeError } from "@/lib/payments/connect/log";
import { parseSpaceForm } from "@/lib/bookings/space-form";
import { pairsForSpace } from "@/lib/bookings/conflicts";
import { cancelBooking } from "@/lib/bookings/create";
import { requireBookingsAdmin, requireBookingsStaff } from "@/lib/bookings/access";
import { slugify } from "@/lib/slug";

const ESPACIOS = "/reservas/espacios";

/**
 * Alta y edición de un espacio, con sus horarios y sus convivencias.
 *
 * Los horarios y las compatibilidades se reemplazan enteros en cada guardado: son listas
 * chicas, y un borrar-e-insertar dentro de una transacción es más fácil de razonar —y de
 * verificar— que un diff. Si algo falla, no queda un espacio a medio configurar.
 */
export async function saveSpaceAction(formData: FormData): Promise<void> {
  const { workspace } = await requireBookingsAdmin();

  const spaceId = String(formData.get("spaceId") ?? "").trim() || null;
  const parsed = parseSpaceForm(formData);
  if (!parsed.ok) {
    redirect(`${ESPACIOS}${spaceId ? `/${spaceId}` : "/nuevo"}?error=${encodeURIComponent(parsed.error)}`);
  }
  const v = parsed.values;

  try {
    await prisma.$transaction(async (tx) => {
      const datos = {
        name: v.name,
        description: v.description,
        slotMinutes: v.slotMinutes,
        minBookingMinutes: v.minBookingMinutes,
        maxBookingMinutes: v.maxBookingMinutes,
        bufferMinutes: v.bufferMinutes,
        minAdvanceHours: v.minAdvanceHours,
        maxAdvanceDays: v.maxAdvanceDays,
        requiresApproval: v.requiresApproval,
        memberHourlyPriceArs: minorToDecimalString(v.memberHourlyPriceMinor),
        nonMemberHourlyPriceArs: minorToDecimalString(v.nonMemberHourlyPriceMinor),
        memberFreeHoursPerMonth: v.memberFreeHoursPerMonth,
        allowsNonMembers: v.allowsNonMembers,
      };

      const espacio = spaceId
        ? await tx.bookingSpace.update({
            where: { id: spaceId, workspaceId: workspace.id },
            data: datos,
            select: { id: true },
          })
        : await tx.bookingSpace.create({
            data: { ...datos, workspaceId: workspace.id, slug: `${slugify(v.name)}-${Date.now().toString(36)}` },
            select: { id: true },
          });

      await tx.bookingSpaceHours.deleteMany({ where: { spaceId: espacio.id } });
      await tx.bookingSpaceHours.createMany({
        data: v.weeklyHours.map((h) => ({ ...h, spaceId: espacio.id })),
      });

      // Las compatibilidades son simétricas: se borran las de los dos lados antes de escribir.
      await tx.bookingSpaceCompatibility.deleteMany({
        where: { OR: [{ spaceAId: espacio.id }, { spaceBId: espacio.id }] },
      });
      const pares = pairsForSpace(espacio.id, v.compatibleWith);
      if (pares.length > 0) await tx.bookingSpaceCompatibility.createMany({ data: pares });
    });
  } catch (error) {
    console.error("[fotoffice][reservas] no se pudo guardar el espacio", {
      workspaceId: workspace.id,
      detalle: sanitizeError(error),
    });
    redirect(`${ESPACIOS}?error=${encodeURIComponent("No pudimos guardar el espacio.")}`);
  }

  revalidatePath(ESPACIOS);
  revalidatePath("/reservas");
  redirect(`${ESPACIOS}?ok=guardado`);
}

/**
 * Un espacio se desactiva, no se borra: borrarlo dejaría reservas huérfanas y le sacaría a
 * la institución el registro de lo que alquiló.
 */
export async function toggleSpaceActiveAction(formData: FormData): Promise<void> {
  const { workspace } = await requireBookingsAdmin();
  const spaceId = String(formData.get("spaceId") ?? "").trim();
  const activar = formData.get("active") === "on";

  await prisma.bookingSpace.updateMany({
    where: { id: spaceId, workspaceId: workspace.id },
    data: { active: activar },
  });

  revalidatePath(ESPACIOS);
  redirect(`${ESPACIOS}?ok=${activar ? "activado" : "desactivado"}`);
}

/** Cancelar desde la agenda del equipo. */
export async function cancelBookingAction(formData: FormData): Promise<void> {
  const { user, workspace } = await requireBookingsStaff();
  const bookingId = String(formData.get("bookingId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim() || "Cancelada por la institución";

  const r = await cancelBooking({ workspaceId: workspace.id, bookingId, byUserId: user.id, reason });

  revalidatePath("/reservas");
  redirect(r.ok ? "/reservas?ok=cancelada" : `/reservas?error=${encodeURIComponent(r.error ?? "")}`);
}
```

- [ ] **Step 6: Escribir el control de acceso**

Crear `lib/bookings/access.ts`:

```ts
import "server-only";
import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/workspace";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { BOOKINGS_MODULE_KEY } from "./constants";

/**
 * Control de acceso del módulo, en dos niveles y siempre en el servidor.
 *
 * Nivel 1: el módulo está habilitado para ESE workspace. Nivel 2: la persona tiene el rol.
 * Esconder el link del menú es el tercer nivel, el cosmético — nunca el control.
 *
 * Agenda es STAFF+; Espacios y Tarifas son ADMIN+.
 */

async function contextoBase() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  if (!(await isModuleEnabledForWorkspace(workspace.id, BOOKINGS_MODULE_KEY))) redirect("/dashboard");
  const role = await resolveWorkspaceRole(user.id, workspace.id);
  return { user, workspace, role };
}

/** Ver la agenda. Cualquiera del equipo. */
export async function requireBookingsStaff() {
  const ctx = await contextoBase();
  if (!ctx.role) redirect("/dashboard");
  return ctx;
}

/** Configurar espacios y tarifas. Solo dueño o administrador. */
export async function requireBookingsAdmin() {
  const ctx = await contextoBase();
  if (!canManageWorkspaceSettings(ctx.role)) redirect("/reservas");
  return ctx;
}
```

- [ ] **Step 7: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: sin errores. `slugify` ya existe en `lib/slug.ts`.

- [ ] **Step 8: Commitear**

```bash
git add lib/bookings/space-form.ts lib/bookings/space-form.test.ts lib/bookings/access.ts "app/(shell)/reservas/actions.ts"
git commit -m "$(cat <<'MSG'
El dueño carga un espacio con sus horarios, tarifas y convivencias

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 9: Las pantallas de Espacios

**Files:**
- Create: `app/(shell)/reservas/layout.tsx`
- Create: `app/(shell)/reservas/espacios/page.tsx`
- Create: `app/(shell)/reservas/espacios/space-form.tsx`
- Create: `app/(shell)/reservas/espacios/nuevo/page.tsx`
- Create: `app/(shell)/reservas/espacios/[spaceId]/page.tsx`

**Interfaces:**
- Consumes: `requireBookingsAdmin` (Task 8), `listSpaces`, `listCompatibilities` (Task 6), `saveSpaceAction`, `toggleSpaceActiveAction` (Task 8), `compatibleSpaceIds` (Task 5), `minuteOfDayToLabel` (Task 1).
- Produces: `<SpaceForm space={…} otrosEspacios={…} compatibleCon={…} />`

- [ ] **Step 1: El layout que sostiene la sección**

Crear `app/(shell)/reservas/layout.tsx`:

```tsx
import { requireBookingsStaff } from "@/lib/bookings/access";

/**
 * El guardia de la sección entera.
 *
 * Vive en el layout para que ninguna pantalla nueva del módulo pueda nacer sin control de
 * acceso por olvido. Cada pantalla vuelve a pedir lo suyo (ADMIN+ donde corresponde): son
 * verificaciones que se suman, no que se reemplazan.
 */
export default async function ReservasLayout({ children }: { children: React.ReactNode }) {
  await requireBookingsStaff();
  return <>{children}</>;
}
```

- [ ] **Step 2: El listado**

Crear `app/(shell)/reservas/espacios/page.tsx`:

```tsx
import Link from "next/link";
import { DoorOpen } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { formatMinorArs } from "@/lib/membership/money";
import { requireBookingsAdmin } from "@/lib/bookings/access";
import { listCompatibilities, listSpaces } from "@/lib/bookings/repository";
import { compatibleSpaceIds } from "@/lib/bookings/conflicts";
import { minuteOfDayToLabel } from "@/lib/bookings/time";
import { toggleSpaceActiveAction } from "../actions";

export const dynamic = "force-dynamic";

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default async function EspaciosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { workspace } = await requireBookingsAdmin();
  const params = await searchParams;

  const [espacios, compatibilidades] = await Promise.all([
    listSpaces(workspace.id, { includeInactive: true }),
    listCompatibilities(workspace.id),
  ]);
  const nombrePorId = new Map(espacios.map((e) => [e.id, e.name]));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Espacios"
        description="Qué se puede reservar, cuándo, a qué precio y con qué otros espacios puede convivir."
        actions={
          <Link href="/reservas/espacios/nuevo" className="fo-btn fo-btn-primary text-sm">
            Nuevo espacio
          </Link>
        }
      />

      {params.error ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">
          {params.error}
        </p>
      ) : null}
      {params.ok ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-success)]">Listo, se guardó.</p>
      ) : null}

      {espacios.length === 0 ? (
        <div className="fo-card flex flex-col items-center gap-4 px-6 py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-[var(--fo-accent-muted)] text-[var(--fo-accent)]">
            <DoorOpen className="size-7" aria-hidden />
          </div>
          <div className="max-w-md space-y-2">
            <p className="text-base font-semibold">Todavía no hay espacios</p>
            <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
              Cargá el primero — por ejemplo el estudio, el salón o el coworking— con sus días,
              sus horarios y sus tarifas.
            </p>
          </div>
          <Link href="/reservas/espacios/nuevo" className="fo-btn fo-btn-primary text-sm">
            Crear el primer espacio
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {espacios.map((espacio) => {
            const convive = compatibleSpaceIds(espacio.id, compatibilidades)
              .map((id) => nombrePorId.get(id))
              .filter((n): n is string => Boolean(n));

            return (
              <section key={espacio.id} className="fo-card space-y-4 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-3">
                      <h2 className="text-base font-semibold">{espacio.name}</h2>
                      {espacio.active ? null : (
                        <span className="text-xs text-[var(--fo-muted-soft)]">Desactivado</span>
                      )}
                      {espacio.requiresApproval ? (
                        <span className="text-xs text-[var(--fo-muted)]">Requiere aprobación</span>
                      ) : null}
                    </div>
                    {espacio.description ? (
                      <p className="max-w-2xl text-sm leading-relaxed text-[var(--fo-muted)]">
                        {espacio.description}
                      </p>
                    ) : null}
                    <p className="text-xs text-[var(--fo-muted-soft)]">
                      {espacio.weeklyHours
                        .map((h) => `${DIAS[h.weekday]} ${minuteOfDayToLabel(h.startMinute)}–${minuteOfDayToLabel(h.endMinute)}`)
                        .join(" · ")}
                    </p>
                    <p className="text-xs text-[var(--fo-muted-soft)]">
                      {convive.length > 0
                        ? `Puede usarse a la vez que: ${convive.join(", ")}.`
                        : "No puede usarse a la vez que ningún otro espacio."}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                    <span className="text-sm font-medium">
                      Socios {formatMinorArs(espacio.memberHourlyPriceMinor)} / hora
                    </span>
                    <span className="text-sm text-[var(--fo-muted)]">
                      No socios {formatMinorArs(espacio.nonMemberHourlyPriceMinor)} / hora
                    </span>
                    {espacio.memberFreeHoursPerMonth > 0 ? (
                      <span className="text-xs text-[var(--fo-success)]">
                        {espacio.memberFreeHoursPerMonth} h bonificadas por mes al socio
                      </span>
                    ) : null}
                    <div className="mt-2 flex items-center gap-3">
                      <Link
                        href={`/reservas/espacios/${espacio.id}`}
                        className="fo-btn fo-btn-secondary text-xs"
                      >
                        Editar
                      </Link>
                      <form action={toggleSpaceActiveAction}>
                        <input type="hidden" name="spaceId" value={espacio.id} />
                        <input type="hidden" name="active" value={espacio.active ? "off" : "on"} />
                        <button type="submit" className="text-xs text-[var(--fo-muted)] underline underline-offset-4">
                          {espacio.active ? "Desactivar" : "Activar"}
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: El formulario**

Crear `app/(shell)/reservas/espacios/space-form.tsx`. Es un componente de servidor: no necesita estado en el navegador, porque los horarios se cargan como texto (`09:00-13:00`, uno por línea) y las compatibilidades como casillas.

```tsx
import { formatMinorArs } from "@/lib/membership/money";
import { minuteOfDayToLabel } from "@/lib/bookings/time";
import type { SpaceRecord } from "@/lib/bookings/repository";
import { saveSpaceAction } from "../actions";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/**
 * Los horarios se cargan como texto, un tramo por línea (`09:00-13:00`).
 *
 * Un selector visual sería más lindo y necesita estado en el navegador, validación
 * duplicada y su propio manejo de errores. El texto se valida en un solo lugar
 * (`lib/bookings/space-form.ts`), se prueba sin navegador, y quien carga esto lo hace una
 * vez por espacio y no todos los días.
 */
export function SpaceForm({
  space,
  otrosEspacios,
  compatibleCon,
  error,
}: {
  space: SpaceRecord | null;
  otrosEspacios: { id: string; name: string }[];
  compatibleCon: string[];
  error?: string;
}) {
  const pesos = (minor: number) => (minor === 0 ? "" : formatMinorArs(minor).replace("$", "").trim());

  return (
    <form action={saveSpaceAction} className="space-y-8">
      {space ? <input type="hidden" name="spaceId" value={space.id} /> : null}

      {error ? (
        <p className="fo-alert-error p-4 text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Identidad</h2>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="name">Nombre</label>
          <input id="name" name="name" className="fo-input" defaultValue={space?.name ?? ""} required />
          <label className="fo-label" htmlFor="description">Descripción</label>
          <textarea id="description" name="description" rows={3} className="fo-input" defaultValue={space?.description ?? ""} />
          <p className="fo-helper">Lo que va a leer el socio antes de reservar.</p>
        </div>
      </section>

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Días y horarios</h2>
        <p className="fo-helper">
          Un tramo por línea, con el formato <code>09:00-13:00</code>. Se pueden poner varios
          tramos en el mismo día. Un día vacío es un día en que no se alquila.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {DIAS.map((nombre, weekday) => {
            const tramos = (space?.weeklyHours ?? [])
              .filter((h) => h.weekday === weekday)
              .map((h) => `${minuteOfDayToLabel(h.startMinute)}-${minuteOfDayToLabel(h.endMinute)}`);
            return (
              <div key={weekday} className="fo-field-stack">
                <label className="fo-label" htmlFor={`hours-${weekday}`}>{nombre}</label>
                <textarea
                  id={`hours-${weekday}`}
                  name={`hours.${weekday}`}
                  rows={2}
                  className="fo-input"
                  placeholder="09:00-13:00"
                  defaultValue={tramos.join("\n")}
                />
              </div>
            );
          })}
        </div>
        <p className="fo-helper">
          Cada línea del recuadro se manda por separado: escribí un tramo por línea y guardá.
        </p>
      </section>

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Reglas</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="slotMinutes">Grilla (minutos)</label>
            <input id="slotMinutes" name="slotMinutes" type="number" min={5} step={5} className="fo-input" defaultValue={space?.rules.slotMinutes ?? 60} />
            <p className="fo-helper">60 = se reserva por hora.</p>
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="minBookingMinutes">Duración mínima</label>
            <input id="minBookingMinutes" name="minBookingMinutes" type="number" min={5} step={5} className="fo-input" defaultValue={space?.rules.minBookingMinutes ?? 60} />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="maxBookingMinutes">Duración máxima</label>
            <input id="maxBookingMinutes" name="maxBookingMinutes" type="number" min={0} step={5} className="fo-input" defaultValue={space?.rules.maxBookingMinutes ?? ""} />
            <p className="fo-helper">Vacío = sin tope.</p>
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="bufferMinutes">Limpieza entre reservas</label>
            <input id="bufferMinutes" name="bufferMinutes" type="number" min={0} step={5} className="fo-input" defaultValue={space?.rules.bufferMinutes ?? 0} />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="minAdvanceHours">Anticipación mínima (horas)</label>
            <input id="minAdvanceHours" name="minAdvanceHours" type="number" min={0} className="fo-input" defaultValue={space?.rules.minAdvanceHours ?? 2} />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="maxAdvanceDays">Anticipación máxima (días)</label>
            <input id="maxAdvanceDays" name="maxAdvanceDays" type="number" min={1} className="fo-input" defaultValue={space?.rules.maxAdvanceDays ?? 90} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="requiresApproval" defaultChecked={space?.requiresApproval ?? false} />
          Requiere aprobación de la institución antes de cobrarse
        </label>
      </section>

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Tarifas</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="memberHourlyPriceArs">Precio por hora — socios</label>
            <input id="memberHourlyPriceArs" name="memberHourlyPriceArs" className="fo-input" defaultValue={space ? pesos(space.memberHourlyPriceMinor) : ""} placeholder="3.000" required />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="nonMemberHourlyPriceArs">Precio por hora — no socios</label>
            <input id="nonMemberHourlyPriceArs" name="nonMemberHourlyPriceArs" className="fo-input" defaultValue={space ? pesos(space.nonMemberHourlyPriceMinor) : ""} placeholder="5.000" required />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="memberFreeHoursPerMonth">Horas bonificadas por mes</label>
            <input id="memberFreeHoursPerMonth" name="memberFreeHoursPerMonth" type="number" min={0} className="fo-input" defaultValue={space?.memberFreeHoursPerMonth ?? 0} />
            <p className="fo-helper">Para socios. No se acumulan de un mes al otro.</p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="allowsNonMembers" defaultChecked={space?.allowsNonMembers ?? true} />
          Se puede alquilar a no socios
        </label>
      </section>

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Convivencia</h2>
        <p className="fo-helper">
          Por defecto, ocupar este espacio ocupa <strong>todos</strong> los demás. Marcá acá los
          que sí pueden usarse al mismo tiempo. Es a propósito: un espacio nuevo mal configurado
          tiene que dar &ldquo;no hay horarios&rdquo;, no dos alquileres del mismo salón.
        </p>
        {otrosEspacios.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">Todavía no hay otros espacios con los que convivir.</p>
        ) : (
          <div className="space-y-2">
            {otrosEspacios.map((otro) => (
              <label key={otro.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="compatibleWith" value={otro.id} defaultChecked={compatibleCon.includes(otro.id)} />
                Puede usarse a la vez que {otro.name}
              </label>
            ))}
          </div>
        )}
      </section>

      <div className="fo-form-actions">
        <button type="submit" className="fo-btn fo-btn-primary text-sm">
          {space ? "Guardar cambios" : "Crear espacio"}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Las dos pantallas que usan el formulario**

Crear `app/(shell)/reservas/espacios/nuevo/page.tsx`:

```tsx
import { PageHeader } from "@/components/page-header";
import { requireBookingsAdmin } from "@/lib/bookings/access";
import { listSpaces } from "@/lib/bookings/repository";
import { SpaceForm } from "../space-form";

export const dynamic = "force-dynamic";

export default async function NuevoEspacioPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { workspace } = await requireBookingsAdmin();
  const params = await searchParams;
  const espacios = await listSpaces(workspace.id, { includeInactive: true });

  return (
    <div className="space-y-8">
      <PageHeader title="Nuevo espacio" description="Un espacio que la institución alquila." />
      <SpaceForm
        space={null}
        otrosEspacios={espacios.map((e) => ({ id: e.id, name: e.name }))}
        compatibleCon={[]}
        error={params.error}
      />
    </div>
  );
}
```

Crear `app/(shell)/reservas/espacios/[spaceId]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireBookingsAdmin } from "@/lib/bookings/access";
import { getSpace, listCompatibilities, listSpaces } from "@/lib/bookings/repository";
import { compatibleSpaceIds } from "@/lib/bookings/conflicts";
import { SpaceForm } from "../space-form";

export const dynamic = "force-dynamic";

export default async function EditarEspacioPage({
  params,
  searchParams,
}: {
  params: Promise<{ spaceId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { workspace } = await requireBookingsAdmin();
  const { spaceId } = await params;
  const query = await searchParams;

  const [espacio, espacios, compatibilidades] = await Promise.all([
    getSpace(workspace.id, spaceId),
    listSpaces(workspace.id, { includeInactive: true }),
    listCompatibilities(workspace.id),
  ]);
  if (!espacio) notFound();

  return (
    <div className="space-y-8">
      <PageHeader title={espacio.name} description="Horarios, tarifas y convivencia de este espacio." />
      <SpaceForm
        space={espacio}
        otrosEspacios={espacios.filter((e) => e.id !== spaceId).map((e) => ({ id: e.id, name: e.name }))}
        compatibleCon={compatibleSpaceIds(spaceId, compatibilidades)}
        error={query.error}
      />
    </div>
  );
}
```

- [ ] **Step 5: Verificar tipos y commitear**

```bash
npx tsc --noEmit && pnpm test
```

Esperado: sin errores nuevos y la suite verde.

```bash
git add "app/(shell)/reservas"
git commit -m "$(cat <<'MSG'
La institución ve sus espacios y los edita

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 10: La agenda del equipo

Lo que la Comisión mira todos los días: quién ocupa qué, y desde dónde carga una reserva de alguien que llamó por teléfono.

**Files:**
- Create: `lib/bookings/week.ts` (armado de la semana, puro)
- Test: `lib/bookings/week.test.ts`
- Create: `app/(shell)/reservas/page.tsx`
- Create: `app/(shell)/reservas/nueva/page.tsx`
- Create: `app/(shell)/reservas/nueva/manual-form.tsx`
- Modify: `app/(shell)/reservas/actions.ts` (agregar `createManualBookingAction`)

**Interfaces:**
- Consumes: Tasks 1–9.
- Produces:
  - `weekRange(anchor: Date, timeZone: string): Interval` — de lunes 00:00 a lunes 00:00, en hora local
  - `weekDays(range: Interval, timeZone: string): { ymd: string; label: string }[]`
  - `shiftWeeks(anchor: Date, weeks: number): Date`
  - Server action `createManualBookingAction(formData)`

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/bookings/week.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { BOOKINGS_TIME_ZONE } from "./time";
import { shiftWeeks, weekDays, weekRange } from "./week";

const tz = BOOKINGS_TIME_ZONE;

describe("la semana que se muestra", () => {
  it("empieza el lunes, aunque el día pedido sea un jueves", () => {
    // Jueves 17/09/2026 a las 15:00 locales.
    const r = weekRange(new Date("2026-09-17T18:00:00Z"), tz);
    expect(weekDays(r, tz)[0].ymd).toBe("2026-09-14");
  });

  it("un domingo pertenece a la semana que arrancó el lunes anterior", () => {
    // Sin esta regla, el domingo se vería solo en una semana propia.
    const r = weekRange(new Date("2026-09-20T18:00:00Z"), tz);
    const dias = weekDays(r, tz);
    expect(dias[0].ymd).toBe("2026-09-14");
    expect(dias[6].ymd).toBe("2026-09-20");
  });

  it("tiene siete días", () => {
    expect(weekDays(weekRange(new Date("2026-09-17T18:00:00Z"), tz), tz)).toHaveLength(7);
  });

  it("cada día trae una etiqueta legible", () => {
    const dias = weekDays(weekRange(new Date("2026-09-17T18:00:00Z"), tz), tz);
    expect(dias[0].label.toLowerCase()).toContain("lun");
    expect(dias[0].label).toContain("14");
  });

  it("moverse una semana adelante y volver deja el mismo lugar", () => {
    const jueves = new Date("2026-09-17T18:00:00Z");
    const ida = shiftWeeks(jueves, 1);
    expect(weekDays(weekRange(ida, tz), tz)[0].ymd).toBe("2026-09-21");
    expect(weekDays(weekRange(shiftWeeks(ida, -1), tz), tz)[0].ymd).toBe("2026-09-14");
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
pnpm test lib/bookings/week.test.ts
```

Esperado: FALLA con `Failed to resolve import "./week"`.

- [ ] **Step 3: Escribir la implementación**

Crear `lib/bookings/week.ts`:

```ts
import { type Interval, addMinutes, localMoment } from "./time";

/**
 * Armado de la semana de la agenda. Módulo PURO: sin base y sin red.
 *
 * La semana arranca el **lunes**, que es como se lee un calendario acá, y no el domingo,
 * que es como numera los días el estándar. Los dos criterios conviven: `localMoment`
 * devuelve 0 para el domingo porque así lo declaran los horarios semanales; la vista es
 * otra cosa.
 */

const DIA = 24 * 60;

/** De lunes 00:00 local a lunes 00:00 local de la semana siguiente. */
export function weekRange(anchor: Date, timeZone: string): Interval {
  const m = localMoment(anchor, timeZone);
  // weekday 0 = domingo. Cuántos días hay que retroceder para llegar al lunes.
  const atras = m.weekday === 0 ? 6 : m.weekday - 1;
  const inicio = addMinutes(anchor, -(atras * DIA + m.minuteOfDay));
  return { startAt: inicio, endAt: addMinutes(inicio, 7 * DIA) };
}

export function weekDays(range: Interval, timeZone: string): { ymd: string; label: string }[] {
  const fmt = new Intl.DateTimeFormat("es-AR", { timeZone, weekday: "short", day: "numeric" });
  const dias: { ymd: string; label: string }[] = [];
  for (let i = 0; i < 7; i += 1) {
    const at = addMinutes(range.startAt, i * DIA + 12 * 60); // mediodía: inmune al horario de verano
    dias.push({ ymd: localMoment(at, timeZone).ymd, label: fmt.format(at) });
  }
  return dias;
}

export function shiftWeeks(anchor: Date, weeks: number): Date {
  return addMinutes(anchor, weeks * 7 * DIA);
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
pnpm test lib/bookings/week.test.ts
```

Esperado: PASA, 5 tests.

- [ ] **Step 5: La acción de carga manual**

Agregar al final de `app/(shell)/reservas/actions.ts`:

```ts
/**
 * Carga una reserva a mano, para quien llamó por teléfono o vino al mostrador.
 *
 * Pasa por el mismo `createBooking` que usará el portal: mismas verificaciones, mismos
 * choques, mismo precio. La única diferencia es el medio de pago `PRESENCIAL`, que confirma
 * en el acto porque el dinero ya lo tiene la institución.
 */
export async function createManualBookingAction(formData: FormData): Promise<void> {
  const { user, workspace } = await requireBookingsStaff();

  const spaceId = String(formData.get("spaceId") ?? "").trim();
  const startAt = new Date(String(formData.get("startAt") ?? ""));
  const endAt = new Date(String(formData.get("endAt") ?? ""));
  const contactName = String(formData.get("contactName") ?? "").trim();
  const contactEmail = String(formData.get("contactEmail") ?? "").trim();

  if (!spaceId || Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    redirect(`/reservas/nueva?error=${encodeURIComponent("Faltan datos de la reserva.")}`);
  }
  if (contactName.length < 2) {
    redirect(`/reservas/nueva?error=${encodeURIComponent("Poné a nombre de quién va la reserva.")}`);
  }

  const r = await createBooking({
    workspaceId: workspace.id,
    spaceId,
    range: { startAt, endAt },
    customerType: formData.get("customerType") === "MEMBER" ? "MEMBER" : "NON_MEMBER",
    memberId: String(formData.get("memberId") ?? "").trim() || null,
    userId: null,
    contactName,
    contactEmail,
    contactPhone: String(formData.get("contactPhone") ?? "").trim() || null,
    // La bolsa mensual del socio se resuelve en el plan del portal. Acá el equipo cobra o
    // no cobra a mano, y poner un beneficio que todavía no se calcula sería inventarlo.
    freeMinutesAvailable: 0,
    paymentMethod: "PRESENCIAL",
    notes: String(formData.get("notes") ?? "").trim() || null,
    createdByUserId: user.id,
  });

  revalidatePath("/reservas");
  redirect(r.ok ? "/reservas?ok=creada" : `/reservas/nueva?error=${encodeURIComponent(r.error)}`);
}
```

Y agregar `createBooking` al import de `@/lib/bookings/create` que ya existe en ese archivo:

```ts
import { cancelBooking, createBooking } from "@/lib/bookings/create";
```

- [ ] **Step 6: La agenda**

Crear `app/(shell)/reservas/page.tsx`:

```tsx
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { formatMinorArs, decimalArsToMinor } from "@/lib/membership/money";
import { requireBookingsStaff } from "@/lib/bookings/access";
import { listBookingsInRange, listSpaces } from "@/lib/bookings/repository";
import { BOOKINGS_TIME_ZONE, localMoment, minuteOfDayToLabel } from "@/lib/bookings/time";
import { shiftWeeks, weekDays, weekRange } from "@/lib/bookings/week";
import { cancelBookingAction } from "./actions";

export const dynamic = "force-dynamic";

const ETIQUETA_ESTADO: Record<string, string> = {
  HOLD: "Esperando pago",
  PENDING_APPROVAL: "A aprobar",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  EXPIRED: "Vencida",
};

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string; error?: string; ok?: string }>;
}) {
  const { workspace } = await requireBookingsStaff();
  const params = await searchParams;

  const ancla = params.semana ? new Date(params.semana) : new Date();
  const referencia = Number.isNaN(ancla.getTime()) ? new Date() : ancla;
  const rango = weekRange(referencia, BOOKINGS_TIME_ZONE);
  const dias = weekDays(rango, BOOKINGS_TIME_ZONE);

  const [espacios, reservas] = await Promise.all([
    listSpaces(workspace.id, { includeInactive: true }),
    listBookingsInRange(workspace.id, rango),
  ]);
  const nombrePorEspacio = new Map(espacios.map((e) => [e.id, e.name]));

  const porDia = new Map<string, typeof reservas>();
  for (const reserva of reservas) {
    const ymd = localMoment(reserva.startAt, BOOKINGS_TIME_ZONE).ymd;
    porDia.set(ymd, [...(porDia.get(ymd) ?? []), reserva]);
  }

  const anterior = shiftWeeks(referencia, -1).toISOString();
  const siguiente = shiftWeeks(referencia, 1).toISOString();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Agenda"
        description={`Semana del ${dias[0].label} al ${dias[6].label}.`}
        actions={
          <>
            <Link href={`/reservas?semana=${anterior}`} className="fo-btn fo-btn-secondary text-sm">
              Semana anterior
            </Link>
            <Link href="/reservas" className="fo-btn fo-btn-secondary text-sm">
              Esta semana
            </Link>
            <Link href={`/reservas?semana=${siguiente}`} className="fo-btn fo-btn-secondary text-sm">
              Semana siguiente
            </Link>
            <Link href="/reservas/nueva" className="fo-btn fo-btn-primary text-sm">
              Cargar reserva
            </Link>
          </>
        }
      />

      {params.error ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">{params.error}</p>
      ) : null}
      {params.ok ? <p className="fo-card p-4 text-sm text-[var(--fo-success)]">Listo.</p> : null}

      {espacios.length === 0 ? (
        <div className="fo-card space-y-3 p-6 text-center">
          <p className="text-sm text-[var(--fo-muted)]">
            Todavía no hay espacios cargados, así que no hay nada que agendar.
          </p>
          <Link href="/reservas/espacios/nuevo" className="fo-btn fo-btn-primary text-sm">
            Cargar el primer espacio
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {dias.map((dia) => {
            const delDia = porDia.get(dia.ymd) ?? [];
            return (
              <section key={dia.ymd} className="fo-card space-y-3 p-5">
                <h2 className="text-sm font-semibold capitalize">{dia.label}</h2>
                {delDia.length === 0 ? (
                  <p className="text-sm text-[var(--fo-muted-soft)]">Sin reservas.</p>
                ) : (
                  <ul className="space-y-2">
                    {delDia.map((reserva) => {
                      const desde = localMoment(reserva.startAt, BOOKINGS_TIME_ZONE);
                      const hasta = localMoment(reserva.endAt, BOOKINGS_TIME_ZONE);
                      const cancelada = reserva.status === "CANCELLED" || reserva.status === "EXPIRED";
                      return (
                        <li
                          key={reserva.id}
                          className={`flex flex-wrap items-center justify-between gap-3 border-b border-[var(--fo-border)] pb-2 last:border-0 ${cancelada ? "opacity-50" : ""}`}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium">
                              {minuteOfDayToLabel(desde.minuteOfDay)}–{minuteOfDayToLabel(hasta.minuteOfDay)} ·{" "}
                              {nombrePorEspacio.get(reserva.spaceId) ?? "Espacio"}
                            </p>
                            <p className="text-xs text-[var(--fo-muted)]">
                              {reserva.contactName} ·{" "}
                              {reserva.customerType === "MEMBER" ? "Socio" : "No socio"} ·{" "}
                              {ETIQUETA_ESTADO[reserva.status] ?? reserva.status}
                              {reserva.holdExpiresAt && reserva.status === "HOLD"
                                ? ` · vence ${reserva.holdExpiresAt.toLocaleString("es-AR", { timeZone: BOOKINGS_TIME_ZONE })}`
                                : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm">
                              {formatMinorArs(decimalArsToMinor(reserva.totalArs))}
                            </span>
                            {cancelada ? null : (
                              <form action={cancelBookingAction}>
                                <input type="hidden" name="bookingId" value={reserva.id} />
                                <button
                                  type="submit"
                                  className="text-xs text-[var(--fo-danger)] underline underline-offset-4"
                                >
                                  Cancelar
                                </button>
                              </form>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: La carga manual**

Crear `app/(shell)/reservas/nueva/page.tsx`:

```tsx
import { PageHeader } from "@/components/page-header";
import { requireBookingsStaff } from "@/lib/bookings/access";
import { listSpaces } from "@/lib/bookings/repository";
import { createManualBookingAction } from "../actions";

export const dynamic = "force-dynamic";

/**
 * La reserva que carga el equipo por alguien que llamó.
 *
 * Se pide fecha y horas locales, y el navegador manda el instante ya resuelto: el campo
 * `datetime-local` no lleva zona, así que se arma con `toISOString()` del lado del cliente
 * antes de enviar. Para evitar esa complicación, acá se piden dos campos `datetime-local`
 * y la acción los interpreta como hora del servidor — que en Vercel es UTC.
 *
 * **Por eso los campos llevan un aviso visible con la zona.** Es la solución simple y
 * honesta mientras la carga manual la haga una persona del equipo, que sabe en qué hora
 * está trabajando.
 */
export default async function NuevaReservaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { workspace } = await requireBookingsStaff();
  const params = await searchParams;
  const espacios = await listSpaces(workspace.id);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Cargar reserva"
        description="Para quien reservó por teléfono o en el mostrador. Se confirma en el acto."
      />

      {params.error ? (
        <p className="fo-alert-error p-4 text-sm" role="alert">{params.error}</p>
      ) : null}

      <form action={createManualBookingAction} className="fo-card space-y-4 p-5">
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="spaceId">Espacio</label>
          <select id="spaceId" name="spaceId" className="fo-input" required>
            {espacios.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="startAt">Desde</label>
            <input id="startAt" name="startAt" type="datetime-local" className="fo-input" required />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="endAt">Hasta</label>
            <input id="endAt" name="endAt" type="datetime-local" className="fo-input" required />
          </div>
        </div>
        <p className="fo-helper">Horarios en hora de Rosario.</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="contactName">A nombre de</label>
            <input id="contactName" name="contactName" className="fo-input" required />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="contactEmail">Email</label>
            <input id="contactEmail" name="contactEmail" type="email" className="fo-input" />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="contactPhone">Teléfono</label>
            <input id="contactPhone" name="contactPhone" className="fo-input" />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="customerType">Quién reserva</label>
            <select id="customerType" name="customerType" className="fo-input">
              <option value="MEMBER">Socio</option>
              <option value="NON_MEMBER">No socio</option>
            </select>
          </div>
        </div>

        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="notes">Notas</label>
          <textarea id="notes" name="notes" rows={2} className="fo-input" />
        </div>

        <div className="fo-form-actions">
          <button type="submit" className="fo-btn fo-btn-primary text-sm">Cargar reserva</button>
        </div>
      </form>
    </div>
  );
}
```

**Nota sobre la zona horaria de los campos:** `datetime-local` manda un texto sin zona (`2026-09-19T14:00`), y `new Date()` en el servidor lo interpreta en la hora del servidor. En Vercel eso es UTC, así que una carga a las 14 quedaría a las 11 de Rosario. **Antes de dar la tarea por terminada, verificar esto en el navegador** cargando una reserva a una hora conocida y mirando cómo se ve en la agenda. Si aparece corrida, la corrección es interpretar el texto en `BOOKINGS_TIME_ZONE` dentro de `createManualBookingAction` en lugar de pasarlo a `new Date()` directamente.

- [ ] **Step 8: Verificar y commitear**

```bash
npx tsc --noEmit && pnpm test
```

```bash
git add lib/bookings/week.ts lib/bookings/week.test.ts "app/(shell)/reservas"
git commit -m "$(cat <<'MSG'
La Comisión ve la ocupación de la semana y carga reservas a mano

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 11: Tarifas y reglas de la institución

Los cierres y los plazos, que son de la organización entera y no de un espacio.

**Files:**
- Create: `app/(shell)/reservas/configuracion/page.tsx`
- Modify: `app/(shell)/reservas/actions.ts` (agregar `saveBookingSettingsAction` y `addClosureAction`, `deleteClosureAction`)

**Interfaces:**
- Consumes: `requireBookingsAdmin`, `getBookingSettings`, `listSpaces`, `getIntegrationSummary` y `GOOGLE_CALENDAR_INTEGRATION_KEY` del módulo de Integraciones.
- Produces: las tres acciones nuevas.

- [ ] **Step 1: Las acciones**

Agregar a `app/(shell)/reservas/actions.ts`:

```ts
/** Plazos de la institución: cuánto vive un bloqueo y hasta cuándo se puede cancelar. */
export async function saveBookingSettingsAction(formData: FormData): Promise<void> {
  const { workspace } = await requireBookingsAdmin();
  const holdHours = Math.max(1, Number(formData.get("holdHours") ?? 24) || 24);
  const cancelWindowHours = Math.max(0, Number(formData.get("cancelWindowHours") ?? 24) || 0);

  await prisma.bookingSettings.upsert({
    where: { workspaceId: workspace.id },
    create: { workspaceId: workspace.id, holdHours, cancelWindowHours },
    update: { holdHours, cancelWindowHours },
  });

  revalidatePath("/reservas/configuracion");
  redirect("/reservas/configuracion?ok=guardado");
}

/** Feriados, vacaciones, mantenimiento. Sin espacio = toda la institución. */
export async function addClosureAction(formData: FormData): Promise<void> {
  const { workspace } = await requireBookingsAdmin();
  const startAt = new Date(String(formData.get("startAt") ?? ""));
  const endAt = new Date(String(formData.get("endAt") ?? ""));
  const reason = String(formData.get("reason") ?? "").trim();

  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
    redirect(`/reservas/configuracion?error=${encodeURIComponent("Revisá las fechas del cierre.")}`);
  }
  if (reason.length < 2) {
    redirect(`/reservas/configuracion?error=${encodeURIComponent("Escribí el motivo del cierre.")}`);
  }

  await prisma.bookingClosure.create({
    data: {
      workspaceId: workspace.id,
      spaceId: String(formData.get("spaceId") ?? "").trim() || null,
      startAt,
      endAt,
      reason,
    },
  });

  revalidatePath("/reservas/configuracion");
  revalidatePath("/reservas");
  redirect("/reservas/configuracion?ok=cierre");
}

export async function deleteClosureAction(formData: FormData): Promise<void> {
  const { workspace } = await requireBookingsAdmin();
  await prisma.bookingClosure.deleteMany({
    where: { id: String(formData.get("closureId") ?? "").trim(), workspaceId: workspace.id },
  });
  revalidatePath("/reservas/configuracion");
  revalidatePath("/reservas");
  redirect("/reservas/configuracion?ok=cierre_borrado");
}
```

- [ ] **Step 2: La pantalla**

Crear `app/(shell)/reservas/configuracion/page.tsx`. Tres secciones: plazos, cierres y el estado de Google Calendar (que **informa y enlaza, no conecta** — la conexión vive en Integraciones).

```tsx
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireBookingsAdmin } from "@/lib/bookings/access";
import { getBookingSettings, listSpaces } from "@/lib/bookings/repository";
import { GOOGLE_CALENDAR_INTEGRATION_KEY } from "@/lib/integrations/registry";
import { getIntegrationSummary } from "@/lib/integrations/store";
import { prisma } from "@repo/db";
import { BOOKINGS_TIME_ZONE } from "@/lib/bookings/time";
import { addClosureAction, deleteClosureAction, saveBookingSettingsAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function ReservasConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { workspace } = await requireBookingsAdmin();
  const params = await searchParams;

  const [settings, espacios, calendario, cierres] = await Promise.all([
    getBookingSettings(workspace.id),
    listSpaces(workspace.id, { includeInactive: true }),
    getIntegrationSummary(workspace.id, GOOGLE_CALENDAR_INTEGRATION_KEY),
    prisma.bookingClosure.findMany({
      where: { workspaceId: workspace.id, endAt: { gte: new Date() } },
      orderBy: { startAt: "asc" },
      select: { id: true, spaceId: true, startAt: true, endAt: true, reason: true },
    }),
  ]);
  const nombrePorEspacio = new Map(espacios.map((e) => [e.id, e.name]));
  const fecha = (d: Date) => d.toLocaleString("es-AR", { timeZone: BOOKINGS_TIME_ZONE });

  return (
    <div className="space-y-8">
      <PageHeader title="Tarifas y reglas" description="Plazos, cierres y el calendario de la institución. Las tarifas de cada espacio se editan en Espacios." />

      {params.error ? <p className="fo-alert-error p-4 text-sm" role="alert">{params.error}</p> : null}
      {params.ok ? <p className="fo-card p-4 text-sm text-[var(--fo-success)]">Listo, se guardó.</p> : null}

      <form action={saveBookingSettingsAction} className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Plazos</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="holdHours">Vencimiento del bloqueo (horas)</label>
            <input id="holdHours" name="holdHours" type="number" min={1} className="fo-input" defaultValue={settings.holdHours} />
            <p className="fo-helper">Cuánto queda tomado un horario esperando el pago por transferencia o la aprobación.</p>
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="cancelWindowHours">Cancelación libre (horas antes)</label>
            <input id="cancelWindowHours" name="cancelWindowHours" type="number" min={0} className="fo-input" defaultValue={settings.cancelWindowHours} />
            <p className="fo-helper">Hasta cuántas horas antes puede cancelar solo quien reservó. Después, solo la institución.</p>
          </div>
        </div>
        <div className="fo-form-actions">
          <button type="submit" className="fo-btn fo-btn-primary text-sm">Guardar plazos</button>
        </div>
      </form>

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Google Calendar</h2>
        {calendario?.status === "ACTIVE" ? (
          <p className="text-sm text-[var(--fo-success)]">
            Conectado como {calendario.accountEmail}. El calendario de cada espacio se elige en Espacios.
          </p>
        ) : (
          <p className="text-sm text-[var(--fo-muted)]">
            Sin conectar. Las reservas funcionan igual; lo que falta es el espejo en el calendario.
          </p>
        )}
        <Link href="/workspace/configuracion/integraciones" className="fo-btn fo-btn-secondary text-sm inline-flex">
          Ir a Integraciones
        </Link>
      </section>

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Cierres</h2>
        <p className="fo-helper">Feriados, vacaciones o mantenimiento. Tapan los horarios aunque el espacio tenga agenda ese día.</p>

        <form action={addClosureAction} className="grid gap-4 sm:grid-cols-4">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="closure-start">Desde</label>
            <input id="closure-start" name="startAt" type="datetime-local" className="fo-input" required />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="closure-end">Hasta</label>
            <input id="closure-end" name="endAt" type="datetime-local" className="fo-input" required />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="closure-space">Espacio</label>
            <select id="closure-space" name="spaceId" className="fo-input">
              <option value="">Toda la institución</option>
              {espacios.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="closure-reason">Motivo</label>
            <input id="closure-reason" name="reason" className="fo-input" placeholder="Feriado" required />
          </div>
          <div className="sm:col-span-4">
            <button type="submit" className="fo-btn fo-btn-secondary text-sm">Agregar cierre</button>
          </div>
        </form>

        {cierres.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted-soft)]">No hay cierres cargados.</p>
        ) : (
          <ul className="space-y-2">
            {cierres.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--fo-border)] pb-2 last:border-0">
                <span className="text-sm">
                  {fecha(c.startAt)} → {fecha(c.endAt)} · {c.reason} ·{" "}
                  {c.spaceId ? (nombrePorEspacio.get(c.spaceId) ?? "Espacio") : "Toda la institución"}
                </span>
                <form action={deleteClosureAction}>
                  <input type="hidden" name="closureId" value={c.id} />
                  <button type="submit" className="text-xs text-[var(--fo-danger)] underline underline-offset-4">Quitar</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Verificar y commitear**

```bash
npx tsc --noEmit && pnpm test
```

```bash
git add "app/(shell)/reservas"
git commit -m "$(cat <<'MSG'
La institución fija sus plazos y cierra por feriado

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```


---

### Task 11.bis: La pantalla de Extras

Donde el dueño carga el inventario y lo que se vende. Dos listas en una pantalla, porque una sin la otra no se entiende.

**Files:**
- Create: `lib/bookings/extra-form.ts` (validación pura)
- Test: `lib/bookings/extra-form.test.ts`
- Create: `app/(shell)/reservas/extras/page.tsx`
- Modify: `app/(shell)/reservas/actions.ts` (cuatro acciones nuevas)
- Modify: `lib/bookings/repository.ts` (dos lecturas nuevas)

**Interfaces:**
- Consumes: `parseArsToMinor` (Task 8); `ExtraDefinition` (Task 7.bis).
- Produces:
  - `parseExtraForm(formData: FormData): { ok: true; values: ExtraFormValues } | { ok: false; error: string }`
  - `listResources(workspaceId: string): Promise<{ id: string; name: string; quantity: number }[]>`
  - `listExtras(workspaceId: string, options?: { spaceId?: string }): Promise<ExtraRecord[]>`
  - Acciones `saveResourceAction`, `deleteResourceAction`, `saveExtraAction`, `toggleExtraActiveAction`

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/bookings/extra-form.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseExtraForm } from "./extra-form";

function form(campos: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) {
    if (Array.isArray(v)) v.forEach((x) => fd.append(k, x));
    else fd.set(k, v);
  }
  return fd;
}

const completo = {
  name: "Pack de 2 flashes",
  priceMode: "PER_BOOKING",
  memberPriceArs: "1.600",
  nonMemberPriceArs: "2.500",
  resourceId: "res-flash",
  unitsConsumed: "2",
  spaceIds: ["estudio"],
};

describe("el formulario de un extra", () => {
  it("un formulario completo se acepta", () => {
    const r = parseExtraForm(form(completo));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.values.name).toBe("Pack de 2 flashes");
    expect(r.values.memberPriceMinor).toBe(160_000);
    expect(r.values.unitsConsumed).toBe(2);
    expect(r.values.resourceId).toBe("res-flash");
    expect(r.values.spaceIds).toEqual(["estudio"]);
  });

  it("sin recurso, el extra no controla cantidad y consume una unidad nominal", () => {
    const r = parseExtraForm(form({ ...completo, resourceId: "", unitsConsumed: "5" }));
    expect(r.ok && r.values.resourceId).toBeNull();
    expect(r.ok && r.values.unitsConsumed).toBe(1);
  });

  it("con recurso, consumir cero unidades no tiene sentido y se rechaza", () => {
    const r = parseExtraForm(form({ ...completo, unitsConsumed: "0" }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("unidad");
  });

  it("un extra sin nombre se rechaza", () => {
    expect(parseExtraForm(form({ ...completo, name: " " })).ok).toBe(false);
  });

  it("un extra que no se ofrece en ningún espacio se rechaza", () => {
    const r = parseExtraForm(form({ ...completo, spaceIds: [] }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("espacio");
  });

  it("un precio ilegible se rechaza y dice cuál", () => {
    const r = parseExtraForm(form({ ...completo, nonMemberPriceArs: "dos mil" }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("no socios");
  });

  it("un modo de cobro desconocido cae en por reserva, no rompe", () => {
    const r = parseExtraForm(form({ ...completo, priceMode: "CUALQUIERA" }));
    expect(r.ok && r.values.priceMode).toBe("PER_BOOKING");
  });

  it("por hora se acepta tal cual", () => {
    const r = parseExtraForm(form({ ...completo, priceMode: "PER_HOUR" }));
    expect(r.ok && r.values.priceMode).toBe("PER_HOUR");
  });

  it("requiere confirmación solo si se marcó", () => {
    expect(parseExtraForm(form(completo)).ok && parseExtraForm(form(completo)).values?.requiresConfirmation).toBe(false);
    const r = parseExtraForm(form({ ...completo, requiresConfirmation: "on" }));
    expect(r.ok && r.values.requiresConfirmation).toBe(true);
  });

  it("un extra gratis es válido: puede ser un servicio incluido", () => {
    const r = parseExtraForm(form({ ...completo, memberPriceArs: "0", nonMemberPriceArs: "0" }));
    expect(r.ok && r.values.memberPriceMinor).toBe(0);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
pnpm test lib/bookings/extra-form.test.ts
```

Esperado: FALLA con `Failed to resolve import "./extra-form"`.

- [ ] **Step 3: Escribir la validación**

Crear `lib/bookings/extra-form.ts`:

```ts
import { parseArsToMinor } from "./space-form";
import type { ExtraPriceMode } from "./extras";

/**
 * Validación del formulario de un extra. Módulo PURO: sin base y sin red.
 *
 * La regla que más importa es la del recurso: sin recurso el extra no controla cantidad, y
 * entonces `unitsConsumed` no significa nada. Se normaliza a 1 en lugar de guardar el
 * número que haya escrito la persona — un dato que no se usa pero se ve invita a creer que
 * hace algo.
 */

export type ExtraFormValues = {
  name: string;
  description: string | null;
  priceMode: ExtraPriceMode;
  memberPriceMinor: number;
  nonMemberPriceMinor: number;
  resourceId: string | null;
  unitsConsumed: number;
  requiresConfirmation: boolean;
  spaceIds: string[];
};

export type ExtraFormResult =
  | { ok: true; values: ExtraFormValues }
  | { ok: false; error: string };

export function parseExtraForm(formData: FormData): ExtraFormResult {
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { ok: false, error: "Poné un nombre para el extra." };

  const memberPriceMinor = parseArsToMinor(String(formData.get("memberPriceArs") ?? ""));
  if (memberPriceMinor === null) {
    return { ok: false, error: "El precio para socios no se entiende." };
  }
  const nonMemberPriceMinor = parseArsToMinor(String(formData.get("nonMemberPriceArs") ?? ""));
  if (nonMemberPriceMinor === null) {
    return { ok: false, error: "El precio para no socios no se entiende." };
  }

  const spaceIds = formData.getAll("spaceIds").map((v) => String(v)).filter((v) => v !== "");
  if (spaceIds.length === 0) {
    return { ok: false, error: "Elegí al menos un espacio donde ofrecer este extra." };
  }

  const resourceId = String(formData.get("resourceId") ?? "").trim() || null;

  // Sin recurso no hay cantidad que controlar: se normaliza a 1 para que el número
  // guardado no sugiera un comportamiento que no existe.
  let unitsConsumed = 1;
  if (resourceId !== null) {
    const crudo = Number(String(formData.get("unitsConsumed") ?? "1").trim());
    if (!Number.isFinite(crudo) || crudo < 1) {
      return { ok: false, error: "Un extra con recurso tiene que consumir al menos una unidad." };
    }
    unitsConsumed = Math.floor(crudo);
  }

  const modo = String(formData.get("priceMode") ?? "");
  const priceMode: ExtraPriceMode = modo === "PER_HOUR" ? "PER_HOUR" : "PER_BOOKING";

  return {
    ok: true,
    values: {
      name,
      description: String(formData.get("description") ?? "").trim() || null,
      priceMode,
      memberPriceMinor,
      nonMemberPriceMinor,
      resourceId,
      unitsConsumed,
      requiresConfirmation: formData.get("requiresConfirmation") === "on",
      spaceIds,
    },
  };
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
pnpm test lib/bookings/extra-form.test.ts
```

Esperado: PASA, 10 tests.

- [ ] **Step 5: Las lecturas del repositorio**

Agregar a `lib/bookings/repository.ts`:

```ts
export type ExtraRecord = ExtraDefinition & {
  description: string | null;
  active: boolean;
  resourceName: string | null;
  spaceIds: string[];
};

export async function listResources(
  workspaceId: string,
): Promise<{ id: string; name: string; quantity: number }[]> {
  return prisma.bookingResource.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, quantity: true },
  });
}

/** Los extras del workspace. Con `spaceId`, solo los que se ofrecen en ese espacio. */
export async function listExtras(
  workspaceId: string,
  options?: { spaceId?: string; onlyActive?: boolean },
): Promise<ExtraRecord[]> {
  const filas = await prisma.bookingExtra.findMany({
    where: {
      workspaceId,
      ...(options?.onlyActive ? { active: true } : {}),
      ...(options?.spaceId ? { spaces: { some: { spaceId: options.spaceId } } } : {}),
    },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    include: { resource: { select: { name: true } }, spaces: { select: { spaceId: true } } },
  });

  return filas.map((f) => ({
    id: f.id,
    name: f.name,
    description: f.description,
    active: f.active,
    priceMode: f.priceMode as "PER_BOOKING" | "PER_HOUR",
    memberPriceMinor: decimalArsToMinor(f.memberPriceArs),
    nonMemberPriceMinor: decimalArsToMinor(f.nonMemberPriceArs),
    resourceId: f.resourceId,
    resourceName: f.resource?.name ?? null,
    unitsConsumed: f.unitsConsumed,
    requiresConfirmation: f.requiresConfirmation,
    spaceIds: f.spaces.map((s) => s.spaceId),
  }));
}

/**
 * Lo que ya está apartado del inventario en una ventana.
 *
 * Solo cuentan las líneas que comprometen: una en `REMOVED` no aparta nada, y una en
 * `PENDING_CONFIRMATION` **sí** — mientras la Secretaría decide, ese flash está reservado.
 */
export async function listResourceCommitments(
  workspaceId: string,
  range: Interval,
): Promise<Commitment[]> {
  const lineas = await prisma.bookingExtraLine.findMany({
    where: {
      status: { in: ["PENDING_CONFIRMATION", "CONFIRMED"] },
      booking: {
        workspaceId,
        status: { in: [...ACTIVE_BOOKING_STATUSES] },
        startAt: { lt: range.endAt },
        endAt: { gt: range.startAt },
      },
      extra: { resourceId: { not: null } },
    },
    select: {
      unitsConsumed: true,
      extra: { select: { resourceId: true } },
      booking: { select: { startAt: true, endAt: true } },
    },
  });

  return lineas
    .filter((l) => l.extra.resourceId !== null)
    .map((l) => ({
      resourceId: l.extra.resourceId as string,
      units: l.unitsConsumed,
      range: { startAt: l.booking.startAt, endAt: l.booking.endAt },
    }));
}
```

Agregar los imports que faltan al principio del archivo:

```ts
import type { Commitment, ExtraDefinition } from "./extras";
```

- [ ] **Step 6: Las cuatro acciones**

Agregar a `app/(shell)/reservas/actions.ts`:

```ts
const EXTRAS = "/reservas/extras";

/** El inventario: qué hay y cuántos. */
export async function saveResourceAction(formData: FormData): Promise<void> {
  const { workspace } = await requireBookingsAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const quantity = Math.max(0, Number(formData.get("quantity") ?? 0) || 0);
  const resourceId = String(formData.get("resourceId") ?? "").trim() || null;

  if (name.length < 2) redirect(`${EXTRAS}?error=${encodeURIComponent("Poné un nombre para el recurso.")}`);

  if (resourceId) {
    await prisma.bookingResource.updateMany({
      where: { id: resourceId, workspaceId: workspace.id },
      data: { name, quantity },
    });
  } else {
    await prisma.bookingResource.create({ data: { workspaceId: workspace.id, name, quantity } });
  }

  revalidatePath(EXTRAS);
  redirect(`${EXTRAS}?ok=recurso`);
}

/**
 * Borrar un recurso deja sin control a los extras que lo usaban, no los rompe: el campo
 * queda en null y esos extras pasan a ofrecerse siempre. Es una consecuencia real, así que
 * la pantalla lo avisa antes.
 */
export async function deleteResourceAction(formData: FormData): Promise<void> {
  const { workspace } = await requireBookingsAdmin();
  await prisma.bookingResource.deleteMany({
    where: { id: String(formData.get("resourceId") ?? "").trim(), workspaceId: workspace.id },
  });
  revalidatePath(EXTRAS);
  redirect(`${EXTRAS}?ok=recurso_borrado`);
}

export async function saveExtraAction(formData: FormData): Promise<void> {
  const { workspace } = await requireBookingsAdmin();
  const extraId = String(formData.get("extraId") ?? "").trim() || null;

  const parsed = parseExtraForm(formData);
  if (!parsed.ok) redirect(`${EXTRAS}?error=${encodeURIComponent(parsed.error)}`);
  const v = parsed.values;

  try {
    await prisma.$transaction(async (tx) => {
      const datos = {
        name: v.name,
        description: v.description,
        priceMode: v.priceMode,
        memberPriceArs: minorToDecimalString(v.memberPriceMinor),
        nonMemberPriceArs: minorToDecimalString(v.nonMemberPriceMinor),
        resourceId: v.resourceId,
        unitsConsumed: v.unitsConsumed,
        requiresConfirmation: v.requiresConfirmation,
      };

      const extra = extraId
        ? await tx.bookingExtra.update({
            where: { id: extraId, workspaceId: workspace.id },
            data: datos,
            select: { id: true },
          })
        : await tx.bookingExtra.create({
            data: { ...datos, workspaceId: workspace.id },
            select: { id: true },
          });

      // Los espacios se reemplazan enteros: lista chica, más fácil de razonar que un diff.
      await tx.bookingExtraSpace.deleteMany({ where: { extraId: extra.id } });
      await tx.bookingExtraSpace.createMany({
        data: v.spaceIds.map((spaceId) => ({ extraId: extra.id, spaceId })),
      });
    });
  } catch (error) {
    console.error("[fotoffice][reservas] no se pudo guardar el extra", {
      workspaceId: workspace.id,
      detalle: sanitizeError(error),
    });
    redirect(`${EXTRAS}?error=${encodeURIComponent("No pudimos guardar el extra.")}`);
  }

  revalidatePath(EXTRAS);
  redirect(`${EXTRAS}?ok=extra`);
}

/** Un extra se desactiva, no se borra: hay reservas que lo contrataron. */
export async function toggleExtraActiveAction(formData: FormData): Promise<void> {
  const { workspace } = await requireBookingsAdmin();
  await prisma.bookingExtra.updateMany({
    where: { id: String(formData.get("extraId") ?? "").trim(), workspaceId: workspace.id },
    data: { active: formData.get("active") === "on" },
  });
  revalidatePath(EXTRAS);
  redirect(`${EXTRAS}?ok=extra`);
}
```

Y agregar al import de validación que ya existe en ese archivo:

```ts
import { parseExtraForm } from "@/lib/bookings/extra-form";
```

- [ ] **Step 7: La pantalla**

Crear `app/(shell)/reservas/extras/page.tsx`. Estructura, de arriba hacia abajo:

1. `PageHeader` con título "Extras" y la descripción: *"Lo que se alquila junto con un espacio. Primero cargá el inventario; después, lo que se vende."*
2. **Sección Inventario** (`fo-card`): la lista de recursos con nombre, cantidad, un formulario de alta (`saveResourceAction`) y el botón de quitar (`deleteResourceAction`) con el aviso *"Los extras que lo usaban dejan de controlar cantidad."*
3. **Sección Extras** (`fo-card`): la lista, cada uno mostrando nombre, precio de socio y de no socio, si se cobra por reserva o por hora, qué consume (*"Consume 2 × Flash"* o *"Sin control de cantidad"*), en qué espacios se ofrece, y si requiere confirmación. Con Editar y Activar/Desactivar.
4. **Formulario de alta/edición** (`saveExtraAction`): nombre, descripción, los dos precios, un `select` de `priceMode` con las dos opciones en castellano (*"Una vez por reserva"* / *"Por cada hora"*), un `select` de recurso (con la opción *"Sin control de cantidad"* en primer lugar y valor vacío), `unitsConsumed`, la casilla de requiere confirmación con la ayuda *"La reserva queda a aprobar y no se cobra hasta que la institución confirme"*, y las casillas de espacios.

Usar exactamente las clases del design system que usa `space-form.tsx` (`fo-card`, `fo-field-stack`, `fo-label`, `fo-input`, `fo-helper`, `fo-form-actions`, `fo-btn fo-btn-primary`), y `formatMinorArs` para mostrar los importes.

- [ ] **Step 8: Verificar y commitear**

```bash
npx tsc --noEmit && pnpm test
```

```bash
git add lib/bookings/extra-form.ts lib/bookings/extra-form.test.ts lib/bookings/repository.ts "app/(shell)/reservas"
git commit -m "$(cat <<'MSG'
El dueño carga qué equipamiento hay y qué se alquila con él

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 12: Encender el módulo

Dos cosas, como siempre: el código y la base. Registrar el módulo no lo enciende para nadie — eso lo hace el Super Admin en la ficha del workspace.

**Files:**
- Modify: `lib/modules/registry.ts`
- Modify: `components/shell/shell-nav.tsx`
- Modify: `docs/fotoffice/ARQUITECTURA-NAVEGACION.md`
- Modify: `docs/fotoffice/ESTADO-ACTUAL.md`

- [ ] **Step 1: Pasar la clave a AVAILABLE**

En `lib/modules/registry.ts`, importar la constante y reemplazar la entrada `bookings`:

```ts
import { BOOKINGS_MODULE_KEY } from "@/lib/bookings/constants";
```

```ts
  {
    key: BOOKINGS_MODULE_KEY,
    label: "Reservas",
    description:
      "Reserva de salón, estudio, coworking u otros espacios: horarios, tarifas para socios y no socios, y agenda.",
    category: "GENERAL",
    order: 60,
    route: "/reservas",
    status: "AVAILABLE",
  },
```

- [ ] **Step 2: Agregar la sección al menú**

En `components/shell/shell-nav.tsx`, agregar una sección RESERVAS con los tres ítems, condicionada al módulo habilitado, siguiendo exactamente la forma de la sección SOCIOS que ya está en el archivo:

- `Agenda` → `/reservas` → ícono `CalendarDays` → STAFF+
- `Espacios` → `/reservas/espacios` → ícono `DoorOpen` → ADMIN+
- `Extras` → `/reservas/extras` → ícono `PackagePlus` → ADMIN+
- `Tarifas y reglas` → `/reservas/configuracion` → ícono `Settings` → ADMIN+

Importar `CalendarDays`, `DoorOpen` y `PackagePlus` de `lucide-react` junto a los demás íconos.

- [ ] **Step 3: Encender el módulo para la SFPR**

Se hace desde `/admin/workspaces/[id]` como Super Admin, no por código. Encenderlo ahí y confirmar que la sección aparece en el menú.

- [ ] **Step 4: Actualizar el documento de navegación**

En `docs/fotoffice/ARQUITECTURA-NAVEGACION.md` §4.6, cambiar las filas de ⬜ a ✅, agregar la fila de `Extras` (orden 25, `/reservas/extras`, `PackagePlus`, ADMIN+) y sacar la línea *«Etapa 9. Cero código hoy. Es el módulo más grande de los que faltan.»*, reemplazándola por:

```markdown
Implementado. Falta el cobro online y la reserva desde el portal del socio, que van en un
plan aparte.
```

Poner además la fecha real del día en que se termina, con el mismo formato que usan las
otras entradas fechadas del documento (`Implementado el 2026-08-31.`).

Y en `docs/fotoffice/ESTADO-ACTUAL.md`, cambiar la fila `9 — Reservas | NO EXISTE` por el estado real, y registrar la migración `20260909000000_bookings` como aplicada a mano en la base de FotoOffice.

- [ ] **Step 5: Verificación completa**

```bash
pnpm test && npx tsc --noEmit && pnpm lint
```

Y en el navegador, con el módulo encendido:

1. Crear el estudio (sábados 9–13, socios $3.000, no socios $5.000, 2 h bonificadas).
2. Crear el salón y el coworking. Marcar estudio ↔ coworking como compatibles.
3. Cargar una reserva del salón un sábado de 10 a 12.
4. Volver a la agenda: la reserva aparece.
5. Intentar cargar una del estudio ese mismo sábado de 10 a 12 → **tiene que rechazarla**, porque el salón no convive con nadie.
6. Cargar una del estudio de 12 a 13 → entra.
7. Cargar un cierre para ese sábado y verificar que ya no deja cargar nada.
8. Entrar como STAFF: ve la Agenda, no ve Espacios, Extras ni Tarifas, y escribir
   `/reservas/espacios` a mano lo devuelve a la agenda.

Y el circuito de los extras, que es donde está la lógica menos obvia:

9. Cargar el recurso **Flash, cantidad 2** y el recurso **Modelo, cantidad 1**.
10. Cargar el extra **Flash adicional** (consume 1 flash, por reserva) y **Pack de 2 flashes**
    (consume 2 flashes, más barato que dos sueltos). Los dos, solo en el estudio.
11. Cargar **Fondo de papel** sin recurso, y **Modelo** por hora con "requiere confirmación".
12. Verificar en la pantalla que el fondo dice "Sin control de cantidad" y el pack "Consume
    2 × Flash".
13. Con una reserva del estudio que ya tomó 1 flash: el flash suelto sigue disponible y **el
    pack aparece agotado**. Es la prueba de que el inventario es compartido.
14. Con los 2 flashes tomados: los dos aparecen agotados, **visibles y con el motivo**, no
    escondidos.
15. El fondo de papel sigue disponible siempre.

- [ ] **Step 6: Commitear**

```bash
git add lib/modules/registry.ts components/shell/shell-nav.tsx docs/fotoffice/ARQUITECTURA-NAVEGACION.md docs/fotoffice/ESTADO-ACTUAL.md
git commit -m "$(cat <<'MSG'
Reservas entra al menú y la institución puede usarlo

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

## Qué queda funcionando al terminar

La institución da de alta sus espacios con horarios, tarifas y reglas de convivencia, y el equipamiento que se alquila junto con ellos. La Comisión ve la ocupación de la semana y carga las reservas que llegan por teléfono. El sistema impide dos reservas superpuestas —tanto del mismo espacio como de espacios que no pueden convivir— y lo impide **dos veces**: en la transacción y en la base. Y no promete un flash que ya está comprometido, ni cuando se pide suelto ni cuando se pide dentro de un pack.

Ya reemplaza a la planilla.

## Lo que falta y va en el plan siguiente

- El socio reserva desde el portal —con sus extras— y paga por Mercado Pago o transferencia.
- Las horas bonificadas del mes, calculadas contra las reservas del socio. **Cubren el
  espacio, no los extras.**
- La confirmación o el retiro de un extra a confirmar desde la agenda, y el enlace de pago
  con el total definitivo.
- La comisión del 5%, retenida por Mercado Pago o devengada como deuda.
- El vencimiento automático de los bloqueos impagos.
- El espejo con Google Calendar, en las dos direcciones.
- La reserva pública para no socios.
