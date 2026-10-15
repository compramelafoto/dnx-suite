import { beforeEach, describe, expect, it, vi } from "vitest";

const { memberFindFirstMock, readChoiceMock } = vi.hoisted(() => ({
  memberFindFirstMock: vi.fn(),
  readChoiceMock: vi.fn(),
}));

vi.mock("@repo/db", () => ({ prisma: { member: { findFirst: memberFindFirstMock } } }));
vi.mock("./profile-choice", () => ({ readProfileChoice: readChoiceMock }));

const { loadPortalContext } = await import("./access");

const ROW = {
  id: "mem-1",
  firstName: "Juan",
  lastName: "Pérez",
  memberNumber: "124",
  workspace: { id: "ws-sfpr", name: "Club SFPR" },
};

beforeEach(() => {
  memberFindFirstMock.mockReset().mockResolvedValue(ROW);
  readChoiceMock.mockReset().mockResolvedValue(null);
});

describe("acceso al portal del socio", () => {
  it("devuelve el socio y su institución", async () => {
    const ctx = await loadPortalContext(7);
    expect(ctx?.member.memberNumber).toBe("124");
    expect(ctx?.workspace.name).toBe("Club SFPR");
  });

  /**
   * La autorización es: sesión + ficha de socio propia + estado permitido. No hay
   * `WorkspaceMembership` de por medio — los roles OWNER/ADMIN/STAFF son del equipo que
   * administra la institución, y un socio no forma parte de ese equipo.
   */
  it("busca la ficha por el userId de la sesión, nunca por un dato del navegador", async () => {
    await loadPortalContext(7);
    expect(memberFindFirstMock.mock.calls[0]?.[0]?.where?.userId).toBe(7);
  });

  it("exige estado ACTIVE", async () => {
    await loadPortalContext(7);
    expect(memberFindFirstMock.mock.calls[0]?.[0]?.where?.status).toBe("ACTIVE");
  });

  it("sin ficha de socio no hay portal", async () => {
    memberFindFirstMock.mockResolvedValue(null);
    expect(await loadPortalContext(7)).toBeNull();
  });

  it("no consulta ni expone membresías de workspace", async () => {
    await loadPortalContext(7);
    const args = JSON.stringify(memberFindFirstMock.mock.calls[0]?.[0] ?? {});
    expect(args).not.toContain("workspaceMembership");
    expect(args).not.toContain("role");
  });
});

/**
 * Socio de varias instituciones: el portal abre la que eligió (cookie `MEMBER:<ws>`, que fijan
 * `switchToPortalAction` y `chooseInstitutionAction`) si sigue siendo una ficha ACTIVE suya;
 * si no, la más antigua, como siempre.
 */
describe("socio de varias instituciones", () => {
  const OTRA = { ...ROW, id: "mem-2", memberNumber: "9", workspace: { id: "ws-otra", name: "Otra" } };

  it("con la cookie de una institución donde es socio: abre esa", async () => {
    readChoiceMock.mockResolvedValue("MEMBER:ws-otra");
    memberFindFirstMock.mockImplementation(async (args: { where: { workspaceId?: string } }) =>
      args.where.workspaceId === "ws-otra" ? OTRA : ROW,
    );
    const ctx = await loadPortalContext(7);
    expect(ctx?.workspace.id).toBe("ws-otra");
    const where = memberFindFirstMock.mock.calls[0]?.[0]?.where;
    expect(where).toEqual({ userId: 7, status: "ACTIVE", workspaceId: "ws-otra" });
  });

  it("con la cookie de una institución donde no es socio: la más antigua", async () => {
    readChoiceMock.mockResolvedValue("MEMBER:ws-ajena");
    memberFindFirstMock.mockImplementation(async (args: { where: { workspaceId?: string } }) =>
      args.where.workspaceId ? null : ROW,
    );
    const ctx = await loadPortalContext(7);
    expect(ctx?.workspace.id).toBe("ws-sfpr");
    expect(memberFindFirstMock.mock.calls.at(-1)?.[0]?.orderBy).toEqual({ createdAt: "asc" });
  });

  it("una cookie de equipo no elige institución del portal", async () => {
    readChoiceMock.mockResolvedValue("TEAM:ws-otra");
    await loadPortalContext(7);
    expect(memberFindFirstMock).toHaveBeenCalledTimes(1);
    expect(memberFindFirstMock.mock.calls[0]?.[0]?.where?.workspaceId).toBeUndefined();
  });

  it("sin poder leer la cookie (fuera de una petición): la más antigua", async () => {
    readChoiceMock.mockRejectedValue(new Error("cookies() fuera de request"));
    expect((await loadPortalContext(7))?.workspace.id).toBe("ws-sfpr");
  });
});
