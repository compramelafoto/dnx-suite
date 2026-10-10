import { describe, expect, it } from "vitest";
import {
  CAPABILITIES, activityRole, can, lastEditText, rolesWith, teamInviteProblems, type ActivityRole, type Capability,
} from "./team";

const como = (role: ActivityRole | null, isSuperAdmin = false) => ({ role, isSuperAdmin });

describe("capacidades por rol", () => {
  it("el dueño y el super admin pueden todo", () => {
    for (const c of CAPABILITIES) {
      expect(can(c, como("OWNER")), c).toBe(true);
      expect(can(c, como(null, true)), c).toBe(true);
    }
  });
  it("coorganización: todo menos cancelar, el equipo y la convocatoria", () => {
    const no: Capability[] = ["cancel", "manageTeam", "manageCall"];
    for (const c of CAPABILITIES) expect(can(c, como("CO_ORGANIZER")), c).toBe(!no.includes(c));
  });
  it("textos: sólo entrar y editar textos", () => {
    for (const c of CAPABILITIES) expect(can(c, como("TEXT_EDITOR")), c).toBe(c === "view" || c === "editTexts");
  });
  it("sin rol, nada", () => {
    for (const c of CAPABILITIES) expect(can(c, como(null)), c).toBe(false);
  });
  it("qué roles tienen cada capacidad", () => {
    expect(rolesWith("editTexts")).toEqual(["OWNER", "CO_ORGANIZER", "TEXT_EDITOR"]);
    expect(rolesWith("rsvp")).toEqual(["OWNER", "CO_ORGANIZER"]);
    expect(rolesWith("manageCall")).toEqual(["OWNER"]);
  });
});

describe("rol de una persona en una muestra", () => {
  const a = {
    proposedByUserId: 1,
    members: [
      { userId: 2, role: "CO_ORGANIZER", status: "ACTIVE" },
      { userId: 3, role: "TEXT_EDITOR", status: "REVOKED" },
      { userId: null, role: "TEXT_EDITOR", status: "INVITED" },
      { userId: 4, role: "ALGO_RARO", status: "ACTIVE" },
    ],
  };
  it("dueño, integrante activo, revocado, desconocido", () => {
    expect(activityRole(a, 1)).toBe("OWNER");
    expect(activityRole(a, 2)).toBe("CO_ORGANIZER");
    expect(activityRole(a, 3)).toBeNull();
    expect(activityRole(a, 4)).toBeNull();
    expect(activityRole(a, 9)).toBeNull();
    expect(activityRole({ proposedByUserId: 1 }, 2)).toBeNull();
  });
});

describe("invitar al equipo", () => {
  const base = { email: "ana@ejemplo.com", role: "CO_ORGANIZER", ownerEmail: "dueno@ejemplo.com", occupied: 0, existing: null };
  it("todo bien", () => expect(teamInviteProblems(base)).toEqual([]));
  it("email inválido o rol desconocido", () => {
    expect(teamInviteProblems({ ...base, email: null })).toEqual(["Escribí un email válido."]);
    expect(teamInviteProblems({ ...base, role: "OWNER" })).toEqual(["Elegí un rol."]);
  });
  it("no se invita al dueño, ni a quien ya está, ni pasando el tope", () => {
    expect(teamInviteProblems({ ...base, email: "DUENO@ejemplo.com".toLowerCase() })).toEqual(["Ya sos responsable de esta muestra."]);
    expect(teamInviteProblems({ ...base, existing: { status: "ACTIVE" } })).toEqual(["Esa persona ya es parte del equipo. Si querés, cambiale el rol."]);
    expect(teamInviteProblems({ ...base, occupied: 10 })).toEqual(["El equipo de una muestra puede tener hasta 10 personas."]);
    // Reenviar a alguien ya invitado no ocupa un lugar más.
    expect(teamInviteProblems({ ...base, occupied: 10, existing: { status: "INVITED" } })).toEqual([]);
  });
});

describe("último cambio", () => {
  it("quién, en qué parte y cuándo, en hora argentina", () => {
    expect(lastEditText({ who: "Ana Pérez", part: "TEXTOS", at: new Date("2026-11-14T21:40:00Z") }))
      .toBe("Último cambio: Ana Pérez, en los textos, el 14 nov a las 18:40.");
  });
  it("sin datos, nada; parte desconocida, sin parte", () => {
    expect(lastEditText({ who: null, part: null, at: null })).toBeNull();
    expect(lastEditText({ who: "Ana", part: "OTRA", at: new Date("2026-11-14T21:40:00Z") })).toBe("Último cambio: Ana, el 14 nov a las 18:40.");
  });
});
