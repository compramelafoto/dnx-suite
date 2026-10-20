import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/db", () => ({ prisma: {} }));
const { AVISO_OBRA_EN_REDES, avisoObraEnRedes, cantidadParaDifundir, motivoSinObrasOnline, obrasParaDifundir } = await import("./cargar");
const { visibilityFromPreset } = await import("@repo/muestras");

const DIA = 86_400_000;
const ahora = new Date();
const abierta = { galleryMode: "HIGHLIGHTS_UNTIL_CLOSED", startsAt: new Date(Date.now() - DIA), endsAt: new Date(Date.now() + 10 * DIA) };
const works = Array.from({ length: 6 }, (_, i) => ({ id: `w${i}`, isHighlight: i === 2, sortOrder: 5 - i }));
const porVisitante = { ...visibilityFromPreset("PREVIEW", "s"), online: { exhibited: "RANDOM", randomCount: 2, rotation: "PER_VISIT", seed: "s", artists: true } };

describe("obras para difundir", () => {
  it("'para cada visitante': cualquier obra expuesta, en su orden, con el aviso", () => {
    const a = { ...abierta, visibility: porVisitante, works };
    expect(obrasParaDifundir(a, ahora).map((w) => w.id)).toEqual(["w5", "w4", "w3", "w2", "w1", "w0"]);
    expect(avisoObraEnRedes(a, ahora)).toBe(AVISO_OBRA_EN_REDES);
    expect(motivoSinObrasOnline(a, ahora)).toBeNull();
  });

  it("'Sorpresa total': ninguna, sin aviso y con el motivo", () => {
    const a = { ...abierta, visibility: visibilityFromPreset("SURPRISE", "s"), works };
    expect(obrasParaDifundir(a, ahora)).toEqual([]);
    expect(avisoObraEnRedes(a, ahora)).toBeNull();
    expect(motivoSinObrasOnline(a, ahora)).toContain("Sorpresa total");
  });

  it("el listado sabe si hay alguna para difundir sólo con la cantidad de obras", () => {
    for (const visibility of [null, porVisitante, visibilityFromPreset("SURPRISE", "s"), visibilityFromPreset("PREVIEW", "s"), visibilityFromPreset("OPEN", "s")]) {
      const a = { ...abierta, visibility };
      expect(cantidadParaDifundir(a, works.length, ahora) > 0).toBe(obrasParaDifundir({ ...a, works }, ahora).length > 0);
    }
    expect(cantidadParaDifundir({ ...abierta, visibility: null }, 0, ahora)).toBe(0);
  });
});
