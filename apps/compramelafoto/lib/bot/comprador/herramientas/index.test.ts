import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ albumFindMany: vi.fn(), photoFindUnique: vi.fn(), contar: vi.fn(), abrir: vi.fn(), incidente: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { album: { findMany: m.albumFindMany, findFirst: vi.fn() }, photo: { findUnique: m.photoFindUnique }, botAction: { count: m.contar } },
  // album-order-payment-recovery lee estos enums al cargar el módulo (preflight #3).
  OrderOrigin: { STANDARD_CHECKOUT: "STANDARD_CHECKOUT", PREVENTA_PACK: "PREVENTA_PACK" },
  CheckoutPaymentSource: { MERCADO_PAGO: "MERCADO_PAGO" },
  Prisma: {},
}));
vi.mock("@/lib/mercadopago/album-order-mp-preference", () => ({ ensureAlbumOrderMpPreference: vi.fn() }));
vi.mock("@/lib/pricing/pricing-engine", () => ({ computeCheckoutTotals: vi.fn() }));
vi.mock("@/lib/preventa-canjeable/pack-service", () => ({ listActivePacksForPublicCatalog: vi.fn() }));
vi.mock("@/emails/send", () => ({ sendEmail: vi.fn() }));
vi.mock("../caso", async (orig) => ({ ...(await orig<object>()), abrirCasoComprador: m.abrir }));
vi.mock("@/lib/bot/escalamiento", async (orig) => ({ ...(await orig<object>()), reportIncident: m.incidente }));

import { ACTOR_MOTOR_COMPRADOR, type CompradorActor } from "../identidad";
import { ERROR_GENERICO_COMPRADOR, herramientasComprador } from "./index";

const actor = (o: Partial<CompradorActor> = {}): CompradorActor => ({
  guestKey: "g".repeat(32), ipHash: "h".repeat(64), conversationId: "c1", pagina: null, pagePath: "/ayuda",
  albumId: null, enlace: null, emailVerificado: null, userId: null, ...o,
});
const tool = (a: CompradorActor, name: string) => herramientasComprador(a, {}).find((t) => t.name === name)!;
const correr = (a: CompradorActor, name: string, input: unknown) => tool(a, name).run(input, ACTOR_MOTOR_COMPRADOR);

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
});

