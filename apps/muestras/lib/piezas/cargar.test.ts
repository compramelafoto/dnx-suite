import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ culturalActivity: { findFirst: vi.fn() }, culturalExhibitorWork: { findMany: vi.fn() } }));
const pub = vi.hoisted(() => ({ distinctionsForWorks: vi.fn(), obrasSoloOnline: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/concursos/publico", () => pub);

const { cargarMuestraParaPiezas } = await import("./cargar");
const { armarPieza } = await import("./armar");
const { obraDeCatalogo } = await import("./textos");

const obra = (id: string, sortOrder: number) => ({ id, title: `Obra ${id}`, authorName: "Ana", year: 2024, technique: null, imageUrl: `https://r2/${id}.webp`, sortOrder });
const muestra = {
  id: "a1", slug: "m", title: "Muestra", organizersText: "SFPR", curatorialText: null, curatorCredits: null,
  startsAt: new Date("2026-11-01"), endsAt: new Date("2026-12-01"), scheduleText: null, venueName: null, address: null, city: null, province: null,
  coverImageUrl: null, hangingPlan: null, updatedAt: new Date("2026-10-10"),
  works: [obra("w1", 0), obra("w2", 1), obra("w3", 2)],
};
const u = { id: 7, esSuperAdmin: false };

beforeEach(() => {
  vi.clearAllMocks();
  db.culturalActivity.findFirst.mockResolvedValue(muestra);
  db.culturalExhibitorWork.findMany.mockResolvedValue([]);
  pub.distinctionsForWorks.mockResolvedValue(new Map());
  pub.obrasSoloOnline.mockResolvedValue(new Set());
});

describe("cargarMuestraParaPiezas (etapa 7)", () => {
  it("una muestra sin concurso queda igual", async () => {
    const a = await cargarMuestraParaPiezas("a1", u, { publicada: true });
    expect(a?.works.map((w) => w.id)).toEqual(["w1", "w2", "w3"]);
  });
  it("sin las obras sólo online: ni catálogo, ni marcos, ni plano", async () => {
    pub.obrasSoloOnline.mockResolvedValue(new Set(["w2"]));
    const a = await cargarMuestraParaPiezas("a1", u, { publicada: true });
    expect(a?.works.map((w) => w.id)).toEqual(["w1", "w3"]);
    expect(pub.distinctionsForWorks).toHaveBeenCalledWith("a1", ["w1", "w3"]);
    // Un marco pedido para una obra sólo online no existe.
    expect(await armarPieza(a!, { pieza: "marcos", obra: "w2", tamano: "A4", conFoto: false } as never, "https://x")).toBeNull();
  });
  it("trae los premios para el catálogo", async () => {
    pub.distinctionsForWorks.mockResolvedValue(new Map([["w1", "1.er premio · Paisaje — Concurso X"]]));
    const a = await cargarMuestraParaPiezas("a1", u, { publicada: true });
    expect(a?.premios?.get("w1")).toBe("1.er premio · Paisaje — Concurso X");
  });
});

describe("obraDeCatalogo", () => {
  it("el premio antes de los datos", () => {
    expect(obraDeCatalogo({ title: "T", authorName: "Ana", year: 2024, technique: "Giclée" }, null, "1.er premio · Paisaje — Concurso X").detalle)
      .toBe("1.er premio · Paisaje — Concurso X. 2024. Giclée");
    expect(obraDeCatalogo({ title: "T", authorName: "Ana", year: null, technique: null }).detalle).toBeNull();
  });
});
