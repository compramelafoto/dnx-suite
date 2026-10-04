import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * El botón de arrepentimiento (Res. SCI 424/2020). Con `prisma` falso: se mira qué se busca
 * (siempre con el `workspaceId`), qué se escribe y cuándo se avisa a la institución.
 */
const h = vi.hoisted(() => ({
  prisma: {
    storeOrder: { findFirst: vi.fn() },
    storeOrderEvent: { findFirst: vi.fn(), create: vi.fn() },
  },
  sendRegretNotice: vi.fn(),
}));
vi.mock("@repo/db", () => ({ prisma: h.prisma }));
vi.mock("./emails", () => ({ sendRegretNotice: h.sendRegretNotice }));

const { submitRegret, REGRET_GENERIC_ERROR, REGRET_RATE_LIMITED, MAX_REGRET_REASON } = await import("./regret");
const { resetRateLimit } = await import("@/lib/geocode/rate-limit");
const { STORE_NOTE_REGRET } = await import("./constants");

const PEDIDO = { id: "ord1", publicId: "ped_abcdefgh2345", status: "DELIVERED", buyerEmail: "ana@example.com" };
const AHORA = new Date("2026-10-04T15:00:00Z");

function base(over: Partial<Parameters<typeof submitRegret>[0]> = {}) {
  return { workspaceId: "ws1", orderNumber: "7", email: "ana@example.com", ip: "1.2.3.4", now: AHORA, ...over };
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  // Sólo el pedido 7 del workspace ws1 existe.
  h.prisma.storeOrder.findFirst.mockImplementation(async (args: { where: { workspaceId: string; orderNumber: number } }) =>
    args.where.workspaceId === "ws1" && args.where.orderNumber === 7 ? PEDIDO : null,
  );
  h.prisma.storeOrderEvent.findFirst.mockResolvedValue(null);
  h.prisma.storeOrderEvent.create.mockResolvedValue({});
  h.sendRegretNotice.mockResolvedValue(undefined);
});

afterEach(() => resetRateLimit());

describe("submitRegret", () => {
  it("pedido y email coinciden: deja constancia sin cambiar el estado, avisa y devuelve el código", async () => {
    const r = await submitRegret(base({ email: "  ANA@example.com ", reason: "No me queda bien" }));
    expect(r).toEqual({ ok: true, code: "PED_ABCDEFGH2345" });
    expect(h.prisma.storeOrder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: "ws1", orderNumber: 7 } }),
    );
    expect(h.prisma.storeOrderEvent.create).toHaveBeenCalledWith({
      data: {
        orderId: "ord1",
        fromStatus: "DELIVERED",
        toStatus: "DELIVERED",
        actorUserId: null,
        note: `${STORE_NOTE_REGRET}: No me queda bien`,
      },
    });
    expect(h.sendRegretNotice).toHaveBeenCalledWith({ workspaceId: "ws1", orderId: "ord1", reason: "No me queda bien" });
  });

  it("acepta el número con # adelante y sin motivo deja la nota sola", async () => {
    const r = await submitRegret(base({ orderNumber: " #7 " }));
    expect(r).toEqual({ ok: true, code: "PED_ABCDEFGH2345" });
    expect(h.prisma.storeOrderEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ note: STORE_NOTE_REGRET }) }),
    );
    expect(h.sendRegretNotice).toHaveBeenCalledWith({ workspaceId: "ws1", orderId: "ord1", reason: null });
  });

  it("email distinto: el mismo mensaje genérico, sin escribir ni avisar", async () => {
    const r = await submitRegret(base({ email: "otra@example.com" }));
    expect(r).toEqual({ ok: false, error: REGRET_GENERIC_ERROR });
    expect(h.prisma.storeOrderEvent.create).not.toHaveBeenCalled();
    expect(h.sendRegretNotice).not.toHaveBeenCalled();
  });

  it("pedido inexistente: el mismo mensaje genérico", async () => {
    const r = await submitRegret(base({ orderNumber: "99" }));
    expect(r).toEqual({ ok: false, error: REGRET_GENERIC_ERROR });
  });

  it("pedido de otro workspace: se busca sólo en el propio y responde lo mismo", async () => {
    const r = await submitRegret(base({ workspaceId: "ws2" }));
    expect(r).toEqual({ ok: false, error: REGRET_GENERIC_ERROR });
    expect(h.prisma.storeOrder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: "ws2", orderNumber: 7 } }),
    );
    expect(h.prisma.storeOrderEvent.create).not.toHaveBeenCalled();
  });

  it("número que no es número: el mismo mensaje genérico y ni se consulta la base", async () => {
    for (const orderNumber of ["abc", "0", "-3", "1.5", "99999999999"]) {
      const r = await submitRegret(base({ orderNumber, ip: `ip-${orderNumber}` }));
      expect(r).toEqual({ ok: false, error: REGRET_GENERIC_ERROR });
    }
    expect(h.prisma.storeOrder.findFirst).not.toHaveBeenCalled();
  });

  it("segundo pedido dentro de las 24 h: el mismo código, sin otra constancia ni otro aviso", async () => {
    h.prisma.storeOrderEvent.findFirst.mockResolvedValue({ id: "ev1" });
    const r = await submitRegret(base());
    expect(r).toEqual({ ok: true, code: "PED_ABCDEFGH2345" });
    const where = h.prisma.storeOrderEvent.findFirst.mock.calls[0]![0].where;
    expect(where.orderId).toBe("ord1");
    expect(where.note).toEqual({ startsWith: STORE_NOTE_REGRET });
    expect(where.createdAt.gte).toEqual(new Date(AHORA.getTime() - 24 * 60 * 60 * 1000));
    expect(h.prisma.storeOrderEvent.create).not.toHaveBeenCalled();
    expect(h.sendRegretNotice).not.toHaveBeenCalled();
  });

  it("recorta el motivo a 500 caracteres", async () => {
    const largo = "x".repeat(MAX_REGRET_REASON + 200);
    await submitRegret(base({ reason: largo }));
    const nota = h.prisma.storeOrderEvent.create.mock.calls[0]![0].data.note as string;
    expect(nota).toBe(`${STORE_NOTE_REGRET}: ${"x".repeat(MAX_REGRET_REASON)}`);
    expect(MAX_REGRET_REASON).toBe(500);
    expect(h.sendRegretNotice.mock.calls[0]![0].reason).toHaveLength(500);
  });

  it("5 intentos por IP cada 15 minutos: el sexto se frena sin consultar la base", async () => {
    for (let i = 0; i < 5; i++) {
      expect((await submitRegret(base({ email: "otra@example.com" }))).ok).toBe(false);
    }
    h.prisma.storeOrder.findFirst.mockClear();
    const r = await submitRegret(base());
    expect(r).toEqual({ ok: false, error: REGRET_RATE_LIMITED });
    expect(h.prisma.storeOrder.findFirst).not.toHaveBeenCalled();
    // Otra IP sigue pudiendo.
    expect((await submitRegret(base({ ip: "5.6.7.8" }))).ok).toBe(true);
  });

  it("si el aviso falla, el trámite igual queda registrado y devuelve el código", async () => {
    h.sendRegretNotice.mockRejectedValue(new Error("caído"));
    const r = await submitRegret(base());
    expect(r).toEqual({ ok: true, code: "PED_ABCDEFGH2345" });
    expect(h.prisma.storeOrderEvent.create).toHaveBeenCalled();
  });
});
