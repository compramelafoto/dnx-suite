import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ culturalActivity: { findFirst: vi.fn() } }));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean; email: string; name: string | null } }));
const componer = vi.hoisted(() => ({ armarPiezaRedes: vi.fn() }));
const pdf = vi.hoisted(() => ({ invitacionImprimible: vi.fn() }));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
vi.mock("@/lib/redes/componer", () => componer);
vi.mock("@/lib/redes/pdf", () => pdf);
const { GET } = await import("@/app/api/redes/[id]/route");
const { conPermiso } = await import("@/lib/equipo/permisos");
const { LIMITES, resetRateLimit } = await import("@/lib/limite");
const { visibilityFromPreset, visibleWorks } = await import("@repo/muestras");

const co = { id: 2, esSuperAdmin: false, email: "co@x.com", name: "Co" };
const DIA = 86_400_000;
const pedido = (id: string, q: string) => new Request(`http://localhost:3014/api/redes/${id}${q}`);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
const muestra = (extra: Record<string, unknown> = {}) => ({
  id: "a1", slug: "rosario", title: "Silos", type: "MUESTRA", reviewStatus: "APPROVED", isCancelled: false, isVirtualOnly: false,
  startsAt: new Date(Date.now() + 5 * DIA), endsAt: new Date(Date.now() + 30 * DIA),
  // 19 h argentinas: tiene hora.
  openingAt: new Date(Math.floor((Date.now() + 5 * DIA) / DIA) * DIA + 22 * 3600_000), openingEndsAt: null,
  venueName: "Parque España", city: "Rosario", province: "Santa Fe", coverImageUrl: "https://pub-test.r2.dev/muestras/a1/p.webp",
  galleryMode: "FULL", visibility: null,
  works: [
    { id: "w1", title: "Uno", authorName: "Ana", year: 2025, imageUrl: "https://pub-test.r2.dev/w1.webp", isHighlight: false, sortOrder: 0 },
    { id: "w2", title: "Dos", authorName: "Beto", year: null, imageUrl: "https://pub-test.r2.dev/w2.webp", isHighlight: true, sortOrder: 1 },
  ],
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  usuarioActual.valor = co;
  db.culturalActivity.findFirst.mockResolvedValue(muestra());
  componer.armarPiezaRedes.mockResolvedValue(JPG);
  pdf.invitacionImprimible.mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
});

