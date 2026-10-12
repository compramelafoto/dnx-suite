import { beforeEach, describe, expect, it, vi } from "vitest";
import { TERMS_VERSIONS_VALIDAS_PARA_VENTA } from "@/lib/terms/photographerTerms";

const m = vi.hoisted(() => ({
  albums: vi.fn(), products: vi.fn(), jobs: vi.fn(), orders: vi.fn(), health: vi.fn(), eventPricing: vi.fn(),
  progreso: vi.fn(), schoolAlbum: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    album: {
      findMany: (...a: unknown[]) => m.albums(...a),
      findFirst: (...a: unknown[]) => m.schoolAlbum(...a),
    },
    photographerProduct: { count: (...a: unknown[]) => m.products(...a) },
    cameraIngestJob: { groupBy: (...a: unknown[]) => m.jobs(...a) },
    order: { aggregate: (...a: unknown[]) => m.orders(...a) },
  },
}));
vi.mock("@/lib/mercadopago/mp-connection-health", () => ({
  getMercadoPagoConnectionHealth: (...a: unknown[]) => m.health(...a),
  needsMercadoPagoReconnect: (s: string) => s === "EXPIRED",
}));
vi.mock("@/lib/events/collaborative-event-pricing-lock", () => ({
  loadCollaborativeEventPricingSnapshot: (...a: unknown[]) => m.eventPricing(...a),
}));
vi.mock("@/lib/bot/escolar/progreso", () => ({
  computeSchoolSetupProgress: (...a: unknown[]) => m.progreso(...a),
}));
import { buildPhotographerSituation } from "./contexto";

const DAY = 24 * 60 * 60 * 1000;
const VALID_TERMS = TERMS_VERSIONS_VALIDAS_PARA_VENTA[0];

function album(over: Record<string, unknown> = {}) {
  return {
    id: 3, title: "Egresados", isPublic: true, isTest: false, eventId: null,
    firstPhotoDate: null, expirationExtensionDays: 0, isHidden: false, deletedAt: null, cleanupStatus: "NONE",
    enableDigitalPhotos: true, enablePrintedPhotos: false, digitalPhotoPriceCents: null,
    termsAcceptedAt: new Date(), termsVersion: VALID_TERMS, albumProfitMarginPercent: null, selectedLabId: null,
    pickupBy: null, printPricingSource: null, mode: "STANDARD", schoolId: null, _count: { photos: 10 },
    ...over,
  };
}

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.albums.mockResolvedValue([]);
  m.products.mockResolvedValue(0);
  m.jobs.mockResolvedValue([]);
  m.orders.mockResolvedValue({ _count: { _all: 0 }, _sum: { totalCents: null } });
  m.health.mockResolvedValue({ status: "CONNECTED", selfHealed: false });
  m.eventPricing.mockResolvedValue(null);
  m.schoolAlbum.mockResolvedValue(null);
  m.progreso.mockResolvedValue({
    albumId: 3, albumTitulo: "Egresados", schoolId: 5, pasos: [], hechos: 5, total: 11,
    siguiente: { n: 6, id: "preventa", titulo: "Armar los packs de preventa", estado: "pendiente", opcional: false, enlace: null },
    aMedias: false,
  });
});

