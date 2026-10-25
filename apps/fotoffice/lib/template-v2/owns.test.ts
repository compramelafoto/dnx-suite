import { describe, expect, it } from "vitest";
import { ROL_SOCIO_FOTOLIBROS, ROL_SOLO_PLACAS, puedeAbrirPlantilla } from "./owns";

const carnetSfpr = { id: "carnet", ownerUserId: 1, workspaceId: "sfpr" };
const fotolibroDeAna = { id: "fl-ana", ownerUserId: 10, workspaceId: null };
const fotolibroEstudio = { id: "fl-estudio", ownerUserId: 1, workspaceId: "dnx" };

describe("quién puede abrir cada plantilla", () => {
  it("el socio abre sus fotolibros personales y nada más", () => {
    const ana = { id: 10, role: ROL_SOCIO_FOTOLIBROS, workspaceId: null };
    expect(puedeAbrirPlantilla(ana, fotolibroDeAna, undefined)).toBe(true);
    expect(puedeAbrirPlantilla(ana, carnetSfpr, undefined)).toBe(false);
    expect(puedeAbrirPlantilla(ana, fotolibroEstudio, undefined)).toBe(false);
  });

  it("nadie abre el fotolibro personal de otro, ni la comisión de su institución", () => {
    const beto = { id: 11, role: ROL_SOCIO_FOTOLIBROS, workspaceId: null };
    const comision = { id: 1, role: "WORKSPACE_OWNER", workspaceId: "sfpr" };
    expect(puedeAbrirPlantilla(beto, fotolibroDeAna, undefined)).toBe(false);
    expect(puedeAbrirPlantilla(comision, fotolibroDeAna, undefined)).toBe(false);
  });

  it("quien diseña todo abre las plantillas de su institución, no las de otra", () => {
    const comision = { id: 1, role: "WORKSPACE_OWNER", workspaceId: "sfpr" };
    expect(puedeAbrirPlantilla(comision, carnetSfpr, undefined)).toBe(true);
    expect(puedeAbrirPlantilla(comision, fotolibroEstudio, undefined)).toBe(false);
  });

  it("con acceso acotado, sólo las plantillas permitidas de su institución", () => {
    const vendedor = { id: 5, role: ROL_SOLO_PLACAS, workspaceId: "dnx" };
    expect(puedeAbrirPlantilla(vendedor, fotolibroEstudio, new Set(["fl-estudio"]))).toBe(true);
    expect(puedeAbrirPlantilla(vendedor, fotolibroEstudio, new Set())).toBe(false);
    expect(puedeAbrirPlantilla(vendedor, carnetSfpr, new Set(["carnet"]))).toBe(false);
  });
});
