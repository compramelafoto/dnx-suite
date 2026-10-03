import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  user: vi.fn(),
  workspace: vi.fn(),
  level: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAuthUser: H.user }));
vi.mock("@/lib/workspace", () => ({ resolveActiveWorkspace: H.workspace }));
vi.mock("@/lib/permissions/module-access", () => ({ getModuleLevel: H.level }));

const { resolvePortfolioAdminContext } = await import("./admin-access");

beforeEach(() => {
  H.user.mockReset().mockResolvedValue({ id: 7, email: "sec@sfpr.test" });
  H.workspace.mockReset().mockResolvedValue({ id: "ws-1", name: "SFPR" });
  H.level.mockReset().mockResolvedValue("MANAGE");
});

describe("resolvePortfolioAdminContext: portfolio MANAGE", () => {
  it("con MANAGE devuelve el contexto, preguntando por ESTA persona en ESTE workspace", async () => {
    await expect(resolvePortfolioAdminContext()).resolves.toEqual({
      user: { id: 7, email: "sec@sfpr.test" },
      workspace: { id: "ws-1", name: "SFPR" },
    });
    expect(H.level).toHaveBeenCalledWith(7, "ws-1", "portfolio");
  });

  it("con VIEW no: ver no alcanza para bajar la obra de alguien", async () => {
    H.level.mockResolvedValue("VIEW");
    await expect(resolvePortfolioAdminContext()).resolves.toBeNull();
  });

  it("sin nivel (módulo apagado, STAFF sin roles o rol sin portfolio), null", async () => {
    H.level.mockResolvedValue("NONE");
    await expect(resolvePortfolioAdminContext()).resolves.toBeNull();
  });

  it("sin sesión o sin workspace, null sin consultar el nivel", async () => {
    H.user.mockResolvedValue(null);
    await expect(resolvePortfolioAdminContext()).resolves.toBeNull();
    H.user.mockResolvedValue({ id: 7 });
    H.workspace.mockResolvedValue(null);
    await expect(resolvePortfolioAdminContext()).resolves.toBeNull();
    expect(H.level).not.toHaveBeenCalled();
  });
});
