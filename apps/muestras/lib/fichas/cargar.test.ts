import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ culturalActivity: { findFirst: vi.fn() }, culturalExhibitorWork: { findMany: vi.fn() } }));
const codigos = vi.hoisted(() => ({ asegurarCodigosDeSala: vi.fn() }));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/sala/codigos", () => codigos);

process.env.APP_URL = "https://muestrasfotograficas.com/";
const { baseUrlPublica, cargarFichas } = await import("./cargar");
const { conPermiso } = await import("@/lib/equipo/permisos");

const muestra = {
  id: "a1", slug: "miradas-abc123", title: "Miradas",
  works: [
    { id: "w1", title: "Uno", authorName: "Ana", year: null, technique: null, sortOrder: 0 },
    { id: "w2", title: "Dos", authorName: "Luis", year: 2024, technique: null, sortOrder: 1 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  db.culturalActivity.findFirst.mockResolvedValue(muestra);
  db.culturalExhibitorWork.findMany.mockResolvedValue([]);
  // Sin códigos de sala (como antes de la etapa 6), salvo que el test diga otra cosa.
  codigos.asegurarCodigosDeSala.mockResolvedValue(new Map());
});

describe("cargarFichas", () => {
  it("sólo busca entre las publicadas donde tiene `pieces`", async () => {
    const u = { id: 7, esSuperAdmin: false };
    await cargarFichas("a1", u, null);
    expect(db.culturalActivity.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: conPermiso({ id: "a1", reviewStatus: "APPROVED", type: "MUESTRA" }, u, "pieces"),
    }));
  });
  it("dueño o coorganización activa ven las fichas; textos no", async () => {
    await cargarFichas("a1", { id: 7, esSuperAdmin: false }, null);
    const or = db.culturalActivity.findFirst.mock.calls[0]![0].where.AND[1].OR;
    expect(or).toEqual([
      { proposedByUserId: 7 },
      { members: { some: { userId: 7, status: "ACTIVE", role: { in: ["CO_ORGANIZER"] } } } },
    ]);
  });
  it("el super admin no filtra por dueño", async () => {
    await cargarFichas("a1", { id: 1, esSuperAdmin: true }, null);
    expect(db.culturalActivity.findFirst.mock.calls[0]![0].where).toEqual({ AND: [{ id: "a1", reviewStatus: "APPROVED", type: "MUESTRA" }, {}] });
  });
  it("todas, con la URL del QR con conteo de cada obra", async () => {
    const r = await cargarFichas("a1", { id: 7, esSuperAdmin: false }, null);
    expect(r?.nombre).toBe("fichas-miradas-abc123");
    expect(r?.fichas.map((f) => f.url)).toEqual([
      "https://muestrasfotograficas.com/q/o/w1",
      "https://muestrasfotograficas.com/q/o/w2",
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

describe("baseUrlPublica (la dirección que va en el QR)", () => {
  const DEFECTO = "https://muestrasfotograficas.com";
  it("en local acepta localhost", () => {
    expect(baseUrlPublica({ NODE_ENV: "development", APP_URL: "http://localhost:3014/" })).toBe("http://localhost:3014");
  });
  it("en producción acepta un dominio propio con https", () => {
    expect(baseUrlPublica({ NODE_ENV: "production", APP_URL: "https://www.muestrasfotograficas.com" })).toBe("https://www.muestrasfotograficas.com");
  });
  it("en producción descarta localhost, *.vercel.app y http, y avisa una sola vez", () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(baseUrlPublica({ NODE_ENV: "production", APP_URL: "http://localhost:3014" })).toBe(DEFECTO);
    expect(baseUrlPublica({ VERCEL_ENV: "production", APP_URL: "https://muestras-abc.vercel.app" })).toBe(DEFECTO);
    expect(baseUrlPublica({ NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "http://muestrasfotograficas.com" })).toBe(DEFECTO);
    expect(baseUrlPublica({ NODE_ENV: "production", APP_URL: "no es una url" })).toBe(DEFECTO);
    expect(aviso).toHaveBeenCalledTimes(1);
    aviso.mockRestore();
  });
  it("sin variables, el dominio público", () => expect(baseUrlPublica({})).toBe(DEFECTO));
});

describe("cargarFichas con código de sala y datos del expositor (etapa 6)", () => {
  it("cada QR va a /q/s/<código> y la obra de expositor suma medidas y edición, sin precio", async () => {
    codigos.asegurarCodigosDeSala.mockResolvedValue(new Map([["w1", "abcdefghjkmn"], ["w2", "nmkjhgfedcba"]]));
    db.culturalExhibitorWork.findMany.mockResolvedValue([
      { activityWorkId: "w2", year: 2024, technique: "Giclée", imageWidthCm: 40, imageHeightCm: 60, edition: "LIMITED", editionNumber: 2, editionSize: 10 },
    ]);
    const r = await cargarFichas("a1", { id: 7, esSuperAdmin: false }, null);
    expect(codigos.asegurarCodigosDeSala).toHaveBeenCalledWith("a1", ["w1", "w2"]);
    expect(r?.fichas.map((f) => f.url)).toEqual([
      "https://muestrasfotograficas.com/q/s/abcdefghjkmn",
      "https://muestrasfotograficas.com/q/s/nmkjhgfedcba",
    ]);
    expect(r?.fichas[1]!.detalle).toBe("2024. Giclée. 40 × 60 cm. Edición 2/10");
    expect(db.culturalExhibitorWork.findMany.mock.calls[0]![0].select).not.toHaveProperty("priceArs");
    expect(db.culturalExhibitorWork.findMany.mock.calls[0]![0].where).toEqual({ activityId: "a1", activityWorkId: { in: ["w1", "w2"] } });
  });
});
