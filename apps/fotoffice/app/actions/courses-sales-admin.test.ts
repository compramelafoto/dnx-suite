import { beforeEach, describe, expect, it, vi } from "vitest";

const { isPlatformAdminMock, upsertMock } = vi.hoisted(() => ({
  isPlatformAdminMock: vi.fn(),
  upsertMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    workspaceFeatureModule: { upsert: upsertMock },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(async () => ({ id: 1, email: "admin@dnx.test" })),
}));

vi.mock("@/lib/platform-admin", () => ({
  isFotofficePlatformAdmin: isPlatformAdminMock,
}));

const { toggleWorkspaceModuleAction } = await import("./courses-sales-admin");

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const base: Record<string, string> = {
    workspaceId: "ws-qa",
    moduleKey: "website",
    enabled: "true",
    ...overrides,
  };
  for (const [key, value] of Object.entries(base)) fd.set(key, value);
  return fd;
}

describe("toggleWorkspaceModuleAction — website", () => {
  beforeEach(() => {
    isPlatformAdminMock.mockReset();
    upsertMock.mockReset();
  });

  it("SUPER_ADMIN puede activar website: la whitelist genérica ya lo incluye sin tocar este archivo", async () => {
    isPlatformAdminMock.mockResolvedValueOnce(true);
    const result = await toggleWorkspaceModuleAction(undefined, buildFormData());
    expect(result.error).toBeNull();
    expect(upsertMock).toHaveBeenCalledWith({
      where: { workspaceId_moduleKey: { workspaceId: "ws-qa", moduleKey: "website" } },
      update: { enabled: true },
      create: { workspaceId: "ws-qa", moduleKey: "website", enabled: true },
    });
  });

  it("un usuario que no es SUPER_ADMIN no puede activar/desactivar website", async () => {
    isPlatformAdminMock.mockResolvedValueOnce(false);
    const result = await toggleWorkspaceModuleAction(undefined, buildFormData());
    expect(result.error).toBe("Solo SUPER_ADMIN puede gestionar módulos globales.");
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("desactivar website solo cambia `enabled`, nunca toca FotofficeWorkspaceWebsite", async () => {
    isPlatformAdminMock.mockResolvedValueOnce(true);
    await toggleWorkspaceModuleAction(undefined, buildFormData({ enabled: "false" }));
    const call = upsertMock.mock.calls[0][0];
    expect(call.update).toEqual({ enabled: false });
    expect(Object.keys(call.create).sort()).toEqual(["enabled", "moduleKey", "workspaceId"].sort());
  });

  it("un moduleKey inventado (no en el registry) se rechaza", async () => {
    isPlatformAdminMock.mockResolvedValueOnce(true);
    const result = await toggleWorkspaceModuleAction(undefined, buildFormData({ moduleKey: "no-existe" }));
    expect(result.error).toBe("Módulo inválido.");
    expect(upsertMock).not.toHaveBeenCalled();
  });
});
