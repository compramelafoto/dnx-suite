import { describe, expect, it } from "vitest";
import { MAX_WORKS, visibilityFromPreset } from "@repo/muestras";
import { modoDeGaleriaDe, visibilidadDesdeFormData } from "./mapear";

function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}
const actual = visibilityFromPreset("HIGHLIGHTS", "semilla-vieja");
const personalizado = {
  preset: "CUSTOM", onlineExhibited: "RANDOM", randomCount: "25", rotation: "PER_VISIT", artists: "on",
  profileExhibited: "NONE", roomExhibited: "ALL", roomPortfolio: "on", roomOtherExhibitions: "on", roomBuy: "on", revealAfterClose: "1",
};

describe("visibilidadDesdeFormData", () => {
  it("elegir un preset reescribe todo y conserva la semilla", () => {
    const v = visibilidadDesdeFormData(fd({ preset: "PREVIEW", onlineExhibited: "ALL", randomCount: "9" }), actual);
    expect(v).toEqual(visibilityFromPreset("PREVIEW", "semilla-vieja"));
  });

  it("personalizado con 'para cada visitante' y 25 se respeta", () => {
    const v = visibilidadDesdeFormData(fd(personalizado), actual);
    expect(v.preset).toBe("CUSTOM");
    expect(v.online).toEqual({ exhibited: "RANDOM", randomCount: 25, rotation: "PER_VISIT", seed: "semilla-vieja", artists: true });
    expect(v.profile.exhibited).toBe("NONE");
    expect(v.room).toEqual({ exhibited: "ALL", portfolio: true, otherExhibitions: true, buy: true });
    expect(v.revealAfterClose).toBe(true);
  });

  it("una cantidad que no sirve vuelve a 3; una enorme queda en el tope técnico", () => {
    for (const n of ["0", "abc", "-2", "1.5", ""]) expect(visibilidadDesdeFormData(fd({ ...personalizado, randomCount: n }), actual).online.randomCount).toBe(3);
    expect(visibilidadDesdeFormData(fd({ ...personalizado, randomCount: "999999" }), actual).online.randomCount).toBe(MAX_WORKS);
  });

  it("casillas ausentes = no", () => {
    const sin = Object.fromEntries(Object.entries(personalizado).filter(([k]) => !["artists", "roomPortfolio", "roomOtherExhibitions", "roomBuy", "revealAfterClose"].includes(k)));
    const v = visibilidadDesdeFormData(fd(sin), actual);
    expect(v.online.artists).toBe(false);
    expect(v.room).toMatchObject({ portfolio: false, otherExhibitions: false, buy: false });
    expect(v.revealAfterClose).toBe(false);
  });

  it("personalizado igual a un preset toma su nombre", () => {
    const v = visibilidadDesdeFormData(fd({ ...personalizado, onlineExhibited: "NONE", profileExhibited: "NONE", roomExhibited: "ARTIST", rotation: "FIXED", randomCount: "3" }), actual);
    expect(v.preset).toBe("SURPRISE");
  });

  it("galleryMode coherente", () => {
    expect(modoDeGaleriaDe(visibilityFromPreset("OPEN", "s"))).toBe("FULL");
    expect(modoDeGaleriaDe(visibilityFromPreset("SURPRISE", "s"))).toBe("HIGHLIGHTS_UNTIL_CLOSED");
  });
});
