import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  album: { findFirst: vi.fn(), findMany: vi.fn() },
  photo: { findMany: vi.fn(), count: vi.fn() },
  order: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
  token: { findFirst: vi.fn(), findMany: vi.fn() },
  zip: { findFirst: vi.fn() },
  albumPack: { findMany: vi.fn() },
  totals: vi.fn(),
  packs: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    album: m.album,
    photo: m.photo,
    order: m.order,
    orderDownloadToken: m.token,
    zipGenerationJob: m.zip,
    albumPack: m.albumPack,
  },
  // album-order-payment-recovery lee estos enums al cargar el módulo (preflight #3).
  OrderOrigin: { STANDARD_CHECKOUT: "STANDARD_CHECKOUT", PREVENTA_PACK: "PREVENTA_PACK" },
  CheckoutPaymentSource: { MERCADO_PAGO: "MERCADO_PAGO" },
}));
// Se usa el albumOrderCanRetryPayment real; sólo se corta la cadena de Mercado Pago que arrastra.
vi.mock("@/lib/mercadopago/album-order-mp-preference", () => ({ ensureAlbumOrderMpPreference: vi.fn() }));
vi.mock("@/lib/pricing/pricing-engine", () => ({ computeCheckoutTotals: m.totals }));
vi.mock("@/lib/preventa-canjeable/pack-service", () => ({ listActivePacksForPublicCatalog: m.packs }));

import { formatPurchaseArs } from "@/lib/album-purchase/format-purchase-ars";
import { benefitStableKey } from "@/lib/preventa-canjeable/preventa-pack-snapshot-v1";
import { ACTOR_MOTOR_COMPRADOR, type CompradorActor } from "../identidad";
import { fechaAR, herramientasDeLectura } from "./lectura";

const TOKEN = "f".repeat(64);
const actor = (o: Partial<CompradorActor> = {}): CompradorActor => ({
  guestKey: "g".repeat(32), ipHash: "h", conversationId: "c1", pagina: null, pagePath: null,
  albumId: null, enlace: null, emailVerificado: null, userId: null, ...o,
});
const tool = (a: CompradorActor, name: string) => herramientasDeLectura(a).find((t) => t.name === name)!;
const DIA = 86400000;

beforeEach(() => {
  for (const grupo of [m.album, m.photo, m.order, m.token, m.zip, m.albumPack]) {
    for (const f of Object.values(grupo)) f.mockReset();
  }
  m.totals.mockReset();
  m.packs.mockReset();
});

const PEDIDO_88 = {
  id: 88, status: "PENDING", albumId: 3, buyerEmail: "juana@gmail.com", buyerUserId: null, totalCents: 9000,
  isTest: false, origin: "STANDARD_CHECKOUT", checkoutPaymentSource: "MERCADO_PAGO",
  createdAt: new Date("2026-10-12T15:00:00Z"), album: { title: "X" },
};

describe("fechaAR", () => {
  it("usa la hora argentina", () => {
    expect(fechaAR(new Date("2026-10-12T15:00:00Z"))).toBe("12/10/2026");
    // 02:00 UTC del 12 son las 23:00 del 11 en Argentina.
    expect(fechaAR(new Date("2026-10-12T02:00:00Z"))).toBe("11/10/2026");
  });
});

describe("armado", () => {
  it("todas son de lectura y sin enlace no se ofrecen ver_mi_descarga ni ver_mi_pack", () => {
    const ts = herramientasDeLectura(actor());
    const nombres = ts.map((t) => t.name);
    expect(nombres).toEqual(["buscar_album", "ver_album", "cotizar_fotos", "estado_de_pago", "mis_pedidos"]);
    expect(ts.every((t) => t.kind === "read")).toBe(true);
  });
  it("con enlace de descarga se ofrece ver_mi_descarga y no ver_mi_pack", () => {
    const nombres = herramientasDeLectura(actor({ enlace: { tipo: "descarga", orderId: 5, albumId: 3 } })).map((t) => t.name);
    expect(nombres).toContain("ver_mi_descarga");
    expect(nombres).not.toContain("ver_mi_pack");
  });
  it("con enlace de pack se ofrece ver_mi_pack y no ver_mi_descarga", () => {
    const nombres = herramientasDeLectura(actor({ enlace: { tipo: "pack", orderId: 5, albumId: 3 } })).map((t) => t.name);
    expect(nombres).toContain("ver_mi_pack");
    expect(nombres).not.toContain("ver_mi_descarga");
  });
});

