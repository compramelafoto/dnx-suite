import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  userFindUniqueMock,
  workspaceMembershipFindManyMock,
  membershipFindFirstMock,
  membershipUpsertMock,
  workspaceCreateMock,
  brandingFindUniqueMock,
  brandingCreateMock,
  membershipCountMock,
  legacyCountMock,
  memberFindFirstMock,
} = vi.hoisted(() => ({
  userFindUniqueMock: vi.fn(),
  workspaceMembershipFindManyMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  membershipUpsertMock: vi.fn(),
  workspaceCreateMock: vi.fn(),
  brandingFindUniqueMock: vi.fn(),
  brandingCreateMock: vi.fn(),
  membershipCountMock: vi.fn(async () => 0),
  legacyCountMock: vi.fn(async () => 0),
  memberFindFirstMock: vi.fn(async () => null),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    user: { findUnique: userFindUniqueMock },
    // `resolveFotofficeUserKind` consulta estas tres para decidir si la persona es equipo,
    // socio o alguien nuevo. Acá siempre da "nuevo/equipo" según las membresías del caso.
    workspaceMembership: { findMany: workspaceMembershipFindManyMock, count: membershipCountMock },
    membership: {
      findFirst: membershipFindFirstMock,
      upsert: membershipUpsertMock,
      count: legacyCountMock,
    },
    member: { findFirst: memberFindFirstMock },
    workspace: { create: workspaceCreateMock },
    fotofficeWorkspaceBranding: {
      findUnique: brandingFindUniqueMock,
      create: brandingCreateMock,
    },
  },
}));

const { resolveFotofficePostLoginDestination } = await import("./post-login");

function resetMocks() {
  userFindUniqueMock.mockReset();
  workspaceMembershipFindManyMock.mockReset();
  membershipFindFirstMock.mockReset();
  membershipUpsertMock.mockReset();
  workspaceCreateMock.mockReset();
  brandingFindUniqueMock.mockReset();
  brandingCreateMock.mockReset();
}

describe("resolveFotofficePostLoginDestination — A: post-login apunta al shell correcto", () => {
  beforeEach(resetMocks);

  it("SUPER_ADMIN → /admin (sin resolver workspace)", async () => {
    userFindUniqueMock.mockResolvedValueOnce({
      id: 1,
      email: "admin@dnx.local",
      name: "Admin",
      role: "USER",
      globalRole: "SUPER_ADMIN",
    });
    const dest = await resolveFotofficePostLoginDestination({ userId: 1 });
    expect(dest).toEqual({ path: "/admin", workspaceId: null });
    expect(workspaceMembershipFindManyMock).not.toHaveBeenCalled();
  });

  it("usuario normal, workspace existente sin onboarding completo → /onboarding", async () => {
    userFindUniqueMock.mockResolvedValueOnce({
      id: 2,
      email: "foto@dnx.local",
      name: "Foto",
      role: "USER",
      globalRole: "USER",
    });
    workspaceMembershipFindManyMock.mockResolvedValueOnce([
      {
        workspaceId: "ws-1",
        role: "WORKSPACE_OWNER",
        workspace: { id: "ws-1", fotofficeBranding: { onboardingCompletedAt: null } },
      },
    ]);
    const dest = await resolveFotofficePostLoginDestination({ userId: 2 });
    expect(dest).toEqual({ path: "/onboarding", workspaceId: "ws-1" });
  });

  it("usuario normal, onboarding completo, sin `next` → /workspace (shell principal canónico)", async () => {
    userFindUniqueMock.mockResolvedValueOnce({
      id: 3,
      email: "foto2@dnx.local",
      name: "Foto2",
      role: "USER",
      globalRole: "USER",
    });
    workspaceMembershipFindManyMock.mockResolvedValueOnce([
      {
        workspaceId: "ws-2",
        role: "WORKSPACE_OWNER",
        workspace: { id: "ws-2", fotofficeBranding: { onboardingCompletedAt: new Date("2026-01-01") } },
      },
    ]);
    const dest = await resolveFotofficePostLoginDestination({ userId: 3 });
    expect(dest).toEqual({ path: "/workspace", workspaceId: "ws-2" });
  });

  it("usuario normal con `next` seguro dentro de la app → respeta ese destino", async () => {
    userFindUniqueMock.mockResolvedValueOnce({
      id: 4,
      email: "foto3@dnx.local",
      name: "Foto3",
      role: "USER",
      globalRole: "USER",
    });
    workspaceMembershipFindManyMock.mockResolvedValueOnce([
      {
        workspaceId: "ws-3",
        role: "WORKSPACE_OWNER",
        workspace: { id: "ws-3", fotofficeBranding: { onboardingCompletedAt: new Date("2026-01-01") } },
      },
    ]);
    const dest = await resolveFotofficePostLoginDestination({
      userId: 4,
      next: "/dashboard/courses",
    });
    expect(dest).toEqual({ path: "/dashboard/courses", workspaceId: "ws-3" });
  });
});

describe("resolveFotofficePostLoginDestination — B: resolución de workspace activo", () => {
  beforeEach(resetMocks);

  it("usuario con membership existente: reutiliza ese workspace, no crea uno nuevo", async () => {
    userFindUniqueMock.mockResolvedValueOnce({
      id: 5,
      email: "existente@dnx.local",
      name: "Existente",
      role: "USER",
      globalRole: "USER",
    });
    workspaceMembershipFindManyMock.mockResolvedValueOnce([
      {
        workspaceId: "ws-existente",
        role: "WORKSPACE_OWNER",
        workspace: { id: "ws-existente", fotofficeBranding: { onboardingCompletedAt: new Date() } },
      },
    ]);
    const dest = await resolveFotofficePostLoginDestination({ userId: 5 });
    expect(dest.workspaceId).toBe("ws-existente");
    expect(workspaceCreateMock).not.toHaveBeenCalled();
  });

  it("usuario sin ninguna membership: se crea un workspace nuevo (bootstrap)", async () => {
    userFindUniqueMock.mockResolvedValueOnce({
      id: 6,
      email: "nuevo@dnx.local",
      name: "Nuevo Usuario",
      role: "USER",
      globalRole: "USER",
    });
    workspaceMembershipFindManyMock.mockResolvedValueOnce([]);
    membershipFindFirstMock.mockResolvedValueOnce(null);
    workspaceCreateMock.mockResolvedValueOnce({ id: "ws-nuevo" });

    const dest = await resolveFotofficePostLoginDestination({ userId: 6 });

    expect(workspaceCreateMock).toHaveBeenCalledTimes(1);
    expect(dest).toEqual({ path: "/onboarding", workspaceId: "ws-nuevo" });
  });
});
