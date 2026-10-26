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
  it("reconoce los artículos importados por sus redirecciones y sólo mira los borradores", async () => {
    m.redireccion.findMany.mockResolvedValueOnce([{ hacia: "/blog/a" }, { hacia: "/blog/a" }, { hacia: "/blog/b" }]);
    m.blogPost.findMany.mockResolvedValueOnce([{ id: 1 }]);
    expect(await contarBorradoresImportados("ws")).toBe(1);
    expect(m.redireccion.findMany.mock.calls[0][0].where).toEqual({ workspaceId: "ws", origen: "alboom-prosite", hacia: { startsWith: "/blog/" } });
    expect(m.blogPost.findMany.mock.calls[0][0].where).toEqual({ platform: "fotoffice", workspaceKey: "ws", status: "DRAFT", slug: { in: ["a", "b"] } });
  });

  it("sin la tabla de redirecciones no hay nada importado", async () => {
    m.redireccion.findMany.mockRejectedValueOnce(Object.assign(new Error("x"), { code: "P2021" }));
    expect(await contarBorradoresImportados("ws")).toBe(0);
    expect(m.blogPost.findMany).not.toHaveBeenCalled();
  });

  it("publica cada borrador importado sin tocar su fecha", async () => {
    m.redireccion.findMany.mockResolvedValueOnce([{ hacia: "/blog/a" }]);
    m.blogPost.findMany.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);
    m.updateBlogPost.mockResolvedValue({ id: 1 });
    expect(await publicarBorradoresImportados("ws")).toBe(2);
    expect(m.updateBlogPost).toHaveBeenCalledWith("ws", 1, { status: "PUBLISHED" });
  });
});