describe("buscar_album", () => {
  it("arma el where sólo con álbumes públicos, no de prueba y no borrados", async () => {
    m.album.findMany.mockResolvedValue([]);
    const r = await tool(actor(), "buscar_album").run({ texto: "boda" }, ACTOR_MOTOR_COMPRADOR);
    const q = m.album.findMany.mock.calls[0]![0];
    expect(q.where).toMatchObject({ isPublic: true, isHidden: false, isTest: false, deletedAt: null });
    expect(q.where.OR).toHaveLength(4);
    expect(q).toMatchObject({ take: 5, orderBy: { createdAt: "desc" } });
    expect(r).toMatchObject({ ok: true, message: "No encontré álbumes públicos con ese nombre.", data: { albumes: [] } });
  });
  it("devuelve el enlace al álbum y el nombre del fotógrafo", async () => {
    m.album.findMany.mockResolvedValue([
      { id: 3, title: "Boda", publicSlug: "boda-x", location: "Rosario", eventDate: new Date("2026-10-10T15:00:00Z"), user: { name: "Ana", companyName: "Estudio A" } },
    ]);
    const r = await tool(actor(), "buscar_album").run({ texto: "boda" }, ACTOR_MOTOR_COMPRADOR);
    expect(r).toMatchObject({
      ok: true,
      data: { albumes: [{ albumId: 3, titulo: "Boda", fotografo: "Estudio A", fecha: "10/10/2026", lugar: "Rosario", enlace: "/album/boda-x" }] },
    });
  });
  it("valida el largo del texto", () => {
    const t = tool(actor(), "buscar_album");
    expect(t.input.safeParse({ texto: "ab" }).success).toBe(false);
    expect(t.input.safeParse({ texto: "a".repeat(81) }).success).toBe(false);
    expect(t.input.safeParse({ texto: "abc", otro: 1 }).success).toBe(false);
  });
});

const ALBUM_3 = {
  id: 3, title: "X", isPublic: true, isHidden: false, isTest: false, deletedAt: null, cleanupStatus: "NONE",
  firstPhotoDate: new Date(Date.now() - 5 * DIA), expirationExtensionDays: 0, digitalPhotoPriceCents: 1234, hiddenPhotosEnabled: false,
  enablePrintedPhotos: false, publicSlug: "x", user: { name: "F", companyName: null },
  digitalDiscount5Plus: null, digitalDiscount10Plus: 10, digitalDiscount20Plus: null,
};

