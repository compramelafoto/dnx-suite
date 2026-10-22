import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  album: { findUnique: vi.fn() },
  photo: { count: vi.fn() },
  packDefinition: { count: vi.fn() },
  order: { findUnique: vi.fn() },
  token: { findFirst: vi.fn() },
  config: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    album: m.album,
    photo: m.photo,
    packDefinition: m.packDefinition,
    order: m.order,
    orderDownloadToken: m.token,
  },
  // lectura.ts (fechaAR) arrastra album-order-payment-recovery, que lee estos enums al cargar (preflight #3).
  OrderOrigin: { STANDARD_CHECKOUT: "STANDARD_CHECKOUT", PREVENTA_PACK: "PREVENTA_PACK" },
  CheckoutPaymentSource: { MERCADO_PAGO: "MERCADO_PAGO" },
}));
// fechaAR vive en lectura.ts: se cortan las cadenas que arrastra al cargar (precios, packs, Mercado Pago).
vi.mock("@/lib/mercadopago/album-order-mp-preference", () => ({ ensureAlbumOrderMpPreference: vi.fn() }));
vi.mock("@/lib/pricing/pricing-engine", () => ({ computeCheckoutTotals: vi.fn() }));
vi.mock("@/lib/preventa-canjeable/pack-service", () => ({ listActivePacksForPublicCatalog: vi.fn() }));
vi.mock("@/lib/services/settingsService", () => ({ getAppConfig: m.config }));

import type { CompradorActor } from "./identidad";
import { buildBuyerSituation } from "./situacion";
// La misma fecha que escribe el bot: armarla con otro formato fallaba los días de un dígito.
import { fechaAR } from "./herramientas/lectura";

const TOKEN = "a1".repeat(32);
const DIA = 86_400_000;
const actor = (o: Partial<CompradorActor> = {}): CompradorActor => ({
  guestKey: "g".repeat(32), ipHash: "h", conversationId: "c1", pagina: null, pagePath: null,
  albumId: null, enlace: null, emailVerificado: null, userId: null, ...o,
});
const ALBUM = {
  id: 3, title: "Maratón Rosario", isPublic: true, isHidden: false, deletedAt: null, cleanupStatus: "NONE",
  expiresAt: new Date(Date.now() + 10 * DIA), hiddenPhotosEnabled: false,
};

beforeEach(() => {
  for (const grupo of [m.album, m.photo, m.packDefinition, m.order, m.token]) {
    for (const f of Object.values(grupo)) f.mockReset();
  }
  m.config.mockReset();
  m.config.mockResolvedValue({ downloadLinkDays: 15 });
  m.album.findUnique.mockResolvedValue(ALBUM);
  m.photo.count.mockResolvedValue(120);
  m.packDefinition.count.mockResolvedValue(0);
});

