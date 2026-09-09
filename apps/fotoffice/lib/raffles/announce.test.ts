import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFirstMock, updateMock, transactionMock, eventMock, chainInfoMock } = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
  updateMock: vi.fn(),
  transactionMock: vi.fn(),
  eventMock: vi.fn(),
  chainInfoMock: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: { raffle: { findFirst: findFirstMock, update: updateMock }, $transaction: transactionMock },
  Prisma: {},
}));
vi.mock("./events", () => ({ recordRaffleEvent: eventMock }));
vi.mock("./drand", async () => {
  const real = await vi.importActual<typeof import("./drand")>("./drand");
  return { ...real, fetchChainInfo: chainInfoMock };
});

const { announceRaffle } = await import("./announce");

const AHORA = new Date("2026-09-20T12:00:00Z");
const INFO = {
  chainHash: "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971",
  periodSeconds: 3,
  genesisTimeSeconds: 1_692_803_367,
};
const sorteo = {
  id: "r-1",
  status: "BORRADOR",
  entriesCloseAt: new Date("2026-09-29T23:00:00Z"),
  drawsAt: new Date("2026-09-30T23:00:00Z"),
  _count: { prizes: 2 },
};

beforeEach(() => {
  findFirstMock.mockReset().mockResolvedValue(sorteo);
  updateMock.mockReset().mockResolvedValue({});
  eventMock.mockReset();
  chainInfoMock.mockReset().mockResolvedValue(INFO);
  transactionMock.mockReset().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({ raffle: { update: updateMock } }),
  );
});

const anunciar = () =>
  announceRaffle({
    workspaceId: "ws-1",
    raffleId: "r-1",
    actorUserId: 7,
    actorLabel: "Secretaría",
    now: AHORA,
  });

describe("anunciar un sorteo", () => {
  it("guarda la cadena y la tanda, y pasa a ANUNCIADO", async () => {
    const r = await anunciar();
    expect(r.ok).toBe(true);
    const datos = updateMock.mock.calls[0][0].data;
    expect(datos.status).toBe("ANUNCIADO");
    expect(datos.drandChainHash).toHaveLength(64);
    expect(typeof datos.drandRound).toBe("number");
  });

  it("la tanda que fija es POSTERIOR al acto", async () => {
    const r = await anunciar();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const cuando = (INFO.genesisTimeSeconds + (r.round - 1) * INFO.periodSeconds) * 1000;
    expect(cuando).toBeGreaterThan(sorteo.drawsAt.getTime());
  });

  it("NO escribe el valor del azar: eso todavía no existe, y ese es todo el punto", async () => {
    await anunciar();
    const datos = updateMock.mock.calls[0][0].data;
    expect(datos.drandRandomness).toBeUndefined();
    expect(datos.drandSignature).toBeUndefined();
  });

  it("deja registrado quién anunció y con qué tanda", async () => {
    await anunciar();
    expect(eventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: "ANUNCIADO", actorUserId: 7, actorLabel: "Secretaría" }),
    );
    expect(eventMock.mock.calls[0][1].note).toMatch(/tanda/i);
  });

  it("no anuncia un sorteo sin premios", async () => {
    findFirstMock.mockResolvedValue({ ...sorteo, _count: { prizes: 0 } });
    await expect(anunciar()).resolves.toEqual({
      ok: false,
      error: "No se puede anunciar un sorteo sin premios.",
    });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("no anuncia dos veces", async () => {
    findFirstMock.mockResolvedValue({ ...sorteo, status: "ANUNCIADO" });
    expect((await anunciar()).ok).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("un sorteo de otra institución no existe para esta", async () => {
    findFirstMock.mockResolvedValue(null);
    expect((await anunciar()).ok).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("si drand no contesta, no anuncia y lo dice: sin tanda no hay garantía", async () => {
    chainInfoMock.mockRejectedValue(new Error("sin red"));
    const r = await anunciar();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/drand/i);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("no inventa el período: lo lee del servicio para calcular la tanda", async () => {
    chainInfoMock.mockResolvedValue({ ...INFO, periodSeconds: 30 });
    const r = await anunciar();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const cuando = (INFO.genesisTimeSeconds + (r.round - 1) * 30) * 1000;
    expect(cuando).toBeGreaterThan(sorteo.drawsAt.getTime());
    expect(cuando - sorteo.drawsAt.getTime()).toBeLessThanOrEqual(60_000);
  });
});
