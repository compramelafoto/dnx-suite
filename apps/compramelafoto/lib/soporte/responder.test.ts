import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  ticket: vi.fn(), msgCreate: vi.fn(), msgFind: vi.fn(), msgUpdate: vi.fn(), msgDelete: vi.fn(), tUpdate: vi.fn(),
  user: vi.fn(), notif: vi.fn(), accion: vi.fn(), mail: vi.fn(), evento: vi.fn(), token: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    supportTicket: { findUnique: (...a: unknown[]) => m.ticket(...a), update: (...a: unknown[]) => m.tUpdate(...a) },
    supportMessage: { create: (...a: unknown[]) => m.msgCreate(...a), findUnique: (...a: unknown[]) => m.msgFind(...a), update: (...a: unknown[]) => m.msgUpdate(...a), delete: (...a: unknown[]) => m.msgDelete(...a) },
    user: { findUnique: (...a: unknown[]) => m.user(...a) },
    dashboardNotification: { create: (...a: unknown[]) => m.notif(...a) },
  },
}));
vi.mock("./acciones", () => ({ ejecutarAccionDeTicket: (...a: unknown[]) => m.accion(...a) }));
vi.mock("@/emails/send", () => ({ sendEmail: (...a: unknown[]) => m.mail(...a) }));
vi.mock("./aplicar-evento", () => ({ aplicarEvento: (...a: unknown[]) => m.evento(...a) }));
vi.mock("./token-caso", async (orig) => ({ ...(await orig<object>()), crearTokenCaso: (...a: unknown[]) => m.token(...a) }));
import { responderTicket } from "./responder";

const admin = { id: 1, name: "Daniel", email: "d@x.com" };
const base = { ticketId: 60, admin, mensaje: "Hola, revisamos tu caso.", acciones: [{ herramienta: "reenviar_descarga" as const, input: {} }], idempotencyKey: "k1" };

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  delete process.env.CLF_SUPPORT_CASE_LINKS_ENABLED;
  process.env.NEXT_PUBLIC_APP_URL = "https://www.compramelafoto.com";
  m.ticket.mockResolvedValue({ id: 60, status: "OPEN", requesterEmail: "ana@x.com", requesterName: "Ana", requesterRole: "CUSTOMER" });
  let creados = 0;
  m.msgCreate.mockImplementation(async () => {
    if (creados++ > 0) throw Object.assign(new Error("dup"), { code: "P2002" });
    return { id: 900 };
  });
  m.msgFind.mockResolvedValue({ id: 900, isInternal: false, origen: "ADMIN" });
  m.msgUpdate.mockResolvedValue({ id: 900 });
  m.accion.mockResolvedValue({ ok: true, message: "Listo" });
  m.mail.mockResolvedValue({ success: true });
  m.user.mockResolvedValue(null);
  m.token.mockResolvedValue({ token: "tok", expiresAt: new Date() });
});

describe("responderTicket", () => {
  it("doble clic con la misma clave: una sola respuesta, un solo mail, cada acción una vez", async () => {
    const [a, b] = await Promise.all([responderTicket(base), responderTicket(base)]);
    expect(m.accion).toHaveBeenCalledTimes(1);
    expect(m.mail).toHaveBeenCalledTimes(1);
    expect(a).toMatchObject({ ok: true, mensajeId: 900 });
    expect(b).toMatchObject({ ok: true, mensajeId: 900 });
  });

  it("si una acción falla no sale nada y se puede reintentar con la misma clave", async () => {
    m.accion.mockResolvedValueOnce({ ok: false, message: "no hay pedidos" });
    const r = await responderTicket(base);
    expect(r).toEqual({ ok: false, fallas: [{ herramienta: "reenviar_descarga", mensaje: "no hay pedidos" }] });
    expect(m.mail).not.toHaveBeenCalled();
    expect(m.msgDelete).toHaveBeenCalledWith({ where: { id: 900 } });
    expect(m.evento).not.toHaveBeenCalled();
  });

  it("enviar igual: manda la respuesta sin volver a correr las acciones", async () => {
    const r = await responderTicket({ ...base, enviarIgual: true });
    expect(r).toMatchObject({ ok: true });
    expect(m.accion).not.toHaveBeenCalled();
    expect(m.mail).toHaveBeenCalledTimes(1);
  });

  it("guarda el mensaje del admin, manda el mail y pasa a Esperando al cliente", async () => {
    await responderTicket(base);
    expect(m.msgUpdate.mock.calls[0]![0]).toMatchObject({ where: { id: 900 }, data: { isInternal: false, origen: "ADMIN", message: base.mensaje } });
    expect(m.mail.mock.calls[0]![0]).toMatchObject({ to: "ana@x.com", templateKey: "SUPPORT_REPLY" });
    expect(m.evento).toHaveBeenCalledWith(60, { tipo: "ADMIN_RESPONDIO" });
  });

  it("con los links del caso encendidos, el mail lleva el botón al bot; apagados, el link de siempre", async () => {
    await responderTicket(base);
    expect(m.mail.mock.calls[0]![0].html).toContain("/cliente/soporte");
    expect(m.token).not.toHaveBeenCalled();
    process.env.CLF_SUPPORT_CASE_LINKS_ENABLED = "1";
    m.msgCreate.mockResolvedValue({ id: 901 });
    await responderTicket({ ...base, idempotencyKey: "k2" });
    expect(m.mail.mock.calls[1]![0].html).toContain("https://www.compramelafoto.com/caso/tok");
  });

  it("ticket inexistente → no encontrado", async () => {
    m.ticket.mockResolvedValue(null);
    expect(await responderTicket(base)).toEqual({ ok: false, noEncontrado: true });
  });
});
