import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  redireccion: { findMany: vi.fn() },
  blogPost: { findMany: vi.fn() },
  updateBlogPost: vi.fn(),
}));
vi.mock("@repo/db", () => ({ prisma: { fotofficeSitioRedireccion: m.redireccion, blogPost: m.blogPost } }));
vi.mock("./admin-queries", () => ({ updateBlogPost: m.updateBlogPost }));

const { contarBorradoresImportados, publicarBorradoresImportados } = await import("./importados");

beforeEach(() => vi.clearAllMocks());

describe("contenido importado del blog", () => {
  it("sólo cuenta los artículos que creó el importador (por id), y sólo si siguen en borrador", async () => {
    m.redireccion.findMany.mockResolvedValueOnce([{ origen: "alboom-prosite:post=7" }, { origen: "alboom-prosite:post=7" }, { origen: "alboom-prosite:post=9" }]);
    m.blogPost.findMany.mockResolvedValueOnce([{ id: 7 }]);
    expect(await contarBorradoresImportados("ws")).toBe(1);
    expect(m.redireccion.findMany.mock.calls[0][0].where).toEqual({ workspaceId: "ws", origen: { startsWith: "alboom-prosite:post=" } });
    // Por id: un borrador que ya existía con el mismo slug no entra.
    expect(m.blogPost.findMany.mock.calls[0][0].where).toEqual({ platform: "fotoffice", workspaceKey: "ws", status: "DRAFT", id: { in: [7, 9] } });
  });

  it("sin la tabla de redirecciones no hay nada importado", async () => {
    m.redireccion.findMany.mockRejectedValueOnce(Object.assign(new Error("x"), { code: "P2021" }));
    expect(await contarBorradoresImportados("ws")).toBe(0);
    expect(m.blogPost.findMany).not.toHaveBeenCalled();
  });

  it("publica cada borrador importado sin tocar su fecha", async () => {
    m.redireccion.findMany.mockResolvedValueOnce([{ origen: "alboom-prosite:post=1" }, { origen: "alboom-prosite:post=2" }]);
    m.blogPost.findMany.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);
    m.updateBlogPost.mockResolvedValue({ id: 1 });
    expect(await publicarBorradoresImportados("ws")).toBe(2);
    expect(m.updateBlogPost).toHaveBeenCalledWith("ws", 1, { status: "PUBLISHED" });
  });
});
