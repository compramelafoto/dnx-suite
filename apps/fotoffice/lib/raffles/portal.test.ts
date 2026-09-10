import { beforeEach, describe, expect, it, vi } from "vitest";

const { raffleFindManyMock, memberMock } = vi.hoisted(() => ({
  raffleFindManyMock: vi.fn(),
  memberMock: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: { raffle: { findMany: raffleFindManyMock } },
  Prisma: {},
}));
vi.mock("./repository", () => ({ loadMemberForRaffle: memberMock }));

const { loadPortalRaffles } = await import("./portal");

const AHORA = new Date("2026-09-25T12:00:00Z");
const CIERRE = new Date("2026-09-29T23:00:00Z");
const ACTO = new Date("2026-09-30T23:00:00Z");

const sorteo = (extra: Record<string, unknown> = {}) => ({
  id: "r-1",
  title: "Sorteo de septiembre",
  description: "Con premios de las marcas aliadas.",
  status: "ANUNCIADO",
  entriesCloseAt: CIERRE,
  drawsAt: ACTO,
  entrantsCount: null,
  drandRound: 1000,
  cancelReason: null,
  prizes: [
    {
      id: "p-1",
      order: 1,
      title: "Mochila",
      description: null,
      conditions: "Con carnet.",
      pickupInstructions: "En la sede.",
      pickupDeadline: null,
      partnerNameSnapshot: "Casa Norte",
      award: null,
    },
  ],
  entries: [],
  ...extra,
});

const socioAlDia = {
  memberId: "m-1",
  memberNumber: "100",
  fullName: "Ana Díaz",
  status: "ACTIVE",
  charges: [],
};

const socioEnDeuda = {
  ...socioAlDia,
  charges: [{ period: "2026-08", dueDate: new Date("2026-09-10T00:00:00Z"), balanceMinor: 500_000 }],
};

beforeEach(() => {
  raffleFindManyMock.mockReset().mockResolvedValue([sorteo()]);
  memberMock.mockReset().mockResolvedValue(socioAlDia);
});

const cargar = (now = AHORA) =>
  loadPortalRaffles({ workspaceId: "ws-1", memberId: "m-1", now });

describe("la situación del socio antes de sellar", () => {
  it("el socio al día está participando", async () => {
    const { current } = await cargar();
    expect(current?.myStatus).toEqual({ participating: true, reason: null, frozen: false });
  });

  it("el socio en deuda no participa, y el motivo se lee en castellano", async () => {
    memberMock.mockResolvedValue(socioEnDeuda);
    const { current } = await cargar();
    expect(current?.myStatus.participating).toBe(false);
    expect(current?.myStatus.reason).toContain("agosto de 2026");
    expect(current?.myStatus.reason).not.toContain("2026-08");
  });

  it("todavía se puede cambiar: no está congelado", async () => {
    memberMock.mockResolvedValue(socioEnDeuda);
    const { current } = await cargar();
    expect(current?.myStatus.frozen).toBe(false);
  });
});

describe("la situación del socio DESPUÉS de sellar", () => {
  const sellado = sorteo({
    status: "PADRON_SELLADO",
    entrantsCount: 40,
    entries: [{ memberId: "m-1", position: 7 }],
  });

  it("participa porque está en el padrón congelado, no porque se recalcule", async () => {
    raffleFindManyMock.mockResolvedValue([sellado]);
    // Aunque AHORA deba, ya entró: la lista está cerrada.
    memberMock.mockResolvedValue(socioEnDeuda);
    const { current } = await cargar(new Date("2026-09-30T00:00:00Z"));
    expect(current?.myStatus).toEqual({ participating: true, reason: null, frozen: true });
  });

  it("el que pagó DESPUÉS del cierre no entra, y se le explica por qué", async () => {
    raffleFindManyMock.mockResolvedValue([sorteo({
      status: "PADRON_SELLADO",
      entrantsCount: 40,
      entries: [],
    })]);
    // Ahora está al día, pero al cierre no lo estaba.
    memberMock.mockResolvedValue(socioAlDia);
    const { current } = await cargar(new Date("2026-09-30T00:00:00Z"));
    expect(current?.myStatus.participating).toBe(false);
    expect(current?.myStatus.frozen).toBe(true);
    expect(current?.myStatus.reason).toMatch(/padrón.*cerr/i);
  });
});

describe("qué sorteo se muestra", () => {
  it("sin ningún sorteo abierto, no hay actual", async () => {
    raffleFindManyMock.mockResolvedValue([]);
    const { current, past } = await cargar();
    expect(current).toBe(null);
    expect(past).toEqual([]);
  });

  it("un sorteo cancelado no es el actual", async () => {
    raffleFindManyMock.mockResolvedValue([sorteo({ status: "CANCELADO", cancelReason: "Se pospuso" })]);
    const { current } = await cargar();
    expect(current).toBe(null);
  });

  it("un sorteo ya resuelto va a los anteriores", async () => {
    raffleFindManyMock.mockResolvedValue([sorteo({ status: "SORTEADO", entrantsCount: 40 })]);
    const { current, past } = await cargar(new Date("2026-10-02T00:00:00Z"));
    expect(current).toBe(null);
    expect(past).toHaveLength(1);
  });

  it("los premios se muestran con el aliado que los dona", async () => {
    const { current } = await cargar();
    expect(current?.prizes[0]).toMatchObject({ title: "Mochila", partnerName: "Casa Norte" });
  });
});

describe("lo que gané", () => {
  it("el socio que ganó ve su premio con condiciones y dónde retirarlo", async () => {
    raffleFindManyMock.mockResolvedValue([
      sorteo({
        status: "SORTEADO",
        entrantsCount: 40,
        entries: [{ memberId: "m-1", position: 7 }],
        prizes: [
          {
            id: "p-1",
            order: 1,
            title: "Mochila",
            description: null,
            conditions: "Con carnet.",
            pickupInstructions: "En la sede, martes y jueves.",
            pickupDeadline: new Date("2026-10-31T23:59:59Z"),
            partnerNameSnapshot: "Casa Norte",
            award: { memberId: "m-1", status: "GANADO", winnerPosition: 7 },
          },
        ],
      }),
    ]);
    const { past } = await cargar(new Date("2026-10-02T00:00:00Z"));
    expect(past[0].myAwards).toHaveLength(1);
    expect(past[0].myAwards[0]).toMatchObject({
      prizeTitle: "Mochila",
      conditions: "Con carnet.",
      pickupInstructions: "En la sede, martes y jueves.",
    });
  });

  it("el que no ganó no ve premios propios", async () => {
    raffleFindManyMock.mockResolvedValue([
      sorteo({
        status: "SORTEADO",
        entrantsCount: 40,
        prizes: [
          {
            id: "p-1",
            order: 1,
            title: "Mochila",
            description: null,
            conditions: null,
            pickupInstructions: null,
            pickupDeadline: null,
            partnerNameSnapshot: null,
            award: { memberId: "m-9", status: "GANADO", winnerPosition: 3 },
          },
        ],
      }),
    ]);
    const { past } = await cargar(new Date("2026-10-02T00:00:00Z"));
    expect(past[0].myAwards).toHaveLength(0);
  });
});

describe("aislamiento", () => {
  it("sólo consulta sorteos de la institución del socio", async () => {
    await cargar();
    expect(raffleFindManyMock.mock.calls[0][0].where.workspaceId).toBe("ws-1");
  });

  it("si la ficha del socio no existe, no se inventa una situación", async () => {
    memberMock.mockResolvedValue(null);
    const { current } = await cargar();
    expect(current?.myStatus.participating).toBe(false);
  });
});
