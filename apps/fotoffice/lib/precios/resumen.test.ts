import { describe, expect, it } from "vitest";
import { INITIAL_CUANTO_COBRO_PROFILE, getProfileCostHour, getProfileMonthlyNeed } from "@repo/cuanto-cobro-core";
import { createBaseCompleteProfile } from "@repo/cuanto-cobro-core/__fixtures__/characterization-fixtures";
import { resumirPerfil } from "./resumen";

describe("resumirPerfil", () => {
  it("resume un perfil completo", () => {
    const p = createBaseCompleteProfile();
    const r = resumirPerfil(p);
    expect(r.completo).toBe(true);
    expect(r.faltan).toEqual([]);
    expect(r.valorHora).toBeGreaterThan(0);
    expect(r.costoHora).toBe(getProfileCostHour(p));
    expect(r.necesidadMensual).toBe(getProfileMonthlyNeed(p));
    expect(r.horasFacturablesMes).toBeGreaterThan(0);
    expect(r.gastosPersonales).toBeGreaterThanOrEqual(0);
  });

  it("marca incompleto un perfil vacío", () => {
    const r = resumirPerfil(INITIAL_CUANTO_COBRO_PROFILE);
    expect(r.completo).toBe(false);
    expect(r.faltan.length).toBeGreaterThan(0);
    expect(r.valorHora).toBeNull();
    expect(r.costoHora).toBeNull();
  });
});
