// Prueba de app/api/support/tickets/[id]/messages (respuesta del cliente desde su panel).
// Vive acá para entrar en el glob de vitest.bot.config.ts.
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ user: vi.fn(), acceso: vi.fn(), create: vi.fn(), update: vi.fn(), sys: vi.fn(), evento: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAuthUser: (...a: unknown[]) => m.user(...a) }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: () => ({ allowed: true }) }));
vi.mock("@/lib/support/access", async (orig) => ({ ...(await orig<object>()), userCanAccessTicket: (...a: unknown[]) => m.acceso(...a) }));
vi.mock("@/lib/prisma", () => ({
  Role: { ADMIN: "ADMIN", SUPER_ADMIN: "SUPER_ADMIN" },
  prisma: {
    supportMessage: { create: (...a: unknown[]) => m.create(...a), findMany: vi.fn() },
    supportTicket: { update: (...a: unknown[]) => m.update(...a) },
    adminSystemMessage: { create: (...a: unknown[]) => m.sys(...a) },
  },
}));
vi.mock("@/lib/soporte/aplicar-evento", () => ({ aplicarEvento: (...a: unknown[]) => m.evento(...a) }));
import { POST } from "@/app/api/support/tickets/[id]/messages/route";

const ctx = { params: Promise.resolve({ id: "60" }) };
const pedido = () => new Request("http://x", { method: "POST", body: JSON.stringify({ message: "Sigue sin andar" }) }) as never;
const ticket = (status: string) => ({ allowed: true, ticket: { id: 60, status, reason: "OTHER" } });

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.user.mockResolvedValue({ id: 5, role: "CUSTOMER", email: "ana@x.com", name: "Ana" });
  m.create.mockResolvedValue({ id: 1, createdAt: new Date(0), message: "Sigue sin andar", authorId: 5, authorName: "Ana", authorEmail: "ana@x.com" });
  m.update.mockResolvedValue({});
  m.evento.mockResolvedValue({ status: "IN_PROGRESS" });
});

describe("respuesta del cliente desde su panel", () => {
  it("en Esperando al cliente: guarda con origen CLIENTE_PANEL y reabre el caso", async () => {
    m.acceso.mockResolvedValue(ticket("WAITING_CUSTOMER"));
    const res = await POST(pedido(), ctx);
    expect(res.status).toBe(200);
    expect(m.create.mock.calls[0]![0].data).toMatchObject({ ticketId: 60, origen: "CLIENTE_PANEL", isInternal: false });
    expect(m.evento).toHaveBeenCalledWith(60, { tipo: "CLIENTE_ESCRIBIO_PANEL" });
  });

  it("un caso Resuelto acepta la respuesta y se reabre", async () => {
    m.acceso.mockResolvedValue(ticket("RESOLVED"));
    expect((await POST(pedido(), ctx)).status).toBe(200);
    expect(m.evento).toHaveBeenCalled();
  });

  it("un caso Cerrado se rechaza como hoy", async () => {
    m.acceso.mockResolvedValue(ticket("CLOSED"));
    expect((await POST(pedido(), ctx)).status).toBe(400);
    expect(m.create).not.toHaveBeenCalled();
    expect(m.evento).not.toHaveBeenCalled();
  });

  it("alguien que no es el dueño no puede escribir", async () => {
    m.acceso.mockResolvedValue({ allowed: false, ticket: null });
    const res = await POST(pedido(), ctx);
    expect([403, 404]).toContain(res.status);
    expect(m.evento).not.toHaveBeenCalled();
  });
});
