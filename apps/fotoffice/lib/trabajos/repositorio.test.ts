import { beforeEach, describe, expect, it, vi } from "vitest";

const { trabajo, foto, categoria, borrarR2, tx } = vi.hoisted(() => ({
  trabajo: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), updateMany: vi.fn() },
  foto: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn(), delete: vi.fn() },
  categoria: { findFirst: vi.fn() },
  borrarR2: vi.fn(),
  tx: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    fotofficeTrabajo: trabajo,
    fotofficeTrabajoFoto: foto,
    fotofficeTrabajoCategoria: categoria,
    $transaction: tx,
  },
}));
vi.mock("@repo/content", () => ({ sanitizeContentHtml: (h: string) => h.replace(/<script.*?<\/script>/g, "") }));
vi.mock("@/lib/images/r2-client", () => ({ deleteFotofficeR2Object: borrarR2 }));

const { crearTrabajo, editarTrabajo, agregarFotos, borrarTrabajo, borrarFoto } = await import("./repositorio");
const P = "fotoffice/site-trabajos/ws-1/t1/";

beforeEach(() => {
  for (const m of [trabajo, foto, categoria]) for (const f of Object.values(m)) f.mockReset();
  borrarR2.mockReset();
  tx.mockReset();
});

describe("crearTrabajo", () => {
  it("arma la dirección del título, la hace única y sanea el HTML", async () => {
    trabajo.findMany.mockResolvedValueOnce([{ slug: "boda-de-sofi" }]);
    trabajo.create.mockImplementationOnce(async ({ data }) => data);
    const r = await crearTrabajo("ws-1", { titulo: "Boda de Sofi", descripcionHtml: "<p>a</p><script>x</script>" });
    expect(r).toMatchObject({ ok: true, valor: { workspaceId: "ws-1", slug: "boda-de-sofi-2", descripcionHtml: "<p>a</p>" } });
  });

  it("rechaza una categoría de otro workspace", async () => {
    categoria.findFirst.mockResolvedValueOnce(null);
    const r = await crearTrabajo("ws-1", { titulo: "X", categoriaId: "ajena" });
    expect(r.ok).toBe(false);
    expect(categoria.findFirst.mock.calls[0][0].where).toEqual({ id: "ajena", workspaceId: "ws-1" });
    expect(trabajo.create).not.toHaveBeenCalled();
  });
});

describe("agregarFotos", () => {
  it("no pasa de 300 fotos por trabajo", async () => {
    trabajo.findFirst.mockResolvedValueOnce({ portadaUrl: null });
    foto.count.mockResolvedValueOnce(299);
    const r = await agregarFotos("ws-1", "t1", [{ url: "a" }, { url: "b" }]);
    expect(r.ok).toBe(false);
    expect(foto.createMany).not.toHaveBeenCalled();
  });

  it("la primera foto queda de portada si no había", async () => {
    trabajo.findFirst.mockResolvedValueOnce({ portadaUrl: null });
    foto.count.mockResolvedValueOnce(0);
    foto.findFirst.mockResolvedValueOnce(null);
    await agregarFotos("ws-1", "t1", [{ url: "https://cdn/a.jpg" }]);
    expect(trabajo.update).toHaveBeenCalledWith({ where: { id: "t1" }, data: { portadaUrl: "https://cdn/a.jpg" } });
  });
});

describe("borrarTrabajo", () => {
  it("borra en la base y en R2, e informa las keys que R2 no pudo borrar", async () => {
    trabajo.findFirst.mockResolvedValueOnce({ id: "t1" });
    foto.findMany.mockResolvedValueOnce([{ r2Key: P + "a.jpg" }, { r2Key: null }, { r2Key: P + "b.jpg" }]);
    tx.mockResolvedValueOnce([]);
    borrarR2.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false });
    const r = await borrarTrabajo("ws-1", "t1");
    expect(borrarR2).toHaveBeenCalledTimes(2);
    expect(r).toEqual({ ok: true, valor: { huerfanas: [P + "b.jpg"] } });
  });

  it("no toca un trabajo de otro workspace", async () => {
    trabajo.findFirst.mockResolvedValueOnce(null);
    expect((await borrarTrabajo("ws-1", "ajeno")).ok).toBe(false);
    expect(tx).not.toHaveBeenCalled();
  });
});