describe("buildBuyerSituation", () => {
  it("visitante en un álbum", async () => {
    const s = await buildBuyerSituation(actor({ pagina: { tipo: "album", slug: "maraton" }, albumId: 3 }));
    expect(s.split("\n")).toEqual([
      "# Situación",
      "Página: álbum «Maratón Rosario»",
      "Nivel: visitante",
      `Álbum #3 «Maratón Rosario» · disponible hasta el ${fechaAR(ALBUM.expiresAt).slice(0, 5)} · 120 fotos · fotos ocultas: no · preventa: no`,
      "Los enlaces de descarga duran 15 días.",
    ]);
    // La consulta del álbum no trae precios: salen de cotizar_fotos.
    expect(JSON.stringify(m.album.findUnique.mock.calls[0][0])).not.toMatch(/price|discount/i);
  });

  it("con enlace de descarga: pedido y vigencia, sin token ni mail completo", async () => {
    m.order.findUnique.mockResolvedValue({ id: 5, status: "PAID", isTest: false });
    m.token.findFirst.mockResolvedValue({ expiresAt: new Date("2030-10-20T15:00:00Z") });
    const a = actor({
      pagina: { tipo: "descarga", token: TOKEN },
      pagePath: "/descargas/[token]",
      albumId: 3,
      enlace: { tipo: "descarga", orderId: 5, albumId: 3 },
      emailVerificado: "juana@gmail.com",
    });
    const s = await buildBuyerSituation(a);
    expect(s).toContain("Página: descarga del pedido #5");
    expect(s).toContain("Nivel: verificado (ju***@gmail.com)");
    expect(s).toContain("Pedido #5: pagado · descarga vigente hasta 20/10");
    expect(JSON.stringify(s)).not.toContain(TOKEN);
    expect(s).not.toContain("juana@gmail.com");
    expect(s).not.toMatch(/[a-z0-9.]+@gmail\.com/);
  });

  it("con enlace de descarga vencido", async () => {
    m.order.findUnique.mockResolvedValue({ id: 5, status: "PAID", isTest: false });
    m.token.findFirst.mockResolvedValue({ expiresAt: new Date(Date.now() - DIA) });
    const s = await buildBuyerSituation(
      actor({ pagina: { tipo: "descarga", token: TOKEN }, albumId: 3, enlace: { tipo: "descarga", orderId: 5, albumId: 3 } }),
    );
    expect(s).toContain("Nivel: con enlace (pedido #5)");
    expect(s).toContain("Pedido #5: pagado · descarga vencida");
  });

  it("pack con enlace inválido o vencido: lo dice y no inventa pedido", async () => {
    const s = await buildBuyerSituation(actor({ pagina: { tipo: "pack", token: "x".repeat(40) } }));
    expect(s).toContain("Página: pack de preventa (el enlace venció o no es válido)");
    expect(s).not.toContain("Pedido #");
    expect(s).not.toContain("x".repeat(40));
  });

  it("página de pago: sólo el estado del pedido (no prueba que sea suyo)", async () => {
    m.order.findUnique.mockResolvedValue({ id: 9, status: "PENDING", isTest: false });
    const s = await buildBuyerSituation(actor({ pagina: { tipo: "pago", resultado: "pending", orderId: 9 }, albumId: 3 }));
    expect(s).toContain("Página: resultado de pago (pendiente) del pedido #9");
    expect(s).toContain("Nivel: visitante");
    expect(s).toContain("Pedido #9: pendiente de pago");
    expect(m.token.findFirst).not.toHaveBeenCalled();
  });

  it("álbum oculto que la persona no puede ver: sin título", async () => {
    m.album.findUnique.mockResolvedValue({ ...ALBUM, isHidden: true, title: "Secreto" });
    const s = await buildBuyerSituation(actor({ pagina: { tipo: "album_id", albumId: 3, photoId: null }, albumId: 3 }));
    expect(s).not.toContain("Secreto");
    expect(s).toContain("Álbum #3 · oculto");
  });

  it("página de quitar una foto y álbum con fotos ocultas y preventa", async () => {
    m.album.findUnique.mockResolvedValue({ ...ALBUM, hiddenPhotosEnabled: true });
    m.packDefinition.count.mockResolvedValue(2);
    const s = await buildBuyerSituation(actor({ pagina: { tipo: "album_id", albumId: 3, photoId: 44 }, albumId: 3 }));
    expect(s).toContain("Página: pedir que se quite la foto #44 del álbum «Maratón Rosario»");
    expect(s).toContain("fotos ocultas: sí · preventa: sí");
  });

  it("si la base falla, omite esas líneas y no lanza", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    m.album.findUnique.mockRejectedValue(new Error("db caída"));
    m.order.findUnique.mockRejectedValue(new Error("db caída"));
    m.config.mockRejectedValue(new Error("db caída"));
    const s = await buildBuyerSituation(
      actor({ pagina: { tipo: "descarga", token: TOKEN }, albumId: 3, enlace: { tipo: "descarga", orderId: 5, albumId: 3 } }),
    );
    expect(s.split("\n")).toEqual(["# Situación", "Página: descarga del pedido #5", "Nivel: con enlace (pedido #5)"]);
    expect(s).not.toContain("db caída");
    expect(log).toHaveBeenCalledTimes(3);
    log.mockRestore();
  });

  it("sin página", async () => {
    const s = await buildBuyerSituation(actor());
    expect(s.split("\n").slice(0, 3)).toEqual(["# Situación", "Página: otra página del sitio", "Nivel: visitante"]);
  });
});
