import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFirstMock, updateMock, createManyMock, transactionMock, eventMock, membersMock } =
  vi.hoisted(() => ({
    findFirstMock: vi.fn(),
    updateMock: vi.fn(),
    createManyMock: vi.fn(),
    transactionMock: vi.fn(),
    eventMock: vi.fn(),
    membersMock: vi.fn(),
  }));

vi.mock("@repo/db", () => ({
  prisma: {
    raffle: { findFirst: findFirstMock, findMany: vi.fn(), update: updateMock },
    raffleEntry: { createMany: createManyMock },
    $transaction: transactionMock,
  },
  Prisma: {},
}));
vi.mock("./events", () => ({ recordRaffleEvent: eventMock }));
vi.mock("./repository", () => ({ loadMembersForRaffle: membersMock }));

const { sealRaffle } = await import("./seal");

const CIERRE = new Date("2026-09-29T23:00:00Z");
const DESPUES = new Date("2026-09-30T01:00:00Z");

const sorteo = {
  id: "r-1",
  status: "ANUNCIADO",
  entriesCloseAt: CIERRE,
  entrantsHash: null as string | null,
  entrantsCount: null as number | null,
  _count: { prizes: 2 },
};

const socio = (id: string, numero: string, alDia = true) => ({
  memberId: id,
  memberNumber: numero,
  fullName: `Socio ${numero}`,
  status: "ACTIVE",
  charges: alDia
    ? []
    : [{ period: "2026-08", dueDate: new Date("2026-09-10T00:00:00Z"), balanceMinor: 500_000 }],
});

beforeEach(() => {
  findFirstMock.mockReset().mockResolvedValue(sorteo);
  updateMock.mockReset().mockResolvedValue({});
  createManyMock.mockReset().mockResolvedValue({ count: 0 });
  eventMock.mockReset();
  membersMock.mockReset().mockResolvedValue([socio("m-1", "10"), socio("m-2", "20")]);
  transactionMock.mockReset().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({ raffle: { update: updateMock }, raffleEntry: { createMany: createManyMock } }),
  );
});

const sellar = (now = DESPUES, raffleId = "r-1") =>
  sealRaffle({ workspaceId: "ws-1", raffleId, actorUserId: null, actorLabel: null, now });

describe("sellar el padrón", () => {
  it("congela a los que están al día, con posición y huella", async () => {
    const r = await sellar();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entrantsCount).toBe(2);
    expect(r.entrantsHash).toMatch(/^[0-9a-f]{64}$/);
    expect(createManyMock.mock.calls[0][0].data).toHaveLength(2);
  });

  it("deja afuera al que debe", async () => {
    membersMock.mockResolvedValue([
      socio("m-1", "10"),
      socio("m-2", "20", false),
      socio("m-3", "30"),
    ]);
    const r = await sellar();
    expect(r.ok && r.entrantsCount).toBe(2);
    const filas = createManyMock.mock.calls[0][0].data;
    expect(filas.map((f: { memberId: string }) => f.memberId)).toEqual(["m-1", "m-3"]);
  });

  it("guarda instantáneas del número y el nombre", async () => {
    await sellar();
    const filas = createManyMock.mock.calls[0][0].data;
    expect(filas[0]).toMatchObject({ memberNumberSnapshot: "10", fullNameSnapshot: "Socio 10" });
  });

  it("las posiciones arrancan en cero y son consecutivas", async () => {
    await sellar();
    const filas = createManyMock.mock.calls[0][0].data;
    expect(filas.map((f: { position: number }) => f.position)).toEqual([0, 1]);
  });

  it("pasa a PADRON_SELLADO y anota cuándo", async () => {
    await sellar();
    const datos = updateMock.mock.calls[0][0].data;
    expect(datos.status).toBe("PADRON_SELLADO");
    expect(datos.sealedAt).toEqual(DESPUES);
  });

  it("antes del cierre no sella", async () => {
    const r = await sellar(new Date("2026-09-28T00:00:00Z"));
    expect(r.ok).toBe(false);
    expect(createManyMock).not.toHaveBeenCalled();
  });

  it("un padrón ya sellado no se vuelve a sellar, y no es un error", async () => {
    findFirstMock.mockResolvedValue({
      ...sorteo,
      status: "PADRON_SELLADO",
      entrantsHash: "f".repeat(64),
      entrantsCount: 40,
    });
    expect(await sellar()).toEqual({
      ok: true,
      alreadySealed: true,
      entrantsCount: 40,
      entrantsHash: "f".repeat(64),
    });
    expect(createManyMock).not.toHaveBeenCalled();
  });

  it("sin ningún socio al día no sella, y el sorteo queda anunciado", async () => {
    membersMock.mockResolvedValue([socio("m-1", "10", false)]);
    expect(await sellar()).toEqual({
      ok: false,
      error: "Ningún socio quedó al día al cerrar el padrón. El sorteo no se puede sellar.",
    });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("con menos participantes que premios no sella", async () => {
    findFirstMock.mockResolvedValue({ ...sorteo, _count: { prizes: 5 } });
    expect((await sellar()).ok).toBe(false);
  });

  it("la huella lleva el sorteo adentro: dos sorteos con el mismo padrón no la comparten", async () => {
    const a = await sellar();
    findFirstMock.mockResolvedValue({ ...sorteo, id: "r-2" });
    const b = await sellar(DESPUES, "r-2");
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.entrantsHash).not.toBe(b.entrantsHash);
  });

  it("la deuda se mide contra el cierre del padrón, no contra el momento de sellar", async () => {
    // Cuota que vence DESPUÉS del cierre pero ANTES de que alguien apriete el botón. Si se
    // midiera contra "ahora", este socio quedaría afuera de un padrón que ya se le prometió.
    const conCuotaPosterior = {
      ...socio("m-1", "10"),
      charges: [
        { period: "2026-10", dueDate: new Date("2026-09-30T00:00:00Z"), balanceMinor: 500_000 },
      ],
    };
    membersMock.mockResolvedValue([conCuotaPosterior, socio("m-2", "20")]);
    const r = await sellar(new Date("2026-10-05T00:00:00Z"));
    expect(r.ok && r.entrantsCount).toBe(2);
  });

  it("deja registrado el sellado con la cantidad y la huella", async () => {
    await sellar();
    expect(eventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: "PADRON_SELLADO" }),
    );
    expect(eventMock.mock.calls[0][1].note).toMatch(/^2 participantes\./);
  });

  it("un sorteo de otra institución no existe para esta", async () => {
    findFirstMock.mockResolvedValue(null);
    expect((await sellar()).ok).toBe(false);
  });
});
