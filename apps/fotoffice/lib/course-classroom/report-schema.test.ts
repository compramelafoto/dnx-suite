import { describe, expect, it } from "vitest";
import { leerReporte } from "./report-schema";

describe("leer el reporte de avance", () => {
  it("acepta un reporte bien formado", () => {
    expect(leerReporte({ lessonId: "c1", positionSeconds: 30.5, watchedSinceLastReport: 15 })).toEqual({
      ok: true,
      reporte: { lessonId: "c1", positionSeconds: 30.5, watchedSinceLastReport: 15 },
    });
  });

  it("rechaza lo que no es un reporte", () => {
    expect(leerReporte(null).ok).toBe(false);
    expect(leerReporte({ lessonId: "", positionSeconds: 1, watchedSinceLastReport: 1 }).ok).toBe(false);
    expect(leerReporte({ lessonId: "c1", positionSeconds: "30", watchedSinceLastReport: 1 }).ok).toBe(false);
    expect(leerReporte({ lessonId: "c1", positionSeconds: -1, watchedSinceLastReport: 1 }).ok).toBe(false);
    expect(leerReporte({ lessonId: "c1", positionSeconds: 1, watchedSinceLastReport: 99999 }).ok).toBe(false);
  });
});