describe("ver_album", () => {
  it("de un álbum no público fuera de su página → no encontrado", async () => {
    m.album.findFirst.mockResolvedValue({ id: 3, isPublic: false, isHidden: false, isTest: false });
    const r = await tool(actor({ albumId: 7 }), "ver_album").run({ albumId: 3 }, ACTOR_MOTOR_COMPRADOR);
    expect(r).toMatchObject({ ok: false, message: "No encontré ese álbum." });
    expect(m.album.findFirst.mock.calls[0]![0].where).toMatchObject({ id: 3, isTest: false });
  });
  it("un álbum no listado se ve si es la página donde está la persona", async () => {
    m.album.findFirst.mockResolvedValue({ ...ALBUM_3, isPublic: false });
    m.photo.count.mockResolvedValue(0);
    m.packs.mockResolvedValue([]);
    m.albumPack.findMany.mockResolvedValue([]);
    const r = await tool(actor({ albumId: 3 }), "ver_album").run({ albumId: 3 }, ACTOR_MOTOR_COMPRADOR);
    expect(r.ok).toBe(true);
  });
  it("un álbum oculto no se ve aunque sea la página donde está la persona", async () => {
    m.album.findFirst.mockResolvedValue({ ...ALBUM_3, isPublic: false, isHidden: true });
    const r = await tool(actor({ albumId: 3 }), "ver_album").run({ albumId: 3 }, ACTOR_MOTOR_COMPRADOR);
    expect(r).toMatchObject({ ok: false, message: "No encontré ese álbum." });
    m.album.findFirst.mockResolvedValue({ ...ALBUM_3, isPublic: true, isHidden: true });
    const r2 = await tool(actor({ albumId: 3 }), "cotizar_fotos").run({ albumId: 3, cantidad: 1 }, ACTOR_MOTOR_COMPRADOR);
    expect(r2).toMatchObject({ ok: false, message: "No encontré ese álbum." });
    expect(m.photo.count).not.toHaveBeenCalled();
    expect(m.photo.findMany).not.toHaveBeenCalled();
  });
  it("no muestra el precio que carga el fotógrafo", async () => {
    m.album.findFirst.mockResolvedValue(ALBUM_3);
    m.photo.count.mockResolvedValue(0);
    m.packs.mockResolvedValue([]);
    m.albumPack.findMany.mockResolvedValue([]);
    const r = await tool(actor(), "ver_album").run({ albumId: 3 }, ACTOR_MOTOR_COMPRADOR);
    expect(JSON.stringify(r)).not.toMatch(/1\.?234/);
    expect(r).toMatchObject({ ok: true, data: { fotos: 0, precioPorFotoDigital: null } });
    expect(m.totals).not.toHaveBeenCalled();
  });
  it("el precio por foto sale del checkout (1 foto) e incluye descuentos, packs y opciones", async () => {
    m.album.findFirst.mockResolvedValue({ ...ALBUM_3, hiddenPhotosEnabled: true });
    m.photo.count.mockResolvedValue(40);
    m.photo.findMany.mockResolvedValue([{ id: 11 }]);
    m.totals.mockResolvedValue({ displayTotalCents: 3100 });
    m.packs.mockResolvedValue([{ name: "Pack egresados", priceClientArs: 25000, benefits: [{}, {}] }]);
    m.albumPack.findMany.mockResolvedValue([{ name: "Pack 10 fotos" }]);
    const r = await tool(actor(), "ver_album").run({ albumId: 3 }, ACTOR_MOTOR_COMPRADOR);
    expect(m.totals).toHaveBeenCalledWith(expect.objectContaining({ flow: "ALBUM_ORDER", albumId: 3, items: [expect.objectContaining({ tipo: "digital", quantity: 1 })] }));
    expect(r).toMatchObject({
      ok: true,
      data: {
        titulo: "X",
        fotografo: "F",
        fotos: 40,
        precioPorFotoDigital: formatPurchaseArs(3100),
        descuentos: "10+ fotos: 10% OFF",
        packsPreventa: [{ nombre: "Pack egresados", precio: formatPurchaseArs(25000), beneficios: 2 }],
        packsDelAlbum: { nombres: ["Pack 10 fotos"] },
        fotosOcultas: true,
        impresas: false,
        enlace: "/album/x",
      },
    });
    expect(JSON.stringify(r)).toContain("selfie");
    expect(JSON.stringify(r)).toMatch(/disponible hasta el \d{1,2}\/\d{1,2}/);
  });
  it("álbum vencido o sin originales lo dice", async () => {
    m.photo.count.mockResolvedValue(0);
    m.packs.mockResolvedValue([]);
    m.albumPack.findMany.mockResolvedValue([]);
    m.album.findFirst.mockResolvedValue({ ...ALBUM_3, firstPhotoDate: new Date(Date.now() - 35 * DIA) });
    const vencido = await tool(actor(), "ver_album").run({ albumId: 3 }, ACTOR_MOTOR_COMPRADOR);
    expect(JSON.stringify(vencido)).toMatch(/venció el \d{1,2}\/\d{1,2}; se puede pedir una extensión hasta el \d{1,2}\/\d{1,2}/);
    m.album.findFirst.mockResolvedValue({ ...ALBUM_3, firstPhotoDate: new Date(Date.now() - 50 * DIA) });
    const borrado = await tool(actor(), "ver_album").run({ albumId: 3 }, ACTOR_MOTOR_COMPRADOR);
    expect(JSON.stringify(borrado)).toContain("ya no está disponible");
    // Caso real (álbum 1099): creado y con primera foto hace 7 días → sigue disponible aunque `expiresAt` haya quedado en la creación.
    m.album.findFirst.mockResolvedValue({ ...ALBUM_3, firstPhotoDate: new Date(Date.now() - 7 * DIA), expiresAt: new Date(Date.now() - 7 * DIA) });
    const vigente = await tool(actor(), "ver_album").run({ albumId: 3 }, ACTOR_MOTOR_COMPRADOR);
    expect(JSON.stringify(vigente)).toMatch(/disponible hasta el \d{1,2}\/\d{1,2}/);
    m.album.findFirst.mockResolvedValue({ ...ALBUM_3, firstPhotoDate: null });
    const sinFotos = await tool(actor(), "ver_album").run({ albumId: 3 }, ACTOR_MOTOR_COMPRADOR);
    expect(JSON.stringify(sinFotos)).toContain('"disponible"');
    m.album.findFirst.mockResolvedValue({ ...ALBUM_3, cleanupStatus: "COMPLETED" });
    const limpio = await tool(actor(), "ver_album").run({ albumId: 3 }, ACTOR_MOTOR_COMPRADOR);
    expect(JSON.stringify(limpio)).toContain("ya no está disponible");
  });
});

