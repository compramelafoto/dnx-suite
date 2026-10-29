import assert from "node:assert/strict";
import test from "node:test";
import {
  CALENDAR_MONTH_NAMES,
  DEFAULT_CALENDAR_OPTIONS,
  calendarMonthWeeks,
  calendarWeekdayLabels,
  daysInMonth,
  defaultCalendarYear,
  firstWeekdayOfMonth,
  isCalendarConfig,
  isLeapYear,
  layoutCalendar,
  parseCalendarYear,
  readCalendarOptions,
  type CalendarOptions,
} from "./calendar";

test("años bisiestos: cada 4, salvo los centenarios no divisibles por 400", () => {
  assert.equal(isLeapYear(2024), true);
  assert.equal(isLeapYear(2026), false);
  assert.equal(isLeapYear(2027), false);
  assert.equal(isLeapYear(2028), true);
  assert.equal(isLeapYear(1900), false);
  assert.equal(isLeapYear(2000), true);
  assert.equal(isLeapYear(2100), false);
});

test("días de cada mes según el año", () => {
  const comun = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const bisiesto = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  for (const anio of [2025, 2026, 2027, 2029, 2100]) {
    assert.deepEqual(
      Array.from({ length: 12 }, (_, i) => daysInMonth(anio, i + 1)),
      comun,
      `año ${anio}`,
    );
  }
  for (const anio of [2024, 2028, 2000]) {
    assert.deepEqual(
      Array.from({ length: 12 }, (_, i) => daysInMonth(anio, i + 1)),
      bisiesto,
      `año ${anio}`,
    );
  }
});

test("el 1 de cada mes cae el día de la semana correcto", () => {
  // 0 = domingo. Comprobado con un almanaque.
  assert.equal(firstWeekdayOfMonth(2026, 1), 4); // jueves 1/1/2026
  assert.equal(firstWeekdayOfMonth(2027, 1), 5); // viernes 1/1/2027
  assert.equal(firstWeekdayOfMonth(2027, 2), 1); // lunes 1/2/2027
  assert.equal(firstWeekdayOfMonth(2028, 2), 2); // martes 1/2/2028
  assert.equal(firstWeekdayOfMonth(2028, 3), 3); // miércoles 1/3/2028 (después del 29/2)
  assert.equal(firstWeekdayOfMonth(2026, 10), 4); // jueves 1/10/2026
});

