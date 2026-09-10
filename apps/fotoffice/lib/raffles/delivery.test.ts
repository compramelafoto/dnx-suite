import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  awardFindFirstMock,
  awardUpdateMock,
  awardUpdateManyMock,
  awardFindManyMock,
  raffleUpdateMock,
  transactionMock,
  eventMock,
} = vi.hoisted(() => ({
  awardFindFirstMock: vi.fn(),
  awardUpdateMock: vi.fn(),
  awardUpdateManyMock: vi.fn(),
  awardFindManyMock: vi.fn(),
  raffleUpdateMock: vi.fn(),
  transactionMock: vi.fn(),
  eventMock: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    rafflePrizeAward: {
      findFirst: awardFindFirstMock,
      findMany: awardFindManyMock,
      update: awardUpdateMock,
      updateMany: awardUpdateManyMock,
    },
    raffle: { update: raffleUpdateMock },
    $transaction: transactionMock,
  },
  Prisma: {},
}));
vi.mock("./events", () => ({ recordRaffleEvent: eventMock }));

const { advancePrizeAward, expireUnclaimedPrizes } = await import("./delivery");

const AHORA = new Date("2026-10-05T12:00:00Z");

const premio = (extra: Record<string, unknown> = {}) => ({
  id: "aw-1",
  raffleId: "r-1",
  prizeId: "p-1",
  status: "GANADO",
  raffle: {
    id: "r-1",
    workspaceId: "ws-1",
    awards: [
      { id: "aw-1", status: "GANADO" },
      { id: "aw-2", status: "RETIRADO" },
    ],
  },
  ...extra,
});

beforeEach(() => {
  awardFindFirstMock.mockReset().mockResolvedValue(premio());
  awardUpdateMock.mockReset().mockResolvedValue({});
  awardUpdateManyMock.mockReset().mockResolvedValue({ count: 0 });
  awardFindManyMock.mockReset().mockResolvedValue([]);
  raffleUpdateMock.mockReset().mockResolvedValue({});
  eventMock.mockReset();
  transactionMock.mockReset().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      rafflePrizeAward: { update: awardUpdateMock },
      raffle: { update: raffleUpdateMock },
    }),
  );
});

const avanzar = (to: string, note: string | null = null) =>
  advancePrizeAward({
    workspaceId: "ws-1",
    awardId: "aw-1",
    to: to as "NOTIFICADO",
    note,
    actorUserId: 7,
    actorLabel: "Secretaría",
    now: AHORA,
  });

describe("mover un premio", () => {
  it("marcar avisado escribe cuándo se avisó", async () => {
    const r = await avanzar("NOTIFICADO");
    expect(r.ok).toBe(true);
    const datos = awardUpdateMock.mock.calls[0][0].data;
    expect(datos.status).toBe("NOTIFICADO");
    expect(datos.notifiedAt).toEqual(AHORA);
    expect(eventMock.mock.calls[0][1].type).toBe("PREMIO_NOTIFICADO");
  });

  it("marcar entregado deja quién lo entregó", async () => {
    const r = await avanzar("RETIRADO", "Lo retiró en la sede");
    expect(r.ok).toBe(true);
    const datos = awardUpdateMock.mock.calls[0][0].data;
    expect(datos.status).toBe("RETIRADO");
    expect(datos.deliveredAt).toEqual(AHORA);
    expect(datos.deliveredByUserId).toBe(7);
    expect(datos.deliveryNote).toBe("Lo retiró en la sede");
  });

  it("anular sin motivo se rechaza y no escribe nada", async () => {
    const r = await avanzar("ANULADO", null);
    expect(r).toEqual({ ok: false, error: "Anular un premio exige escribir el motivo." });
    expect(awardUpdateMock).not.toHaveBeenCalled();
  });

  it("anular con motivo lo deja escrito", async () => {
    const r = await avanzar("ANULADO", "El aliado no entregó el premio");
    expect(r.ok).toBe(true);
    expect(awardUpdateMock.mock.calls[0][0].data.voidReason).toBe("El aliado no entregó el premio");
    expect(eventMock.mock.calls[0][1].type).toBe("PREMIO_ANULADO");
  });

  it("un premio ya retirado no vuelve a avisado", async () => {
    awardFindFirstMock.mockResolvedValue(premio({ status: "RETIRADO" }));
    const r = await avanzar("NOTIFICADO");
    expect(r.ok).toBe(false);
    expect(awardUpdateMock).not.toHaveBeenCalled();
  });

  it("cuando el último premio termina su camino, el sorteo pasa a CERRADO", async () => {
    awardFindFirstMock.mockResolvedValue(
      premio({
        raffle: {
          id: "r-1",
          workspaceId: "ws-1",
          awards: [
            { id: "aw-1", status: "GANADO" },
            { id: "aw-2", status: "RETIRADO" },
          ],
        },
      }),
    );
    await avanzar("RETIRADO");
    expect(raffleUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "CERRADO" } }),
    );
  });

  it("mientras quede uno pendiente, el sorteo sigue abierto", async () => {
    awardFindFirstMock.mockResolvedValue(
      premio({
        raffle: {
          id: "r-1",
          workspaceId: "ws-1",
          awards: [
            { id: "aw-1", status: "GANADO" },
            { id: "aw-2", status: "NOTIFICADO" },
          ],
        },
      }),
    );
    await avanzar("RETIRADO");
    expect(raffleUpdateMock).not.toHaveBeenCalled();
  });

  it("un premio de otra institución no se puede tocar", async () => {
    awardFindFirstMock.mockResolvedValue(null);
    const r = await avanzar("RETIRADO");
    expect(r.ok).toBe(false);
    expect(awardUpdateMock).not.toHaveBeenCalled();
  });

  it("el ganador que se dio de baja conserva su premio: no hay chequeo de estado societario", async () => {
    // La ficha puede haber cambiado; las instantáneas del padrón guardan quién era.
    const r = await avanzar("RETIRADO", "Ya no es socio, la Comisión resolvió entregárselo igual");
    expect(r.ok).toBe(true);
  });
});

describe("vencer los premios que nadie retiró", () => {
  it("pasa a NO_RETIRADO los que tienen plazo vencido y siguen pendientes", async () => {
    awardFindManyMock.mockResolvedValue([
      { id: "aw-1", raffleId: "r-1", prizeId: "p-1" },
      { id: "aw-3", raffleId: "r-2", prizeId: "p-3" },
    ]);
    const r = await expireUnclaimedPrizes(AHORA);
    expect(r.vencidos).toBe(2);
    expect(awardUpdateManyMock).toHaveBeenCalled();
  });

  it("busca sólo los pendientes con plazo cumplido", async () => {
    await expireUnclaimedPrizes(AHORA);
    const filtro = awardFindManyMock.mock.calls[0][0].where;
    expect(filtro.status.in).toEqual(["GANADO", "NOTIFICADO"]);
    expect(filtro.prize.pickupDeadline.lt).toEqual(AHORA);
  });

  it("sin nada vencido no escribe", async () => {
    awardFindManyMock.mockResolvedValue([]);
    const r = await expireUnclaimedPrizes(AHORA);
    expect(r.vencidos).toBe(0);
    expect(awardUpdateManyMock).not.toHaveBeenCalled();
  });
});
