import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  membershipFindUniqueMock,
  brandingFindUniqueMock,
  brandingUpdateMock,
  workspaceUpdateMock,
  profileUpsertMock,
  featureModuleMock,
} = vi.hoisted(() => ({
  membershipFindUniqueMock: vi.fn(),
  brandingFindUniqueMock: vi.fn(),
  brandingUpdateMock: vi.fn(),
  workspaceUpdateMock: vi.fn(),
  profileUpsertMock: vi.fn(),
  featureModuleMock: vi.fn(() => {
    throw new Error("Configuración no debe consultar WorkspaceFeatureModule.");
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    workspaceMembership: { findUnique: membershipFindUniqueMock },
    fotofficeWorkspaceBranding: { findUnique: brandingFindUniqueMock, update: brandingUpdateMock },
    workspace: { update: workspaceUpdateMock },
    fotofficePhotographerProfile: { upsert: profileUpsertMock },
    workspaceFeatureModule: { findUnique: featureModuleMock, findMany: featureModuleMock },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(async () => ({ id: 1, email: "owner@sfpr.test", name: "Owner" })),
}));

vi.mock("@/lib/ensure-workspace", () => ({
  ensureFotofficeWorkspaceForUser: vi.fn(async () => ({
    workspaceId: "ws-sfpr",
    created: false,
    onboardingCompleted: true,
  })),
}));

const { updateWorkspaceSettingsAction } = await import("./actions");

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const base: Record<string, string> = {
    commercialName: "Club SFPR",
    publicSlug: "sfpr",
    activityType: "PHOTOGRAPHERS_ASSOCIATION",
    contactEmail: "info@sfpr.test",
    phone: "",
    whatsapp: "+54 9 11 5555-5555",
    city: "",
    province: "",
    country: "",
    website: "",
    instagram: "",
    logoUrl: "https://cdn.example.com/logo.png",
    coverImageUrl: "https://cdn.example.com/cover.png",
    displayName: "",
    ...overrides,
  };
  for (const [key, value] of Object.entries(base)) fd.set(key, value);
  return fd;
}

describe("updateWorkspaceSettingsAction", () => {
  beforeEach(() => {
    membershipFindUniqueMock.mockReset();
    brandingFindUniqueMock.mockReset();
    brandingUpdateMock.mockReset();
    workspaceUpdateMock.mockReset();
    profileUpsertMock.mockReset();
    featureModuleMock.mockClear();
    brandingFindUniqueMock.mockResolvedValue(null); // slug libre por defecto
  });

  it("OWNER puede guardar publicSlug, coverImageUrl y whatsapp (campos nuevos)", async () => {
    membershipFindUniqueMock.mockResolvedValueOnce({ role: "WORKSPACE_OWNER" });
    const result = await updateWorkspaceSettingsAction(undefined, buildFormData());
    expect(result.error).toBeNull();
    expect(brandingUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: "ws-sfpr" },
        data: expect.objectContaining({
          publicSlug: "sfpr",
          whatsapp: "+54 9 11 5555-5555",
          coverImageUrl: "https://cdn.example.com/cover.png",
          logoUrl: "https://cdn.example.com/logo.png",
        }),
      }),
    );
  });

  it("STAFF no puede guardar (solo lectura)", async () => {
    membershipFindUniqueMock.mockResolvedValueOnce({ role: "STAFF" });
    const result = await updateWorkspaceSettingsAction(undefined, buildFormData());
    expect(result.error).toBe("No tenés permiso para editar este workspace.");
    expect(brandingUpdateMock).not.toHaveBeenCalled();
  });

  it("rechaza un publicSlug ya usado por otro workspace", async () => {
    membershipFindUniqueMock.mockResolvedValueOnce({ role: "WORKSPACE_OWNER" });
    brandingFindUniqueMock.mockResolvedValueOnce({ workspaceId: "otro-workspace" });
    const result = await updateWorkspaceSettingsAction(undefined, buildFormData());
    expect(result.error).toBe("Ese slug público ya está en uso por otro workspace.");
    expect(brandingUpdateMock).not.toHaveBeenCalled();
  });

  it("no depende de WorkspaceFeatureModule: apagar todos los módulos no debería afectar esta action", async () => {
    membershipFindUniqueMock.mockResolvedValueOnce({ role: "WORKSPACE_OWNER" });
    const result = await updateWorkspaceSettingsAction(undefined, buildFormData());
    expect(result.error).toBeNull();
    expect(featureModuleMock).not.toHaveBeenCalled();
  });
});
