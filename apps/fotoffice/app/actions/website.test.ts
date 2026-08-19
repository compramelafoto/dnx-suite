import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  membershipFindUniqueMock,
  websiteUpsertMock,
  websiteUpdateMock,
  websiteUpdateManyMock,
  versionAggregateMock,
  versionCreateMock,
  brandingUpdateMock,
} = vi.hoisted(() => ({
  membershipFindUniqueMock: vi.fn(),
  websiteUpsertMock: vi.fn(),
  websiteUpdateMock: vi.fn(),
  websiteUpdateManyMock: vi.fn(),
  versionAggregateMock: vi.fn(),
  versionCreateMock: vi.fn(),
  brandingUpdateMock: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const txDelegates = {
  fotofficeWorkspaceWebsite: { upsert: websiteUpsertMock, update: websiteUpdateMock },
  fotofficeWorkspaceWebsiteVersion: { aggregate: versionAggregateMock, create: versionCreateMock },
};

vi.mock("@repo/db", () => ({
  prisma: {
    workspaceMembership: { findUnique: membershipFindUniqueMock },
    fotofficeWorkspaceWebsite: { upsert: websiteUpsertMock, update: websiteUpdateMock, updateMany: websiteUpdateManyMock },
    fotofficeWorkspaceBranding: { update: brandingUpdateMock },
    $transaction: vi.fn(async (fn: (tx: typeof txDelegates) => unknown) => fn(txDelegates)),
  },
}));

vi.mock("@/lib/workspace", () => ({
  requireWebsiteContext: vi.fn(async () => ({
    workspace: { id: "ws-a", name: "Workspace A" },
    user: { id: 7, email: "owner@a.test" },
  })),
}));

const {
  publishWebsiteAction,
  unpublishWebsiteAction,
  saveWebsiteBlocksAction,
  saveWebsiteSeoAction,
  saveWebsiteBrandingColorsAction,
} = await import("./website");

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(overrides)) fd.set(key, value);
  return fd;
}

const DRAFT_BASE = {
  id: "website-a",
  workspaceId: "ws-a",
  heroTitle: null,
  heroSubtitle: null,
  seoTitle: null,
  seoDescription: null,
  navJson: null,
  sectionsJson: null,
  updatedAt: new Date("2026-08-19T10:00:00.000Z"),
};

describe("publishWebsiteAction", () => {
  beforeEach(() => {
    membershipFindUniqueMock.mockReset();
    websiteUpsertMock.mockReset();
    websiteUpdateMock.mockReset();
    versionAggregateMock.mockReset();
    versionCreateMock.mockReset();
  });

  it("OWNER publica: crea la Version 1 y apunta publishedVersionId hacia ella", async () => {
    membershipFindUniqueMock.mockResolvedValueOnce({ role: "WORKSPACE_OWNER" });
    websiteUpsertMock.mockResolvedValueOnce(DRAFT_BASE);
    versionAggregateMock.mockResolvedValueOnce({ _max: { versionNumber: null } });
    versionCreateMock.mockResolvedValueOnce({ id: "version-1" });

    const result = await publishWebsiteAction(undefined, buildFormData());

    expect(result.error).toBeNull();
    expect(versionCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        websiteId: "website-a",
        versionNumber: 1,
        publishedByUserId: 7,
      }),
    });
    expect(websiteUpdateMock).toHaveBeenCalledWith({
      where: { id: "website-a" },
      data: expect.objectContaining({ publishedVersionId: "version-1" }),
    });
  });

  it("publicar dos veces crea dos versiones distintas, sin tocar la anterior", async () => {
    membershipFindUniqueMock.mockResolvedValueOnce({ role: "WORKSPACE_OWNER" });
    websiteUpsertMock.mockResolvedValueOnce(DRAFT_BASE);
    versionAggregateMock.mockResolvedValueOnce({ _max: { versionNumber: 1 } });
    versionCreateMock.mockResolvedValueOnce({ id: "version-2" });

    await publishWebsiteAction(undefined, buildFormData());

    expect(versionCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ versionNumber: 2 }),
    });
    // La única escritura sobre versiones en esta llamada es el create de la v2 — nunca un update/delete de la v1.
    expect(versionCreateMock).toHaveBeenCalledTimes(1);
  });

  it("publishedVersionId queda apuntando a la versión recién creada, no a una anterior", async () => {
    membershipFindUniqueMock.mockResolvedValueOnce({ role: "WORKSPACE_ADMIN" });
    websiteUpsertMock.mockResolvedValueOnce(DRAFT_BASE);
    versionAggregateMock.mockResolvedValueOnce({ _max: { versionNumber: 4 } });
    versionCreateMock.mockResolvedValueOnce({ id: "version-5" });

    await publishWebsiteAction(undefined, buildFormData());

    expect(websiteUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ publishedVersionId: "version-5" }) }),
    );
  });

  it("el snapshot creado no incluye ningún dato de usuario más allá del id (publishedByUserId)", async () => {
    membershipFindUniqueMock.mockResolvedValueOnce({ role: "WORKSPACE_OWNER" });
    websiteUpsertMock.mockResolvedValueOnce(DRAFT_BASE);
    versionAggregateMock.mockResolvedValueOnce({ _max: { versionNumber: null } });
    versionCreateMock.mockResolvedValueOnce({ id: "version-1" });

    await publishWebsiteAction(undefined, buildFormData());

    const dataArg = versionCreateMock.mock.calls[0][0].data;
    expect(Object.keys(dataArg).sort()).toEqual(
      [
        "websiteId",
        "versionNumber",
        "heroTitle",
        "heroSubtitle",
        "seoTitle",
        "seoDescription",
        "navJson",
        "sectionsJson",
        "publishedByUserId",
        "publishedAt",
      ].sort(),
    );
    expect(dataArg.publishedByUserId).toBe(7);
  });

  it("STAFF no puede publicar", async () => {
    membershipFindUniqueMock.mockResolvedValueOnce({ role: "STAFF" });
    const result = await publishWebsiteAction(undefined, buildFormData());
    expect(result.error).toBe("No tenés permiso para publicar el sitio web.");
    expect(versionCreateMock).not.toHaveBeenCalled();
  });

  it("concurrencia: si el draft cambió desde que se cargó la pantalla, aborta sin publicar", async () => {
    membershipFindUniqueMock.mockResolvedValueOnce({ role: "WORKSPACE_OWNER" });
    websiteUpsertMock.mockResolvedValueOnce(DRAFT_BASE); // updatedAt real: 2026-08-19T10:00:00.000Z
    const result = await publishWebsiteAction(
      undefined,
      buildFormData({ draftUpdatedAt: "2026-08-19T09:00:00.000Z" }), // el que vio el usuario, viejo
    );
    expect(result.error).toContain("modificó el sitio mientras tanto");
    expect(versionCreateMock).not.toHaveBeenCalled();
    expect(websiteUpdateMock).not.toHaveBeenCalled();
  });

  it("sin draftUpdatedAt (primera publicación) no aplica el chequeo de concurrencia", async () => {
    membershipFindUniqueMock.mockResolvedValueOnce({ role: "WORKSPACE_OWNER" });
    websiteUpsertMock.mockResolvedValueOnce(DRAFT_BASE);
    versionAggregateMock.mockResolvedValueOnce({ _max: { versionNumber: null } });
    versionCreateMock.mockResolvedValueOnce({ id: "version-1" });
    const result = await publishWebsiteAction(undefined, buildFormData());
    expect(result.error).toBeNull();
  });

  it("aislamiento: el snapshot se crea con el websiteId del workspace activo, nunca uno arbitrario", async () => {
    membershipFindUniqueMock.mockResolvedValueOnce({ role: "WORKSPACE_OWNER" });
    websiteUpsertMock.mockResolvedValueOnce({ ...DRAFT_BASE, id: "website-a", workspaceId: "ws-a" });
    versionAggregateMock.mockResolvedValueOnce({ _max: { versionNumber: null } });
    versionCreateMock.mockResolvedValueOnce({ id: "version-1" });
    await publishWebsiteAction(undefined, buildFormData());
    expect(websiteUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: "ws-a" } }),
    );
    expect(versionAggregateMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { websiteId: "website-a" } }),
    );
  });
});

