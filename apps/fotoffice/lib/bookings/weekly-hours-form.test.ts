import { describe, expect, it } from "vitest";
import {
  copyDayTo,
  endOptions,
  formatRange,
  nextRangeFor,
  overlappingIndexes,
  rangeIssue,
  startOptions,
  timeOptions,
  toWeekRanges,
  type WeekRanges,
} from "./weekly-hours-form";

describe("los horarios guardados se reparten en los siete días", () => {
  it("agrupa por día y ordena por hora", () => {
    const semana = toWeekRanges([
      { weekday: 1, startMinute: 840, endMinute: 1080 },
      { weekday: 1, startMinute: 540, endMinute: 720 },
      { weekday: 6, startMinute: 540, endMinute: 780 },
    ]);
    expect(semana).toHaveLength(7);
    expect(semana[1]).toEqual([
      { start: 540, end: 720 },
      { start: 840, end: 1080 },
    ]);
    expect(semana[0]).toEqual([]);
    expect(semana[6]).toEqual([{ start: 540, end: 780 }]);
  });
});

describe("las horas que ofrece el desplegable", () => {
  it("sigue la grilla del espacio", () => {
    const opciones = timeOptions(60);
    expect(opciones[0]).toBe(0);
    expect(opciones[1]).toBe(60);
    expect(opciones.at(-1)).toBe(1440);
  });

  it("llega hasta la medianoche aunque la grilla no caiga justo", () => {
    expect(timeOptions(50).at(-1)).toBe(1440);
  });

  it("conserva un horario viejo que no cae en la grilla nueva", () => {
    // Estaba guardado 09:30 y después alguien puso grilla de 60: la opción no se pierde.
    expect(timeOptions(60, [570])).toContain(570);
  });

  it("no deja empezar un tramo a las 24:00", () => {
    expect(startOptions(60)).not.toContain(1440);
  });

  it("como fin sólo ofrece horas que respetan la duración mínima", () => {
    const opciones = endOptions(60, 540, 120);
    expect(opciones).not.toContain(600);
    expect(opciones).toContain(660);
    expect(opciones).toContain(1440);
  });

  it("mantiene el fin que ya estaba elegido aunque no lo respete", () => {
    expect(endOptions(60, 540, 120, [600])).toContain(600);
  });
});

describe("el tramo que propone el botón +", () => {
  it("en un día vacío arranca a las 09:00", () => {
    expect(nextRangeFor([], 60, 60)).toEqual({ start: 540, end: 780 });
  });

  it("en un día con tramos arranca donde terminó el último", () => {
    expect(nextRangeFor([{ start: 540, end: 720 }], 60, 60)).toEqual({
      start: 720,
      end: 960,
    });
  });

  it("respeta la grilla cuando no es de una hora", () => {
    const rango = nextRangeFor([], 45, 45)!;
    expect(rango.start % 45).toBe(0);
  });

  it("recorta el último tramo en la medianoche", () => {
    expect(nextRangeFor([{ start: 1200, end: 1380 }], 60, 60)).toEqual({
      start: 1380,
      end: 1440,
    });
  });

  it("no propone nada si ya no queda día", () => {
    expect(nextRangeFor([{ start: 1380, end: 1440 }], 60, 60)).toBeNull();
  });
});

describe("tramos que se pisan", () => {
  it("los señala a los dos", () => {
    expect(
      overlappingIndexes([
        { start: 540, end: 720 },
        { start: 660, end: 900 },
      ]),
    ).toEqual([0, 1]);
  });

  it("deja pasar dos tramos que se tocan sin superponerse", () => {
    expect(
      overlappingIndexes([
        { start: 540, end: 720 },
        { start: 720, end: 900 },
      ]),
    ).toEqual([]);
  });
});

describe("el aviso que se muestra antes de guardar", () => {
  const reglas = { slotMinutes: 60, minBookingMinutes: 60 };

  it("acepta un tramo alineado y largo", () => {
    expect(rangeIssue({ start: 540, end: 780 }, reglas)).toBeNull();
  });

  it("avisa cuando el tramo no arranca en la grilla", () => {
    expect(rangeIssue({ start: 570, end: 780 }, reglas)).toMatch(/grilla/);
  });

  it("avisa cuando el tramo es más corto que la duración mínima", () => {
    expect(rangeIssue({ start: 540, end: 570 }, { ...reglas, minBookingMinutes: 60 })).toMatch(
      /mínima/,
    );
  });
});

describe("copiar un día a otros", () => {
  it("reemplaza los días elegidos y no toca los demás", () => {
    const semana: WeekRanges = [[], [{ start: 540, end: 720 }], [{ start: 60, end: 120 }], [], [], [], []];
    const copiada = copyDayTo(semana, 1, [2, 3]);
    expect(copiada[2]).toEqual([{ start: 540, end: 720 }]);
    expect(copiada[3]).toEqual([{ start: 540, end: 720 }]);
    expect(copiada[0]).toEqual([]);
  });

  it("copia sin compartir los objetos, para que editar uno no cambie el otro", () => {
    const semana: WeekRanges = [[], [{ start: 540, end: 720 }], [], [], [], [], []];
    const copiada = copyDayTo(semana, 1, [2]);
    expect(copiada[2]![0]).not.toBe(copiada[1]![0]);
  });
});

describe("cómo viaja el tramo al servidor", () => {
  it("usa el mismo formato que entiende parseSpaceForm", () => {
    expect(formatRange({ start: 540, end: 780 })).toBe("09:00-13:00");
    expect(formatRange({ start: 1200, end: 1440 })).toBe("20:00-24:00");
  });
});
