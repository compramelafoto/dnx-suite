import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  culturalActivity: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  culturalActivityWork: { findMany: vi.fn(), findFirst: vi.fn() },
  culturalExhibitorWork: { findFirst: vi.fn() },
  photographerProfile: { findUnique: vi.fn() },
  culturalActivityRoomKey: { findUnique: vi.fn() },
}));
const galletas = vi.hoisted(() => ({ valor: new Map<string, string>() }));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean } }));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n: string) => (galletas.valor.has(n) ? { value: galletas.valor.get(n) } : undefined) }) }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));

const { escaneadoEnSala, imagenDeSalaPermitida, obraParaAdquirir, paseDeSala, vistaDeSala } = await import("./consultas");
const { firmarPase } = await import("./llave");
const { visibilityFromPreset } = await import("@repo/muestras");

const LLAVE = "e".repeat(64);
const BUCKET = "https://pub-test.r2.dev/muestras/50";
const muestra = {
  id: "a1", slug: "silos", title: "Silos", type: "MUESTRA", reviewStatus: "APPROVED", galleryMode: "HIGHLIGHTS_UNTIL_CLOSED",
  visibility: visibilityFromPreset("SURPRISE", "s"), startsAt: new Date(Date.now() - 86_400_000), endsAt: new Date(Date.now() + 30 * 86_400_000),
};
const obras = [
  { id: "a1w", title: "Uno", authorName: "Ema", authorProfileId: "p1", year: 2024, technique: "Giclée", isHighlight: false, sortOrder: 0 },
  { id: "a2w", title: "Dos", authorName: "Ema", authorProfileId: "p1", year: 2023, technique: null, isHighlight: false, sortOrder: 1 },
  { id: "c1w", title: "Tres", authorName: "Otro", authorProfileId: "p2", year: null, technique: null, isHighlight: false, sortOrder: 2 },
];
const pase = (extra: Partial<{ a: string; exp: number; w: string[] }> = {}, llave = LLAVE) =>
  firmarPase({ v: 1, a: "a1", exp: Date.now() + 3600_000, w: ["a1w"], ...extra }, llave);

beforeEach(() => {
  vi.clearAllMocks();
  galletas.valor = new Map([["mf_sala_a1", pase()]]);
  usuarioActual.valor = null;
  db.culturalActivity.findUnique.mockResolvedValue(muestra);
  db.culturalActivity.findMany.mockResolvedValue([{ slug: "otra", title: "Otra muestra", startsAt: new Date(), endsAt: new Date() }]);
  db.culturalActivity.count.mockResolvedValue(0);
  db.culturalActivityWork.findMany.mockResolvedValue(obras);
  db.culturalActivityWork.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) => ({ imageUrl: `${BUCKET}/${where.id}.webp` }));
  db.culturalExhibitorWork.findFirst.mockResolvedValue({
    imageWidthCm: 40, imageHeightCm: 60, edition: "UNIQUE", editionNumber: null, editionSize: null, statement: "Sobre el río.", forSale: true,
  });
  db.photographerProfile.findUnique.mockResolvedValue({
    id: "p1", slug: "ema", displayName: "Ema", bio: "Fotógrafa de Rosario.", city: "Rosario", province: null, website: null, instagram: "ema",
    avatarUrl: null, portfolio: [{ id: "f1", imageUrl: "https://pub-test.r2.dev/muestras/50/portfolio.webp", title: "Portfolio", year: null, technique: null, caption: null }],
  });
  db.culturalActivityRoomKey.findUnique.mockResolvedValue({ secret: LLAVE });
});

describe("paseDeSala", () => {
  it("con el pase válido de esta muestra lo devuelve", async () => {
    expect((await paseDeSala("silos"))?.pase?.w).toEqual(["a1w"]);
  });
  it("sin pase, de otra muestra, vencido o con otra firma: sin pase", async () => {
    for (const valor of [undefined, pase({ a: "otra" }), pase({ exp: Date.now() - 1 }), pase({}, "f".repeat(64))]) {
      galletas.valor = valor ? new Map([["mf_sala_a1", valor]]) : new Map();
      expect((await paseDeSala("silos"))?.pase).toBeNull();
    }
  });
  it("una muestra sin publicar no tiene vista de sala", async () => {
    db.culturalActivity.findUnique.mockResolvedValue({ ...muestra, reviewStatus: "UNPUBLISHED" });
    expect(await paseDeSala("silos")).toBeNull();
  });
});

