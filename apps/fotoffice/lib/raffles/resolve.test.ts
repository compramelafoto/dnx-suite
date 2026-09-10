import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findFirstMock,
  updateMock,
  prizeUpdateManyMock,
  awardCreateManyMock,
  awardFindManyMock,
  transactionMock,
  eventMock,
  fetchRoundMock,
} = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
  updateMock: vi.fn(),
  prizeUpdateManyMock: vi.fn(),
  awardCreateManyMock: vi.fn(),
  awardFindManyMock: vi.fn(),
  transactionMock: vi.fn(),
  eventMock: vi.fn(),
  fetchRoundMock: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    raffle: { findFirst: findFirstMock, findMany: vi.fn(), update: updateMock },
    rafflePrize: { updateMany: prizeUpdateManyMock },
    rafflePrizeAward: { createMany: awardCreateManyMock, findMany: awardFindManyMock },
    $transaction: transactionMock,
  },
  Prisma: {},
}));
vi.mock("./events", () => ({ recordRaffleEvent: eventMock }));
vi.mock("./drand", async () => {
  const real = await vi.importActual<typeof import("./drand")>("./drand");
  return { ...real, fetchRound: fetchRoundMock };
});

const { resolveRaffle } = await import("./resolve");

const ACTO = new Date("2026-09-30T23:00:00Z");
const DESPUES = new Date("2026-09-30T23:05:00Z");

const sorteo = {
  id: "r-1",
  status: "PADRON_SELLADO",
  drawsAt: ACTO,
  drawnAt: null as Date | null,
  entrantsHash: "a".repeat(64),
  entrantsCount: 5,
  drandChainHash: "c".repeat(64),
  drandRound: 1000,
  drandRandomness: null as string | null,
  pickupDays: 15,
  prizes: [
    { id: "p-1", order: 1 },
    { id: "p-2", order: 2 },
  ],
  entries: Array.from({ length: 5 }, (_, i) => ({ id: `e-${i}`, memberId: `m-${i}`, position: i })),
};

beforeEach(() => {
  findFirstMock.mockReset().mockResolvedValue(sorteo);
  updateMock.mockReset().mockResolvedValue({});
  awardCreateManyMock.mockReset().mockResolvedValue({ count: 2 });
  prizeUpdateManyMock.mockReset().mockResolvedValue({ count: 2 });
  awardFindManyMock.mockReset().mockResolvedValue([]);
  eventMock.mockReset();
  fetchRoundMock
    .mockReset()
    .mockResolvedValue({ round: 1000, randomness: "b".repeat(64), signature: "d".repeat(96) });
  transactionMock.mockReset().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      raffle: { update: updateMock },
      rafflePrize: { updateMany: prizeUpdateManyMock },
      rafflePrizeAward: { createMany: awardCreateManyMock },
    }),
  );
});

const resolver = (now = DESPUES) => resolveRaffle({ workspaceId: "ws-1", raffleId: "r-1", now });

