import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ culturalActivity: { findFirst: vi.fn() } }));
vi.mock("@repo/db", () => ({ prisma: db }));
const { obrasDelAnticipo } = await import("./elegir");

const DIA = 86_400_000;
const porVisitante = (n: number, extra: Record<string, unknown> = {}) => ({
  v: 1, online: { exhibited: "RANDOM", randomCount: n, rotation: "PER_VISIT", seed: "s", artists: true }, ...extra,
});
const obra = (i: number) => ({
  id: `w${i}`, imageUrl: `https://pub-test.r2.dev/muestras/a1/w${i}.webp`, title: `Obra ${i}`, authorName: "Ana", year: 2024,
  technique: "Giclée", isHighlight: false, sortOrder: i, authorUserId: 9, authorProfileId: "p1",
});
const muestra = (extra: Record<string, unknown> = {}) => ({
  galleryMode: "HIGHLIGHTS_UNTIL_CLOSED", visibility: porVisitante(3),
  startsAt: new Date(Date.now() - DIA), endsAt: new Date(Date.now() + 10 * DIA),
  works: Array.from({ length: 6 }, (_, i) => obra(i + 1)),
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  db.culturalActivity.findFirst.mockResolvedValue(muestra());
});

describe("obrasDelAnticipo", () => {
  it("elige N en el servidor y devuelve sólo los campos de la galería", async () => {
    const r = await obrasDelAnticipo("m", () => 0);
    expect(r).toHaveLength(3);
    expect(r!.map((o) => o.id)).toEqual(["w1", "w2", "w3"]);
    expect(Object.keys(r![0]!).sort()).toEqual(["authorName", "id", "imageUrl", "technique", "title", "year"]);
    const otra = await obrasDelAnticipo("m", (max) => max - 1);
    expect(otra!.map((o) => o.id)).not.toEqual(["w1", "w2", "w3"]);
    expect(otra).toHaveLength(3);
  });

  it("sólo muestras publicadas: el where lo pide", async () => {
    await obrasDelAnticipo("m", () => 0);
    expect(db.culturalActivity.findFirst.mock.calls[0]![0].where).toEqual({ slug: "m", reviewStatus: "APPROVED", type: "MUESTRA" });
  });

  it("no publicada (no la encuentra) → null", async () => {
    db.culturalActivity.findFirst.mockResolvedValue(null);
    expect(await obrasDelAnticipo("m", () => 0)).toBeNull();
  });

  it("ajuste fijo, sin ajuste o ninguna → null", async () => {
    db.culturalActivity.findFirst.mockResolvedValue(muestra({ visibility: { ...porVisitante(3), online: { exhibited: "RANDOM", randomCount: 3, rotation: "FIXED", seed: "s", artists: true } } }));
    expect(await obrasDelAnticipo("m", () => 0)).toBeNull();
    db.culturalActivity.findFirst.mockResolvedValue(muestra({ visibility: null }));
    expect(await obrasDelAnticipo("m", () => 0)).toBeNull();
    db.culturalActivity.findFirst.mockResolvedValue(muestra({ visibility: { v: 1, online: { exhibited: "NONE" } } }));
    expect(await obrasDelAnticipo("m", () => 0)).toBeNull();
  });

  it("cerrada y se revela todo → null (la página muestra el archivo)", async () => {
    db.culturalActivity.findFirst.mockResolvedValue(muestra({ startsAt: new Date(Date.now() - 20 * DIA), endsAt: new Date(Date.now() - 2 * DIA) }));
    expect(await obrasDelAnticipo("m", () => 0)).toBeNull();
  });

  it("N mayor o igual a las obras → como 'todas' (null: la página las muestra fijas)", async () => {
    db.culturalActivity.findFirst.mockResolvedValue(muestra({ visibility: porVisitante(6) }));
    expect(await obrasDelAnticipo("m", () => 0)).toBeNull();
  });
});
