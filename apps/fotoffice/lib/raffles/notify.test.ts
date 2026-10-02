import { beforeEach, describe, expect, it, vi } from "vitest";

const { findManyMock, updateMock, enviarMock, firmaMock, eventMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  updateMock: vi.fn(),
  enviarMock: vi.fn(),
  firmaMock: vi.fn(),
  eventMock: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: { rafflePrizeAward: { findMany: findManyMock, update: updateMock } },
  Prisma: {},
}));
vi.mock("@/lib/communications/send-and-log", () => ({ sendAndLogEmail: enviarMock }));
vi.mock("@/lib/communications/load-workspace-signature", () => ({ loadWorkspaceSignature: firmaMock }));
vi.mock("./events", () => ({ recordRaffleEvent: eventMock }));

const { notifyPendingAwards } = await import("./notify");

const AHORA = new Date("2026-10-01T12:00:00Z");

const premio = (extra = {}) => ({
  id: "aw-1",
  raffleId: "r-1",
  notifiedAt: null,
  sponsorNotifiedAt: null,
  member: { firstName: "Ana", lastName: "Díaz", memberNumber: "114", email: "ana@ejemplo.com" },
  prize: {
    title: "Mochila para equipo fotográfico",
    conditions: null,
    pickupDeadline: new Date("2026-10-16T02:59:59Z"),
    partnerNameSnapshot: "Casa de Fotografía Norte",
    partnerEmailSnapshot: "aliado@ejemplo.com",
    partnerAddressSnapshot: "San Martín 1234",
    partnerPhoneSnapshot: "341 555-0198",
    partnerHoursSnapshot: "9 a 18",
  },
  raffle: {
    id: "r-1",
    title: "Sorteo de septiembre",
    workspaceId: "ws-1",
    workspace: { name: "SFPR", fotofficeBranding: { contactEmail: "sfpr@ejemplo.com" } },
  },
  ...extra,
});

beforeEach(() => {
  findManyMock.mockReset().mockResolvedValue([premio()]);
  updateMock.mockReset().mockResolvedValue({});
  enviarMock.mockReset().mockResolvedValue({ status: "SENT", providerId: "re_1" });
  firmaMock.mockReset().mockResolvedValue(null);
  eventMock.mockReset();
});

describe("avisar a quien corresponde", () => {
  it("manda los dos correos: al ganador y al aliado", async () => {
    const r = await notifyPendingAwards(AHORA);
    expect(r.ganadores).toBe(1);
    expect(r.aliados).toBe(1);
    const destinos = enviarMock.mock.calls.map((c) => c[0].to);
    expect(destinos).toContain("ana@ejemplo.com");
    expect(destinos).toContain("aliado@ejemplo.com");
  });

  it("anota cuándo salió cada uno", async () => {
    await notifyPendingAwards(AHORA);
    const datos = updateMock.mock.calls.map((c) => c[0].data);
    expect(datos.some((d) => d.notifiedAt)).toBe(true);
    expect(datos.some((d) => d.sponsorNotifiedAt)).toBe(true);
  });

  it("no reenvía lo que ya salió", async () => {
    findManyMock.mockResolvedValue([premio({ notifiedAt: AHORA, sponsorNotifiedAt: AHORA })]);
    const r = await notifyPendingAwards(AHORA);
    expect(r.ganadores).toBe(0);
    expect(r.aliados).toBe(0);
    expect(enviarMock).not.toHaveBeenCalled();
  });

  it("si ya se avisó al ganador pero no al aliado, sólo manda el que falta", async () => {
    findManyMock.mockResolvedValue([premio({ notifiedAt: AHORA })]);
    await notifyPendingAwards(AHORA);
    expect(enviarMock).toHaveBeenCalledTimes(1);
    expect(enviarMock.mock.calls[0][0].to).toBe("aliado@ejemplo.com");
  });

  it("un socio sin correo no frena el aviso al aliado, y queda registrado por qué", async () => {
    findManyMock.mockResolvedValue([
      premio({ member: { firstName: "Ana", lastName: "Díaz", memberNumber: "114", email: null } }),
    ]);
    const r = await notifyPendingAwards(AHORA);
    expect(r.ganadores).toBe(0);
    expect(r.aliados).toBe(1);
    const datos = updateMock.mock.calls.map((c) => c[0].data);
    expect(datos.some((d) => typeof d.noticeError === "string" && /correo/i.test(d.noticeError))).toBe(true);
  });

  it("un aliado sin correo tampoco frena el aviso al ganador", async () => {
    findManyMock.mockResolvedValue([
      premio({ prize: { ...premio().prize, partnerEmailSnapshot: null } }),
    ]);
    const r = await notifyPendingAwards(AHORA);
    expect(r.ganadores).toBe(1);
    expect(r.aliados).toBe(0);
  });

  it("si el envío rebota, guarda el error y NO marca como avisado: se reintenta solo", async () => {
    enviarMock.mockResolvedValue({ status: "BOUNCED", detail: "buzón inexistente" });
    await notifyPendingAwards(AHORA);
    const datos = updateMock.mock.calls.map((c) => c[0].data);
    expect(datos.every((d) => !d.notifiedAt)).toBe(true);
    expect(datos.some((d) => d.noticeError)).toBe(true);
  });

  it("el plazo que viaja en el correo es el del premio, no uno recalculado", async () => {
    await notifyPendingAwards(AHORA);
    const cuerpo = enviarMock.mock.calls[0][0].body.text;
    expect(cuerpo).toContain("15 de octubre de 2026");
  });

  it("al aliado le pide el remito al correo de la institución", async () => {
    await notifyPendingAwards(AHORA);
    const alAliado = enviarMock.mock.calls.find((c) => c[0].to === "aliado@ejemplo.com");
    expect(alAliado?.[0].body.text).toContain("sfpr@ejemplo.com");
  });

  it("sin branding institucional cargado no le escribe al aliado: no sabría adónde pedirle nada", async () => {
    findManyMock.mockResolvedValue([
      premio({ raffle: { ...premio().raffle, workspace: { name: "SFPR", fotofficeBranding: null } } }),
    ]);
    const r = await notifyPendingAwards(AHORA);
    expect(r.aliados).toBe(0);
    expect(r.ganadores).toBe(1);
  });

  it("cada aviso queda en la historia del sorteo", async () => {
    await notifyPendingAwards(AHORA);
    expect(eventMock).toHaveBeenCalled();
  });
});
