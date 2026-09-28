import { describe, expect, it } from "vitest";
import { ordenarBandeja } from "./priority";

describe("ordenarBandeja", () => {
  it("acción hoy primero, después prioridad, después evento más cercano, sin fecha al final", () => {
    const t = (id: string, accionHoy: boolean, prioridad: "ALTA" | "MEDIA" | "BAJA" | null, f: string | null) =>
      ({ id, accionHoy, prioridad, fechaEvento: f ? new Date(f) : null });
    const r = ordenarBandeja([
      t("espera", false, "ALTA", "2026-10-01"),
      t("baja", true, "BAJA", "2026-10-01"),
      t("alta-lejos", true, "ALTA", "2027-01-01"),
      t("alta-sin-fecha", true, "ALTA", null),
      t("alta-cerca", true, "ALTA", "2026-10-15"),
    ]);
    expect(r.map((x) => x.id)).toEqual(["alta-cerca", "alta-lejos", "alta-sin-fecha", "baja", "espera"]);
  });
});
