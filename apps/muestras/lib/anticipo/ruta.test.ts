import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ culturalActivity: { findFirst: vi.fn() } }));
const azar = vi.hoisted(() => ({ randomInt: vi.fn((max: number) => 0 * max) }));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("node:crypto", async (original) => ({ ...(await original<typeof import("node:crypto")>()), randomInt: azar.randomInt }));
const { GET } = await import("@/app/api/m/[slug]/anticipo/route");
const { LIMITES_PUBLICOS, resetRateLimit } = await import("@/lib/limite");
const { olvidarAnticipos } = await import("./memoria");

const DIA = 86_400_000;
const obra = (i: number) => ({
  id: `w${i}`, imageUrl: `https://pub-test.r2.dev/muestras/a1/w${i}.webp`, title: `Obra ${i}`, authorName: "Ana", year: null,
  technique: null, isHighlight: false, sortOrder: i,
});
const muestra = {
  galleryMode: "HIGHLIGHTS_UNTIL_CLOSED",
  visibility: { v: 1, online: { exhibited: "RANDOM", randomCount: 3, rotation: "PER_VISIT", seed: "s", artists: true } },
  startsAt: new Date(Date.now() - DIA), endsAt: new Date(Date.now() + 10 * DIA),
  works: Array.from({ length: 8 }, (_, i) => obra(i + 1)),
};
const pedido = (slug: string, ip = "190.1.2.3") =>
  [new Request(`http://localhost:3014/api/m/${slug}/anticipo`, { headers: { "x-forwarded-for": ip } }), { params: Promise.resolve({ slug }) }] as const;
const ids = async (r: Response) => ((await r.json()) as { obras: { id: string }[] }).obras.map((o) => o.id);

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  olvidarAnticipos();
  azar.randomInt.mockImplementation(() => 0);
  db.culturalActivity.findFirst.mockResolvedValue(muestra);
});

describe("GET /api/m/[slug]/anticipo", () => {
  it("200 con N obras, privada y sin caché", async () => {
    const r = await GET(...pedido("rosario"));
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    expect(r.headers.get("x-robots-tag")).toBe("noindex");
    const cuerpo = (await r.json()) as { obras: Record<string, unknown>[] };
    expect(cuerpo.obras).toHaveLength(3);
    expect(Object.keys(cuerpo.obras[0]!).sort()).toEqual(["authorName", "id", "imageUrl", "technique", "title", "year"]);
  });

  it("cada pedido sortea otra vez", async () => {
    const primero = await ids(await GET(...pedido("rosario")));
    azar.randomInt.mockImplementation((max: number) => max - 1);
    const segundo = await ids(await GET(...pedido("rosario")));
    expect(primero).toHaveLength(3);
    expect(segundo).toHaveLength(3);
    expect(segundo).not.toEqual(primero);
  });

  it("pasado el freno de la muestra, la misma respuesta que la última vez para esa IP; sin respuesta previa, vacía", async () => {
    const tope = LIMITES_PUBLICOS.anticipoPorMuestra.limit;
    let ultima: string[] = [];
    for (let i = 0; i < tope; i++) {
      azar.randomInt.mockImplementation((max: number) => i % max);
      ultima = await ids(await GET(...pedido("rosario")));
    }
    azar.randomInt.mockImplementation((max: number) => max - 1);
    const frenado = await GET(...pedido("rosario"));
    expect(frenado.status).toBe(200);
    expect(frenado.headers.get("cache-control")).toBe("private, no-store");
    expect(await ids(frenado)).toEqual(ultima);
    // Frenado no sortea: sólo relee el ajuste (sin las imágenes de las obras).
    expect(db.culturalActivity.findFirst).toHaveBeenCalledTimes(tope + 1);
    expect(db.culturalActivity.findFirst.mock.calls[tope]![0].select.works.select).toEqual({ id: true, isHighlight: true, sortOrder: true });
    // Otra muestra, sin respuesta previa para esa IP: se sortea (su propio tope).
    expect(await ids(await GET(...pedido("otra")))).toHaveLength(3);
  });

  it("el tope general por IP frena aunque se repartan los pedidos entre muestras", async () => {
    const tope = LIMITES_PUBLICOS.anticipo.limit;
    for (let i = 0; i < tope; i++) await GET(...pedido(`m${i % 10}`));
    const llamadas = db.culturalActivity.findFirst.mock.calls.length;
    expect(await ids(await GET(...pedido("nueva")))).toEqual([]);
    // Frenado por el tope general: relee el ajuste, nunca sortea.
    expect(db.culturalActivity.findFirst.mock.calls.length).toBe(llamadas + 1);
  });

  it("frenado y el ajuste ya no es 'para cada visitante' → vacía (no repite obras que hoy son sorpresa)", async () => {
    const tope = LIMITES_PUBLICOS.anticipoPorMuestra.limit;
    for (let i = 0; i < tope; i++) await GET(...pedido("rosario"));
    db.culturalActivity.findFirst.mockResolvedValue({ ...muestra, visibility: { v: 1, online: { exhibited: "NONE" } } });
    expect(await ids(await GET(...pedido("rosario")))).toEqual([]);
    db.culturalActivity.findFirst.mockResolvedValue(null);
    expect(await ids(await GET(...pedido("rosario")))).toEqual([]);
  });

  it("frenado: una obra que ya no está en la muestra no se repite", async () => {
    const tope = LIMITES_PUBLICOS.anticipoPorMuestra.limit;
    let ultima: string[] = [];
    for (let i = 0; i < tope; i++) ultima = await ids(await GET(...pedido("rosario")));
    const sinLaPrimera = muestra.works.filter((w) => w.id !== ultima[0]);
    db.culturalActivity.findFirst.mockResolvedValue({ ...muestra, works: sinLaPrimera });
    expect(await ids(await GET(...pedido("rosario")))).toEqual(ultima.slice(1));
  });

  it("slug inexistente o ajuste que no es 'para cada visitante' → 404 vacío", async () => {
    db.culturalActivity.findFirst.mockResolvedValue(null);
    const r = await GET(...pedido("nada"));
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ obras: [] });
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    db.culturalActivity.findFirst.mockResolvedValue({ ...muestra, visibility: null });
    expect((await GET(...pedido("rosario"))).status).toBe(404);
  });

  it("slug con forma rara → 404 sin consultar", async () => {
    expect((await GET(...pedido("a b"))).status).toBe(404);
    expect(db.culturalActivity.findFirst).not.toHaveBeenCalled();
  });
});
