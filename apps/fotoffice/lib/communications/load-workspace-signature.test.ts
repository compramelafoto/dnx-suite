import { beforeEach, describe, expect, it, vi } from "vitest";

const { brandingFindUniqueMock, workspaceFindUniqueMock } = vi.hoisted(() => ({
  brandingFindUniqueMock: vi.fn(),
  workspaceFindUniqueMock: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    fotofficeWorkspaceBranding: { findUnique: brandingFindUniqueMock },
    workspace: { findUnique: workspaceFindUniqueMock },
  },
}));

const { loadWorkspaceEmailContext } = await import("./load-workspace-signature");

const BRANDING = {
  commercialName: "Club SFPR",
  logoUrl: null,
  contactEmail: "info@sfpr.test",
  phone: null,
  whatsapp: null,
  instagram: null,
  website: null,
  city: null,
  accentColor: null,
  emailSignatureNote: null,
};

beforeEach(() => {
  brandingFindUniqueMock.mockReset();
  workspaceFindUniqueMock.mockReset();
});

describe("contexto de email del workspace", () => {
  it("usa el nombre comercial y devuelve la firma renderizada", async () => {
    brandingFindUniqueMock.mockResolvedValue(BRANDING);
    workspaceFindUniqueMock.mockResolvedValue({ name: "workspace-interno" });

    const ctx = await loadWorkspaceEmailContext("ws-sfpr");
    expect(ctx.organizationName).toBe("Club SFPR");
    expect(ctx.signature?.html).toContain("Club SFPR");
    expect(ctx.signature?.text).toContain("Club SFPR");
  });

  it("cae al nombre del workspace si no hay nombre comercial", async () => {
    brandingFindUniqueMock.mockResolvedValue({ ...BRANDING, commercialName: null });
    workspaceFindUniqueMock.mockResolvedValue({ name: "Sociedad de Fotógrafos" });

    const ctx = await loadWorkspaceEmailContext("ws-sfpr");
    expect(ctx.organizationName).toBe("Sociedad de Fotógrafos");
  });

  /**
   * Sin branding el email sale sin firma en vez de fallar, igual que en el flujo de cursos:
   * una prueba de configuración tiene que poder correrse justamente cuando falta cargar algo.
   */
  it("sin branding devuelve firma nula pero nombre utilizable", async () => {
    brandingFindUniqueMock.mockResolvedValue(null);
    workspaceFindUniqueMock.mockResolvedValue({ name: "Estudio Nuevo" });

    const ctx = await loadWorkspaceEmailContext("ws-nuevo");
    expect(ctx.signature).toBeNull();
    expect(ctx.organizationName).toBe("Estudio Nuevo");
  });

  it("si tampoco hay workspace usa el nombre del producto", async () => {
    brandingFindUniqueMock.mockResolvedValue(null);
    workspaceFindUniqueMock.mockResolvedValue(null);

    const ctx = await loadWorkspaceEmailContext("ws-fantasma");
    expect(ctx.organizationName).toBe("FotoOffice");
  });

  it("nunca devuelve el identificador del workspace como nombre", async () => {
    brandingFindUniqueMock.mockResolvedValue({ ...BRANDING, commercialName: "   " });
    workspaceFindUniqueMock.mockResolvedValue({ name: "  " });

    const ctx = await loadWorkspaceEmailContext("ws-abc123");
    expect(ctx.organizationName).not.toContain("ws-abc123");
    expect(ctx.organizationName).toBe("FotoOffice");
  });
});
