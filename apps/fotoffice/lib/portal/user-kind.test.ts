import { beforeEach, describe, expect, it, vi } from "vitest";

const { membershipCountMock, legacyCountMock, memberFindFirstMock } = vi.hoisted(() => ({
  membershipCountMock: vi.fn(),
  legacyCountMock: vi.fn(),
  memberFindFirstMock: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    workspaceMembership: { count: membershipCountMock },
    membership: { count: legacyCountMock },
    member: { findFirst: memberFindFirstMock },
  },
}));

const { resolveFotofficeUserKind } = await import("./user-kind");

beforeEach(() => {
  membershipCountMock.mockReset().mockResolvedValue(0);
  legacyCountMock.mockReset().mockResolvedValue(0);
  memberFindFirstMock.mockReset().mockResolvedValue(null);
});

describe("clasificación de usuario", () => {
  it("con membresía de workspace es equipo administrador", async () => {
    membershipCountMock.mockResolvedValue(1);
    expect(await resolveFotofficeUserKind(7)).toBe("TEAM");
  });

  it("la membresía legacy también cuenta como equipo", async () => {
    legacyCountMock.mockResolvedValue(1);
    expect(await resolveFotofficeUserKind(7)).toBe("TEAM");
  });

  it("sin membresía pero con ficha de socio es socio", async () => {
    memberFindFirstMock.mockResolvedValue({ id: "mem-1" });
    expect(await resolveFotofficeUserKind(7)).toBe("MEMBER");
  });

  it("sin nada es un usuario nuevo", async () => {
    expect(await resolveFotofficeUserKind(7)).toBe("NEW");
  });

  /**
   * Alguien puede ser fotógrafo con su propio workspace Y socio de una institución. En ese
   * caso manda el equipo: tiene panel propio y no hay que quitárselo.
   */
  it("quien es equipo y socio a la vez sigue siendo equipo", async () => {
    membershipCountMock.mockResolvedValue(1);
    memberFindFirstMock.mockResolvedValue({ id: "mem-1" });
    expect(await resolveFotofficeUserKind(7)).toBe("TEAM");
  });

  it("no consulta socios si ya sabe que es equipo", async () => {
    membershipCountMock.mockResolvedValue(1);
    await resolveFotofficeUserKind(7);
    expect(memberFindFirstMock).not.toHaveBeenCalled();
  });

  /** Un socio dado de baja no es "socio activo": no debe entrar al portal por esta vía. */
  it("solo cuenta la ficha de socio ACTIVE", async () => {
    memberFindFirstMock.mockResolvedValue(null);
    await resolveFotofficeUserKind(7);
    expect(memberFindFirstMock.mock.calls[0]?.[0]?.where?.status).toBe("ACTIVE");
    expect(memberFindFirstMock.mock.calls[0]?.[0]?.where?.userId).toBe(7);
  });
});
