import { describe, expect, it } from "vitest";
import { resolveWelcomeAccess } from "./welcome-access";
import type { UserProfile } from "../portal/profiles";

const equipo = (workspaceId: string): UserProfile => ({
  kind: "TEAM",
  workspaceId,
  workspaceName: "Estudio",
  role: "WORKSPACE_OWNER",
});

const socio = (workspaceId: string): UserProfile => ({
  kind: "MEMBER",
  workspaceId,
  workspaceName: "SFPR",
  memberId: "m-1",
  memberNumber: "648",
});

/**
 * Quién ve la pregunta "¿a qué viniste?".
 *
 * Solo quien de verdad no tiene por dónde entrar. A todos los demás la pregunta les sobra, y
 * una pregunta que sobra es una pregunta que la gente contesta mal: el socio 648 que ve
 * "quiero crear mi espacio de trabajo" y lo aprieta por curiosidad se fabrica exactamente la
 * institución fantasma que esta pantalla vino a evitar.
 */
describe("resolveWelcomeAccess", () => {
  it("sin ningún perfil: se pregunta", () => {
    expect(resolveWelcomeAccess({ profiles: [], claimable: false })).toEqual({ ask: true });
  });

  it("si figura en un padrón con este email, primero se le ofrece su ficha", () => {
    // Reconocer gana sobre preguntar: es el caso de Emeveph y de Libardi. Preguntarles a ellos
    // sería ofrecerles otra vez el camino equivocado.
    expect(resolveWelcomeAccess({ profiles: [], claimable: true })).toEqual({
      redirectTo: "/soy-socio",
    });
  });

  it("con un solo perfil de equipo no hay nada que preguntar: al panel", () => {
    expect(resolveWelcomeAccess({ profiles: [equipo("ws-1")], claimable: false })).toEqual({
      redirectTo: "/workspace",
    });
  });

  it("con un solo perfil de socio: al portal", () => {
    expect(resolveWelcomeAccess({ profiles: [socio("ws-sfpr")], claimable: false })).toEqual({
      redirectTo: "/portal",
    });
  });

  it("con dos perfiles decide el selector, no esta pantalla", () => {
    expect(
      resolveWelcomeAccess({ profiles: [equipo("ws-1"), socio("ws-sfpr")], claimable: false }),
    ).toEqual({ redirectTo: "/elegir-perfil" });
  });

  it("tener ficha reclamable no reabre la pregunta a quien ya tiene por dónde entrar", () => {
    // Un socio de SFPR que además figura en otro padrón con el mismo email ya tiene su lugar;
    // que exista una ficha suelta no lo devuelve a la pantalla de bienvenida.
    expect(resolveWelcomeAccess({ profiles: [socio("ws-sfpr")], claimable: true })).toEqual({
      redirectTo: "/soy-socio",
    });
  });
});
