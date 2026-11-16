import { beforeEach, describe, expect, it, vi } from "vitest";

const { rubro, etiqueta, trabajo, categoria, website, tx, sitio } = vi.hoisted(() => ({
  rubro: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), aggregate: vi.fn() },
  etiqueta: { findMany: vi.fn(), findFirst: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn() },
  trabajo: { findMany: vi.fn(), findFirst: vi.fn() },
  categoria: { findMany: vi.fn() },
  website: { findUnique: vi.fn() },
  tx: vi.fn(),
  sitio: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({
  prisma: {
    fotofficePortfolioRubro: rubro,
    fotofficeTrabajoPortfolio: etiqueta,
    fotofficeTrabajo: trabajo,
    fotofficeTrabajoCategoria: categoria,
    fotofficeWorkspaceWebsite: website,
    $transaction: tx,
  },
}));
vi.mock("@/lib/presupuestos/sitio", () => ({ sitioDelWorkspace: sitio }));
vi.mock("@/lib/trabajos/publico", () => ({ miniaturasDePortadas: async () => new Map([["https://r2/a.jpg", "https://r2/a-mini.webp"]]) }));
vi.mock("@/lib/app-url", () => ({ appUrl: () => "https://fotoffice.com" }));

const { crearRubro, guardarEtiquetas, borrarRubro, cargarPortfoliosDelEstudio, listarRubros } = await import("./repositorio");

const faltaTabla = Object.assign(new Error("no existe"), { code: "P2021" });

beforeEach(() => {
  for (const m of [rubro, etiqueta, trabajo, categoria, website]) for (const f of Object.values(m)) f.mockReset();
  tx.mockReset();
  tx.mockImplementation(async (ops: unknown[]) => ops);
  sitio.mockReset();
  sitio.mockResolvedValue({ slug: "dnx-estudio", customDomain: null });
});

describe("crearRubro", () => {
  it("nombre repetido → aviso claro", async () => {
    rubro.aggregate.mockResolvedValueOnce({ _max: { orden: 2 } });
    rubro.create.mockRejectedValueOnce(Object.assign(new Error("dup"), { code: "P2002" }));
    expect(await crearRubro("ws-1", "XV")).toEqual({ ok: false, error: "Ya hay un rubro con ese nombre." });
  });
  it("lo pone al final", async () => {
    rubro.aggregate.mockResolvedValueOnce({ _max: { orden: 2 } });
    rubro.create.mockImplementationOnce(async ({ data }) => ({ id: "r1", ...data }));
    const r = await crearRubro("ws-1", " Bodas ");
    expect(rubro.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ workspaceId: "ws-1", nombre: "Bodas", orden: 3 }) }));
    expect(r).toMatchObject({ ok: true, valor: { id: "r1", nombre: "Bodas", enlaces: [] } });
  });
  it("nombre vacío → error sin escribir", async () => {
    expect((await crearRubro("ws-1", "  ")).ok).toBe(false);
    expect(rubro.create).not.toHaveBeenCalled();
  });
});

describe("guardarEtiquetas", () => {
  it("rubro de otro workspace → error y no escribe", async () => {
    trabajo.findFirst.mockResolvedValueOnce({ id: "t1" });
    rubro.findFirst.mockResolvedValueOnce(null);
    const r = await guardarEtiquetas("ws-1", "t1", { rubroId: "ajeno", estilos: ["Fiesta"] });
    expect(r.ok).toBe(false);
    expect(etiqueta.upsert).not.toHaveBeenCalled();
    expect(rubro.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "ajeno", workspaceId: "ws-1" } }));
  });
  it("sin rubro ni estilos → borra la fila", async () => {
    trabajo.findFirst.mockResolvedValueOnce({ id: "t1" });
    const r = await guardarEtiquetas("ws-1", "t1", { rubroId: "", estilos: [] });
    expect(r.ok).toBe(true);
    expect(etiqueta.deleteMany).toHaveBeenCalledWith({ where: { workspaceId: "ws-1", trabajoId: "t1" } });
    expect(etiqueta.upsert).not.toHaveBeenCalled();
  });
  it("guarda estilos normalizados", async () => {
    trabajo.findFirst.mockResolvedValueOnce({ id: "t1" });
    rubro.findFirst.mockResolvedValueOnce({ id: "r1" });
    await guardarEtiquetas("ws-1", "t1", { rubroId: "r1", estilos: ["Fiesta", " fiesta "] });
    expect(etiqueta.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { trabajoId: "t1" }, create: expect.objectContaining({ workspaceId: "ws-1", rubroId: "r1", estilos: ["Fiesta"] }) }),
    );
  });
  it("trabajo de otro workspace → error", async () => {
    trabajo.findFirst.mockResolvedValueOnce(null);
    expect((await guardarEtiquetas("ws-1", "t1", { rubroId: "r1", estilos: [] })).ok).toBe(false);
  });
});

