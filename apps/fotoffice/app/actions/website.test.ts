import { beforeEach, describe, expect, it, vi } from "vitest";

const { membershipFindUniqueMock, websiteUpsertMock } = vi.hoisted(() => ({
  membershipFindUniqueMock: vi.fn(),
  websiteUpsertMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    workspaceMembership: { findUnique: membershipFindUniqueMock },
    fotofficeWorkspaceWebsite: { upsert: websiteUpsertMock },
  },
}));

vi.mock("@/lib/workspace", () => ({
  requireWebsiteContext: vi.fn(async () => ({
    workspace: { id: "ws-a", name: "Workspace A" },
    user: { id: 1, email: "owner@a.test" },
  })),
}));

const { toggleWebsitePublishAction } = await import("./website");

function buildFormData(publish: boolean): FormData {
  const fd = new FormData();
  fd.set("publish", String(publish));
  return fd;
}

describe("toggleWebsitePublishAction", () => {
  beforeEach(() => {
    membershipFindUniqueMock.mockReset();
    websiteUpsertMock.mockReset();
  });

  it("OWNER puede publicar: setea publishedAt", async () => {
    membershipFindUniqueMock.mockResolvedValueOnce({ role: "WORKSPACE_OWNER" });
    const result = await toggleWebsitePublishAction(undefined, buildFormData(true));
    expect(result.error).toBeNull();
    expect(websiteUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: "ws-a" },
        update: expect.objectContaining({ publishedAt: expect.any(Date) }),
      }),
    );
  });

  it("ADMIN puede despublicar: publishedAt vuelve a null", async () => {
    membershipFindUniqueMock.mockResolvedValueOnce({ role: "WORKSPACE_ADMIN" });
    const result = await toggleWebsitePublishAction(undefined, buildFormData(false));
    expect(result.error).toBeNull();
    expect(websiteUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: "ws-a" },
        update: { publishedAt: null },
      }),
    );
  });

  it("STAFF no puede publicar/despublicar", async () => {
    membershipFindUniqueMock.mockResolvedValueOnce({ role: "STAFF" });
    const result = await toggleWebsitePublishAction(undefined, buildFormData(true));
    expect(result.error).toBe("No tenés permiso para publicar el sitio web.");
    expect(websiteUpsertMock).not.toHaveBeenCalled();
  });

  it("aislamiento: el upsert siempre usa el workspaceId del contexto activo, nunca uno arbitrario", async () => {
    membershipFindUniqueMock.mockResolvedValueOnce({ role: "WORKSPACE_OWNER" });
    await toggleWebsitePublishAction(undefined, buildFormData(true));
    const call = websiteUpsertMock.mock.calls[0][0];
    expect(call.where.workspaceId).toBe("ws-a");
    expect(call.create.workspaceId).toBe("ws-a");
  });
});
