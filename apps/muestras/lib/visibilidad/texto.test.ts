import { describe, expect, it } from "vitest";
import { visibilityFromPreset } from "@repo/muestras";
import { queSeVeOnline } from "./texto";

describe("queSeVeOnline", () => {
  it("sin ajuste: como hasta hoy", () => {
    expect(queSeVeOnline({ visibility: null, galleryMode: "HIGHLIGHTS_UNTIL_CLOSED" })).toContain("sólo las destacadas");
    expect(queSeVeOnline({ visibility: null, galleryMode: "FULL" })).toContain("todas las obras");
  });
  it("con ajuste: lo que eligió en Visibilidad, nunca 'sólo las destacadas' si no es así", () => {
    const t = queSeVeOnline({ visibility: visibilityFromPreset("SURPRISE", "s"), galleryMode: "HIGHLIGHTS_UNTIL_CLOSED" });
    expect(t).toContain("no muestra ninguna obra de la sala");
    expect(t).not.toContain("destacadas");
    const r = queSeVeOnline({ visibility: { ...visibilityFromPreset("PREVIEW", "s"), revealAfterClose: false }, galleryMode: "HIGHLIGHTS_UNTIL_CLOSED" });
    expect(r).toContain("3 obras de la sala elegidas al azar");
    expect(r).toContain("se mantiene la reserva");
  });
});