describe("cotizar_fotos", () => {
  it("usa el mismo cálculo que el checkout y muestra pesos", async () => {
    m.album.findFirst.mockResolvedValue({ id: 3, isPublic: true, isHidden: false, isTest: false, digitalDiscount5Plus: null, digitalDiscount10Plus: 10, digitalDiscount20Plus: null });
    m.photo.findMany.mockResolvedValue(Array.from({ length: 10 }, (_, i) => ({ id: i + 1 })));
    m.totals.mockResolvedValue({ displayTotalCents: 27000 });
    const r = await tool(actor(), "cotizar_fotos").run({ albumId: 3, cantidad: 10 }, ACTOR_MOTOR_COMPRADOR);
    expect(m.totals).toHaveBeenCalledWith(expect.objectContaining({ flow: "ALBUM_ORDER", albumId: 3 }));
    expect(m.totals.mock.calls[0]![0].items).toHaveLength(10);
    expect(m.photo.findMany.mock.calls[0]![0]).toMatchObject({ where: { albumId: 3, isRemoved: false }, take: 10 });
    expect(r).toMatchObject({ ok: true, data: { cantidad: 10, total: formatPurchaseArs(27000), descuentoPorcentaje: 10 } });
  });
  it("sin descuentos configurados no inventa uno", async () => {
    m.album.findFirst.mockResolvedValue({ id: 3, isPublic: true, isHidden: false, isTest: false, digitalDiscount5Plus: null, digitalDiscount10Plus: null, digitalDiscount20Plus: null });
    m.photo.findMany.mockResolvedValue(Array.from({ length: 20 }, (_, i) => ({ id: i + 1 })));
    m.totals.mockResolvedValue({ displayTotalCents: 60000 });
    const r = await tool(actor(), "cotizar_fotos").run({ albumId: 3, cantidad: 20 }, ACTOR_MOTOR_COMPRADOR);
    expect(r).toMatchObject({ ok: true, data: { descuentoPorcentaje: 0 } });
  });
  it("si el álbum tiene menos fotos lo dice", async () => {
    m.album.findFirst.mockResolvedValue({ id: 3, isPublic: true, isHidden: false, isTest: false });
    m.photo.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const r = await tool(actor(), "cotizar_fotos").run({ albumId: 3, cantidad: 5 }, ACTOR_MOTOR_COMPRADOR);
    expect(r).toMatchObject({ ok: false, message: "El álbum tiene 2 fotos." });
    expect(m.totals).not.toHaveBeenCalled();
  });
  it("álbum no público fuera de su página → no encontrado", async () => {
    m.album.findFirst.mockResolvedValue({ id: 3, isPublic: true, isHidden: true, isTest: false });
    const r = await tool(actor(), "cotizar_fotos").run({ albumId: 3, cantidad: 1 }, ACTOR_MOTOR_COMPRADOR);
    expect(r).toMatchObject({ ok: false, message: "No encontré ese álbum." });
  });
});

