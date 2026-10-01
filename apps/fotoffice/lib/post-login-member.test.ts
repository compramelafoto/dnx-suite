import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Ruteo post-login para quien NO es equipo administrador.
 *
 * El defecto que cierra este archivo: `resolveFotofficePostLoginDestination` llamaba a
 * `ensureFotofficeWorkspaceForUser` para todo el mundo antes de mirar nada más, y esa función
 * le crea un workspace propio —con rol de dueño— a quien no tiene ninguno. Un socio que
 * iniciara sesión se llevaba una institución vacía de regalo.
 */

const { userFindUniqueMock, findMock, userKindMock, listProfilesMock, readChoiceMock } = vi.hoisted(() => ({
  userFindUniqueMock: vi.fn(),
  findMock: vi.fn(),
  userKindMock: vi.fn(),
  listProfilesMock: vi.fn(),
  readChoiceMock: vi.fn(),
}));

vi.mock("@/lib/portal/profile-choice", () => ({ readProfileChoice: readChoiceMock }));

vi.mock("@/lib/portal/profiles", async () => {
  const actual = await vi.importActual<typeof import("./portal/profiles")>("./portal/profiles");
  return { ...actual, listUserProfiles: listProfilesMock };
});

vi.mock("@/lib/members/invitation-continuity-resolve", () => ({
  resolveInvitationContinuityPath: vi.fn(async () => null),
}));

vi.mock("@repo/db", () => ({ prisma: { user: { findUnique: userFindUniqueMock } } }));
vi.mock("@/lib/ensure-workspace", () => ({ findFotofficeWorkspaceForUser: findMock }));
vi.mock("@/lib/portal/claim", () => ({ findClaimableMembership: async () => null }));
vi.mock("@/lib/portal/user-kind", () => ({ resolveFotofficeUserKind: userKindMock }));

const { resolveFotofficePostLoginDestination } = await import("./post-login");

beforeEach(() => {
  userFindUniqueMock.mockReset().mockResolvedValue({
    id: 7,
    email: "socio@example.com",
    name: "Juan",
    role: "PHOTOGRAPHER",
    globalRole: "USER",
  });
  findMock.mockReset().mockResolvedValue({ workspaceId: "ws-1", onboardingCompleted: true });
  userKindMock.mockReset().mockResolvedValue("TEAM");
  listProfilesMock.mockReset().mockResolvedValue([]);
  readChoiceMock.mockReset().mockResolvedValue(null);
});

describe("socio ya vinculado", () => {
  beforeEach(() => userKindMock.mockResolvedValue("MEMBER"));

  it("va al portal, no al panel", async () => {
    const dest = await resolveFotofficePostLoginDestination({ userId: 7 });
    expect(dest.path).toBe("/portal");
  });

  it("NUNCA se le crea un workspace", async () => {
    await resolveFotofficePostLoginDestination({ userId: 7 });
    expect(findMock).not.toHaveBeenCalled();
  });

  it("no queda asociado a ningún workspace por esta vía", async () => {
    const dest = await resolveFotofficePostLoginDestination({ userId: 7 });
    expect(dest.workspaceId).toBeNull();
  });

  it("acepta un next dentro del portal", async () => {
    const dest = await resolveFotofficePostLoginDestination({ userId: 7, next: "/portal/pagos" });
    expect(dest.path).toBe("/portal/pagos");
    expect(findMock).not.toHaveBeenCalled();
  });

  it.each(["/workspace", "/members", "https://malicioso.test"])(
    "ignora un next hacia %s",
    async (next) => {
      const dest = await resolveFotofficePostLoginDestination({ userId: 7, next });
      expect(dest.path).toBe("/portal");
      expect(findMock).not.toHaveBeenCalled();
    },
  );
});

describe("vuelta a una invitación en curso", () => {
  /**
   * Quien acaba de crear su contraseña todavía NO es socio a los ojos del sistema: su ficha
   * no tiene `userId`. Si se lo tratara como usuario nuevo, `ensure` le crearía un workspace
   * justo antes de que complete la vinculación.
   */
  it("un usuario nuevo que vuelve a su invitación no recibe workspace", async () => {
    userKindMock.mockResolvedValue("NEW");
    const dest = await resolveFotofficePostLoginDestination({
      userId: 7,
      next: "/invitacion/abc123",
    });
    expect(dest.path).toBe("/invitacion/abc123");
    expect(findMock).not.toHaveBeenCalled();
  });

  it("también respeta la invitación para alguien ya socio", async () => {
    userKindMock.mockResolvedValue("MEMBER");
    const dest = await resolveFotofficePostLoginDestination({
      userId: 7,
      next: "/invitacion/abc123",
    });
    expect(dest.path).toBe("/invitacion/abc123");
    expect(findMock).not.toHaveBeenCalled();
  });

  it("un next que solo empieza parecido NO toma el atajo de invitación", async () => {
    userKindMock.mockResolvedValue("NEW");
    await resolveFotofficePostLoginDestination({ userId: 7, next: "/invitacionfalsa/abc" });
    // Sigue el camino normal de un usuario nuevo, que sí prepara su workspace.
    expect(findMock).toHaveBeenCalledTimes(1);
  });

  it("un socio tampoco llega al portal por un next parecido a una invitación", async () => {
    userKindMock.mockResolvedValue("MEMBER");
    const dest = await resolveFotofficePostLoginDestination({
      userId: 7,
      next: "/invitacionfalsa/abc",
    });
    expect(dest.path).toBe("/portal");
    expect(findMock).not.toHaveBeenCalled();
  });
});

