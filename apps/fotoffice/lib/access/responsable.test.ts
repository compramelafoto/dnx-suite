import { describe, expect, it } from "vitest";
import { filtroSoloAsignado } from "./responsable";

describe("filtroSoloAsignado", () => {
  it("el colaborador sólo ve lo suyo", () => {
    expect(filtroSoloAsignado("COLLABORATOR", 7)).toEqual({ responsableUserId: 7 });
  });
  it("dueño, admin y equipo ven todo", () => {
    for (const r of ["WORKSPACE_OWNER", "WORKSPACE_ADMIN", "STAFF"]) expect(filtroSoloAsignado(r, 7)).toEqual({});
  });
  it("sin rol no ve nada: filtro imposible", () => {
    expect(filtroSoloAsignado(null, 7)).toEqual({ responsableUserId: -1 });
  });
});