describe("borrarRubro", () => {
  it("deja sus trabajos sin rubro y lo borra", async () => {
    rubro.findFirst.mockResolvedValueOnce({ id: "r1" });
    expect((await borrarRubro("ws-1", "r1")).ok).toBe(true);
    expect(etiqueta.updateMany).toHaveBeenCalledWith({ where: { workspaceId: "ws-1", rubroId: "r1" }, data: { rubroId: null } });
    expect(rubro.delete).toHaveBeenCalledWith({ where: { id: "r1" } });
  });
});

describe("listarRubros / cargarPortfoliosDelEstudio", () => {
  it("con la tabla faltante → FALTAN_TABLAS", async () => {
    rubro.findMany.mockRejectedValue(faltaTabla);
    expect(await listarRubros("ws-1")).toBe("FALTAN_TABLAS");
    expect(await cargarPortfoliosDelEstudio("ws-1", { incluirNoCompartibles: true })).toBe("FALTAN_TABLAS");
  });

  function escenario() {
    rubro.findMany.mockResolvedValue([{ id: "xv", nombre: "XV", orden: 0, enlacesJson: [{ titulo: "Presentación", url: "https://a.com/xv" }, { titulo: "mal", url: "http://x" }] }]);
    categoria.findMany.mockResolvedValue([
      { id: "c1", slug: "fiestas-de-xv", visible: true },
      { id: "c2", slug: "oculta", visible: false },
    ]);
    trabajo.findMany.mockResolvedValue([
      { id: "t1", titulo: "Fiesta Lupe", slug: "lupe", lugar: "Rosario", fecha: null, destacado: false, portadaUrl: "https://r2/a.jpg", estado: "PUBLICADO", categoriaId: "c1" },
      { id: "t2", titulo: "Borrador", slug: "b", lugar: null, fecha: null, destacado: false, portadaUrl: null, estado: "BORRADOR", categoriaId: "c1" },
      { id: "t3", titulo: "Oculto", slug: "o", lugar: null, fecha: null, destacado: false, portadaUrl: null, estado: "PUBLICADO", categoriaId: "c2" },
      { id: "t4", titulo: "Suelto", slug: "s", lugar: null, fecha: null, destacado: false, portadaUrl: null, estado: "PUBLICADO", categoriaId: "c1" },
    ]);
    etiqueta.findMany.mockResolvedValue([
      { trabajoId: "t1", rubroId: "xv", estilos: ["Fiesta"] },
      { trabajoId: "t2", rubroId: "xv", estilos: ["Fiesta"] },
      { trabajoId: "t3", rubroId: null, estilos: [] },
    ]);
    website.findUnique.mockResolvedValue({ publishedAt: new Date("2026-11-07") });
  }

  it("para la vendedora: sólo lo compartible, ni en grupos ni en sin etiquetar", async () => {
    escenario();
    const r = await cargarPortfoliosDelEstudio("ws-1", { incluirNoCompartibles: false });
    if (r === "FALTAN_TABLAS") throw new Error("no");
    const t1 = r.grupos[0].estilos[0].trabajos[0];
    expect(r.grupos[0].estilos.flatMap((e) => e.trabajos.map((x) => x.id))).toEqual(["t1"]);
    expect(t1).toMatchObject({ url: "https://fotoffice.com/w/dnx-estudio/trabajos/fiestas-de-xv/lupe", portadaUrl: "https://r2/a-mini.webp", compartible: true });
    expect(r.sinEtiquetar.map((x) => x.id)).toEqual(["t4"]);
    expect(r.rubros[0].enlaces).toEqual([{ titulo: "Presentación", url: "https://a.com/xv" }]);
  });

  it("para quien edita: también los no compartibles, con su motivo", async () => {
    escenario();
    const r = await cargarPortfoliosDelEstudio("ws-1", { incluirNoCompartibles: true });
    if (r === "FALTAN_TABLAS") throw new Error("no");
    const borr = r.grupos[0].estilos[0].trabajos.find((x) => x.id === "t2");
    expect(borr).toMatchObject({ compartible: false, motivo: "Es un borrador" });
    expect(r.sinEtiquetar.find((x) => x.id === "t3")).toMatchObject({ motivo: "Su categoría está oculta en el sitio" });
  });

  it("sitio sin publicar → nada es compartible", async () => {
    escenario();
    website.findUnique.mockResolvedValue({ publishedAt: null });
    const r = await cargarPortfoliosDelEstudio("ws-1", { incluirNoCompartibles: false });
    if (r === "FALTAN_TABLAS") throw new Error("no");
    expect(r.grupos[0].total).toBe(0);
    expect(r.sinEtiquetar).toEqual([]);
  });
});
