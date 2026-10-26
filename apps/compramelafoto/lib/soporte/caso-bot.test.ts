import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  ticket: vi.fn(), convFind: vi.fn(), convCreate: vi.fn(), convUpdate: vi.fn(), msgs: vi.fn(), msgCreate: vi.fn(),
  diag: vi.fn(), acciones: vi.fn(), token: vi.fn(), verificar: vi.fn(), evento: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    supportTicket: { findUnique: (...a: unknown[]) => m.ticket(...a) },
    botConversation: { findFirst: (...a: unknown[]) => m.convFind(...a), create: (...a: unknown[]) => m.convCreate(...a), update: (...a: unknown[]) => m.convUpdate(...a) },
    supportMessage: { findMany: (...a: unknown[]) => m.msgs(...a), create: (...a: unknown[]) => m.msgCreate(...a) },
    supportDiagnosis: { findUnique: (...a: unknown[]) => m.diag(...a) },
    botAction: { findMany: (...a: unknown[]) => m.acciones(...a) },
  },
}));
vi.mock("@/lib/bot/config", () => ({ BOT_PLATFORM: "CLF", readBotConfig: () => ({ model: "claude-sonnet-5-5" }) }));
vi.mock("./token-caso", () => ({ leerTokenCaso: (...a: unknown[]) => m.token(...a) }));
vi.mock("@/lib/bot/comprador/store", () => ({ marcarVerificada: (...a: unknown[]) => m.verificar(...a) }));
vi.mock("./aplicar-evento", () => ({ aplicarEvento: (...a: unknown[]) => m.evento(...a) }));
import { casoParaComprador, casoParaFotografo, conversacionDeCaso, espejarTurnoEnTicket, herramientasDeCaso, historiaDeCaso, situacionDeCaso } from "./caso-bot";

const now = new Date("2026-10-26T12:00:00Z");
const t = (iso: string) => new Date(iso);
const ticket = { id: 60, status: "WAITING_CUSTOMER", createdAt: t("2026-10-25T20:15:00Z"), requesterEmail: "ana@x.com", requesterRole: "CUSTOMER", reason: "PAYMENT_FAILED", description: "No puedo pagar" };

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.ticket.mockResolvedValue(ticket);
  m.convFind.mockResolvedValue({
    id: "c1",
    messages: [
      { role: "user", content: "No puedo pagar", createdAt: t("2026-10-25T20:14:00Z") },
      { role: "assistant", content: [{ type: "text", text: "Paso el caso al equipo." }], createdAt: t("2026-10-25T20:14:30Z") },
      { role: "user", content: [{ type: "tool_result", content: "{}" }], createdAt: t("2026-10-25T20:14:31Z") },
      { role: "user", content: "esto es posterior y ya está espejado", createdAt: t("2026-10-26T10:00:00Z") },
    ],
  });
  m.msgs.mockResolvedValue([
    { message: "Revisamos tus pagos.", origen: "ADMIN", authorName: "Daniel", authorEmail: "d@x.com", createdAt: t("2026-10-26T10:02:00Z") },
    { message: "Gracias, pruebo.", origen: "CLIENTE_BOT", authorName: null, authorEmail: null, createdAt: t("2026-10-26T10:05:00Z") },
  ]);
  m.diag.mockResolvedValue({ estado: "LISTO", hallazgos: "4 rechazos del banco", resumen: "Rechazos del banco" });
  m.acciones.mockResolvedValue([{ toolName: "reenviar_link_pack", resultMessage: "Listo, te mandé el link" }]);
  m.evento.mockResolvedValue({});
});

describe("historiaDeCaso", () => {
  it("junta la charla previa con el bot y los mensajes del caso, en orden y sin resultados de herramientas", async () => {
    const h = await historiaDeCaso(60);
    expect(h.ticket).toEqual({ id: 60, estado: "WAITING_CUSTOMER" });
    expect(h.items.map((i) => [i.rol, i.texto, i.autor])).toEqual([
      ["usuario", "No puedo pagar", null],
      ["bot", "Paso el caso al equipo.", null],
      ["equipo", "Revisamos tus pagos.", "Daniel · equipo CompraMeLaFoto"],
      ["usuario", "Gracias, pruebo.", null],
    ]);
    expect(m.msgs.mock.calls[0]![0].where).toMatchObject({ ticketId: 60, isInternal: false });
  });
});

describe("situacionDeCaso", () => {
  it("lleva el diagnóstico, lo que respondió el equipo, lo aplicado y las reglas del modo caso", async () => {
    const s = await situacionDeCaso(60);
    for (const texto of ["#60", "4 rechazos del banco", "Revisamos tus pagos.", "Listo, te mandé el link", "¿Se solucionó tu problema?", "cerrar_caso_resuelto", "pasar_caso_al_equipo", "Sos DNX Bot"]) {
      expect(s).toContain(texto);
    }
  });
});