describe("el equipo administrador conserva su comportamiento", () => {
  it("con onboarding completo va al panel", async () => {
    const dest = await resolveFotofficePostLoginDestination({ userId: 7 });
    expect(dest.path).toBe("/workspace");
    expect(findMock).toHaveBeenCalledTimes(1);
  });

  it("sin onboarding completo va al onboarding", async () => {
    findMock.mockResolvedValue({ workspaceId: "ws-1", onboardingCompleted: false });
    const dest = await resolveFotofficePostLoginDestination({ userId: 7 });
    expect(dest.path).toBe("/onboarding");
  });

  it("a un fotógrafo nuevo se le pregunta: ya no se le regala una institución", async () => {
    // Antes este caso terminaba en `/onboarding` con un `Workspace` recién creado. Ese era
    // justo el camino por el que aparecieron las dos instituciones fantasma de producción:
    // el socio al que el reconocimiento por email no encontró caía acá.
    userKindMock.mockResolvedValue("NEW");
    findMock.mockResolvedValue(null);

    const dest = await resolveFotofficePostLoginDestination({ userId: 7 });

    expect(dest).toEqual({ path: "/bienvenida", workspaceId: null });
  });
});

/**
 * Una misma persona puede administrar su negocio Y ser socia de una institución. Solo ella
 * sabe a cuál de las dos viene hoy, así que se le pregunta — una vez, y se recuerda.
 */
describe("selector de perfil", () => {
  const TEAM = { kind: "TEAM", workspaceId: "ws-dnx", workspaceName: "DNX Owner", role: "WORKSPACE_OWNER" };
  const SOCIO = { kind: "MEMBER", workspaceId: "ws-sfpr", workspaceName: "SFPR", memberId: "m", memberNumber: "556" };

  beforeEach(() => {
    userKindMock.mockResolvedValue("TEAM");
    listProfilesMock.mockResolvedValue([TEAM, SOCIO]);
    readChoiceMock.mockResolvedValue(null);
  });

  it("con dos perfiles y sin elección previa, pregunta", async () => {
    const dest = await resolveFotofficePostLoginDestination({ userId: 4 });
    expect(dest.path).toBe("/elegir-perfil");
    expect(findMock).not.toHaveBeenCalled();
  });

  it("con un solo perfil no pregunta nada", async () => {
    listProfilesMock.mockResolvedValue([TEAM]);
    const dest = await resolveFotofficePostLoginDestination({ userId: 4 });
    expect(dest.path).toBe("/workspace");
  });

  it("respeta la elección guardada: socio va al portal", async () => {
    readChoiceMock.mockResolvedValue("MEMBER:ws-sfpr");
    const dest = await resolveFotofficePostLoginDestination({ userId: 4 });
    expect(dest.path).toBe("/portal");
    // Elegir el perfil de socio no debe prepararle un workspace.
    expect(findMock).not.toHaveBeenCalled();
  });

  it("respeta la elección guardada: equipo va al panel", async () => {
    readChoiceMock.mockResolvedValue("TEAM:ws-dnx");
    const dest = await resolveFotofficePostLoginDestination({ userId: 4 });
    expect(dest.path).toBe("/workspace");
  });

  it.each([
    ["manipulada", "basura"],
    ["de un perfil ajeno", "TEAM:ws-de-otro"],
    ["con tipo inventado", "ADMIN:ws-dnx"],
  ])("una cookie %s se descarta y vuelve a preguntar", async (_label, value) => {
    readChoiceMock.mockResolvedValue(value);
    const dest = await resolveFotofficePostLoginDestination({ userId: 4 });
    expect(dest.path).toBe("/elegir-perfil");
  });

  /** Completar una invitación pendiente manda más que la preferencia guardada. */
  it("una invitación en curso gana sobre el selector", async () => {
    const dest = await resolveFotofficePostLoginDestination({ userId: 4, next: "/invitacion/abc" });
    expect(dest.path).toBe("/invitacion/abc");
  });
});

/**
 * Entrar por la puerta de una institución.
 *
 * Quien entró por `/w/sfpr/entrar` ya dijo a dónde viene. El post-login no resuelve ese caso:
 * lo devuelve a la puerta, que es la que sabe leer el slug y mirar los perfiles de esa
 * institución puntual.
 */
describe("la puerta de una institución", () => {
  it("vuelve a la puerta, que es la que decide", async () => {
    // Sin esto, alguien con dos perfiles entraría por la puerta de SFPR y le preguntaríamos
    // igual a cuál viene — que es justo lo que la puerta vino a evitar.
    listProfilesMock.mockResolvedValue([
      { kind: "TEAM", workspaceId: "ws-propio", workspaceName: "Estudio", role: "WORKSPACE_OWNER" },
      {
        kind: "MEMBER",
        workspaceId: "ws-sfpr",
        workspaceName: "SFPR",
        memberId: "m-1",
        memberNumber: "648",
      },
    ]);

    const dest = await resolveFotofficePostLoginDestination({
      userId: 4,
      next: "/w/sfpr/entrar",
    });

    expect(dest.path).toBe("/w/sfpr/entrar");
  });

  it("un socio que entró por la puerta tampoco se va derecho al portal genérico", async () => {
    userKindMock.mockResolvedValue("MEMBER");

    const dest = await resolveFotofficePostLoginDestination({
      userId: 4,
      next: "/w/sfpr/entrar",
    });

    expect(dest.path).toBe("/w/sfpr/entrar");
  });

  it("un `next` que solo se parece a una puerta no manda a ninguna parte", async () => {
    userKindMock.mockResolvedValue("MEMBER");

    const dest = await resolveFotofficePostLoginDestination({
      userId: 4,
      next: "//malo.com/w/sfpr/entrar",
    });

    expect(dest.path).toBe("/portal");
  });
});