describe("estado_de_pago", () => {
  it("de visitante: sólo el estado, sin mail ni total", async () => {
    m.order.findFirst.mockResolvedValue(PEDIDO_88);
    const r = await tool(actor(), "estado_de_pago").run({ pedido: 88 }, ACTOR_MOTOR_COMPRADOR);
    expect(r).toMatchObject({ ok: true, data: { pedido: 88, estado: "pendiente de pago" } });
    expect(JSON.stringify(r)).not.toMatch(/juana|9\.000|reintentar/);
    expect(m.order.findFirst.mock.calls[0]![0].where).toMatchObject({ id: 88, isTest: false });
  });
  it("el pedido de la página de pago no prueba que sea suyo", async () => {
    m.order.findFirst.mockResolvedValue(PEDIDO_88);
    const r = await tool(actor({ albumId: 3 }), "estado_de_pago").run({ pedido: 88 }, ACTOR_MOTOR_COMPRADOR);
    expect(JSON.stringify(r)).not.toMatch(/juana|9\.000|reintentar/);
  });
  it("con el mail correcto da el enlace para reintentar", async () => {
    m.order.findFirst.mockResolvedValue(PEDIDO_88);
    const r = await tool(actor(), "estado_de_pago").run({ pedido: 88, email: "JUANA@gmail.com" }, ACTOR_MOTOR_COMPRADOR);
    expect(r).toMatchObject({ ok: true, data: { estado: "pendiente de pago", reintentar: "/pago/reintentar/88" } });
    expect(JSON.stringify(r)).not.toContain("juana@gmail.com");
    expect(JSON.stringify(r)).not.toMatch(/9\.000/);
  });
  it("con otro mail no da el enlace", async () => {
    m.order.findFirst.mockResolvedValue(PEDIDO_88);
    const r = await tool(actor(), "estado_de_pago").run({ pedido: 88, email: "otra@gmail.com" }, ACTOR_MOTOR_COMPRADOR);
    expect(JSON.stringify(r)).not.toMatch(/juana|reintentar/);
  });
  it("verificado con su mail ve fecha, total y álbum", async () => {
    m.order.findFirst.mockResolvedValue({ ...PEDIDO_88, status: "PAID" });
    const r = await tool(actor({ emailVerificado: "juana@gmail.com" }), "estado_de_pago").run({ pedido: 88 }, ACTOR_MOTOR_COMPRADOR);
    expect(r).toMatchObject({ ok: true, data: { estado: "pagado", total: formatPurchaseArs(9000), album: "X", fecha: "12/10/2026" } });
    expect((r as { data: { reintentar?: string } }).data.reintentar).toBeUndefined();
    expect(JSON.stringify(r)).not.toContain("juana@gmail.com");
  });
  it("compara el mail verificado normalizado de los dos lados", async () => {
    m.order.findFirst.mockResolvedValue({ ...PEDIDO_88, buyerEmail: " Juana@Gmail.com " });
    const r = await tool(actor({ emailVerificado: "JUANA@gmail.com " }), "estado_de_pago").run({ pedido: 88 }, ACTOR_MOTOR_COMPRADOR);
    expect(r).toMatchObject({ ok: true, data: { total: formatPurchaseArs(9000), reintentar: "/pago/reintentar/88" } });
  });
  it("con enlace del pedido es propio y puede reintentar", async () => {
    m.order.findFirst.mockResolvedValue({ ...PEDIDO_88, status: "FAILED" });
    const a = actor({ enlace: { tipo: "descarga", orderId: 88, albumId: 3 } });
    const r = await tool(a, "estado_de_pago").run({ pedido: 88 }, ACTOR_MOTOR_COMPRADOR);
    expect(r).toMatchObject({ ok: true, data: { estado: "rechazado", total: formatPurchaseArs(9000), reintentar: "/pago/reintentar/88" } });
  });
  it("pedido que no existe", async () => {
    m.order.findFirst.mockResolvedValue(null);
    const r = await tool(actor(), "estado_de_pago").run({ pedido: 1 }, ACTOR_MOTOR_COMPRADOR);
    expect(r).toMatchObject({ ok: false, message: "No encontré ese pedido." });
  });
});

