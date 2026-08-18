import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  isPlatformAdminMock,
  workspaceFindUniqueMock,
  workspaceDeleteMock,
  enrollmentCountMock,
  courseSalesLeadCountMock,
  serviceSalesLeadCountMock,
  memberCountMock,
  serviceLeadFormCountMock,
} = vi.hoisted(() => ({
  isPlatformAdminMock: vi.fn(),
  workspaceFindUniqueMock: vi.fn(),
  workspaceDeleteMock: vi.fn(),
  enrollmentCountMock: vi.fn(),
  courseSalesLeadCountMock: vi.fn(),
  serviceSalesLeadCountMock: vi.fn(),
  memberCountMock: vi.fn(),
  serviceLeadFormCountMock: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@repo/db", () => ({
  prisma: {
    workspace: { findUnique: workspaceFindUniqueMock, delete: workspaceDeleteMock },
    courseEnrollment: { count: enrollmentCountMock },
    courseSalesLead: { count: courseSalesLeadCountMock },
    serviceSalesLead: { count: serviceSalesLeadCountMock },
    member: { count: memberCountMock },
    serviceLeadForm: { count: serviceLeadFormCountMock },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(async () => ({ id: 1, email: "super@dnx.test" })),
}));

vi.mock("@/lib/platform-admin", () => ({
  isFotofficePlatformAdmin: isPlatformAdminMock,
}));

const { deleteWorkspaceAction } = await import("./super-admin");

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const base: Record<string, string> = {
    workspaceId: "ws-fixture",
    confirmSlug: "qa-fixture",
    ...overrides,
  };
  for (const [key, value] of Object.entries(base)) fd.set(key, value);
  return fd;
}

function resetAllCountsToZero() {
  enrollmentCountMock.mockResolvedValue(0);
  courseSalesLeadCountMock.mockResolvedValue(0);
  serviceSalesLeadCountMock.mockResolvedValue(0);
  memberCountMock.mockResolvedValue(0);
  serviceLeadFormCountMock.mockResolvedValue(0);
}

describe("deleteWorkspaceAction", () => {
  beforeEach(() => {
    isPlatformAdminMock.mockReset();
    workspaceFindUniqueMock.mockReset();
    workspaceDeleteMock.mockReset();
    enrollmentCountMock.mockReset();
    courseSalesLeadCountMock.mockReset();
    serviceSalesLeadCountMock.mockReset();
    memberCountMock.mockReset();
    serviceLeadFormCountMock.mockReset();
    workspaceFindUniqueMock.mockResolvedValue({
      id: "ws-fixture",
      name: "QA Fixture",
      fotofficeBranding: { publicSlug: "qa-fixture" },
    });
    resetAllCountsToZero();
  });

  it("un usuario que no es SUPER_ADMIN no puede eliminar (server-side, no confía en el frontend)", async () => {
    isPlatformAdminMock.mockResolvedValueOnce(false);
    const result = await deleteWorkspaceAction(undefined, buildFormData());
    expect(result.error).toBe("No tenés permisos para eliminar workspaces.");
    expect(workspaceDeleteMock).not.toHaveBeenCalled();
  });

  it("rechaza si el slug escrito no coincide con el real", async () => {
    isPlatformAdminMock.mockResolvedValueOnce(true);
    const result = await deleteWorkspaceAction(undefined, buildFormData({ confirmSlug: "otro-slug" }));
    expect(result.error).toBe("El slug no coincide. No se eliminó nada.");
    expect(workspaceDeleteMock).not.toHaveBeenCalled();
  });

  it("SUPER_ADMIN + slug correcto + sin datos reales: elimina el workspace", async () => {
    isPlatformAdminMock.mockResolvedValueOnce(true);
    const result = await deleteWorkspaceAction(undefined, buildFormData());
    expect(result.error).toBeNull();
    expect(workspaceDeleteMock).toHaveBeenCalledWith({ where: { id: "ws-fixture" } });
  });

  it("bloquea la eliminación si hay inscripciones con datos de pago (CourseEnrollment)", async () => {
    isPlatformAdminMock.mockResolvedValueOnce(true);
    enrollmentCountMock.mockResolvedValue(3);
    const result = await deleteWorkspaceAction(undefined, buildFormData());
    expect(result.error).toContain("inscripción");
    expect(workspaceDeleteMock).not.toHaveBeenCalled();
  });

  it("bloquea la eliminación si hay socios (Member) — personas reales", async () => {
    isPlatformAdminMock.mockResolvedValueOnce(true);
    memberCountMock.mockResolvedValue(5);
    const result = await deleteWorkspaceAction(undefined, buildFormData());
    expect(result.error).toContain("socio");
    expect(workspaceDeleteMock).not.toHaveBeenCalled();
  });

  it("bloquea la eliminación si hay ServiceLeadForm (sin cascade en el schema real)", async () => {
    isPlatformAdminMock.mockResolvedValueOnce(true);
    serviceLeadFormCountMock.mockResolvedValue(1);
    const result = await deleteWorkspaceAction(undefined, buildFormData());
    expect(result.error).toContain("formulario");
    expect(workspaceDeleteMock).not.toHaveBeenCalled();
  });

  it("no aplica ninguna política de soft-delete inventada: solo bloquea e informa", async () => {
    isPlatformAdminMock.mockResolvedValueOnce(true);
    courseSalesLeadCountMock.mockResolvedValue(1);
    serviceSalesLeadCountMock.mockResolvedValue(1);
    const result = await deleteWorkspaceAction(undefined, buildFormData());
    expect(result.error).toContain("decisión de negocio");
    expect(workspaceDeleteMock).not.toHaveBeenCalled();
  });

  it("workspace inexistente: no falla ni intenta borrar", async () => {
    isPlatformAdminMock.mockResolvedValueOnce(true);
    workspaceFindUniqueMock.mockResolvedValueOnce(null);
    const result = await deleteWorkspaceAction(undefined, buildFormData());
    expect(result.error).toBe("Ese workspace ya no existe.");
    expect(workspaceDeleteMock).not.toHaveBeenCalled();
  });
});
