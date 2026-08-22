import { beforeEach, describe, expect, it, vi } from "vitest";

const { memberFindFirstMock } = vi.hoisted(() => ({ memberFindFirstMock: vi.fn() }));

vi.mock("@repo/db", () => ({ prisma: { member: { findFirst: memberFindFirstMock } } }));

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