describe("herramientasComprador", () => {
  it("con enlace de descarga incluye ver_mi_descarga; nombres únicos; nada de fotógrafos", () => {
    const nombres = herramientasComprador(actor({ enlace: { tipo: "descarga", orderId: 88, albumId: 3 } }), {}).map((t) => t.name);
    expect(nombres).toContain("ver_mi_descarga");
    expect(nombres).toEqual(expect.arrayContaining(["buscar_album", "pedir_codigo", "solicitar_quitar_foto", "abrir_caso", "reportar_problema_del_sistema"]));
    expect(new Set(nombres).size).toBe(nombres.length);
    for (const n of ["actualizar_album", "reenviar_link_de_descarga", "abrir_ticket"]) expect(nombres).not.toContain(n);
  });

  it("sin enlace no ofrece ver_mi_descarga", () => {
    expect(herramientasComprador(actor(), {}).map((t) => t.name)).not.toContain("ver_mi_descarga");
  });

  it("abrir_caso usa el pedido del enlace si no viene y el texto del turno", async () => {
    m.abrir.mockResolvedValue({ ok: true, ticketId: 31, reused: false });
    const a = actor({ enlace: { tipo: "descarga", orderId: 88, albumId: 3 } });
    const r = await herramientasComprador(a, { currentUserText: "me cobraron dos veces" })
      .find((t) => t.name === "abrir_caso")!
      .run({ motivo: "pago_duplicado", resumen: "Dice que le cobraron dos veces", urgente: false, email: "juana@gmail.com" }, ACTOR_MOTOR_COMPRADOR);
    expect(m.abrir).toHaveBeenCalledWith({
      actor: a, email: "juana@gmail.com", nombre: null, motivo: "pago_duplicado", resumen: "Dice que le cobraron dos veces",
      urgente: false, orderId: 88, currentUserText: "me cobraron dos veces",
    });
    expect(r).toEqual({ ok: true, message: "Abrí el caso #31. Te responden por mail a ju***@gmail.com.", data: { ticketId: 31 } });
  });

  it("abrir_caso: el pedido explícito gana; reusado y rechazado", async () => {
    m.abrir.mockResolvedValueOnce({ ok: true, ticketId: 44, reused: true });
    const a = actor({ enlace: { tipo: "pack", orderId: 88, albumId: 3 }, emailVerificado: "juana@gmail.com" });
    const r1 = await correr(a, "abrir_caso", { motivo: "otro", resumen: "Quiere otra cosa", urgente: false, pedido: 90 });
    expect(m.abrir.mock.calls[0]![0]).toMatchObject({ orderId: 90, email: null });
    expect(r1).toEqual({ ok: true, message: "Esta conversación ya tiene el caso #44; te responden por mail.", data: { ticketId: 44 } });

    m.abrir.mockResolvedValueOnce({ ok: false, mensaje: "Para que te respondan necesito tu mail." });
    const r2 = await correr(actor(), "abrir_caso", { motivo: "otro", resumen: "Quiere otra cosa", urgente: false });
    expect(m.abrir.mock.calls[1]![0]).toMatchObject({ orderId: null });
    expect(r2).toEqual({ ok: false, message: "Para que te respondan necesito tu mail." });
  });

  it("abrir_caso valida el motivo y el largo del resumen", () => {
    const t = tool(actor(), "abrir_caso");
    expect(t.kind).toBe("read");
    expect(t.input.safeParse({ motivo: "inventado", resumen: "algo largo acá", urgente: false }).success).toBe(false);
    expect(t.input.safeParse({ motivo: "otro", resumen: "corto", urgente: false }).success).toBe(false);
    expect(t.input.safeParse({ motivo: "otro", resumen: "algo largo acá", urgente: false, pedido: 0 }).success).toBe(false);
  });

  it("reportar_problema_del_sistema es la misma de fotógrafos", async () => {
    const r = await correr(actor(), "reportar_problema_del_sistema", { area: "descargas", codigo: "ZIP_FAIL", ids: { orderId: 88 }, detalle: "x", urgente: false });
    expect(r).toEqual({ ok: true, message: "Quedó registrado para el equipo técnico." });
    expect(m.incidente).toHaveBeenCalledWith({ area: "descargas", codigo: "ZIP_FAIL", ids: { orderId: 88 }, detalle: "x", urgente: false });
  });

  it("un error que lanza una herramienta llega al modelo sin detalles de la base", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    m.albumFindMany.mockRejectedValue(new Error("Can't reach database server at `ep-cool-db.neon.tech`: table \"Album\""));
    const p = correr(actor(), "buscar_album", { texto: "egresados" });
    await expect(p).rejects.toThrow(ERROR_GENERICO_COMPRADOR);
    await p.catch((e: Error) => {
      expect(e.message).not.toMatch(/neon|Album|database/i);
    });
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("también describe() de las de escritura oculta el detalle", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    m.contar.mockResolvedValue(0);
    m.photoFindUnique.mockRejectedValue(new Error("Invalid `prisma.photo.findUnique()` invocation: relation \"Photo\""));
    const p = tool(actor(), "solicitar_quitar_foto").describe!({ albumId: 3, photoId: 9, email: "juana@gmail.com" }, ACTOR_MOTOR_COMPRADOR);
    await expect(p).rejects.toThrow(ERROR_GENERICO_COMPRADOR);
    err.mockRestore();
  });

  it("los avisos pensados para la persona pasan tal cual", async () => {
    m.contar.mockResolvedValue(0);
    m.photoFindUnique.mockResolvedValue(null);
    const p = tool(actor(), "solicitar_quitar_foto").describe!({ albumId: 3, photoId: 9, email: "juana@gmail.com" }, ACTOR_MOTOR_COMPRADOR);
    await expect(p).rejects.toThrow("No encontré esa foto en ese álbum.");
  });
});