describe("GET /api/redes/[id]", () => {
  it("sin sesión → a ingresar", async () => {
    usuarioActual.valor = null;
    const r = await GET(pedido("a1", "?formato=post&variante=inaugura"), ctx("a1"));
    expect(r.status).toBe(307);
    const u = new URL(r.headers.get("location")!);
    expect(u.pathname + u.search).toBe("/login?next=%2Fpanel%2Fdifusion");
  });

  it("formato o variante desconocidos, o A6 de algo que no es invitación → 404", async () => {
    for (const q of ["?formato=tiktok&variante=inaugura", "?formato=post&variante=otra", "?variante=inaugura", "?formato=a6&variante=inaugura", "?formato=a5&variante=obra"]) {
      const r = await GET(pedido("a1", q), ctx("a1"));
      expect(r.status).toBe(404);
      expect(r.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    }
    expect(db.culturalActivity.findFirst).not.toHaveBeenCalled();
  });

  it("id sin forma → 404 sin consultar", async () => {
    expect((await GET(pedido("a b", "?formato=post&variante=inaugura"), ctx("a b"))).status).toBe(404);
    expect(db.culturalActivity.findFirst).not.toHaveBeenCalled();
  });

  it("coorganización sí; textos o ajeno → 404 (el where lleva dondePuede promote y APPROVED)", async () => {
    expect((await GET(pedido("a1", "?formato=post&variante=inaugura"), ctx("a1"))).status).toBe(200);
    const where = db.culturalActivity.findFirst.mock.calls[0]![0].where;
    expect(where).toEqual(conPermiso({ id: "a1", type: "MUESTRA", reviewStatus: "APPROVED" }, co, "promote"));
    expect(where).toMatchObject({ AND: [expect.anything(), { OR: [{ proposedByUserId: 2 }, { members: { some: { userId: 2, status: "ACTIVE", role: { in: ["CO_ORGANIZER"] } } } }] }] });
    db.culturalActivity.findFirst.mockResolvedValue(null);
    const r = await GET(pedido("a1", "?formato=post&variante=inaugura"), ctx("a1"));
    expect(r.status).toBe(404);
    expect(await r.text()).toContain("No encontramos esa muestra");
    expect(componer.armarPiezaRedes).toHaveBeenCalledTimes(1);
  });

  it("variante fuera de su momento → 404 con explicación", async () => {
    db.culturalActivity.findFirst.mockResolvedValue(muestra({ openingAt: new Date(Date.now() - DIA), startsAt: new Date(Date.now() - DIA) }));
    const r = await GET(pedido("a1", "?formato=post&variante=inaugura"), ctx("a1"));
    expect(r.status).toBe(404);
    expect(await r.text()).toBe("Esta pieza ya no está disponible: la inauguración ya pasó.");
    db.culturalActivity.findFirst.mockResolvedValue(muestra({ endsAt: new Date(Date.now() - DIA) }));
    expect(await (await GET(pedido("a1", "?formato=post&variante=ultimos-dias"), ctx("a1"))).text()).toBe("Esta pieza ya no está disponible: la muestra ya cerró.");
    db.culturalActivity.findFirst.mockResolvedValue(muestra({ works: [] }));
    expect(await (await GET(pedido("a1", "?formato=post&variante=obra"), ctx("a1"))).text()).toBe("La muestra todavía no tiene obras.");
    // Sin hora (00:00 argentinas): no hay invitación.
    db.culturalActivity.findFirst.mockResolvedValue(muestra({ openingAt: new Date(Math.floor((Date.now() + 5 * DIA) / DIA) * DIA + 3 * 3600_000) }));
    expect(await (await GET(pedido("a1", "?formato=a6&variante=invitacion"), ctx("a1"))).text()).toBe("Cargá la hora de la inauguración en la ficha para armar la invitación.");
    expect(componer.armarPiezaRedes).not.toHaveBeenCalled();
  });

  it("obra: la pedida, o la destacada; de otra muestra → 404", async () => {
    await GET(pedido("a1", "?formato=cuadrado&variante=obra&obra=w1"), ctx("a1"));
    expect(componer.armarPiezaRedes.mock.calls[0]![0].obra).toMatchObject({ title: "Uno" });
    await GET(pedido("a1", "?formato=cuadrado&variante=obra"), ctx("a1"));
    expect(componer.armarPiezaRedes.mock.calls[1]![0].obra).toMatchObject({ title: "Dos" });
    const r = await GET(pedido("a1", "?formato=cuadrado&variante=obra&obra=ajena"), ctx("a1"));
    expect(r.status).toBe(404);
    expect(await r.text()).toBe("Esa obra no es de esta muestra.");
    expect(componer.armarPiezaRedes).toHaveBeenCalledTimes(2);
  });

  it("JPEG con nombre de archivo y caché privada; ?descargar=1 → attachment", async () => {
    const r = await GET(pedido("a1", "?formato=historia&variante=ultimos-dias&descargar=1"), ctx("a1"));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("image/jpeg");
    expect(r.headers.get("content-disposition")).toBe('attachment; filename="muestra-rosario-ultimos-dias-historia.jpg"');
    expect(r.headers.get("cache-control")).toBe("private, max-age=300");
    expect(Buffer.from(await r.arrayBuffer())).toEqual(JPG);
    const a = componer.armarPiezaRedes.mock.calls[0]![0];
    expect(a).toMatchObject({ formato: "STORY", variante: "LAST_DAYS", obra: null, urlInvitacion: expect.stringMatching(/\/m\/rosario\/inauguracion$/) });
    expect(a.muestra.worksCount).toBe(2);
    const vista = await GET(pedido("a1", "?formato=post&variante=inaugura"), ctx("a1"));
    expect(vista.headers.get("content-disposition")).toBe('inline; filename="muestra-rosario-inaugura-posteo.jpg"');
  });

  it("A6 → PDF", async () => {
    const r = await GET(pedido("a1", "?formato=a6&variante=invitacion"), ctx("a1"));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/pdf");
    expect(r.headers.get("content-disposition")).toBe('attachment; filename="muestra-rosario-invitacion-a6.pdf"');
    expect(pdf.invitacionImprimible).toHaveBeenCalledWith(JPG, "A6");
  });

  it("si el texto no se dibujó → 500 en texto, nunca una imagen", async () => {
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});
    componer.armarPiezaRedes.mockRejectedValue(new Error("El texto no se dibujó."));
    const r = await GET(pedido("a1", "?formato=post&variante=inaugura"), ctx("a1"));
    expect(r.status).toBe(500);
    expect(r.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await r.text()).toBe("No pudimos armar la pieza. Probá de nuevo.");
    consola.mockRestore();
  });

  it("freno → 429", async () => {
    for (let i = 0; i < LIMITES.redes.limit; i++) expect((await GET(pedido("a1", "?formato=post&variante=inaugura"), ctx("a1"))).status).toBe(200);
    expect((await GET(pedido("a1", "?formato=post&variante=inaugura"), ctx("a1"))).status).toBe(429);
  });

  describe("la sorpresa de la muestra (etapa 6)", () => {
    const muchas = Array.from({ length: 10 }, (_, i) => ({
      id: `o${i}`, title: `Obra ${i}`, authorName: "Ana", year: null, imageUrl: `https://pub-test.r2.dev/o${i}.webp`, isHighlight: false, sortOrder: i,
    }));

    it("'Sorpresa total': no hay Obra destacada, con el motivo", async () => {
      db.culturalActivity.findFirst.mockResolvedValue(muestra({ works: muchas, visibility: visibilityFromPreset("SURPRISE", "s") }));
      const r = await GET(pedido("a1", "?formato=post&variante=obra"), ctx("a1"));
      expect(r.status).toBe(404);
      expect(await r.text()).toBe("Con 'Sorpresa total' no se difunden obras de la sala: usá 'Inaugura' o 'Invitación'.");
      expect((await GET(pedido("a1", "?formato=post&variante=obra&obra=o3"), ctx("a1"))).status).toBe(404);
      expect(componer.armarPiezaRedes).not.toHaveBeenCalled();
    });

    it("'Adelanto': sólo las 3 que se ven online; una oculta pedida a mano → 404", async () => {
      const ajuste = visibilityFromPreset("PREVIEW", "semilla-fija");
      const m = muestra({ works: muchas, visibility: ajuste });
      db.culturalActivity.findFirst.mockResolvedValue(m);
      const visibles = visibleWorks(m, muchas, new Date()).works.map((w) => w.id);
      expect(visibles).toHaveLength(3);
      for (const w of muchas) {
        const r = await GET(pedido("a1", `?formato=post&variante=obra&obra=${w.id}`), ctx("a1"));
        expect(r.status).toBe(visibles.includes(w.id) ? 200 : 404);
      }
      expect(componer.armarPiezaRedes).toHaveBeenCalledTimes(3);
      // Sin obra pedida, una de las visibles.
      await GET(pedido("a1", "?formato=post&variante=obra"), ctx("a1"));
      expect(visibles).toContain(componer.armarPiezaRedes.mock.calls[3]![0].obra.id);
    });

    it("'cambian para cada visitante': no se difunde ninguna obra de la sala", async () => {
      const ajuste = { ...visibilityFromPreset("PREVIEW", "s"), preset: "CUSTOM", online: { exhibited: "RANDOM", randomCount: 3, rotation: "PER_VISIT", seed: "s", artists: true } };
      db.culturalActivity.findFirst.mockResolvedValue(muestra({ works: muchas, visibility: ajuste }));
      const r = await GET(pedido("a1", "?formato=post&variante=obra&obra=o1"), ctx("a1"));
      expect(r.status).toBe(404);
      expect(await r.text()).toContain("cada visitante");
      expect(componer.armarPiezaRedes).not.toHaveBeenCalled();
    });

    it("muestra sin ajuste con destacadas: como hasta hoy, sólo las destacadas mientras está abierta", async () => {
      db.culturalActivity.findFirst.mockResolvedValue(muestra({ galleryMode: "HIGHLIGHTS_UNTIL_CLOSED" }));
      expect((await GET(pedido("a1", "?formato=post&variante=obra&obra=w1"), ctx("a1"))).status).toBe(404);
      expect((await GET(pedido("a1", "?formato=post&variante=obra&obra=w2"), ctx("a1"))).status).toBe(200);
    });
  });
});