describe("herramientasDeCaso", () => {
  it("cerrar el caso y pasarlo al equipo aplican los eventos del tablero", async () => {
    const [cerrar, pasar] = herramientasDeCaso(60);
    expect([cerrar!.name, cerrar!.kind, pasar!.name, pasar!.kind]).toEqual(["cerrar_caso_resuelto", "read", "pasar_caso_al_equipo", "read"]);
    await cerrar!.run({}, { userId: 0, role: "BUYER", email: "", name: null });
    expect(m.evento).toHaveBeenCalledWith(60, { tipo: "CLIENTE_CONFIRMO_RESUELTO" });
    await pasar!.run({ motivo: "sigue sin poder pagar" }, { userId: 0, role: "BUYER", email: "", name: null });
    expect(m.evento).toHaveBeenCalledWith(60, { tipo: "BOT_PASO_AL_EQUIPO", motivo: "sigue sin poder pagar" });
  });
});

describe("espejarTurnoEnTicket", () => {
  it("guarda lo que escribió la persona y lo que contestó el bot; repetir el turno no duplica ni falla", async () => {
    m.msgCreate.mockResolvedValueOnce({}).mockResolvedValueOnce({})
      .mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    const turno = { turnoId: "u1", textoUsuario: "sigue igual", textoBot: "Te paso con el equipo." };
    await espejarTurnoEnTicket(60, turno);
    await expect(espejarTurnoEnTicket(60, turno)).resolves.toBeUndefined();
    expect(m.msgCreate.mock.calls.map((c) => [c[0].data.origen, c[0].data.idempotencyKey])).toEqual([
      ["CLIENTE_BOT", "u1:u"], ["BOT", "u1:b"], ["CLIENTE_BOT", "u1:u"], ["BOT", "u1:b"],
    ]);
  });
});

describe("conversacionDeCaso", () => {
  it("usa la conversación del ticket o crea una vinculada", async () => {
    m.convFind.mockResolvedValueOnce({ id: "c1" });
    expect(await conversacionDeCaso(60, "BUYER", null)).toEqual({ id: "c1" });
    m.convFind.mockResolvedValueOnce(null);
    m.convCreate.mockResolvedValue({ id: "c9" });
    expect(await conversacionDeCaso(55, "PHOTOGRAPHER", 7)).toEqual({ id: "c9" });
    expect(m.convCreate.mock.calls[0]![0].data).toMatchObject({ platform: "CLF", audience: "PHOTOGRAPHER", userId: 7, supportTicketId: 55, status: "ESCALATED" });
  });
});

describe("casoParaComprador", () => {
  it("link válido: ata la conversación del caso a este navegador y la marca verificada 24 h", async () => {
    m.token.mockResolvedValue({ ticketId: 60 });
    m.convFind.mockResolvedValue({ id: "c1" });
    const r = await casoParaComprador("tok", { guestKey: "g".repeat(32), ipHash: "ip" }, now);
    expect(r).toEqual({ ticketId: 60, conversationId: "c1" });
    expect(m.convUpdate.mock.calls[0]![0]).toMatchObject({ where: { id: "c1" }, data: { guestKey: "g".repeat(32), ipHash: "ip" } });
    expect(m.verificar).toHaveBeenCalledWith("c1", "ana@x.com", new Date(now.getTime() + 86_400_000));
  });
  it("link vencido o inventado → null, sin tocar nada", async () => {
    m.token.mockResolvedValue(null);
    expect(await casoParaComprador("x", { guestKey: "g", ipHash: "ip" }, now)).toBeNull();
    expect(m.convUpdate).not.toHaveBeenCalled();
    expect(m.verificar).not.toHaveBeenCalled();
  });
});

describe("casoParaFotografo", () => {
  it("sólo el dueño del ticket puede seguir el caso", async () => {
    m.token.mockResolvedValue({ ticketId: 55 });
    m.ticket.mockResolvedValue({ ...ticket, id: 55, requesterEmail: "Foto@x.com", requesterRole: "PHOTOGRAPHER" });
    m.convFind.mockResolvedValue({ id: "c5" });
    expect(await casoParaFotografo("tok", { id: 7, email: "foto@x.com" }, now)).toEqual({ ticketId: 55, conversationId: "c5" });
    expect(await casoParaFotografo("tok", { id: 8, email: "otro@x.com" }, now)).toEqual({ error: "ajeno" });
    m.token.mockResolvedValue(null);
    expect(await casoParaFotografo("tok", { id: 7, email: "foto@x.com" }, now)).toEqual({ error: "vencido" });
  });
});
