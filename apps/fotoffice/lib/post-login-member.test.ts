import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Ruteo post-login para quien NO es equipo administrador.
 *
 * El defecto que cierra este archivo: `resolveFotofficePostLoginDestination` llamaba a
 * `ensureFotofficeWorkspaceForUser` para todo el mundo antes de mirar nada más, y esa función
 * le crea un workspace propio —con rol de dueño— a quien no tiene ninguno. Un socio que
 * iniciara sesión se llevaba una institución vacía de regalo.
 */

const { userFindUniqueMock, ensureMock, userKindMock, listProfilesMock, readChoiceMock } = vi.hoisted(() => ({
  userFindUniqueMock: vi.fn(),
  ensureMock: vi.fn(),
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
vi.mock("@/lib/ensure-workspace", () => ({ ensureFotofficeWorkspaceForUser: ensureMock }));
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
  ensureMock.mockReset().mockResolvedValue({ workspaceId: "ws-1", onboardingCompleted: true });
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
    expect(ensureMock).not.toHaveBeenCalled();
  });

  it("no queda asociado a ningún workspace por esta vía", async () => {
    const dest = await resolveFotofficePostLoginDestination({ userId: 7 });
    expect(dest.workspaceId).toBeNull();
  });

  it("acepta un next dentro del portal", async () => {
    const dest = await resolveFotofficePostLoginDestination({ userId: 7, next: "/portal/pagos" });
    expect(dest.path).toBe("/portal/pagos");
    expect(ensureMock).not.toHaveBeenCalled();
  });

  it.each(["/workspace", "/members", "https://malicioso.test"])(
    "ignora un next hacia %s",
    async (next) => {
      const dest = await resolveFotofficePostLoginDestination({ userId: 7, next });
      expect(dest.path).toBe("/portal");
      expect(ensureMock).not.toHaveBeenCalled();
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
    expect(ensureMock).not.toHaveBeenCalled();
  });

  it("también respeta la invitación para alguien ya socio", async () => {
    userKindMock.mockResolvedValue("MEMBER");
    const dest = await resolveFotofficePostLoginDestination({
      userId: 7,
      next: "/invitacion/abc123",
    });
    expect(dest.path).toBe("/invitacion/abc123");
    expect(ensureMock).not.toHaveBeenCalled();
  });

  it("un next que solo empieza parecido NO toma el atajo de invitación", async () => {
    userKindMock.mockResolvedValue("NEW");
    await resolveFotofficePostLoginDestination({ userId: 7, next: "/invitacionfalsa/abc" });
    // Sigue el camino normal de un usuario nuevo, que sí prepara su workspace.
    expect(ensureMock).toHaveBeenCalledTimes(1);
  });

  it("un socio tampoco llega al portal por un next parecido a una invitación", async () => {
    userKindMock.mockResolvedValue("MEMBER");
    const dest = await resolveFotofficePostLoginDestination({
      userId: 7,
      next: "/invitacionfalsa/abc",
    });
    expect(dest.path).toBe("/portal");
    expect(ensureMock).not.toHaveBeenCalled();
  });
});

describe("el equipo administrador conserva su comportamiento", () => {
  it("con onboarding completo va al panel", async () => {
    const dest = await resolveFotofficePostLoginDestination({ userId: 7 });
    expect(dest.path).toBe("/workspace");
    expect(ensureMock).toHaveBeenCalledTimes(1);
  });

  it("sin onboarding completo va al onboarding", async () => {
    ensureMock.mockResolvedValue({ workspaceId: "ws-1", onboardingCompleted: false });
    const dest = await resolveFotofficePostLoginDestination({ userId: 7 });
    expect(dest.path).toBe("/onboarding");
  });

  it("un fotógrafo nuevo sí recibe su workspace", async () => {
    userKindMock.mockResolvedValue("NEW");
    const dest = await resolveFotofficePostLoginDestination({ userId: 7 });
    expect(ensureMock).toHaveBeenCalledTimes(1);
    expect(dest.path).toBe("/workspace");
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
    expect(ensureMock).not.toHaveBeenCalled();
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
    expect(ensureMock).not.toHaveBeenCalled();
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
