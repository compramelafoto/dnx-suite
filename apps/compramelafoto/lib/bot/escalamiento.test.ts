import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ create: vi.fn(), history: vi.fn(), conv: vi.fn(), find: vi.fn(), tg: vi.fn(), inc: vi.fn() }));
vi.mock("@/lib/support/create-ticket", () => ({ createSupportTicket: (...a: unknown[]) => m.create(...a) }));
vi.mock("@/lib/bot/store", () => ({ loadHistory: (...a: unknown[]) => m.history(...a), upsertIncident: (...a: unknown[]) => m.inc(...a) }));
vi.mock("@/lib/prisma", () => ({ prisma: { botConversation: { update: (...a: unknown[]) => m.conv(...a), findUnique: (...a: unknown[]) => m.find(...a) } } }));
vi.mock("@repo/dnx-bot", async (orig) => ({ ...(await orig<object>()), sendTelegramMessage: (...a: unknown[]) => m.tg(...a) }));
vi.mock("@/lib/bot/config", () => ({ BOT_PLATFORM: "CLF", readBotConfig: () => ({ telegram: { token: "t", chatId: "c" } }) }));
import { SUPPORT_MESSAGE_MAX_LENGTH } from "@/lib/support/sanitize";
import { escalateToHuman, MAX_INCIDENT_ALERTS_PER_HOUR, reportIncident, resetIncidentAlertBudget } from "./escalamiento";

const actor = { userId: 7, role: "PHOTOGRAPHER", email: "f@x.com", name: "Fede" };
beforeEach(() => { Object.values(m).forEach((f) => f.mockReset()); m.create.mockResolvedValue({ id: 12, createdAt: new Date() }); m.history.mockResolvedValue([{ role: "user", content: "no anda" }]); m.find.mockResolvedValue({ status: "OPEN", supportTicketId: null }); resetIncidentAlertBudget(); });

describe("escalamiento", () => {
  it("crea ticket con la conversación como nota interna y marca la conversación", async () => {
    const r = await escalateToHuman({ actor, conversationId: "c1", motivo: "TECHNICAL_ISSUE", resumen: "No puede subir", urgente: false });
    expect(r).toEqual({ ticketId: 12, reused: false });
    expect(m.create.mock.calls[0]![0].internalNote).toContain("no anda");
    expect(m.conv.mock.calls[0]![0]).toMatchObject({ where: { id: "c1" }, data: { status: "ESCALATED", supportTicketId: 12 } });
    expect(m.tg).not.toHaveBeenCalled();
  });
  it("urgente → Telegram al instante", async () => {
    await escalateToHuman({ actor, conversationId: "c1", motivo: "PAYMENT_FAILED", resumen: "Cobro raro", urgente: true });
    expect(m.tg.mock.calls[0]![1]).toContain("#12");
  });
  it("incidente nuevo urgente → Telegram; repetido → no", async () => {
    m.inc.mockResolvedValueOnce({ id: "i", occurrences: 1, isNew: true }).mockResolvedValueOnce({ id: "i", occurrences: 2, isNew: false });
    await reportIncident({ area: "album", codigo: "P2002", ids: { albumId: 3 }, detalle: "x", urgente: true });
    await reportIncident({ area: "album", codigo: "P2002", ids: { albumId: 3 }, detalle: "x", urgente: true });
    expect(m.tg).toHaveBeenCalledTimes(1);
  });
  it("conversación ya escalada con ticket → devuelve ese ticket sin crear otro", async () => {
    m.find.mockResolvedValue({ status: "ESCALATED", supportTicketId: 44 });
    const r = await escalateToHuman({ actor, conversationId: "c1", motivo: "OTHER", resumen: "otra vez", urgente: true });
    expect(r).toEqual({ ticketId: 44, reused: true });
    expect(m.create).not.toHaveBeenCalled();
    expect(m.conv).not.toHaveBeenCalled();
    expect(m.tg).not.toHaveBeenCalled();
  });
  it("incluye el mensaje del turno en curso en la nota interna", async () => {
    await escalateToHuman({ actor, conversationId: "c1", motivo: "OTHER", resumen: "x".repeat(20), urgente: false, currentUserText: "me cobraron dos veces" });
    const note: string = m.create.mock.calls[0]![0].internalNote;
    expect(note).toContain("no anda");
    expect(note.trimEnd().endsWith("Usuario: me cobraron dos veces")).toBe(true);
  });
  it("una charla larga se recorta conservando lo más reciente", async () => {
    m.history.mockResolvedValue(Array.from({ length: 200 }, (_, i) => ({ role: "user", content: `mensaje número ${i} ${"x".repeat(40)}` })));
    await escalateToHuman({ actor, conversationId: "c1", motivo: "OTHER", resumen: "x".repeat(20), urgente: false, currentUserText: "lo último" });
    const note: string = m.create.mock.calls[0]![0].internalNote;
    expect(note.length).toBeLessThanOrEqual(SUPPORT_MESSAGE_MAX_LENGTH);
    expect(note.startsWith("Derivado por DNX Bot.\n\n…")).toBe(true);
    expect(note).toContain("lo último");
    expect(note).toContain("mensaje número 199");
    expect(note).not.toContain("mensaje número 0 ");
  });
  it("como mucho 5 avisos urgentes por Telegram por hora; el resto sólo queda en la base", async () => {
    m.inc.mockResolvedValue({ id: "i", occurrences: 1, isNew: true });
    for (let k = 0; k < MAX_INCIDENT_ALERTS_PER_HOUR + 3; k++) {
      await reportIncident({ area: "album", codigo: `E${k}`, ids: {}, detalle: "x", urgente: true });
    }
    expect(m.inc).toHaveBeenCalledTimes(MAX_INCIDENT_ALERTS_PER_HOUR + 3);
    expect(m.tg).toHaveBeenCalledTimes(MAX_INCIDENT_ALERTS_PER_HOUR);
  });
});
