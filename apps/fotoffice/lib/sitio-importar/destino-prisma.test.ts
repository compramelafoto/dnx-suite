import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  blogPost: { findFirst: vi.fn(), updateMany: vi.fn() },
  blogMedia: { findFirst: vi.fn(), create: vi.fn() },
  trabajo: { findFirst: vi.fn() },
  foto: { findMany: vi.fn() },
  redireccion: { createMany: vi.fn() },
  website: { update: vi.fn() },
  createBlogPost: vi.fn(),
  crearTrabajo: vi.fn(),
  crearTestimonioImportado: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    blogPost: m.blogPost,
    blogMedia: m.blogMedia,
    fotofficeTrabajo: m.trabajo,
    fotofficeTrabajoFoto: m.foto,
    fotofficeSitioRedireccion: m.redireccion,
    fotofficeWorkspaceWebsite: m.website,
  },
}));
vi.mock("@/lib/blog/admin-queries", () => ({ createBlogPost: m.createBlogPost }));
vi.mock("@/lib/trabajos/repositorio", () => ({ crearTrabajo: m.crearTrabajo, agregarFotos: vi.fn(), crearCategoria: vi.fn(), publicarTrabajo: vi.fn() }));
vi.mock("@/lib/testimonios/repositorio", () => ({ crearTestimonioImportado: m.crearTestimonioImportado }));
vi.mock("@/lib/website/draft", () => ({ ensureWebsiteDraft: vi.fn() }));

const { crearDestinoPrisma } = await import("./destino-prisma");
const WS = "cmv5z6qxwwmmhf0q5gp8qja1j";
const destino = crearDestinoPrisma(WS);
const enBlog = { platform: "fotoffice", workspaceKey: WS };

beforeEach(() => vi.clearAllMocks());

describe("crearDestinoPrisma", () => {
  it("el artículo se crea con el motor del blog y después se le pone la fecha de Alboom", async () => {
    m.createBlogPost.mockResolvedValueOnce({ id: 7 });
    const createdAt = new Date("2024-01-27T22:36:00Z");
    const data = { title: "Nos mudamos a Funes!", slug: "nos-mudamos" } as never;
    expect(await destino.crearArticulo({ data, createdAt })).toEqual({ id: 7 });
    expect(m.createBlogPost).toHaveBeenCalledWith(WS, data);
    expect(m.blogPost.updateMany).toHaveBeenCalledWith({ where: { id: 7, ...enBlog }, data: { createdAt } });
  });

  it("busca artículos e imágenes sólo en el blog de la institución", async () => {
    m.blogPost.findFirst.mockResolvedValueOnce(null);
    await destino.articuloPorSlug("x");
    expect(m.blogPost.findFirst.mock.calls[0][0].where).toEqual({ ...enBlog, slug: "x" });
    m.blogMedia.findFirst.mockResolvedValueOnce({ id: 1 });
    expect(await destino.registrarMediaBlog({ url: "u", r2Key: "k", filename: "f", mimeType: "image/jpeg", sizeBytes: 1 })).toBe(false);
    expect(m.blogMedia.create).not.toHaveBeenCalled();
  });

  it("los trabajos se marcan y se buscan por su origen de Alboom", async () => {
    m.crearTrabajo.mockResolvedValueOnce({ ok: true, valor: { id: "t1" } });
    await destino.crearTrabajo({ titulo: "Emma", slug: "emma", categoriaId: null, lugar: null, fecha: null, descripcionHtml: null, destacado: false, origenExternoId: "1465286" });
    expect(m.crearTrabajo.mock.calls[0][1]).toMatchObject({ origenExterno: "alboom-prosite", origenExternoId: "1465286", slug: "emma" });

    m.trabajo.findFirst.mockResolvedValueOnce({ id: "t1", slug: "emma", categoriaId: null, portadaUrl: null });
    m.foto.findMany.mockResolvedValueOnce([{ origenUrl: "https://a/1.jpg", url: "https://r2/1.jpg" }, { origenUrl: null, url: "https://youtu.be/x" }]);
    expect(await destino.trabajoPorOrigen("1465286")).toMatchObject({ id: "t1", origenesFotos: ["https://a/1.jpg", "https://youtu.be/x"] });
    expect(m.trabajo.findFirst.mock.calls[0][0].where).toEqual({ workspaceId: WS, origenExterno: "alboom-prosite", origenExternoId: "1465286" });
  });

  it("un trabajo que el repositorio rechaza es un error", async () => {
    m.crearTrabajo.mockResolvedValueOnce({ ok: false, error: "Ya hay otro trabajo con esa dirección" });
    await expect(
      destino.crearTrabajo({ titulo: "X", slug: "x", categoriaId: null, lugar: null, fecha: null, descripcionHtml: null, destacado: false, origenExternoId: "1" }),
    ).rejects.toThrow("Ya hay otro trabajo con esa dirección");
  });

  it("las redirecciones se crean sin pisar las que ya están", async () => {
    m.redireccion.createMany.mockResolvedValueOnce({ count: 1 });
    expect(await destino.crearRedirecciones([{ desde: "/sobre", hacia: "/quien-soy", codigo: 301 }], "alboom-prosite")).toBe(1);
    expect(m.redireccion.createMany).toHaveBeenCalledWith({
      data: [{ workspaceId: WS, desde: "/sobre", hacia: "/quien-soy", codigo: 301, origen: "alboom-prosite" }],
      skipDuplicates: true,
    });
  });

  it("escribe sólo el borrador del sitio", async () => {
    await destino.guardarBorrador({ navJson: { version: 2, items: [] } });
    expect(m.website.update).toHaveBeenCalledWith({ where: { workspaceId: WS }, data: { navJson: { version: 2, items: [] } } });
  });
});
