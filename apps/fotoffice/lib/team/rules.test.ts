import { describe, expect, it } from "vitest";
import { rolesOfrecidos, teamInvitationExpiryFrom, validarAccionSobreMiembro } from "./rules";

const base = { esUnoMismo: false, duenosRestantes: 2 };

describe("validarAccionSobreMiembro", () => {
  it("nadie deja el workspace sin dueño", () => {
    expect(validarAccionSobreMiembro({ ...base, actorRole: "WORKSPACE_OWNER", objetivoRole: "WORKSPACE_OWNER", esUnoMismo: true, duenosRestantes: 1, accion: { tipo: "CAMBIAR_ROL", nuevoRol: "STAFF" } })).toMatch(/último dueño/i);
    expect(validarAccionSobreMiembro({ ...base, actorRole: "WORKSPACE_OWNER", objetivoRole: "WORKSPACE_OWNER", esUnoMismo: true, duenosRestantes: 1, accion: { tipo: "DAR_DE_BAJA" } })).toMatch(/último dueño/i);
  });
  it("un admin no toca a un dueño ni nombra dueños", () => {
    expect(validarAccionSobreMiembro({ ...base, actorRole: "WORKSPACE_ADMIN", objetivoRole: "WORKSPACE_OWNER", accion: { tipo: "DAR_DE_BAJA" } })).toMatch(/dueño/i);
    expect(validarAccionSobreMiembro({ ...base, actorRole: "WORKSPACE_ADMIN", objetivoRole: "STAFF", accion: { tipo: "CAMBIAR_ROL", nuevoRol: "WORKSPACE_OWNER" } })).toMatch(/dueño/i);
  });
  it("equipo no gestiona a nadie", () => {
    expect(validarAccionSobreMiembro({ ...base, actorRole: "STAFF", objetivoRole: "STAFF", accion: { tipo: "DAR_DE_BAJA" } })).toMatch(/permiso/i);
  });
  it("un dueño puede pasar a equipo a un admin", () => {
    expect(validarAccionSobreMiembro({ ...base, actorRole: "WORKSPACE_OWNER", objetivoRole: "WORKSPACE_ADMIN", accion: { tipo: "CAMBIAR_ROL", nuevoRol: "STAFF" } })).toBeNull();
  });
});

describe("rolesOfrecidos", () => {
  it("dueño ofrece admin y equipo; colaborador sólo si Proyectos existe", () => {
    expect(rolesOfrecidos("WORKSPACE_OWNER", false)).toEqual(["WORKSPACE_ADMIN", "STAFF"]);
    expect(rolesOfrecidos("WORKSPACE_OWNER", true)).toEqual(["WORKSPACE_ADMIN", "STAFF", "COLLABORATOR"]);
  });
  it("equipo no ofrece nada", () => {
    expect(rolesOfrecidos("STAFF", true)).toEqual([]);
  });
});

it("la invitación vence a los 7 días", () => {
  const now = new Date("2026-10-01T12:00:00Z");
  expect(teamInvitationExpiryFrom(now).toISOString()).toBe("2026-10-08T12:00:00.000Z");
});
