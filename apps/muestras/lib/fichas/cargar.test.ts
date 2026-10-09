import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ culturalActivity: { findFirst: vi.fn() } }));
vi.mock("@repo/db", () => ({ prisma: db }));

process.env.APP_URL = "https://muestrasfotograficas.com/";
const { cargarFichas } = await import("./cargar");

const muestra = {
  slug: "miradas-abc123", title: "Miradas",
  works: [
    { id: "w1", title: "Uno", authorName: "Ana", year: null, technique: null, sortOrder: 0 },
    { id: "w2", title: "Dos", authorName: "Luis", year: 2024, technique: null, sortOrder: 1 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  db.culturalActivity.findFirst.mockResolvedValue(muestra);
});

describe("cargarFichas", () => {
  it("sólo busca entre las publicadas propias", async () => {
    await cargarFichas("a1", { id: 7, esSuperAdmin: false }, null);
    expect(db.culturalActivity.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "a1", reviewStatus: "APPROVED", type: "MUESTRA", proposedByUserId: 7 },
    }));
  });
  it("el super admin no filtra por dueño", async () => {
    await cargarFichas("a1", { id: 1, esSuperAdmin: true }, null);
    expect(db.culturalActivity.findFirst.mock.calls[0]![0].where).not.toHaveProperty("proposedByUserId");
  });
  it("todas, con la URL pública de cada obra", async () => {
    const r = await cargarFichas("a1", { id: 7, esSuperAdmin: false }, null);
    expect(r?.nombre).toBe("fichas-miradas-abc123");
    expect(r?.fichas.map((f) => f.url)).toEqual([
      "https://muestrasfotograficas.com/m/miradas-abc123/o/w1",
      "https://muestrasfotograficas.com/m/miradas-abc123/o/w2",
    ]);
  });
  it("una sola obra lleva su número en el nombre", async () => {
    const r = await cargarFichas("a1", { id: 7, esSuperAdmin: false }, "w2");
    expect(r?.nombre).toBe("ficha-miradas-abc123-2");
    expect(r?.fichas).toHaveLength(1);
  });
  it("una obra de otra muestra, o una muestra ajena, no da nada", async () => {
    expect(await cargarFichas("a1", { id: 7, esSuperAdmin: false }, "w9")).toBeNull();
    db.culturalActivity.findFirst.mockResolvedValue(null);
    expect(await cargarFichas("a1", { id: 8, esSuperAdmin: false }, null)).toBeNull();
  });
});
