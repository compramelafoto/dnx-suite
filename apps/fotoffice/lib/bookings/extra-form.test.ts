import { describe, expect, it } from "vitest";
import { parseExtraForm } from "./extra-form";

function form(campos: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) {
    if (Array.isArray(v)) v.forEach((x) => fd.append(k, x));
    else fd.set(k, v);
  }
  return fd;
}

const completo = {
  name: "Pack de 2 flashes",
  priceMode: "PER_BOOKING",
  memberPriceArs: "1.600",
  nonMemberPriceArs: "2.500",
  resourceId: "res-flash",
  unitsConsumed: "2",
  spaceIds: ["estudio"],
};

describe("el formulario de un extra", () => {
  it("un formulario completo se acepta", () => {
    const r = parseExtraForm(form(completo));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.values.name).toBe("Pack de 2 flashes");
    expect(r.values.memberPriceMinor).toBe(160_000);
    expect(r.values.unitsConsumed).toBe(2);
    expect(r.values.resourceId).toBe("res-flash");
    expect(r.values.spaceIds).toEqual(["estudio"]);
  });

  it("sin recurso, el extra no controla cantidad y consume una unidad nominal", () => {
    const r = parseExtraForm(form({ ...completo, resourceId: "", unitsConsumed: "5" }));
    expect(r.ok && r.values.resourceId).toBeNull();
    expect(r.ok && r.values.unitsConsumed).toBe(1);
  });

  it("con recurso, consumir cero unidades no tiene sentido y se rechaza", () => {
    const r = parseExtraForm(form({ ...completo, unitsConsumed: "0" }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("unidad");
  });

  it("un extra sin nombre se rechaza", () => {
    expect(parseExtraForm(form({ ...completo, name: " " })).ok).toBe(false);
  });

  it("un extra que no se ofrece en ningún espacio se rechaza", () => {
    const r = parseExtraForm(form({ ...completo, spaceIds: [] }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("espacio");
  });

  it("un precio ilegible se rechaza y dice cuál", () => {
    const r = parseExtraForm(form({ ...completo, nonMemberPriceArs: "dos mil" }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("no socios");
  });

  it("un modo de cobro desconocido cae en por reserva, no rompe", () => {
    const r = parseExtraForm(form({ ...completo, priceMode: "CUALQUIERA" }));
    expect(r.ok && r.values.priceMode).toBe("PER_BOOKING");
  });

  it("por hora se acepta tal cual", () => {
    const r = parseExtraForm(form({ ...completo, priceMode: "PER_HOUR" }));
    expect(r.ok && r.values.priceMode).toBe("PER_HOUR");
  });

  it("requiere confirmación solo si se marcó", () => {
    const sinMarcar = parseExtraForm(form(completo));
    expect(sinMarcar.ok && sinMarcar.values.requiresConfirmation).toBe(false);
    const marcado = parseExtraForm(form({ ...completo, requiresConfirmation: "on" }));
    expect(marcado.ok && marcado.values.requiresConfirmation).toBe(true);
  });

  it("un extra gratis es válido: puede ser un servicio incluido", () => {
    const r = parseExtraForm(form({ ...completo, memberPriceArs: "0", nonMemberPriceArs: "0" }));
    expect(r.ok && r.values.memberPriceMinor).toBe(0);
  });
});
