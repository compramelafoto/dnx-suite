import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  create: vi.fn(), history: vi.fn(), find: vi.fn(), update: vi.fn(), tg: vi.fn(), registrar: vi.fn(), contar: vi.fn(), order: vi.fn(),
}));
vi.mock("@/lib/support/create-ticket", () => ({ createSupportTicket: m.create }));
vi.mock("@/lib/bot/store", () => ({ loadHistory: m.history, upsertIncident: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { botConversation: { findUnique: m.find, update: m.update }, order: { findUnique: m.order } } }));
vi.mock("@repo/dnx-bot", async (orig) => ({ ...(await orig<object>()), sendTelegramMessage: m.tg }));
vi.mock("@/lib/bot/config", () => ({ BOT_PLATFORM: "CLF", readBotConfig: () => ({ telegram: { token: "t", chatId: "c" } }) }));
vi.mock("./store", () => ({ registrarAccionComprador: m.registrar, contarAccionesComprador: m.contar }));

import { abrirCasoComprador, CASOS_POR_IP_DIA, esCasoDePlata, type MotivoCaso } from "./caso";
import type { CompradorActor } from "./identidad";

const actor = (o: Partial<CompradorActor> = {}): CompradorActor => ({
  guestKey: "g".repeat(32), ipHash: "h".repeat(64), conversationId: "c1", pagina: null, pagePath: "/ayuda",
  albumId: null, enlace: null, emailVerificado: null, userId: null, ...o,
});
const base = (o: Partial<Parameters<typeof abrirCasoComprador>[0]> = {}) => ({
  actor: actor(), email: "juana@gmail.com", nombre: "Juana", motivo: "otro" as MotivoCaso,
  resumen: "No encuentra su álbum", urgente: false, orderId: null, ...o,
});

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.create.mockResolvedValue({ id: 31, createdAt: new Date() });
  m.history.mockResolvedValue([{ role: "user", content: "hola, no encuentro mis fotos" }]);
  m.find.mockResolvedValue({ status: "OPEN", supportTicketId: null });
  m.contar.mockResolvedValue(0);
  m.tg.mockResolvedValue(undefined);
  m.order.mockResolvedValue({ buyerEmail: "Juana@Gmail.com", buyerUserId: 9 });
});

describe("esCasoDePlata", () => {
  it("sólo los tres motivos de plata", () => {
    expect(["pago_duplicado", "pago_no_impactado", "reembolso"].every((x) => esCasoDePlata(x as MotivoCaso))).toBe(true);
    expect(esCasoDePlata("descarga")).toBe(false);
    expect(esCasoDePlata("otro")).toBe(false);
  });
});

