import { beforeEach, describe, expect, it, vi } from "vitest";

const { trabajo, foto, categoria, borrarR2, tx } = vi.hoisted(() => ({
  trabajo: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), updateMany: vi.fn() },
  foto: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn() },
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

const { crearTrabajo, agregarFotos, borrarTrabajo } = await import("./repositorio");

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
    foto.findMany.mockResolvedValueOnce([{ r2Key: "fotoffice/site-trabajos/a.jpg" }, { r2Key: null }, { r2Key: "fotoffice/site-trabajos/b.jpg" }]);
    tx.mockResolvedValueOnce([]);
    borrarR2.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false });
    const r = await borrarTrabajo("ws-1", "t1");
    expect(borrarR2).toHaveBeenCalledTimes(2);
    expect(r).toEqual({ ok: true, valor: { huerfanas: ["fotoffice/site-trabajos/b.jpg"] } });
  });

  it("no toca un trabajo de otro workspace", async () => {
    trabajo.findFirst.mockResolvedValueOnce(null);
    expect((await borrarTrabajo("ws-1", "ajeno")).ok).toBe(false);
    expect(tx).not.toHaveBeenCalled();
  });
});
