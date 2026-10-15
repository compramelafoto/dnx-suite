import { describe, expect, it } from "vitest";
import { parseSharePercent, professionalShareMinor, shareLabel, summarizePending } from "./settlement";

describe("parte del profesional y liquidación", () => {
  it("entiende el porcentaje como lo escribe una persona", () => {
    expect(parseSharePercent("60")).toBe(6000);
    expect(parseSharePercent("60,5")).toBe(6050);
    expect(parseSharePercent("50%")).toBe(5000);
    expect(parseSharePercent("")).toBe(0);
    expect(parseSharePercent("120")).toBeNull();
    expect(parseSharePercent("mucho")).toBeNull();
  });

  it("lo muestra como porcentaje", () => {
    expect(shareLabel(6000)).toBe("60 %");
    expect(shareLabel(6050)).toBe("60,5 %");
  });

  it("calcula la parte sobre el total: corte + barba al 60 % son $12.000", () => {
    expect(professionalShareMinor(2_000_000, 6000)).toBe(1_200_000);
    expect(professionalShareMinor(0, 6000)).toBe(0); // un corte del club no deja nada para repartir
    expect(professionalShareMinor(1_500_000, 0)).toBe(0); // Gus: todo para la institución
  });

  it("sólo se debe lo que ya pasó", () => {
    const ahora = new Date("2026-10-20T12:00:00Z");
    const turnos = [
      { id: "a", startAt: new Date("2026-10-14T14:00:00Z"), endAt: new Date("2026-10-14T14:30:00Z"), shareMinor: 900_000 },
      { id: "b", startAt: new Date("2026-10-16T15:00:00Z"), endAt: new Date("2026-10-16T15:30:00Z"), shareMinor: 1_200_000 },
      { id: "c", startAt: new Date("2026-10-22T15:00:00Z"), endAt: new Date("2026-10-22T15:30:00Z"), shareMinor: 900_000 },
    ];
    const r = summarizePending(turnos, ahora);
    expect(r.count).toBe(2);
    expect(r.totalMinor).toBe(2_100_000);
    expect(r.fromAt?.toISOString()).toBe("2026-10-14T14:00:00.000Z");
    expect(r.toAt?.toISOString()).toBe("2026-10-16T15:30:00.000Z");
  });

  it("sin turnos hechos no hay nada que liquidar", () => {
    expect(summarizePending([], new Date())).toEqual({ count: 0, totalMinor: 0, fromAt: null, toAt: null });
  });
});
