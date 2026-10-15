import { describe, expect, it } from "vitest";
import { invitacionesPendientesWhere } from "./invitaciones";

describe("invitacionesPendientesWhere", () => {
  it("filtra INVITADO, por negocio o por correo normalizado sin negocio", () => {
    expect(invitacionesPendientesWhere("ws1", "  Ana@Correo.COM ")).toEqual({
      status: "INVITADO",
      OR: [{ workspaceId: "ws1" }, { workspaceId: null, invitedEmail: "ana@correo.com" }],
    });
  });
});