describe("buildPhotographerSituation", () => {
  it("Mercado Pago vencido bloquea ventas", async () => {
    m.health.mockResolvedValue({ status: "EXPIRED", selfHealed: false });
    const s = await buildPhotographerSituation(1);
    expect(s.alerts[0]).toMatchObject({ level: "bloquea_ventas" });
    expect(s.text).toContain("Mercado Pago");
  });

  it("Mercado Pago sin conectar bloquea ventas", async () => {
    m.health.mockResolvedValue({ status: "NOT_CONNECTED", selfHealed: false });
    const s = await buildPhotographerSituation(1);
    expect(s.alerts[0]).toMatchObject({ level: "bloquea_ventas" });
  });

  it("si Mercado Pago no responde no inventa una alerta", async () => {
    m.health.mockRejectedValue(new Error("caído"));
    const s = await buildPhotographerSituation(1);
    expect(s.alerts).toEqual([]);
  });

  it("álbum publicado sin precio digital → alerta con el texto de la falta", async () => {
    m.albums.mockResolvedValue([album()]);
    const s = await buildPhotographerSituation(1);
    const alert = s.alerts.find((a) => a.albumId === 3 && a.level === "bloquea_ventas");
    expect(alert?.text).toContain("Configurar precio digital");
    expect(s.text).toContain("Egresados");
  });

  it("álbum de evento con precio fijado por el organizador no reporta falta de precio", async () => {
    m.albums.mockResolvedValue([album({ eventId: 9 })]);
    m.eventPricing.mockResolvedValue({ locksPhotographerDigitalPricing: true, fixedPhotoPrice: 3000 });
    const s = await buildPhotographerSituation(1);
    expect(m.eventPricing).toHaveBeenCalledWith(9);
    expect(s.alerts.filter((a) => a.albumId === 3)).toEqual([]);
    expect(s.text).toContain("$");
    expect(s.text).toContain("3.000");
  });

  it("no consulta precios de evento para álbumes sin evento", async () => {
    m.albums.mockResolvedValue([album({ digitalPhotoPriceCents: 2500 })]);
    await buildPhotographerSituation(1);
    expect(m.eventPricing).not.toHaveBeenCalled();
  });

  it("avisa cuando el álbum deja de verse en 7 días o menos (desde la primera foto)", async () => {
    m.albums.mockResolvedValue([
      album({ digitalPhotoPriceCents: 2500, firstPhotoDate: new Date(Date.now() - 25 * DAY) }),
    ]);
    const s = await buildPhotographerSituation(1);
    expect(s.alerts).toEqual([
      expect.objectContaining({ level: "aviso", albumId: 3, text: expect.stringContaining("5 días") }),
    ]);
  });

  it("álbum sin fotos todavía: no inventa un vencimiento", async () => {
    m.albums.mockResolvedValue([album({ digitalPhotoPriceCents: 2500, _count: { photos: 0 } })]);
    const s = await buildPhotographerSituation(1);
    expect(s.alerts).toEqual([]);
    expect(s.text).toContain("primera foto");
  });

  it("subidas fallidas → aviso del álbum", async () => {
    m.albums.mockResolvedValue([album({ digitalPhotoPriceCents: 2500 })]);
    m.jobs.mockResolvedValue([{ albumId: 3, _count: { _all: 4 } }]);
    const s = await buildPhotographerSituation(1);
    expect(s.alerts).toEqual([expect.objectContaining({ level: "aviso", albumId: 3, text: expect.stringContaining("4 subidas") })]);
  });

  it("muestra importes en pesos con formato argentino", async () => {
    m.orders.mockResolvedValue({ _count: { _all: 2 }, _sum: { totalCents: 5980 } });
    const text = (await buildPhotographerSituation(1)).text;
    expect(text).toContain("$");
    expect(text).toContain("5.980");
  });

  it("sólo consulta datos del usuario pedido", async () => {
    await buildPhotographerSituation(42);
    expect(m.albums.mock.calls[0][0].where).toMatchObject({ userId: 42, deletedAt: null });
    expect(m.orders.mock.calls[0][0].where).toMatchObject({ album: { userId: 42 }, isTest: false, status: "PAID" });
    expect(m.jobs.mock.calls[0][0].where).toMatchObject({ album: { userId: 42 }, status: "FAILED" });
    expect(m.health).toHaveBeenCalledWith({ ownerType: "USER", ownerId: 42 });
  });

  it("álbum escolar sin escuela → alerta «a medias» que bloquea ventas", async () => {
    m.albums.mockResolvedValue([album({ digitalPhotoPriceCents: 2500, mode: "SCHOOL", schoolId: null })]);
    const s = await buildPhotographerSituation(1);
    expect(s.alerts).toContainEqual({
      level: "bloquea_ventas",
      albumId: 3,
      text: "«Egresados» está marcado como escolar pero no tiene escuela: queda a medias.",
    });
  });

  it("álbum escolar de prueba sin escuela no genera la alerta", async () => {
    m.albums.mockResolvedValue([album({ digitalPhotoPriceCents: 2500, mode: "SCHOOL", schoolId: null, isTest: true })]);
    const s = await buildPhotographerSituation(1);
    expect(s.alerts.some((a) => a.text.includes("a medias"))).toBe(false);
  });

  it("con álbum escolar muestra en qué paso del armado está", async () => {
    m.albums.mockResolvedValue([album({ digitalPhotoPriceCents: 2500, mode: "SCHOOL", schoolId: 5 })]);
    m.schoolAlbum.mockResolvedValue({ id: 3 });
    const s = await buildPhotographerSituation(7);
    expect(m.progreso).toHaveBeenCalledWith(7);
    expect(s.text).toContain("Escolar: paso 6 de 11 en «Egresados»");
  });

  it("busca álbumes escolares reales en toda la cuenta, sin contar los de prueba", async () => {
    m.albums.mockResolvedValue([album({ digitalPhotoPriceCents: 2500 })]);
    m.schoolAlbum.mockResolvedValue({ id: 1 });
    const s = await buildPhotographerSituation(7);
    expect(m.schoolAlbum.mock.calls[0][0].where).toEqual({
      userId: 7,
      deletedAt: null,
      isTest: false,
      OR: [{ schoolId: { not: null } }, { mode: "SCHOOL" }],
    });
    expect(s.text).toContain("Escolar: paso 6 de 11");
  });

  it("sin álbumes escolares no calcula el progreso", async () => {
    m.albums.mockResolvedValue([album({ digitalPhotoPriceCents: 2500 })]);
    const s = await buildPhotographerSituation(1);
    expect(m.progreso).not.toHaveBeenCalled();
    expect(s.text).not.toContain("Escolar:");
  });

  it("si el progreso escolar falla, la situación sale igual", async () => {
    m.albums.mockResolvedValue([album({ digitalPhotoPriceCents: 2500, mode: "SCHOOL", schoolId: 5 })]);
    m.schoolAlbum.mockResolvedValue({ id: 3 });
    m.progreso.mockRejectedValue(new Error("base caída"));
    const s = await buildPhotographerSituation(1);
    expect(s.text).toContain("Egresados");
    expect(s.text).not.toContain("Escolar:");
  });

  it("si la búsqueda del álbum escolar falla, la situación sale igual", async () => {
    m.albums.mockResolvedValue([album({ digitalPhotoPriceCents: 2500 })]);
    m.schoolAlbum.mockRejectedValue(new Error("base caída"));
    const s = await buildPhotographerSituation(1);
    expect(m.progreso).not.toHaveBeenCalled();
    expect(s.text).toContain("Egresados");
  });
});
