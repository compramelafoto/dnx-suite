import { describe, expect, it } from "vitest";
import { BOOKINGS_TIME_ZONE, addMinutes } from "./time";
import { buildWeekGrid, selectRange, type WeekGrid } from "./week-grid";

const tz = BOOKINGS_TIME_ZONE;

/** Lunes 14/09/2026, medianoche en Rosario (UTC-3 → 03:00Z). */
const lunes = new Date("2026-09-14T03:00:00.000Z");
/** El instante de una hora local de un día de esa semana. */
const en = (diaIndex: number, hora: number) => addMinutes(lunes, diaIndex * 1440 + hora * 60);

/** Coworking: lunes a viernes, 9-12 y 14-18. */
const horariosCoworking = [1, 2, 3, 4, 5].flatMap((d) => [
  { weekday: d, startMinute: 9 * 60, endMinute: 12 * 60 },
  { weekday: d, startMinute: 14 * 60, endMinute: 18 * 60 },
]);

const base = {
  weekStart: lunes,
  weeklyHours: horariosCoworking,
  now: new Date("2026-09-13T15:00:00Z"),
  timeZone: tz,
  slotMinutes: 60,
  minAdvanceHours: 2,
};

/** Todos los turnos de la semana como libres, salvo los que se pidan ocupados. */
function todosLibres(ocupados: { dia: number; hora: number }[] = []) {
  const libres = [];
  for (let dia = 0; dia < 7; dia += 1) {
    for (const [desde, hasta] of [
      [9, 12],
      [14, 18],
    ]) {
      if (dia > 4) continue; // solo lunes a viernes
      for (let h = desde; h < hasta; h += 1) {
        if (ocupados.some((o) => o.dia === dia && o.hora === h)) continue;
        libres.push({ startAt: en(dia, h), endAt: en(dia, h + 1) });
      }
    }
  }
  return libres;
}

const celda = (g: WeekGrid, dia: number, hora: number) =>
  g.days[dia].cells.find((c) => c.minuteOfDay === hora * 60);

describe("la grilla de la semana", () => {
  it("tiene siete días", () => {
    expect(buildWeekGrid({ ...base, freeSlots: todosLibres() }).days).toHaveLength(7);
  });

  it("las filas van del primer horario al último, sin saltearse el hueco del mediodía", () => {
    // El coworking abre 9-12 y 14-18. Las 12 y las 13 tienen que EXISTIR como fila,
    // cerradas: si no aparecieran, el día parecería terminar a las 12.
    const g = buildWeekGrid({ ...base, freeSlots: todosLibres() });
    expect(g.rows).toEqual([540, 600, 660, 720, 780, 840, 900, 960, 1020]);
    expect(celda(g, 0, 12)?.state).toBe("CLOSED");
    expect(celda(g, 0, 13)?.state).toBe("CLOSED");
  });

  it("un turno libre se ve libre", () => {
    const g = buildWeekGrid({ ...base, freeSlots: todosLibres() });
    expect(celda(g, 0, 9)?.state).toBe("FREE");
    expect(celda(g, 0, 15)?.state).toBe("FREE");
  });

  it("un turno dentro del horario pero sin hueco está ocupado", () => {
    const g = buildWeekGrid({ ...base, freeSlots: todosLibres([{ dia: 0, hora: 10 }]) });
    expect(celda(g, 0, 10)?.state).toBe("TAKEN");
  });

  it("un día que el espacio no abre queda cerrado entero", () => {
    const g = buildWeekGrid({ ...base, freeSlots: todosLibres() });
    // Sábado (índice 5) y domingo (6): el coworking no abre.
    expect(g.days[5].cells.every((c) => c.state === "CLOSED")).toBe(true);
    expect(g.days[6].cells.every((c) => c.state === "CLOSED")).toBe(true);
  });

  it("lo que ya pasó no se ofrece como ocupado: se marca aparte", () => {
    // Con `now` el miércoles al mediodía, el lunes entero ya pasó.
    const g = buildWeekGrid({
      ...base,
      now: en(2, 12),
      freeSlots: todosLibres().filter((s) => s.startAt > en(2, 14)),
    });
    expect(celda(g, 0, 9)?.state).toBe("PAST");
    expect(celda(g, 2, 9)?.state).toBe("PAST");
  });

  it("cada día trae su etiqueta y su fecha", () => {
    const g = buildWeekGrid({ ...base, freeSlots: todosLibres() });
    expect(g.days[0].ymd).toBe("2026-09-14");
    expect(g.days[0].label.toLowerCase()).toContain("lun");
    expect(g.days[6].ymd).toBe("2026-09-20");
  });

  it("un espacio sin horarios no arma grilla, en vez de romper", () => {
    const g = buildWeekGrid({ ...base, weeklyHours: [], freeSlots: [] });
    expect(g.rows).toEqual([]);
    expect(g.days.every((d) => d.cells.length === 0)).toBe(true);
  });
});

describe("elegir un rango con dos toques", () => {
  const g = buildWeekGrid({ ...base, freeSlots: todosLibres() });

  it("un solo turno es un rango válido de una hora", () => {
    const c = celda(g, 0, 9)!;
    const r = selectRange(g, c.startISO, c.startISO);
    expect(r.ok).toBe(true);
    expect(r.ok && r.startISO).toBe(c.startISO);
    expect(r.ok && r.endISO).toBe(celda(g, 0, 10)!.startISO);
  });

  it("cuatro horas seguidas se pueden reservar de una", () => {
    // Es lo que faltaba: alguien que quiere el coworking de 14 a 18.
    const r = selectRange(g, celda(g, 0, 14)!.startISO, celda(g, 0, 17)!.startISO);
    expect(r.ok).toBe(true);
    expect(r.ok && r.minutes).toBe(240);
  });

  it("el orden de los dos toques no importa", () => {
    const a = selectRange(g, celda(g, 0, 14)!.startISO, celda(g, 0, 17)!.startISO);
    const b = selectRange(g, celda(g, 0, 17)!.startISO, celda(g, 0, 14)!.startISO);
    expect(a).toEqual(b);
  });

  it("un rango que cruza el hueco del mediodía se rechaza, y dice por qué", () => {
    const r = selectRange(g, celda(g, 0, 11)!.startISO, celda(g, 0, 15)!.startISO);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.motivo).toContain("cerrado");
  });

  it("un rango con una hora ocupada en el medio se rechaza", () => {
    const conOcupado = buildWeekGrid({
      ...base,
      freeSlots: todosLibres([{ dia: 0, hora: 15 }]),
    });
    const r = selectRange(
      conOcupado,
      celda(conOcupado, 0, 14)!.startISO,
      celda(conOcupado, 0, 17)!.startISO,
    );
    expect(r.ok).toBe(false);
    expect(!r.ok && r.motivo).toContain("ocupada");
  });

  it("no se puede elegir un rango que cruce de un día al otro", () => {
    const r = selectRange(g, celda(g, 0, 17)!.startISO, celda(g, 1, 9)!.startISO);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.motivo).toContain("mismo día");
  });

  it("un turno que no existe en la grilla no arma rango", () => {
    expect(selectRange(g, "2026-01-01T00:00:00.000Z", celda(g, 0, 9)!.startISO).ok).toBe(false);
  });
});