describe("claves de R2 y direcciones", () => {
  it("rechaza una key de otro workspace, de otro trabajo o sin prefijo", async () => {
    for (const r2Key of ["fotoffice/site-trabajos/ws-2/t1/a.jpg", "fotoffice/site-trabajos/ws-1/t9/a.jpg", "fotoffice/blog-hero/a.jpg", P + "../x.jpg"]) {
      trabajo.findFirst.mockResolvedValueOnce({ portadaUrl: "x" });
      const r = await agregarFotos("ws-1", "t1", [{ url: "https://cdn/a.jpg", r2Key }]);
      expect(r.ok).toBe(false);
    }
    expect(foto.createMany).not.toHaveBeenCalled();
  });

  it("rechaza una url que no es https", async () => {
    trabajo.findFirst.mockResolvedValueOnce({ portadaUrl: "x" });
    expect((await agregarFotos("ws-1", "t1", [{ url: "javascript:alert(1)" }])).ok).toBe(false);
  });

  it("acepta una key del propio trabajo", async () => {
    trabajo.findFirst.mockResolvedValueOnce({ portadaUrl: "x" });
    foto.count.mockResolvedValueOnce(0);
    foto.findFirst.mockResolvedValueOnce(null);
    expect((await agregarFotos("ws-1", "t1", [{ url: "https://cdn/a.jpg", r2Key: P + "a.jpg" }])).ok).toBe(true);
  });

  it("borrarTrabajo no borra de R2 una key de otra institución", async () => {
    trabajo.findFirst.mockResolvedValueOnce({ id: "t1" });
    foto.findMany.mockResolvedValueOnce([{ r2Key: "fotoffice/site-trabajos/ws-2/t5/a.jpg" }]);
    tx.mockResolvedValueOnce([]);
    const r = await borrarTrabajo("ws-1", "t1");
    expect(borrarR2).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: true, valor: { huerfanas: ["fotoffice/site-trabajos/ws-2/t5/a.jpg"] } });
  });
});

describe("borrarFoto", () => {
  it("si era la portada, pasa a la siguiente foto", async () => {
    foto.findFirst
      .mockResolvedValueOnce({ r2Key: P + "a.jpg", url: "https://cdn/a.jpg" })
      .mockResolvedValueOnce({ url: "https://cdn/b.jpg" });
    trabajo.findFirst.mockResolvedValueOnce({ portadaUrl: "https://cdn/a.jpg" });
    borrarR2.mockResolvedValueOnce({ ok: true });
    const r = await borrarFoto("ws-1", "t1", "f1");
    expect(trabajo.update).toHaveBeenCalledWith({ where: { id: "t1" }, data: { portadaUrl: "https://cdn/b.jpg" } });
    expect(r).toEqual({ ok: true, valor: { huerfanas: [] } });
  });

  it("sin más fotos la portada queda en null y informa la key huérfana si R2 falla", async () => {
    foto.findFirst.mockResolvedValueOnce({ r2Key: P + "a.jpg", url: "u" }).mockResolvedValueOnce(null);
    trabajo.findFirst.mockResolvedValueOnce({ portadaUrl: "u" });
    borrarR2.mockResolvedValueOnce({ ok: false });
    const r = await borrarFoto("ws-1", "t1", "f1");
    expect(trabajo.update).toHaveBeenCalledWith({ where: { id: "t1" }, data: { portadaUrl: null } });
    expect(r).toEqual({ ok: true, valor: { huerfanas: [P + "a.jpg"] } });
  });
});

describe("P2002 y normalizaciones", () => {
  it("crearTrabajo devuelve el fallo de dirección repetida", async () => {
    trabajo.findMany.mockResolvedValueOnce([]);
    trabajo.create.mockRejectedValueOnce(Object.assign(new Error("dup"), { code: "P2002" }));
    expect(await crearTrabajo("ws-1", { titulo: "A" })).toEqual({ ok: false, error: "Ya hay otro trabajo con esa dirección" });
  });

  it("editarTrabajo: categoriaId vacío pasa a null y la fecha a medianoche UTC", async () => {
    trabajo.findFirst.mockResolvedValueOnce({ id: "t1" });
    trabajo.update.mockImplementationOnce(async ({ data }) => data);
    const r = await editarTrabajo("ws-1", "t1", { categoriaId: "", fecha: new Date("2025-03-14T18:30:00.000Z") });
    expect(r).toMatchObject({ ok: true, valor: { categoriaId: null, fecha: new Date("2025-03-14T00:00:00.000Z") } });
  });
});
