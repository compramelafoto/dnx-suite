import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ ticket: vi.fn(), msg: vi.fn(), admin: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    supportTicket: { create: (...a: unknown[]) => m.ticket(...a) },
    supportMessage: { create: (...a: unknown[]) => m.msg(...a) },
    adminSystemMessage: { create: (...a: unknown[]) => m.admin(...a) },
  },
}));
import { createSupportTicket } from "./create-ticket";

const data = { reason: "TECHNICAL_ISSUE", description: "No puedo subir", printOrderId: null, requesterName: "Ana", requesterEmail: "a@x.com", requesterPhone: null, requesterRole: "PHOTOGRAPHER" };

beforeEach(() => { m.ticket.mockReset().mockResolvedValue({ id: 9, createdAt: new Date(0) }); m.msg.mockReset(); m.admin.mockReset(); });

describe("createSupportTicket", () => {
  it("crea ticket y aviso al admin con el formato actual", async () => {
    await createSupportTicket({ data, requesterLabel: "Ana · a@x.com" });
    expect(m.ticket.mock.calls[0]![0].data).toMatchObject({ reason: "TECHNICAL_ISSUE", status: "OPEN" });
    expect(m.admin.mock.calls[0]![0].data).toMatchObject({ type: "SUPPORT_TICKET_CREATED:9", title: "Nueva incidencia de soporte", isRead: false });
  });
  it("agrega la nota interna si viene", async () => {
    await createSupportTicket({ data, requesterLabel: "x", internalNote: "Conversación…" });
    expect(m.msg.mock.calls[0]![0].data).toMatchObject({ ticketId: 9, isInternal: true, message: "Conversación…", authorName: "DNX Bot" });
  });
  it("si falla el aviso al admin, el ticket igual se crea", async () => {
    m.admin.mockRejectedValue(new Error("x"));
    await expect(createSupportTicket({ data, requesterLabel: "x" })).resolves.toEqual({ id: 9, createdAt: new Date(0) });
  });
  it("guarda orderId si viene", async () => {
    await createSupportTicket({ data: { ...data, orderId: 7 }, requesterLabel: "x" });
    expect(m.ticket.mock.calls[0]![0].data).toMatchObject({ orderId: 7 });
  });
  it("sin orderId el create es el mismo de hoy", async () => {
    await createSupportTicket({ data, requesterLabel: "x" });
    expect(m.ticket.mock.calls[0]![0].data).toEqual({
      printOrderId: null, reason: "TECHNICAL_ISSUE", description: "No puedo subir", requesterName: "Ana",
      requesterEmail: "a@x.com", requesterPhone: null, requesterRole: "PHOTOGRAPHER", status: "OPEN",
    });
  });
});