describe("vistaDeSala", () => {
  it("sin pase no hay vista (la página redirige a la pública)", async () => {
    galletas.valor = new Map();
    expect(await vistaDeSala((await paseDeSala("silos"))!, "a1w")).toBeNull();
  });
  it("con 'a1' y 'las del mismo artista': ve a1 y a2, no c1", async () => {
    const p = (await paseDeSala("silos"))!;
    const v = await vistaDeSala(p, "a1w");
    expect(v?.obra.id).toBe("a1w");
    expect(v?.otrasObras.map((o) => o.id)).toEqual(["a2w"]);
    expect(await vistaDeSala(p, "a2w")).not.toBeNull();
    expect(await vistaDeSala(p, "c1w")).toBeNull();
  });
  it("el equipo sin pase ve todo", async () => {
    galletas.valor = new Map();
    usuarioActual.valor = { id: 7, esSuperAdmin: false };
    db.culturalActivity.count.mockResolvedValue(1);
    expect(await vistaDeSala((await paseDeSala("silos"))!, "c1w")).not.toBeNull();
  });
  it("ni URL del bucket de obras ni precio en lo que va a la página", async () => {
    const v = await vistaDeSala((await paseDeSala("silos"))!, "a1w");
    const texto = JSON.stringify(v);
    expect(texto).not.toContain(`${BUCKET}/a1w`);
    expect(texto).not.toContain(`${BUCKET}/a2w`);
    expect(texto).not.toContain("priceArs");
    expect(v?.obra.imagen).toBe("/m/silos/sala/img/a1w");
    expect(v?.obra.detalle).toBe("2024. Giclée. 40 × 60 cm. Pieza única");
    expect(db.culturalExhibitorWork.findFirst.mock.calls[0]![0].select).not.toHaveProperty("priceArs");
    expect(v?.portfolio).toHaveLength(1);
    expect(v?.otrasMuestras).toHaveLength(1);
  });
  it("el Instagram del artista sale como usuario, aunque se haya guardado con @ o la dirección completa", async () => {
    for (const guardado of ["@Ema.Foto", "https://www.instagram.com/ema.foto/", "ema.foto"]) {
      db.photographerProfile.findUnique.mockResolvedValueOnce({
        id: "p1", slug: "ema", displayName: "Ema", bio: null, city: null, province: null, website: null, instagram: guardado, avatarUrl: null, portfolio: [],
      });
      expect((await vistaDeSala((await paseDeSala("silos"))!, "a1w"))?.artista?.instagram).toBe("ema.foto");
    }
  });
  it("'Adquirir obra' sólo con room.buy y la obra a la venta", async () => {
    expect((await vistaDeSala((await paseDeSala("silos"))!, "a1w"))?.mostrarAdquirir).toBe(true);
    db.culturalExhibitorWork.findFirst.mockResolvedValue({ imageWidthCm: null, imageHeightCm: null, edition: null, editionNumber: null, editionSize: null, statement: null, forSale: false });
    expect((await vistaDeSala((await paseDeSala("silos"))!, "a1w"))?.mostrarAdquirir).toBe(false);
    const sinBoton = visibilityFromPreset("SURPRISE", "s");
    sinBoton.room.buy = false;
    db.culturalActivity.findUnique.mockResolvedValue({ ...muestra, visibility: sinBoton });
    db.culturalExhibitorWork.findFirst.mockResolvedValue({ imageWidthCm: null, imageHeightCm: null, edition: null, editionNumber: null, editionSize: null, statement: null, forSale: true });
    expect((await vistaDeSala((await paseDeSala("silos"))!, "a1w"))?.mostrarAdquirir).toBe(false);
  });
});

describe("escaneado e imágenes", () => {
  it("lo escaneado, con miniaturas por proxy", async () => {
    const e = await escaneadoEnSala((await paseDeSala("silos"))!);
    expect(e?.obras.map((o) => o.imagen)).toEqual(["/m/silos/sala/img/a1w"]);
    expect(e?.vence).toBeGreaterThan(Date.now());
  });
  it("la imagen sólo sale para una obra permitida por el pase", async () => {
    expect(await imagenDeSalaPermitida("silos", "a2w")).toBe(`${BUCKET}/a2w.webp`);
    expect(await imagenDeSalaPermitida("silos", "c1w")).toBeNull();
    galletas.valor = new Map();
    expect(await imagenDeSalaPermitida("silos", "a1w")).toBeNull();
  });
  it("adquirir: obra permitida con su marca de venta, sin precio", async () => {
    const o = await obraParaAdquirir((await paseDeSala("silos"))!, "a1w");
    expect(o).toEqual({ id: "a1w", title: "Uno", authorName: "Ema", forSale: true, roomBuy: true });
  });
});
