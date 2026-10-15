import { beforeEach, describe, expect, it, vi } from "vitest";

const { settingsFindManyMock, raffleFindFirstMock, raffleCreateMock, commitmentFindManyMock, eventMock } =
  vi.hoisted(() => ({
    settingsFindManyMock: vi.fn(),
    raffleFindFirstMock: vi.fn(),
    raffleCreateMock: vi.fn(),
    commitmentFindManyMock: vi.fn(),
    eventMock: vi.fn(),
  }));

vi.mock("@repo/db", () => ({
  prisma: {
    raffleSettings: { findMany: settingsFindManyMock },
    raffle: { findFirst: raffleFindFirstMock, create: raffleCreateMock },
    rafflePrizeCommitment: { findMany: commitmentFindManyMock },
  },
  Prisma: {},
}));
vi.mock("./events", () => ({ recordRaffleEvent: eventMock }));

const { generateMonthlyRaffles } = await import("./monthly");

// 25 de octubre. El acto de octubre es el 30: faltan 5 días, dentro de los 10 de anticipación.
const HOY = new Date("2026-10-25T15:00:00Z");

const reglas = {
  workspaceId: "ws-1",
  monthlyEnabled: true,
  drawDay: 30,
  drawHour: 20,
  entriesCloseHoursBefore: 24,
  pickupDays: 15,
  createDaysAhead: 10,
};

const compromiso = (extra = {}) => ({
  id: "c-1",
  title: "50% OFF en cursos seleccionados",
  description: null,
  conditions: "Sobre cursos de la grilla vigente.",
  estimatedValueMinor: null,
  order: 1,
  partnerId: "pt-1",
  partnerNameSnapshot: "Arte en Foco",
  partnerEmailSnapshot: "arteenfocorosario@gmail.com",
  partnerAddressSnapshot: null,
  partnerPhoneSnapshot: null,
  partnerHoursSnapshot: null,
  startPeriod: "2026-09",
  endPeriod: "2026-12",
  cancelledAt: null,
  ...extra,
});

beforeEach(() => {
  settingsFindManyMock.mockReset().mockResolvedValue([reglas]);
  raffleFindFirstMock.mockReset().mockResolvedValue(null);
  raffleCreateMock.mockReset().mockResolvedValue({ id: "r-nuevo" });
  commitmentFindManyMock.mockReset().mockResolvedValue([compromiso()]);
  eventMock.mockReset();
});

describe("el sorteo del mes se crea solo", () => {
  it("crea el del mes que viene cuando se acerca la fecha", async () => {
    const r = await generateMonthlyRaffles(HOY);
    expect(r.creados).toBe(1);
    const datos = raffleCreateMock.mock.calls[0][0].data;
    expect(datos.period).toBe("2026-10");
    expect(datos.title).toBe("Sorteo de octubre de 2026");
    expect(datos.status).toBe("BORRADOR");
  });

  it("le carga los premios comprometidos que siguen vigentes", async () => {
    await generateMonthlyRaffles(HOY);
    const premios = raffleCreateMock.mock.calls[0][0].data.prizes.create;
    expect(premios).toHaveLength(1);
    expect(premios[0]).toMatchObject({
      title: "50% OFF en cursos seleccionados",
      commitmentId: "c-1",
      partnerNameSnapshot: "Arte en Foco",
      partnerEmailSnapshot: "arteenfocorosario@gmail.com",
    });
  });

  it("copia el plazo de retiro de las reglas de la institución", async () => {
    await generateMonthlyRaffles(HOY);
    expect(raffleCreateMock.mock.calls[0][0].data.pickupDays).toBe(15);
  });

  it("no crea dos veces el mismo mes", async () => {
    raffleFindFirstMock.mockResolvedValue({ id: "ya-existe" });
    const r = await generateMonthlyRaffles(HOY);
    expect(r.creados).toBe(0);
    expect(raffleCreateMock).not.toHaveBeenCalled();
  });

  it("con la generación apagada no hace nada", async () => {
    settingsFindManyMock.mockResolvedValue([]);
    const r = await generateMonthlyRaffles(HOY);
    expect(r.creados).toBe(0);
  });

  it("todavía lejos de la fecha, no lo crea: el sorteo aparecería con un mes de anticipación", async () => {
    const r = await generateMonthlyRaffles(new Date("2026-10-05T12:00:00Z"));
    expect(r.creados).toBe(0);
    expect(raffleCreateMock).not.toHaveBeenCalled();
  });

  it("pasado el acto del mes, mira el mes siguiente y espera a que se acerque", async () => {
    const r = await generateMonthlyRaffles(new Date("2026-11-01T12:00:00Z"));
    expect(r.creados).toBe(0);
  });

  it("a fin de noviembre crea el de noviembre, no el de diciembre", async () => {
    await generateMonthlyRaffles(new Date("2026-11-25T15:00:00Z"));
    expect(raffleCreateMock.mock.calls[0][0].data.period).toBe("2026-11");
  });

  it("un compromiso vencido ya no genera premio", async () => {
    commitmentFindManyMock.mockResolvedValue([compromiso({ endPeriod: "2026-09" })]);
    const r = await generateMonthlyRaffles(HOY);
    expect(r.creados).toBe(0);
    expect(r.sinPremios).toBe(1);
  });

  it("sin ningún premio comprometido no crea un sorteo vacío", async () => {
    commitmentFindManyMock.mockResolvedValue([]);
    const r = await generateMonthlyRaffles(HOY);
    expect(r.creados).toBe(0);
    expect(raffleCreateMock).not.toHaveBeenCalled();
  });

  it("dos compromisos con el mismo orden se acomodan: el orden entra en la cuenta y no puede repetirse", async () => {
    commitmentFindManyMock.mockResolvedValue([
      compromiso(),
      compromiso({ id: "c-2", title: "Otro premio", order: 1 }),
    ]);
    await generateMonthlyRaffles(HOY);
    const premios = raffleCreateMock.mock.calls[0][0].data.prizes.create;
    expect(premios.map((p: { order: number }) => p.order)).toEqual([1, 2]);
  });

  it("deja constancia de que lo creó el sistema", async () => {
    await generateMonthlyRaffles(HOY);
    expect(eventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: "CREADO" }),
    );
  });
});
