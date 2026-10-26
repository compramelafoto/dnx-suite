import { beforeEach, describe, expect, it, vi } from "vitest";

const { trabajo, categoria, foto } = vi.hoisted(() => ({
  trabajo: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
  categoria: { findMany: vi.fn(), findFirst: vi.fn() },
  foto: { findMany: vi.fn() },
}));

vi.mock("@repo/db", () => ({
  prisma: {
    fotofficeTrabajo: trabajo,
    fotofficeTrabajoCategoria: categoria,
    fotofficeTrabajoFoto: foto,
  },
}));

const { listarTrabajosPublicos, obtenerTrabajoPublico, listarCategoriasPublicas } = await import("./publico");

const cat = { id: "c1", nombre: "Casamientos", slug: "casamientos", orden: 0, visible: true, portadaUrl: null };
const fila = (over: Record<string, unknown> = {}) => ({
  id: "t1",
  titulo: "Boda de Sofi",
  slug: "boda-de-sofi",
  lugar: "Rosario",
  fecha: new Date("2025-03-14T00:00:00.000Z"),
  portadaUrl: "https://cdn/x.jpg",
  categoriaId: "c1",
  ...over,
});

function p2021() {
  return Object.assign(new Error("tabla inexistente"), { code: "P2021" });
}

beforeEach(() => {
  for (const m of [trabajo, categoria, foto]) for (const f of Object.values(m)) f.mockReset();
});

describe("listarTrabajosPublicos", () => {
  it("filtra por workspace, PUBLICADO y categoría visible; ordena por fecha desc y orden asc", async () => {
    categoria.findMany.mockResolvedValueOnce([cat]);
    trabajo.findMany.mockResolvedValueOnce([fila()]);
    trabajo.count.mockResolvedValueOnce(1);
    const r = await listarTrabajosPublicos("ws-1", { base: "/w/sfpr" });
    const where = trabajo.findMany.mock.calls[0][0].where;
    expect(where.workspaceId).toBe("ws-1");
    expect(where.estado).toBe("PUBLICADO");
    expect(where.categoriaId).toEqual({ in: ["c1"] });
    expect(trabajo.findMany.mock.calls[0][0].orderBy).toEqual([{ fecha: { sort: "desc", nulls: "last" } }, { orden: "asc" }]);
    expect(categoria.findMany.mock.calls[0][0].where).toMatchObject({ workspaceId: "ws-1", visible: true });
    expect(r.total).toBe(1);
    expect(r.trabajos[0]).toEqual({
      titulo: "Boda de Sofi",
      slug: "boda-de-sofi",
      categoriaSlug: "casamientos",
      categoriaNombre: "Casamientos",
      lugar: "Rosario",
      fechaTexto: "14 de marzo de 2025",
      portadaUrl: "https://cdn/x.jpg",
      href: "/w/sfpr/trabajos/casamientos/boda-de-sofi",
    });
  });

  it("un trabajo sin categoría o con categoría oculta no se lista", async () => {
    categoria.findMany.mockResolvedValueOnce([cat]); // la oculta no vuelve de la consulta
    trabajo.findMany.mockResolvedValueOnce([fila(), fila({ id: "t2", categoriaId: null }), fila({ id: "t3", categoriaId: "oculta" })]);
    trabajo.count.mockResolvedValueOnce(1);
    const r = await listarTrabajosPublicos("ws-1");
    expect(r.trabajos).toHaveLength(1);
  });

  it("pide una categoría por slug y sólo destacados cuando se indica", async () => {
    categoria.findMany.mockResolvedValueOnce([cat]);
    trabajo.findMany.mockResolvedValueOnce([]);
    trabajo.count.mockResolvedValueOnce(0);
    await listarTrabajosPublicos("ws-1", { categoriaSlug: "casamientos", soloDestacados: true, limite: 6, pagina: 2 });
    expect(categoria.findMany.mock.calls[0][0].where.slug).toBe("casamientos");
    const arg = trabajo.findMany.mock.calls[0][0];
    expect(arg.where.destacado).toBe(true);
    expect(arg.take).toBe(6);
    expect(arg.skip).toBe(6);
  });

  it("sin categorías visibles no consulta trabajos", async () => {
    categoria.findMany.mockResolvedValueOnce([]);
    expect(await listarTrabajosPublicos("ws-1")).toEqual({ trabajos: [], total: 0 });
    expect(trabajo.findMany).not.toHaveBeenCalled();
  });

  it("P2021 (tabla sin crear) devuelve vacío", async () => {
    categoria.findMany.mockRejectedValueOnce(p2021());
    expect(await listarTrabajosPublicos("ws-1")).toEqual({ trabajos: [], total: 0 });
  });

  it("otros errores se propagan", async () => {
    categoria.findMany.mockRejectedValueOnce(new Error("boom"));
    await expect(listarTrabajosPublicos("ws-1")).rejects.toThrow("boom");
  });
});

