import { beforeEach, describe, expect, it, vi } from "vitest";

const { membershipFindUniqueMock, legacyMembershipFindUniqueMock, courseSettingsUpsertMock, brandingUpsertMock } =
  vi.hoisted(() => ({
    membershipFindUniqueMock: vi.fn(),
    legacyMembershipFindUniqueMock: vi.fn(),
    courseSettingsUpsertMock: vi.fn(),
    brandingUpsertMock: vi.fn(),
  }));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    workspaceMembership: { findUnique: membershipFindUniqueMock },
    membership: { findUnique: legacyMembershipFindUniqueMock },
    courseSalesWorkspaceSettings: { upsert: courseSettingsUpsertMock },
    fotofficeWorkspaceBranding: { upsert: brandingUpsertMock },
  },
}));

vi.mock("@/lib/workspace", () => ({
  requireCoursesSalesContext: vi.fn(async () => ({
    workspace: { id: "ws-sfpr", name: "Club SFPR" },
    user: { id: 1, email: "owner@sfpr.test" },
  })),
}));

const { updateCoursesSalesSettingsAction } = await import("./settings");

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const base: Record<string, string> = {
    defaultCurrency: "ARS",
    enrollmentCtaLabel: "Quiero inscribirme",
    ...overrides,
  };
  for (const [key, value] of Object.entries(base)) fd.set(key, value);
  return fd;
}

describe("updateCoursesSalesSettingsAction", () => {
  beforeEach(() => {
    membershipFindUniqueMock.mockReset();
    legacyMembershipFindUniqueMock.mockReset();
    courseSettingsUpsertMock.mockReset();
    brandingUpsertMock.mockReset();
    legacyMembershipFindUniqueMock.mockResolvedValue(null);
  });

  it("guarda defaultCurrency y enrollmentCtaLabel en CourseSalesWorkspaceSettings", async () => {
    membershipFindUniqueMock.mockResolvedValueOnce({ role: "WORKSPACE_OWNER" });
    const result = await updateCoursesSalesSettingsAction(undefined, buildFormData());
    expect(result.error).toBeNull();
    expect(courseSettingsUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: "ws-sfpr" },
        update: expect.objectContaining({
          defaultCurrency: "ARS",
          enrollmentCtaLabel: "Quiero inscribirme",
        }),
      }),
    );
  });

  /**
   * La comisión es de la plataforma, no del cliente. Aunque el formulario mande el campo
   * —a mano, con curl, o por un formulario viejo cacheado— la acción no lo escribe.
   */
  it("ignora coursesFeePercent aunque venga en el formulario", async () => {
    membershipFindUniqueMock.mockResolvedValueOnce({ role: "WORKSPACE_OWNER" });
    await updateCoursesSalesSettingsAction(undefined, buildFormData({ coursesFeePercent: "0" }));

    const call = courseSettingsUpsertMock.mock.calls[0]?.[0];
    expect(call.update).not.toHaveProperty("coursesFeePercent");
    expect(call.create).not.toHaveProperty("coursesFeePercent");
  });

  it("NUNCA toca fotofficeWorkspaceBranding — el branding general ya no se edita desde Cursos", async () => {
    membershipFindUniqueMock.mockResolvedValueOnce({ role: "WORKSPACE_OWNER" });
    await updateCoursesSalesSettingsAction(undefined, buildFormData());
    expect(brandingUpsertMock).not.toHaveBeenCalled();
  });

  it("STAFF no puede editar la configuración de cursos", async () => {
    membershipFindUniqueMock.mockResolvedValueOnce({ role: "STAFF" });
    const result = await updateCoursesSalesSettingsAction(undefined, buildFormData());
    expect(result.error).toBe("Solo owner/admin del workspace puede editar la configuración de cursos.");
    expect(courseSettingsUpsertMock).not.toHaveBeenCalled();
  });
});
