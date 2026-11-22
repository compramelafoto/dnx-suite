import { describe, expect, it } from "vitest";
import { formatArgentina, fromArgentinaInput, monthlyWindow, periodOf, toArgentinaInput } from "./fechas";

describe("las fechas del sorteo mensual", () => {
  it("noviembre: ventas del 1/11 al 1/12 (hora argentina), cierre al terminar el mes, sorteo el día elegido", () => {
    const v = monthlyWindow("2026-11", 5, 20);
    expect(v.salesFrom.toISOString()).toBe("2026-11-01T03:00:00.000Z");
    expect(v.salesTo.toISOString()).toBe("2026-12-01T03:00:00.000Z");
    expect(v.entriesCloseAt.toISOString()).toBe(v.salesTo.toISOString());
    expect(v.drawsAt.toISOString()).toBe("2026-12-05T23:00:00.000Z");
  });

  it("diciembre pasa al año siguiente", () => {
    const v = monthlyWindow("2026-12", 5, 20);
    expect(v.salesTo.toISOString()).toBe("2027-01-01T03:00:00.000Z");
    expect(v.drawsAt.toISOString()).toBe("2027-01-05T23:00:00.000Z");
  });

  it("el día del sorteo nunca es el 1 (no habría 24 h desde el cierre)", () => {
    const v = monthlyWindow("2026-11", 1, 0);
    expect(v.drawsAt.getTime() - v.entriesCloseAt.getTime()).toBeGreaterThanOrEqual(24 * 3_600_000);
  });

  it("el mes en curso se mide en hora argentina", () => {
    // 1/12 a las 01:00 UTC es todavía 30/11 en Argentina.
    expect(periodOf(new Date("2026-12-01T01:00:00Z"))).toBe("2026-11");
    expect(periodOf(new Date("2026-12-01T03:00:00Z"))).toBe("2026-12");
  });

  it("ida y vuelta de los campos de fecha", () => {
    const d = fromArgentinaInput("2026-12-05T20:00")!;
    expect(d.toISOString()).toBe("2026-12-05T23:00:00.000Z");
    expect(toArgentinaInput(d)).toBe("2026-12-05T20:00");
    expect(fromArgentinaInput("2026-12-05")!.toISOString()).toBe("2026-12-05T03:00:00.000Z");
    expect(fromArgentinaInput("basura")).toBeNull();
  });

  it("se lee en castellano", () => {
    expect(formatArgentina(new Date("2026-12-05T23:00:00Z"))).toBe("5 de diciembre de 2026, 20:00 h");
  });
});
