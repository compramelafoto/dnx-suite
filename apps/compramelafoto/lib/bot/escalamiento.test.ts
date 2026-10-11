import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ create: vi.fn(), history: vi.fn(), conv: vi.fn(), tg: vi.fn(), inc: vi.fn() }));
vi.mock("@/lib/support/create-ticket", () => ({ createSupportTicket: (...a: unknown[]) => m.create(...a) }));
vi.mock("@/lib/bot/store", () => ({ loadHistory: (...a: unknown[]) => m.history(...a), upsertIncident: (...a: unknown[]) => m.inc(...a) }));
vi.mock("@/lib/prisma", () => ({ prisma: { botConversation: { update: (...a: unknown[]) => m.conv(...a) } } }));
vi.mock("@repo/dnx-bot", async (orig) => ({ ...(await orig<object>()), sendTelegramMessage: (...a: unknown[]) => m.tg(...a) }));
vi.mock("@/lib/bot/config", () => ({ BOT_PLATFORM: "CLF", readBotConfig: () => ({ telegram: { token: "t", chatId: "c" } }) }));
import { escalateToHuman, reportIncident } from "./escalamiento";

const actor = { userId: 7, role: "PHOTOGRAPHER", email: "f@x.com", name: "Fede" };
beforeEach(() => { Object.values(m).forEach((f) => f.mockReset()); m.create.mockResolvedValue({ id: 12, createdAt: new Date() }); m.history.mockResolvedValue([{ role: "user", content: "no anda" }]); });

describe("escalamiento", () => {
  it("crea ticket con la conversación como nota interna y marca la conversación", async () => {
    const r = await escalateToHuman({ actor, conversationId: "c1", motivo: "TECHNICAL_ISSUE", resumen: "No puede subir", urgente: false });
    expect(r).toEqual({ ticketId: 12 });
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
});
