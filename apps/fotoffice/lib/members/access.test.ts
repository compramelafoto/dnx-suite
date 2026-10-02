import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  redirect: vi.fn((d: string) => {
    throw new Error(`REDIRECT:${d}`);
  }),
  requireAuth: vi.fn(),
  getAuthUser: vi.fn(),
  workspace: vi.fn(),
  enabled: vi.fn(),
  level: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: H.redirect }));
vi.mock("@/lib/auth", () => ({ requireAuth: H.requireAuth, getAuthUser: H.getAuthUser }));
vi.mock("@/lib/workspace", () => ({ resolveActiveWorkspace: H.workspace }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: H.enabled }));
vi.mock("@/lib/permissions/module-access", () => ({ getModuleLevel: H.level }));

const { requireMembersContext, requireMembersManageContext, resolveMembersExportContext } = await import(
  "./access"
);

beforeEach(() => {
  H.redirect.mockClear();
  H.requireAuth.mockReset().mockResolvedValue({ id: 7 });
  H.getAuthUser.mockReset().mockResolvedValue({ id: 7 });
  H.workspace.mockReset().mockResolvedValue({ id: "ws-1", name: "SFPR" });
  H.enabled.mockReset().mockResolvedValue(true);
  H.level.mockReset().mockResolvedValue("MANAGE");
});

describe("Socios", () => {
  it("módulo apagado: mismo destino que antes", async () => {
    H.enabled.mockResolvedValue(false);
    await expect(requireMembersContext()).rejects.toThrow("REDIRECT:/dashboard?module=off");
  });

  it("sin nivel: afuera", async () => {
    H.level.mockResolvedValue("NONE");
    await expect(requireMembersContext()).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("VIEW consulta pero no gestiona", async () => {
    H.level.mockResolvedValue("VIEW");
    await expect(requireMembersContext()).resolves.toMatchObject({ canManage: false });
    await expect(requireMembersManageContext()).rejects.toThrow("REDIRECT:/members?forbidden=manage");
  });

  it("MANAGE gestiona", async () => {
    await expect(requireMembersManageContext()).resolves.toMatchObject({ canManage: true });
    expect(H.level).toHaveBeenCalledWith(7, "ws-1", "members");
  });

  it("la exportación del padrón exige MANAGE", async () => {
    H.level.mockResolvedValue("VIEW");
    expect(await resolveMembersExportContext()).toBeNull();
    H.level.mockResolvedValue("MANAGE");
    expect(await resolveMembersExportContext()).toMatchObject({ canManage: true });
  });
});