describe("unpublishWebsiteAction", () => {
  beforeEach(() => {
    membershipFindUniqueMock.mockReset();
    websiteUpdateMock.mockReset();
    websiteUpsertMock.mockReset();
    versionAggregateMock.mockReset();
    versionCreateMock.mockReset();
  });

  it("OWNER despublica: limpia publishedVersionId y publishedAt, nada más", async () => {
    membershipFindUniqueMock.mockResolvedValueOnce({ role: "WORKSPACE_OWNER" });
    websiteUpdateMock.mockResolvedValueOnce({});
    const result = await unpublishWebsiteAction(undefined, buildFormData());
    expect(result.error).toBeNull();
    expect(websiteUpdateMock).toHaveBeenCalledWith({
      where: { workspaceId: "ws-a" },
      data: { publishedVersionId: null, publishedAt: null },
    });
  });

  it("despublicar no borra ninguna versión — el update jamás toca FotofficeWorkspaceWebsiteVersion", async () => {
    membershipFindUniqueMock.mockResolvedValueOnce({ role: "WORKSPACE_OWNER" });
    websiteUpdateMock.mockResolvedValueOnce({});
    await unpublishWebsiteAction(undefined, buildFormData());
    expect(versionCreateMock).not.toHaveBeenCalled();
  });

  it("STAFF no puede despublicar", async () => {
    membershipFindUniqueMock.mockResolvedValueOnce({ role: "STAFF" });
    const result = await unpublishWebsiteAction(undefined, buildFormData());
    expect(result.error).toBe("No tenés permiso para despublicar el sitio web.");
    expect(websiteUpdateMock).not.toHaveBeenCalled();
  });
});

