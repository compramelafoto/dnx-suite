import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAuthMock, listProfilesMock, setChoiceMock, clearChoiceMock, ensureMock, redirectMock } =
  vi.hoisted(() => ({
    requireAuthMock: vi.fn(),
    listProfilesMock: vi.fn(),
    setChoiceMock: vi.fn(),
    clearChoiceMock: vi.fn(),
    ensureMock: vi.fn(),
    redirectMock: vi.fn((path: string) => {
      // `redirect` corta el flujo lanzando; se replica para que el test vea lo mismo.
      const e = new Error(`REDIRECT:${path}`);
      (e as Error & { path?: string }).path = path;
      throw e;
    }),
  }));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/auth", () => ({ requireAuth: requireAuthMock }));
vi.mock("@/lib/ensure-workspace", () => ({ ensureFotofficeWorkspaceForUser: ensureMock }));
vi.mock("@/lib/portal/profile-choice", () => ({
  setProfileChoice: setChoiceMock,
  clearProfileChoice: clearChoiceMock,
}));
vi.mock("@/lib/portal/profiles", async () => {
  const actual = await vi.importActual<typeof import("@/lib/portal/profiles")>("@/lib/portal/profiles");
  return { ...actual, listUserProfiles: listProfilesMock };
});

const { chooseProfileAction, switchProfileAction, createOwnBusinessAction } = await import(
  "./profile-choice"
);

const TEAM = { kind: "TEAM", workspaceId: "ws-dnx", workspaceName: "DNX Owner", role: "WORKSPACE_OWNER" };
const SOCIO = { kind: "MEMBER", workspaceId: "ws-sfpr", workspaceName: "SFPR", memberId: "m", memberNumber: "556" };

function form(profile: string) {
  const fd = new FormData();
  fd.set("profile", profile);
  return fd;
}

/** Ejecuta la acción y devuelve a dónde redirigió. */
async function destinationOf(run: () => Promise<void>): Promise<string> {
  try {
    await run();
  } catch (e) {
    const path = (e as Error & { path?: string }).path;
    if (path) return path;
    throw e;
  }
  throw new Error("la acción no redirigió");
}

beforeEach(() => {
  requireAuthMock.mockReset().mockResolvedValue({ id: 4, email: "a@b.test", name: "Daniel" });
  listProfilesMock.mockReset().mockResolvedValue([TEAM, SOCIO]);
  setChoiceMock.mockReset();
  clearChoiceMock.mockReset();
  ensureMock.mockReset().mockResolvedValue({ workspaceId: "ws-nuevo", onboardingCompleted: false });
  redirectMock.mockClear();
});

describe("elegir perfil", () => {
  it("guarda la elección y lleva al destino del perfil de equipo", async () => {
    expect(await destinationOf(() => chooseProfileAction(form("TEAM:ws-dnx")))).toBe("/workspace");
    expect(setChoiceMock).toHaveBeenCalledWith("TEAM:ws-dnx");
  });

  it("el perfil de socio lleva al portal", async () => {
    expect(await destinationOf(() => chooseProfileAction(form("MEMBER:ws-sfpr")))).toBe("/portal");
    expect(setChoiceMock).toHaveBeenCalledWith("MEMBER:ws-sfpr");
  });

  /**
   * Lo que manda el navegador no se cree: la lista real se rearma en el servidor y la clave
   * tiene que estar ahí. Si no, no se guarda nada y se vuelve a preguntar.
   */
  it.each([
    ["de un workspace ajeno", "TEAM:ws-de-otro"],
    ["con tipo inventado", "SUPERADMIN:ws-dnx"],
    ["vacía", ""],
    ["basura", "%%%"],
  ])("una clave %s no se guarda y vuelve al selector", async (_label, key) => {
    expect(await destinationOf(() => chooseProfileAction(form(key)))).toBe("/elegir-perfil");
    expect(setChoiceMock).not.toHaveBeenCalled();
  });

  it("elegir no crea membresías ni workspaces", async () => {
    await destinationOf(() => chooseProfileAction(form("MEMBER:ws-sfpr")));
    expect(ensureMock).not.toHaveBeenCalled();
  });

  it("cambiar de perfil olvida la preferencia y vuelve al selector", async () => {
    expect(await destinationOf(() => switchProfileAction())).toBe("/elegir-perfil");
    expect(clearChoiceMock).toHaveBeenCalledTimes(1);
  });
});

describe("crear mi negocio", () => {
  it("un socio sin negocio lo crea y va al onboarding", async () => {
    listProfilesMock.mockResolvedValue([SOCIO]);
    expect(await destinationOf(() => createOwnBusinessAction())).toBe("/onboarding");
    expect(ensureMock).toHaveBeenCalledTimes(1);
    expect(setChoiceMock).toHaveBeenCalledWith("TEAM:ws-nuevo");
  });

  /** Un clic repetido no puede dejar a la persona con dos negocios. */
  it("quien ya tiene negocio no crea otro", async () => {
    listProfilesMock.mockResolvedValue([TEAM, SOCIO]);
    expect(await destinationOf(() => createOwnBusinessAction())).toBe("/workspace");
    expect(ensureMock).not.toHaveBeenCalled();
  });

  it("la creación es siempre explícita: exige sesión autenticada", async () => {
    await destinationOf(() => createOwnBusinessAction()).catch(() => "");
    expect(requireAuthMock).toHaveBeenCalled();
  });

  it("no toca la ficha de socio", async () => {
    listProfilesMock.mockResolvedValue([SOCIO]);
    await destinationOf(() => createOwnBusinessAction());
    // El mock de prisma no está expuesto acá: cualquier escritura sobre Member habría fallado.
    expect(ensureMock.mock.calls[0]?.[0]).toEqual({
      userId: 4,
      email: "a@b.test",
      name: "Daniel",
    });
  });
});
