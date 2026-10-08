import { describe, expect, it } from "vitest";
import { createBaseCompleteProfile } from "@repo/cuanto-cobro-core/__fixtures__/characterization-fixtures";
import { planDeImportacion } from "./importar-clf";

describe("planDeImportacion", () => {
  const valido = createBaseCompleteProfile();

  it("rechaza un perfil de CLF inválido", () => {
    const r = planDeImportacion({ perfilClf: null, existente: false, aplicar: true, pisar: false });
    expect(r.accion).toBe("nada");
    expect(r.perfil).toBeNull();
    expect(r.motivo).toMatch(/^El perfil de CLF no es válido: /);
  });

  it("no pisa un perfil existente sin --pisar", () => {
    const r = planDeImportacion({ perfilClf: valido, existente: true, aplicar: true, pisar: false });
    expect(r.accion).toBe("nada");
    expect(r.motivo).toBe("El workspace ya tiene perfil; usá --pisar.");
  });

  it("en seco no escribe pero devuelve el perfil", () => {
    const r = planDeImportacion({ perfilClf: valido, existente: false, aplicar: false, pisar: false });
    expect(r.accion).toBe("nada");
    expect(r.motivo).toBe("En seco: no se escribió nada.");
    expect(r.perfil).not.toBeNull();
  });

  it("escribe con aplicar, y pisa un existente con --pisar", () => {
    const a = planDeImportacion({ perfilClf: valido, existente: false, aplicar: true, pisar: false });
    expect(a.accion).toBe("escribir");
    expect(a.perfil).not.toBeNull();
    const b = planDeImportacion({ perfilClf: valido, existente: true, aplicar: true, pisar: true });
    expect(b.accion).toBe("escribir");
  });
});