describe("abrirCasoComprador", () => {
  it("sin mail → pide el mail y no crea ticket", async () => {
    const r = await abrirCasoComprador(base({ email: null }));
    expect(r).toEqual({ ok: false, mensaje: "Para que te respondan necesito tu mail." });
    expect(m.create).not.toHaveBeenCalled();
  });

  it("mail sin verificar: etiqueta enmascarada, pedido, rol CUSTOMER y nota con la charla", async () => {
    const r = await abrirCasoComprador(base({ email: " Juana@Gmail.com ", orderId: 88, currentUserText: "me cobraron" }));
    expect(r).toEqual({ ok: true, ticketId: 31, reused: false });
    const arg = m.create.mock.calls[0]![0];
    expect(arg.requesterLabel).toContain("mail sin verificar");
    expect(arg.requesterLabel).toContain("ju***@gmail.com");
    expect(arg.requesterLabel).not.toContain("juana@gmail.com");
    expect(arg.data).toMatchObject({
      orderId: null, printOrderId: null, requesterRole: "CUSTOMER", requesterEmail: "juana@gmail.com", requesterName: "Juana", reason: "OTHER",
    });
    expect(arg.data.description).toBe("[Comprador · mail sin verificar] Pedido declarado #88 (sin verificar). Motivo: otro.\nNo encuentra su álbum");
    expect(arg.internalNote).toMatch(/^Derivado por DNX Bot\.\n\n/);
    expect(arg.internalNote).toContain("no encuentro mis fotos");
    expect(arg.internalNote).toContain("me cobraron");
    expect(arg.adminTitle).toBe("DNX Bot derivó un caso de comprador");
    expect(m.update.mock.calls[0]![0]).toMatchObject({ where: { id: "c1" }, data: { status: "ESCALATED", supportTicketId: 31 } });
    expect(m.registrar).toHaveBeenCalledWith({
      conversationId: "c1", toolName: "abrir_caso", email: "juana@gmail.com", resultado: "ticket:31",
      datos: { motivo: "otro", urgente: false, orderId: null, pedidoDeclarado: 88 },
    });
  });

  it("sin mail propio usa el verificado y lo marca como verificado", async () => {
    await abrirCasoComprador(base({ actor: actor({ emailVerificado: "juana@gmail.com" }), email: null }));
    const arg = m.create.mock.calls[0]![0];
    expect(arg.requesterLabel).toContain("(mail verificado)");
    expect(arg.data.description).toMatch(/^\[Comprador · mail verificado\] Motivo: otro\./);
  });

  it("mail distinto del verificado → sin verificar", async () => {
    await abrirCasoComprador(base({ actor: actor({ emailVerificado: "otra@gmail.com" }) }));
    expect(m.create.mock.calls[0]![0].requesterLabel).toContain("mail sin verificar");
  });

  it("motivos → reason", async () => {
    const casos: [MotivoCaso, string][] = [
      ["reembolso", "PAYMENT_FAILED"], ["descarga", "ORDER_STATUS"], ["album_borrado", "ORDER_STATUS"], ["impresiones", "OTHER"],
    ];
    for (const [motivo, reason] of casos) {
      m.create.mockClear();
      await abrirCasoComprador(base({ motivo }));
      expect(m.create.mock.calls[0]![0].data.reason).toBe(reason);
    }
  });

  it("pago_duplicado manda Telegram aunque no sea urgente, con título urgente", async () => {
    await abrirCasoComprador(base({ motivo: "pago_duplicado", orderId: 88 }));
    expect(m.create.mock.calls[0]![0].adminTitle).toBe("URGENTE · DNX Bot derivó un caso de comprador");
    expect(m.tg).toHaveBeenCalledTimes(1);
    const texto = m.tg.mock.calls[0]![1] as string;
    expect(texto).toBe("🚨 CLF · Caso de comprador #31 (pago_duplicado)\nPedido declarado #88 (sin verificar) · ju***@gmail.com (sin verificar)\n\nNo encuentra su álbum");
  });

  it("otro no urgente no manda Telegram; urgente sí", async () => {
    await abrirCasoComprador(base());
    expect(m.tg).not.toHaveBeenCalled();
    await abrirCasoComprador(base({ urgente: true }));
    expect(m.tg).toHaveBeenCalledTimes(1);
  });

  it("si falla Telegram el caso queda igual", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    m.tg.mockRejectedValue(new Error("caído"));
    const r = await abrirCasoComprador(base({ motivo: "reembolso" }));
    expect(r).toEqual({ ok: true, ticketId: 31, reused: false });
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("cuarto caso del día para la IP → rechazado sin crear", async () => {
    m.contar.mockResolvedValue(CASOS_POR_IP_DIA);
    const r = await abrirCasoComprador(base());
    expect(r).toEqual({ ok: false, mensaje: "Ya abriste varios casos hoy. Te van a responder por mail a cada uno." });
    expect(m.create).not.toHaveBeenCalled();
    const filtro = m.contar.mock.calls[0]![0];
    expect(filtro).toMatchObject({ toolName: "abrir_caso", ipHash: "h".repeat(64) });
    expect(Date.now() - filtro.desde.getTime()).toBeGreaterThanOrEqual(24 * 3600 * 1000 - 1000);
  });

  it("conversación ya escalada → reusa sin crear ni avisar", async () => {
    m.find.mockResolvedValue({ status: "ESCALATED", supportTicketId: 44 });
    const r = await abrirCasoComprador(base({ motivo: "reembolso" }));
    expect(r).toEqual({ ok: true, ticketId: 44, reused: true });
    expect(m.create).not.toHaveBeenCalled();
    expect(m.update).not.toHaveBeenCalled();
    expect(m.tg).not.toHaveBeenCalled();
  });

  it("la descripción se recorta a 8000", async () => {
    await abrirCasoComprador(base({ resumen: "x".repeat(9000) }));
    expect(m.create.mock.calls[0]![0].data.description.length).toBe(8000);
  });

  describe("vínculo con el pedido", () => {
    it("pedido ajeno con mail verificado distinto → orderId null y «sin verificar» en ticket, acción y Telegram", async () => {
      m.order.mockResolvedValue({ buyerEmail: "duenia@gmail.com", buyerUserId: 3 });
      await abrirCasoComprador(base({
        actor: actor({ emailVerificado: "juana@gmail.com" }), email: null, motivo: "cambio_de_mail", urgente: true, orderId: 4512,
      }));
      const arg = m.create.mock.calls[0]![0];
      expect(arg.data.orderId).toBeNull();
      expect(arg.data.description).toContain("Pedido declarado #4512 (sin verificar).");
      expect(arg.data.description).not.toMatch(/ Pedido #4512/);
      expect(m.tg.mock.calls[0]![1]).toContain("Pedido declarado #4512 (sin verificar) · ");
      expect(m.registrar.mock.calls[0]![0].datos).toMatchObject({ orderId: null, pedidoDeclarado: 4512 });
    });

    it("visitante sin verificar ni enlace → no consulta el pedido ni lo vincula", async () => {
      await abrirCasoComprador(base({ orderId: 4512 }));
      expect(m.order).not.toHaveBeenCalled();
      expect(m.create.mock.calls[0]![0].data.orderId).toBeNull();
    });

    it("pedido inexistente → no se vincula", async () => {
      m.order.mockResolvedValue(null);
      await abrirCasoComprador(base({ actor: actor({ emailVerificado: "juana@gmail.com" }), email: null, orderId: 999 }));
      expect(m.create.mock.calls[0]![0].data.orderId).toBeNull();
    });

    it("mail verificado igual al de la compra (normalizado) → se vincula", async () => {
      await abrirCasoComprador(base({ actor: actor({ emailVerificado: "juana@gmail.com" }), email: null, orderId: 88, motivo: "reembolso" }));
      const arg = m.create.mock.calls[0]![0];
      expect(arg.data.orderId).toBe(88);
      expect(arg.data.description).toMatch(/^\[Comprador · mail verificado\] Pedido #88\. Motivo: reembolso\./);
      expect(m.tg.mock.calls[0]![1]).toContain("\nPedido #88 · ");
      expect(m.order).toHaveBeenCalledWith({ where: { id: 88 }, select: { buyerEmail: true, buyerUserId: true } });
    });

    it("sesión del comprador del pedido → se vincula aunque el mail del pedido sea otro", async () => {
      m.order.mockResolvedValue({ buyerEmail: "viejo@gmail.com", buyerUserId: 9 });
      await abrirCasoComprador(base({ actor: actor({ emailVerificado: "juana@gmail.com", userId: 9 }), email: null, orderId: 88 }));
      expect(m.create.mock.calls[0]![0].data.orderId).toBe(88);
    });

    it("enlace con token de ese pedido → se vincula sin consultar", async () => {
      await abrirCasoComprador(base({ actor: actor({ enlace: { tipo: "descarga", orderId: 88, albumId: 3 } }), orderId: 88 }));
      expect(m.order).not.toHaveBeenCalled();
      expect(m.create.mock.calls[0]![0].data.orderId).toBe(88);
    });

    it("enlace de otro pedido no prueba el pedido declarado", async () => {
      m.order.mockResolvedValue({ buyerEmail: "duenia@gmail.com", buyerUserId: null });
      await abrirCasoComprador(base({ actor: actor({ enlace: { tipo: "descarga", orderId: 5, albumId: 3 } }), orderId: 88 }));
      expect(m.create.mock.calls[0]![0].data.orderId).toBeNull();
    });
  });
});