describe("resolver el sorteo", () => {
  it("asigna un ganador por premio", async () => {
    const r = await resolver();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.awards).toHaveLength(2);
  });

  it("nadie gana dos premios", async () => {
    const r = await resolver();
    if (!r.ok) throw new Error("debía resolver");
    const ids = r.awards.map((a) => a.memberId);
    expect(new Set(ids).size).toBe(2);
  });

  it("cada ganador es un socio del padrón sellado", async () => {
    const r = await resolver();
    if (!r.ok) throw new Error("debía resolver");
    for (const a of r.awards) {
      expect(sorteo.entries.some((e) => e.memberId === a.memberId)).toBe(true);
    }
  });

  it("guarda el valor de drand y su firma, y pasa a SORTEADO", async () => {
    await resolver();
    const datos = updateMock.mock.calls[0][0].data;
    expect(datos.drandRandomness).toBe("b".repeat(64));
    expect(datos.drandSignature).toBe("d".repeat(96));
    expect(datos.status).toBe("SORTEADO");
    expect(datos.drawnAt).toEqual(DESPUES);
  });

  it("usa la tanda que se fijó al anunciar y no calcula una nueva", async () => {
    await resolver();
    expect(fetchRoundMock).toHaveBeenCalledWith("c".repeat(64), 1000);
  });

  it("es idempotente: un sorteo ya resuelto devuelve lo mismo y no reescribe", async () => {
    findFirstMock.mockResolvedValue({ ...sorteo, status: "SORTEADO", drawnAt: DESPUES });
    awardFindManyMock.mockResolvedValue([
      { prizeId: "p-1", memberId: "m-2", winnerPosition: 2 },
      { prizeId: "p-2", memberId: "m-4", winnerPosition: 4 },
    ]);
    const r = await resolver();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.alreadyDrawn).toBe(true);
      expect(r.awards).toHaveLength(2);
    }
    expect(awardCreateManyMock).not.toHaveBeenCalled();
  });

  it("un sorteo cerrado tampoco se rehace", async () => {
    findFirstMock.mockResolvedValue({ ...sorteo, status: "CERRADO" });
    const r = await resolver();
    expect(r.ok && r.alreadyDrawn).toBe(true);
    expect(awardCreateManyMock).not.toHaveBeenCalled();
  });

  it("antes de la hora del acto no resuelve", async () => {
    const r = await resolver(new Date("2026-09-30T20:00:00Z"));
    expect(r.ok).toBe(false);
    expect(awardCreateManyMock).not.toHaveBeenCalled();
  });

  it("sin el padrón sellado no resuelve", async () => {
    findFirstMock.mockResolvedValue({ ...sorteo, status: "ANUNCIADO" });
    expect((await resolver()).ok).toBe(false);
  });

  it("si la tanda todavía no salió, espera: no es un error del sorteo", async () => {
    fetchRoundMock.mockRejectedValue(new Error("La tanda todavía no salió."));
    const r = await resolver();
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.waiting).toBe(true);
      expect(r.error).toContain("1000");
    }
    expect(awardCreateManyMock).not.toHaveBeenCalled();
  });

  it("si los espejos no coinciden, no resuelve y NO es una espera", async () => {
    fetchRoundMock.mockRejectedValue(new Error("Los espejos de drand no coinciden"));
    const r = await resolver();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.waiting).toBeUndefined();
    expect(awardCreateManyMock).not.toHaveBeenCalled();
  });

  it("el resultado no depende de cuándo se resuelva: mismos datos, mismos ganadores", async () => {
    const a = await resolver(new Date("2026-09-30T23:05:00Z"));
    const b = await resolver(new Date("2026-10-05T10:00:00Z"));
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.awards).toEqual(b.awards);
  });

  it("sin huella del padrón no resuelve: faltaría la mitad de la prueba", async () => {
    findFirstMock.mockResolvedValue({ ...sorteo, entrantsHash: null });
    expect((await resolver()).ok).toBe(false);
  });

  it("sin tanda fijada no resuelve", async () => {
    findFirstMock.mockResolvedValue({ ...sorteo, drandRound: null });
    expect((await resolver()).ok).toBe(false);
  });

  it("fija el plazo de retiro al resolver: 15 días desde el sorteo", async () => {
    await resolver();
    const datos = prizeUpdateManyMock.mock.calls[0][0].data;
    const dias = (datos.pickupDeadline.getTime() - DESPUES.getTime()) / 86_400_000;
    expect(dias).toBe(15);
  });

  it("no le pisa el plazo a un premio que ya tenía uno cargado a mano", async () => {
    await resolver();
    expect(prizeUpdateManyMock.mock.calls[0][0].where.pickupDeadline).toBe(null);
  });

  it("el plazo respeta lo que diga el sorteo, no un número fijo en el código", async () => {
    findFirstMock.mockResolvedValue({ ...sorteo, pickupDays: 30 });
    await resolver();
    const datos = prizeUpdateManyMock.mock.calls[0][0].data;
    const dias = (datos.pickupDeadline.getTime() - DESPUES.getTime()) / 86_400_000;
    expect(dias).toBe(30);
  });

  it("deja registrado el sorteo con la tanda y el valor usados", async () => {
    await resolver();
    expect(eventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: "SORTEADO" }),
    );
    expect(eventMock.mock.calls[0][1].note).toContain("1000");
  });
});
