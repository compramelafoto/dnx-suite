import { describe, expect, it } from "vitest";
import { visibilityFromPreset } from "@repo/muestras";
import { AVISO_YA_CIRCULARON, avisosDeAjuste, sinSemilla } from "./forma";

const de = (p: Parameters<typeof visibilityFromPreset>[0]) => sinSemilla(visibilityFromPreset(p, "s"));

describe("avisosDeAjuste", () => {
  it("si antes estaba todo a la vista y ahora se reserva algo, avisa que lo publicado ya circuló", () => {
    expect(avisosDeAjuste(de("SURPRISE"), de("OPEN"))).toContain(AVISO_YA_CIRCULARON);
    expect(avisosDeAjuste(de("PREVIEW"), de("OPEN"))).toContain(AVISO_YA_CIRCULARON);
  });
  it("sin cambio desde 'todo a la vista', o si antes ya se reservaba, no", () => {
    expect(avisosDeAjuste(de("OPEN"), de("OPEN"))).not.toContain(AVISO_YA_CIRCULARON);
    expect(avisosDeAjuste(de("SURPRISE"), de("HIGHLIGHTS"))).not.toContain(AVISO_YA_CIRCULARON);
    expect(avisosDeAjuste(de("SURPRISE"))).toEqual([]);
  });
  it("'para cada visitante' sigue avisando que con el tiempo se ven todas", () => {
    const a = de("PREVIEW");
    const r = avisosDeAjuste({ ...a, online: { ...a.online, rotation: "PER_VISIT" } }, de("OPEN"));
    expect(r).toHaveLength(2);
    expect(r[1]).toContain("Cada visitante ve otras 3 obras");
  });
});