test("las semanas de un mes con la semana empezando el lunes", () => {
  // Febrero 2027 empieza un lunes y tiene 28 días: cuatro filas justas, dos vacías.
  const feb = calendarMonthWeeks(2027, 2, "monday");
  assert.equal(feb.length, 6);
  assert.deepEqual(feb[0], [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(feb[3], [22, 23, 24, 25, 26, 27, 28]);
  assert.deepEqual(feb[4], [null, null, null, null, null, null, null]);
  // Enero 2027 empieza un viernes: lunes a jueves vacíos.
  const ene = calendarMonthWeeks(2027, 1, "monday");
  assert.deepEqual(ene[0], [null, null, null, null, 1, 2, 3]);
  // El 31 de enero de 2027 es domingo: última columna.
  assert.equal(ene[4]![6], 31);
});

test("las semanas con la semana empezando el domingo", () => {
  const ene = calendarMonthWeeks(2027, 1, "sunday");
  assert.deepEqual(ene[0], [null, null, null, null, null, 1, 2]);
  // Mayo 2027 empieza sábado y tiene 31 días: necesita las 6 filas.
  const mayo = calendarMonthWeeks(2027, 5, "sunday");
  assert.equal(mayo[0]![6], 1);
  assert.equal(mayo[5]![1], 31);
});

test("cada mes tiene todos sus días, una sola vez y en orden", () => {
  for (const anio of [2026, 2027, 2028]) {
    for (let mes = 1; mes <= 12; mes++) {
      for (const inicio of ["monday", "sunday"] as const) {
        const dias = calendarMonthWeeks(anio, mes, inicio).flat().filter((d): d is number => d != null);
        assert.deepEqual(dias, Array.from({ length: daysInMonth(anio, mes) }, (_, i) => i + 1));
      }
    }
  }
});

test("los encabezados de la semana", () => {
  assert.deepEqual(calendarWeekdayLabels("monday", "initial"), ["L", "M", "M", "J", "V", "S", "D"]);
  assert.deepEqual(calendarWeekdayLabels("sunday", "short"), ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"]);
});

test("el año que se ofrece: desde septiembre, el que viene", () => {
  assert.equal(defaultCalendarYear(new Date("2026-03-10T12:00:00Z")), 2026);
  assert.equal(defaultCalendarYear(new Date("2026-10-29T12:00:00Z")), 2027);
  // 1 de enero a las 01:00 UTC todavía es 31 de diciembre en la Argentina.
  assert.equal(defaultCalendarYear(new Date("2027-01-01T01:00:00Z")), 2027);
});

test("leer el año escrito por el fotógrafo", () => {
  assert.equal(parseCalendarYear("2027"), 2027);
  assert.equal(parseCalendarYear(" 2028 "), 2028);
  assert.equal(parseCalendarYear(2030), 2030);
  assert.equal(parseCalendarYear("27"), null);
  assert.equal(parseCalendarYear("dos mil"), null);
  assert.equal(parseCalendarYear(2027.5), null);
});

test("las opciones guardadas, con valores por defecto donde faltan", () => {
  assert.deepEqual(readCalendarOptions({}), DEFAULT_CALENDAR_OPTIONS);
  const o = readCalendarOptions({ calendar: { year: "2028", month: 3, columns: 5, weekStart: "sunday", sundayColor: null } });
  assert.equal(o.year, 2028);
  assert.equal(o.month, 3);
  assert.equal(o.columns, DEFAULT_CALENDAR_OPTIONS.columns, "5 columnas no es válido");
  assert.equal(o.weekStart, "sunday");
  assert.equal(o.sundayColor, null);
  assert.equal(readCalendarOptions({ calendar: { month: 13 } }).month, 0);
  assert.equal(isCalendarConfig({ variableKey: "calendar.grid" }), true);
  assert.equal(isCalendarConfig({ variableKey: "course.studentList" }), false);
});

const anual = (anio: number, extra: Partial<CalendarOptions> = {}): CalendarOptions => ({
  ...DEFAULT_CALENDAR_OPTIONS,
  year: anio,
  month: 0,
  ...extra,
});

test("el año completo trae los 12 meses y todos los días del año", () => {
  for (const [anio, total] of [
    [2027, 365],
    [2028, 366],
  ] as const) {
    const { cells, months } = layoutCalendar({ options: anual(anio), width: 2400, height: 3000, fontSize: 40, lineHeight: 1.2 });
    assert.equal(months.length, 12);
    assert.deepEqual(
      cells.filter((c) => c.kind === "month").map((c) => c.text),
      [...CALENDAR_MONTH_NAMES],
    );
    assert.equal(cells.filter((c) => c.kind === "day").length, total);
    assert.equal(cells.filter((c) => c.kind === "weekday").length, 12 * 7);
  }
});

test("todo queda adentro del bloque y achica el cuerpo si no entra", () => {
  const ancho = 1800;
  const alto = 1200;
  const { cells, fontSize } = layoutCalendar({ options: anual(2027, { columns: 4 }), width: ancho, height: alto, fontSize: 200, lineHeight: 1.2 });
  assert.ok(fontSize < 200, "achicó");
  for (const c of cells) {
    assert.ok(c.x >= -0.01 && c.y >= -0.01, `${c.text} adentro arriba/izquierda`);
    assert.ok(c.x + c.width <= ancho + 0.01, `${c.text} adentro a lo ancho`);
    assert.ok(c.y + c.height <= alto + 0.01, `${c.text} adentro a lo alto`);
  }
  // Nunca agranda.
  assert.equal(layoutCalendar({ options: anual(2027), width: 9000, height: 9000, fontSize: 30, lineHeight: 1.2 }).fontSize, 30);
});

test("un mes solo: con el año en el título, los domingos en su color", () => {
  const o: CalendarOptions = { ...DEFAULT_CALENDAR_OPTIONS, year: 2027, month: 2, showYearInTitle: true };
  const { cells } = layoutCalendar({ options: o, width: 1400, height: 1200, fontSize: 60, lineHeight: 1.2 });
  assert.equal(cells.find((c) => c.kind === "month")?.text, "Febrero 2027");
  const dias = cells.filter((c) => c.kind === "day");
  assert.equal(dias.length, 28);
  // Domingos de febrero 2027: 7, 14, 21 y 28.
  assert.deepEqual(
    dias.filter((c) => c.color === o.sundayColor).map((c) => c.text),
    ["7", "14", "21", "28"],
  );
  // El mes solo estira las filas hasta usar el alto del bloque.
  const ultimo = dias.at(-1)!;
  assert.ok(ultimo.y + ultimo.height > 1200 * 0.6);
  assert.ok(ultimo.y + ultimo.height <= 1200 + 0.01);
});

test("sin nombre del mes ni encabezados, sólo los días", () => {
  const o: CalendarOptions = { ...DEFAULT_CALENDAR_OPTIONS, year: 2026, month: 12, showMonthName: false, showWeekdays: false };
  const { cells } = layoutCalendar({ options: o, width: 700, height: 600, fontSize: 40, lineHeight: 1.2 });
  assert.equal(cells.length, 31);
  assert.ok(cells.every((c) => c.kind === "day"));
});
