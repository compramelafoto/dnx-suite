import { describe, expect, it } from "vitest";
import { duracionLegible, elegirSesionParaGrabacion, MARGEN_MS, tituloImprovisado, type SesionCandidata } from "./grabaciones";

const t = (iso: string) => new Date(iso);

const LUNES: SesionCandidata = {
  id: "lunes",
  status: "TERMINADA",
  createdAt: t("2026-11-09T20:50:00Z"),
  endedAt: t("2026-11-09T22:05:00Z"),
};
const JUEVES: SesionCandidata = { id: "jueves", status: "EN_VIVO", createdAt: t("2026-11-12T21:55:00Z"), endedAt: null };

describe("a qué vivo pertenece una grabación", () => {
  it("la grabación del lunes va al vivo del lunes", () => {
    expect(elegirSesionParaGrabacion([JUEVES, LUNES], t("2026-11-09T21:00:10Z"))).toBe("lunes");
  });

  it("la del jueves va al vivo abierto del jueves", () => {
    expect(elegirSesionParaGrabacion([LUNES, JUEVES], t("2026-11-12T22:00:00Z"))).toBe("jueves");
  });

  it("OBS arrancó apenas antes de apretar «Nuevo vivo»: entra por el margen", () => {
    const creado = new Date(JUEVES.createdAt.getTime() - MARGEN_MS + 1000);
    expect(elegirSesionParaGrabacion([JUEVES], creado)).toBe("jueves");
  });

  it("una transmisión sin vivo creado (fuera de toda ventana) no se asigna a nadie", () => {
    expect(elegirSesionParaGrabacion([LUNES], t("2026-11-10T15:00:00Z"))).toBeNull();
  });

  it("sin hora, la abierta más reciente", () => {
    expect(elegirSesionParaGrabacion([LUNES, JUEVES], null)).toBe("jueves");
    expect(elegirSesionParaGrabacion([LUNES], null)).toBeNull();
  });
});

describe("textos", () => {
  it("título del vivo creado solo, en hora argentina", () => {
    expect(tituloImprovisado(t("2026-11-09T21:00:00Z"))).toBe("Vivo del 09/11, 18:00");
  });
  it("duración legible", () => {
    expect(duracionLegible(3661)).toBe("1 h 01 min");
    expect(duracionLegible(1500)).toBe("25 min");
    expect(duracionLegible(20)).toBe("1 min");
    expect(duracionLegible(null)).toBe("");
  });
});