const VALID_BLOCK = {
  id: "blk-1",
  type: "SPACER",
  visible: true,
  order: 0,
  config: { sizePreset: "md" },
};

describe("saveWebsiteBlocksAction", () => {
  beforeEach(() => {
    membershipFindUniqueMock.mockReset();
    websiteUpdateManyMock.mockReset();
  });

  it("OWNER guarda bloques válidos: escribe sectionsJson.pages.home con updateMany guardado por updatedAt", async () => {
    membershipFindUniqueMock.mockResolvedValueOnce({ role: "WORKSPACE_OWNER" });
    websiteUpdateManyMock.mockResolvedValueOnce({ count: 1 });
    const result = await saveWebsiteBlocksAction(
      undefined,
      buildFormData({ blocksJson: JSON.stringify([VALID_BLOCK]), draftUpdatedAt: "2026-08-19T10:00:00.000Z" }),
    );
    expect(result.error).toBeNull();
    expect(websiteUpdateManyMock).toHaveBeenCalledWith({
      where: { workspaceId: "ws-a", updatedAt: new Date("2026-08-19T10:00:00.000Z") },
      data: { sectionsJson: { pages: { home: [VALID_BLOCK] } } },
    });
  });

  it("bloque con forma inválida se rechaza sin llegar a la DB", async () => {
    membershipFindUniqueMock.mockResolvedValueOnce({ role: "WORKSPACE_OWNER" });
    const result = await saveWebsiteBlocksAction(
      undefined,
      buildFormData({ blocksJson: JSON.stringify([{ type: "NOPE" }]), draftUpdatedAt: "2026-08-19T10:00:00.000Z" }),
    );
    expect(result.error).toBe("Los bloques enviados no tienen un formato válido.");
    expect(websiteUpdateManyMock).not.toHaveBeenCalled();
  });

  it("concurrencia: updateMany afecta 0 filas → conflicto informado, no se pisa en silencio", async () => {
    membershipFindUniqueMock.mockResolvedValueOnce({ role: "WORKSPACE_OWNER" });
    websiteUpdateManyMock.mockResolvedValueOnce({ count: 0 });
    const result = await saveWebsiteBlocksAction(
      undefined,
      buildFormData({ blocksJson: JSON.stringify([VALID_BLOCK]), draftUpdatedAt: "2026-08-19T09:00:00.000Z" }),
    );
    expect(result.error).toContain("modificó el sitio mientras tanto");
  });

  it("STAFF no puede guardar bloques", async () => {
    membershipFindUniqueMock.mockResolvedValueOnce({ role: "STAFF" });
    const result = await saveWebsiteBlocksAction(
      undefined,
      buildFormData({ blocksJson: "[]", draftUpdatedAt: "2026-08-19T10:00:00.000Z" }),
    );
    expect(result.error).toBe("No tenés permiso para editar el sitio web.");
    expect(websiteUpdateManyMock).not.toHaveBeenCalled();
  });
});