describe("obtenerTrabajoPublico", () => {
  it("borrador, categoría oculta o inexistente: null", async () => {
    categoria.findFirst.mockResolvedValueOnce(null);
    expect(await obtenerTrabajoPublico("ws-1", "casamientos", "x")).toBeNull();
    categoria.findFirst.mockResolvedValueOnce(cat);
    trabajo.findFirst.mockResolvedValueOnce(null);
    expect(await obtenerTrabajoPublico("ws-1", "casamientos", "x")).toBeNull();
    expect(trabajo.findFirst.mock.calls[0][0].where).toMatchObject({
      workspaceId: "ws-1",
      slug: "x",
      estado: "PUBLICADO",
      categoriaId: "c1",
    });
    expect(categoria.findFirst.mock.calls[0][0].where).toMatchObject({ workspaceId: "ws-1", slug: "casamientos", visible: true });
  });

  it("devuelve fotos ordenadas y 3 relacionados que excluyen el propio", async () => {
    categoria.findFirst.mockResolvedValueOnce(cat);
    trabajo.findFirst.mockResolvedValueOnce({
      ...fila(),
      descripcionHtml: "<p>hola</p>",
      seoTitle: null,
      seoDescription: null,
    });
    foto.findMany.mockResolvedValueOnce([
      { id: "f1", tipo: "FOTO", url: "u1", ancho: 100, alto: 50, alt: "a" },
    ]);
    trabajo.findMany.mockResolvedValueOnce([fila({ id: "t2", slug: "otra", titulo: "Otra" })]);
    const r = await obtenerTrabajoPublico("ws-1", "casamientos", "boda-de-sofi", { base: "/w/sfpr" });
    expect(foto.findMany.mock.calls[0][0]).toMatchObject({ where: { trabajoId: "t1", workspaceId: "ws-1" }, orderBy: [{ orden: "asc" }, { createdAt: "asc" }] });
    const rel = trabajo.findMany.mock.calls[0][0];
    expect(rel.where).toMatchObject({ workspaceId: "ws-1", estado: "PUBLICADO", categoriaId: "c1", id: { not: "t1" } });
    expect(rel.take).toBe(3);
    expect(r?.fotos).toHaveLength(1);
    expect(r?.relacionados[0].href).toBe("/w/sfpr/trabajos/casamientos/otra");
    expect(r?.categoriaNombre).toBe("Casamientos");
    expect(r?.fechaTexto).toBe("14 de marzo de 2025");
  });

  it("P2021 devuelve null", async () => {
    categoria.findFirst.mockRejectedValueOnce(p2021());
    expect(await obtenerTrabajoPublico("ws-1", "a", "b")).toBeNull();
  });
});

describe("listarCategoriasPublicas", () => {
  it("sólo visibles del workspace, por orden", async () => {
    categoria.findMany.mockResolvedValueOnce([cat]);
    const r = await listarCategoriasPublicas("ws-1");
    expect(categoria.findMany.mock.calls[0][0]).toMatchObject({
      where: { workspaceId: "ws-1", visible: true },
      orderBy: [{ orden: "asc" }, { nombre: "asc" }],
    });
    expect(r).toEqual([{ nombre: "Casamientos", slug: "casamientos", portadaUrl: null }]);
  });

  it("P2021 devuelve vacío", async () => {
    categoria.findMany.mockRejectedValueOnce(p2021());
    expect(await listarCategoriasPublicas("ws-1")).toEqual([]);
  });
});