describe("mis_pedidos", () => {
  it("sin verificar no consulta pedidos", async () => {
    const r = await tool(actor(), "mis_pedidos").run({}, ACTOR_MOTOR_COMPRADOR);
    expect(r).toMatchObject({ ok: false, message: "Para ver tus pedidos primero verificá tu mail: pedime un código." });
    expect(m.order.findMany).not.toHaveBeenCalled();
  });
  it("verificado busca por mail sin distinguir mayúsculas y por usuario de la sesión", async () => {
    m.order.findMany.mockResolvedValue([]);
    m.token.findMany.mockResolvedValue([]);
    await tool(actor({ emailVerificado: "juana@gmail.com", userId: 4 }), "mis_pedidos").run({}, ACTOR_MOTOR_COMPRADOR);
    expect(m.order.findMany.mock.calls[0]![0].where).toMatchObject({ isTest: false, OR: [{ buyerEmail: { equals: "juana@gmail.com", mode: "insensitive" } }, { buyerUserId: 4 }] });
    expect(m.order.findMany.mock.calls[0]![0]).toMatchObject({ orderBy: { createdAt: "desc" }, take: 10 });
  });
  it("busca con el mail verificado normalizado", async () => {
    m.order.findMany.mockResolvedValue([]);
    await tool(actor({ emailVerificado: " Juana@Gmail.com" }), "mis_pedidos").run({}, ACTOR_MOTOR_COMPRADOR);
    expect(m.order.findMany.mock.calls[0]![0].where.OR).toEqual([{ buyerEmail: { equals: "juana@gmail.com", mode: "insensitive" } }]);
  });
  it("lee el nivel en el momento: si verifica a mitad de turno ya funciona", async () => {
    const a = actor();
    const t = tool(a, "mis_pedidos");
    a.emailVerificado = "juana@gmail.com";
    m.order.findMany.mockResolvedValue([]);
    const r = await t.run({}, ACTOR_MOTOR_COMPRADOR);
    expect(r.ok).toBe(true);
    expect(m.order.findMany.mock.calls[0]![0].where.OR).toEqual([{ buyerEmail: { equals: "juana@gmail.com", mode: "insensitive" } }]);
  });
  it("muestra la vigencia de la descarga más lejana por pedido, sin tokens ni mail", async () => {
    const ahora = Date.now();
    m.order.findMany.mockResolvedValue([
      { id: 1, status: "PAID", totalCents: 9000, createdAt: new Date("2026-10-12T15:00:00Z"), album: { title: "A" } },
      { id: 2, status: "PAID", totalCents: 5000, createdAt: new Date("2026-10-01T15:00:00Z"), album: { title: "B" } },
      { id: 3, status: "PENDING", totalCents: 5000, createdAt: new Date("2026-10-01T15:00:00Z"), album: { title: "C" } },
    ]);
    m.token.findMany.mockResolvedValue([
      { orderId: 1, expiresAt: new Date(ahora - DIA) },
      { orderId: 1, expiresAt: new Date(ahora + 5 * DIA) },
      { orderId: 2, expiresAt: new Date(ahora - DIA) },
    ]);
    const r = await tool(actor({ emailVerificado: "juana@gmail.com" }), "mis_pedidos").run({}, ACTOR_MOTOR_COMPRADOR);
    expect(m.token.findMany.mock.calls[0]![0].where).toMatchObject({ orderId: { in: [1, 2, 3] }, type: "CLIENT_DIGITAL", photoId: null });
    const pedidos = (r as { data: { pedidos: { pedido: number; descarga: string; total: string; album: string }[] } }).data.pedidos;
    expect(pedidos[0]).toMatchObject({ pedido: 1, album: "A", fecha: "12/10/2026", estado: "pagado", total: formatPurchaseArs(9000) });
    expect(pedidos[0]!.descarga).toMatch(/^vigente hasta \d{2}\/\d{2}$/);
    expect(pedidos[1]!.descarga).toBe("vencida");
    expect(pedidos[2]!.descarga).toBe("no corresponde");
    expect(JSON.stringify(r)).not.toMatch(/juana|token/i);
  });
});

describe("ver_mi_descarga", () => {
  const a = () => actor({ enlace: { tipo: "descarga", orderId: 5, albumId: 3 } });
  it("no devuelve el token", async () => {
    m.order.findUnique.mockResolvedValue({ id: 5, status: "PAID", album: { title: "X", deletedAt: null, cleanupStatus: "NONE" }, _count: { items: 4, videoItems: 0 } });
    m.token.findFirst.mockResolvedValue({ expiresAt: new Date(Date.now() + DIA), token: TOKEN });
    m.zip.findFirst.mockResolvedValue({ status: "COMPLETED" });
    const r = await tool(a(), "ver_mi_descarga").run({}, ACTOR_MOTOR_COMPRADOR);
    expect(JSON.stringify(r)).not.toContain(TOKEN);
    expect(r).toMatchObject({ ok: true, data: { pedido: 5, estado: "pagado", album: "X", originales: true, fotos: 4, videos: 0, zip: "listo" } });
    expect(m.order.findUnique.mock.calls[0]![0].where).toEqual({ id: 5 });
    expect(m.zip.findFirst.mock.calls[0]![0]).toMatchObject({ where: { orderId: 5, type: "ORDER_DOWNLOAD" }, orderBy: { createdAt: "desc" } });
  });
  it("ZIP fallado, en preparación y enlace vencido", async () => {
    m.order.findUnique.mockResolvedValue({ id: 5, status: "PAID", album: { title: "X", deletedAt: null, cleanupStatus: "COMPLETED" }, _count: { items: 4, videoItems: 1 } });
    m.token.findFirst.mockResolvedValue({ expiresAt: new Date(Date.now() - DIA) });
    m.zip.findFirst.mockResolvedValue({ status: "FAILED" });
    const r1 = await tool(a(), "ver_mi_descarga").run({}, ACTOR_MOTOR_COMPRADOR);
    expect(r1).toMatchObject({ ok: true, data: { originales: false, videos: 1, zip: "falló", vigencia: "vencido" } });
    m.zip.findFirst.mockResolvedValue(null);
    const r2 = await tool(a(), "ver_mi_descarga").run({}, ACTOR_MOTOR_COMPRADOR);
    expect(r2).toMatchObject({ ok: true, data: { zip: "se está preparando" } });
  });
});