describe("saveWebsiteSeoAction", () => {
  beforeEach(() => {
    membershipFindUniqueMock.mockReset();
    websiteUpdateManyMock.mockReset();
  });

  it("OWNER guarda seoTitle/seoDescription en el draft", async () => {
    membershipFindUniqueMock.mockResolvedValueOnce({ role: "WORKSPACE_OWNER" });
    websiteUpdateManyMock.mockResolvedValueOnce({ count: 1 });
    const result = await saveWebsiteSeoAction(
      undefined,
      buildFormData({ seoTitle: "Mi sitio", seoDescription: "Descripción", draftUpdatedAt: "2026-08-19T10:00:00.000Z" }),
    );
    expect(result.error).toBeNull();
    expect(websiteUpdateManyMock).toHaveBeenCalledWith({
      where: { workspaceId: "ws-a", updatedAt: new Date("2026-08-19T10:00:00.000Z") },
      data: { seoTitle: "Mi sitio", seoDescription: "Descripción" },
    });
  });

  it("STAFF no puede guardar SEO", async () => {
    membershipFindUniqueMock.mockResolvedValueOnce({ role: "STAFF" });
    const result = await saveWebsiteSeoAction(undefined, buildFormData({ draftUpdatedAt: "2026-08-19T10:00:00.000Z" }));
    expect(result.error).toBe("No tenés permiso para editar el sitio web.");
    expect(websiteUpdateManyMock).not.toHaveBeenCalled();
  });
});

describe("saveWebsiteBrandingColorsAction", () => {
  beforeEach(() => {
    membershipFindUniqueMock.mockReset();
    brandingUpdateMock.mockReset();
  });

  it("OWNER guarda los 5 colores en FotofficeWorkspaceBranding (no en Website)", async () => {
    membershipFindUniqueMock.mockResolvedValueOnce({ role: "WORKSPACE_OWNER" });
    brandingUpdateMock.mockResolvedValueOnce({});
    const result = await saveWebsiteBrandingColorsAction(
      undefined,
      buildFormData({ primaryColor: "#112233", secondaryColor: "", backgroundColor: "", textColor: "", accentColor: "" }),
    );
    expect(result.error).toBeNull();
    expect(brandingUpdateMock).toHaveBeenCalledWith({
      where: { workspaceId: "ws-a" },
      data: { primaryColor: "#112233", secondaryColor: null, backgroundColor: null, textColor: null, accentColor: null },
    });
  });

  it("rechaza un color que no es hexadecimal válido", async () => {
    membershipFindUniqueMock.mockResolvedValueOnce({ role: "WORKSPACE_OWNER" });
    const result = await saveWebsiteBrandingColorsAction(
      undefined,
      buildFormData({ primaryColor: "azul", secondaryColor: "", backgroundColor: "", textColor: "", accentColor: "" }),
    );
    expect(result.error).toContain("hexadecimal");
    expect(brandingUpdateMock).not.toHaveBeenCalled();
  });

  it("STAFF no puede guardar el diseño", async () => {
    membershipFindUniqueMock.mockResolvedValueOnce({ role: "STAFF" });
    const result = await saveWebsiteBrandingColorsAction(undefined, buildFormData());
    expect(result.error).toBe("No tenés permiso para editar el sitio web.");
    expect(brandingUpdateMock).not.toHaveBeenCalled();
  });
});
