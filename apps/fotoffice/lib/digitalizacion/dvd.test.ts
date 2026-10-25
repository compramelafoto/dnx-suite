import { describe, expect, it } from "vitest";
import { cortesDeArchivo, vobsEnOrden } from "./dvd";

describe("DVD", () => {
  it("saltea menús y ordena por título y número", () => {
    const nombres = ["VIDEO_TS.VOB", "VTS_02_1.VOB", "VTS_01_0.VOB", "VTS_01_2.VOB", "VTS_01_1.VOB", "VTS_01_1.IFO", "vts_02_2.vob"];
    expect(vobsEnOrden(nombres.map((nombre) => ({ nombre }))).map((a) => a.nombre))
      .toEqual(["VTS_01_1.VOB", "VTS_01_2.VOB", "VTS_02_1.VOB", "vts_02_2.vob"]);
  });
  it("corta un archivo en pedacitos de 16 MB", () => {
    const mb = 1024 * 1024;
    expect(cortesDeArchivo(40 * mb)).toEqual([
      { desde: 0, hasta: 16 * mb },
      { desde: 16 * mb, hasta: 32 * mb },
      { desde: 32 * mb, hasta: 40 * mb },
    ]);
    expect(cortesDeArchivo(0)).toEqual([]);
  });
});