describe("ver_mi_pack", () => {
  const a = () => actor({ enlace: { tipo: "pack", orderId: 9, albumId: 3 } });
  const snapshot = (deadline: string | null) => ({
    schemaVersion: 1, frozenAt: "2026-09-01T00:00:00.000Z", packDefinitionId: 1, packName: "Pack egresados",
    packDescription: null, packVersion: 1, priceClientArs: 25000, currency: "ARS", redemptionDeadlineAt: deadline,
    benefits: [{
      stableKey: benefitStableKey(1, 1), benefitDefinitionId: 1, kind: "DIGITAL", selectionMode: "SINGLE_PHOTO",
      includedQuantity: 1, requiredPhotoCount: 1, templatePolicy: "NONE", sortOrder: 0,
    }],
  });
  it("sin fotos todavía: espera el mail; fecha límite del snapshot", async () => {
    m.order.findUnique.mockResolvedValue({ id: 9, status: "PAID", origin: "PREVENTA_PACK", albumId: 3, redemptionOrderId: null, preventaPackSnapshotJson: snapshot("2026-12-20T15:00:00.000Z") });
    m.photo.count.mockResolvedValue(0);
    const r = await tool(a(), "ver_mi_pack").run({}, ACTOR_MOTOR_COMPRADOR);
    expect(r).toMatchObject({
      ok: true,
      data: { pedido: 9, estado: "pagado", pack: "Pack egresados", fechaLimiteCanje: "20/12/2026", canjeado: false, hayFotos: false, siguientePaso: "Todavía no hay fotos. Cuando el fotógrafo las suba y mande el aviso, vas a poder elegir desde este mismo enlace." },
    });
  });
  it("con fotos y sin canjear; snapshot roto → pack null", async () => {
    m.order.findUnique.mockResolvedValue({ id: 9, status: "PAID", origin: "PREVENTA_PACK", albumId: 3, redemptionOrderId: null, preventaPackSnapshotJson: { roto: true } });
    m.photo.count.mockResolvedValue(12);
    const r = await tool(a(), "ver_mi_pack").run({}, ACTOR_MOTOR_COMPRADOR);
    expect(r).toMatchObject({ ok: true, data: { pack: null, fechaLimiteCanje: null, hayFotos: true, siguientePaso: "Ya podés elegir tus fotos desde este enlace." } });
  });
  it("canjeado", async () => {
    m.order.findUnique.mockResolvedValue({ id: 9, status: "PAID", origin: "PREVENTA_PACK", albumId: 3, redemptionOrderId: 50, preventaPackSnapshotJson: snapshot(null) });
    m.photo.count.mockResolvedValue(12);
    const r = await tool(a(), "ver_mi_pack").run({}, ACTOR_MOTOR_COMPRADOR);
    expect(r).toMatchObject({ ok: true, data: { canjeado: true, siguientePaso: "Ya elegiste tus fotos." } });
  });
  it("un pedido que no es de preventa → no encontrado", async () => {
    m.order.findUnique.mockResolvedValue({ id: 9, status: "PAID", origin: "STANDARD_CHECKOUT", albumId: 3, redemptionOrderId: null, preventaPackSnapshotJson: null });
    const r = await tool(a(), "ver_mi_pack").run({}, ACTOR_MOTOR_COMPRADOR);
    expect(r).toMatchObject({ ok: false, message: "No encontré ese pedido." });
  });
});
