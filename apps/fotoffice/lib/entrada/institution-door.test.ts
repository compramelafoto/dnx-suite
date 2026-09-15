import { describe, expect, it } from "vitest";
import { doorPathFor, parseDoorPath, resolveDoorDestination } from "./institution-door";
import type { UserProfile } from "../portal/profiles";

const equipoDe = (workspaceId: string): UserProfile => ({
  kind: "TEAM",
  workspaceId,
  workspaceName: "SFPR",
  role: "WORKSPACE_OWNER",
});

const socioDe = (workspaceId: string): UserProfile => ({
  kind: "MEMBER",
  workspaceId,
  workspaceName: "SFPR",
  memberId: "m-1",
  memberNumber: "648",
});

/**
 * La puerta propia de cada institución: `fotoffice.com/w/sfpr/entrar`.
 *
 * Entrar por ahí es decir "vengo a SFPR" antes de escribir la contraseña. Eso resuelve algo
 * que la puerta general no puede: a quien tiene dos perfiles —su estudio y su institución— no
 * hay que preguntarle a cuál viene, porque ya lo dijo al elegir la puerta.
 *
 * Lo que la puerta NO hace es dejar a nadie afuera. Un fotógrafo que entra por la puerta de
 * SFPR sin ser nada de SFPR igual entra a lo suyo: es una comodidad, no una tranquera.
 */
describe("resolveDoorDestination", () => {
  it("el equipo de esa institución va a su panel", () => {
    expect(
      resolveDoorDestination({ workspaceId: "ws-sfpr", profiles: [equipoDe("ws-sfpr")] }),
    ).toEqual({ redirectTo: "/workspace" });
  });

  it("el socio de esa institución va a su portal", () => {
    expect(
      resolveDoorDestination({ workspaceId: "ws-sfpr", profiles: [socioDe("ws-sfpr")] }),
    ).toEqual({ redirectTo: "/portal" });
  });

  it("con los dos perfiles en la misma institución gana el panel", () => {
    // Misma doctrina que `resolveFotofficeUserKind`: ser equipo gana. Quien administra SFPR y
    // además es socio entra a administrar, y desde ahí puede cambiar de perfil.
    expect(
      resolveDoorDestination({
        workspaceId: "ws-sfpr",
        profiles: [socioDe("ws-sfpr"), equipoDe("ws-sfpr")],
      }),
    ).toEqual({ redirectTo: "/workspace" });
  });

  it("la puerta desempata: teniendo perfiles en dos lados, no se pregunta", () => {
    // Este es el caso que justifica la puerta. Por la general terminaría en `/elegir-perfil`.
    expect(
      resolveDoorDestination({
        workspaceId: "ws-sfpr",
        profiles: [equipoDe("ws-estudio-propio"), socioDe("ws-sfpr")],
      }),
    ).toEqual({ redirectTo: "/portal" });
  });

  it("quien no es nada de esa institución no queda afuera: sigue el camino normal", () => {
    expect(
      resolveDoorDestination({
        workspaceId: "ws-sfpr",
        profiles: [equipoDe("ws-estudio-propio")],
      }),
    ).toEqual({ unknownHere: true });
  });

  it("sin ningún perfil tampoco es asunto de la puerta", () => {
    expect(resolveDoorDestination({ workspaceId: "ws-sfpr", profiles: [] })).toEqual({
      unknownHere: true,
    });
  });
});

describe("parseDoorPath", () => {
  it("reconoce la puerta de una institución", () => {
    expect(parseDoorPath("/w/sfpr/entrar")).toBe("sfpr");
  });

  it("no reconoce cualquier otra cosa", () => {
    expect(parseDoorPath("/w/sfpr")).toBe(null);
    expect(parseDoorPath("/w/sfpr/cursos")).toBe(null);
    expect(parseDoorPath("/workspace")).toBe(null);
    expect(parseDoorPath(null)).toBe(null);
    expect(parseDoorPath(undefined)).toBe(null);
  });

  it("no se deja llevar a otro sitio", () => {
    // `next` viene del navegador. Un slug con barras o un host adentro tiene que morir acá y
    // no convertirse en un destino.
    expect(parseDoorPath("//malo.com/w/sfpr/entrar")).toBe(null);
    expect(parseDoorPath("https://malo.com/w/sfpr/entrar")).toBe(null);
    expect(parseDoorPath("/w/../../etc/entrar")).toBe(null);
    expect(parseDoorPath("/w/sfpr/entrar?x=1")).toBe(null);
  });

  it("doorPathFor y parseDoorPath son la misma idea en los dos sentidos", () => {
    expect(parseDoorPath(doorPathFor("sfpr"))).toBe("sfpr");
  });
});
