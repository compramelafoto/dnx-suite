import { beforeEach, describe, expect, it, vi } from "vitest";

const { findManyMock, countMock, eventMock, enviarMock, moduloMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  countMock: vi.fn(),
  eventMock: vi.fn(),
  enviarMock: vi.fn(),
  moduloMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({
  prisma: {
    raffle: { findMany: findManyMock },
    sentEmailLog: { count: countMock },
    raffleEvent: { create: eventMock },
  },
}));
vi.mock("@/lib/app-url", () => ({ appUrl: () => "https://fotoffice.com" }));
vi.mock("@/lib/communications/send-and-log", () => ({ sendAndLogEmail: enviarMock }));
vi.mock("@/lib/communications/load-workspace-signature", () => ({ loadWorkspaceSignature: async () => null }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: moduloMock }));
vi.mock("@/lib/vocabulario/load", () => ({
  loadPersonVocabulary: async () => ({ singular: "socio", plural: "socios", Singular: "Socio", Plural: "Socios" }),
}));

const { sendPendingInstitutionSummaries } = await import("./institution-summary");

const SORTEO_HECHO = new Date("2026-10-11T23:00:05Z");
const AHORA = new Date("2026-10-11T23:15:00Z");

const award = (extra = {}) => ({
  status: "NOTIFICADO",
  notifiedAt: SORTEO_HECHO,
  noticeError: null,
  sponsorNotifiedAt: SORTEO_HECHO,
  sponsorNoticeError: null,
  member: { firstName: "Diego Luis", lastName: "Rovere", memberNumber: "565", email: "d@ejemplo.com", phone: null },
  ...extra,
});

const sorteo = (premios = [{ award: award() }], extra = {}) => ({
  id: "r-1",
  title: "Sorteo del Mes!",
  workspaceId: "ws-1",
  drawsAt: new Date("2026-10-11T23:00:00Z"),
  drawnAt: SORTEO_HECHO,
  entrantsCount: 101,
  workspace: { fotofficeBranding: { contactEmail: "sfpr@ejemplo.com" } },
  prizes: premios.map((p, i) => ({
    title: `Premio ${i + 1}`,
    partnerNameSnapshot: "Tecnoflash",
    pickupDeadline: new Date("2026-10-27T02:59:59Z"),
    ...p,
  })),
  ...extra,
});

beforeEach(() => {
  findManyMock.mockReset().mockResolvedValue([sorteo()]);
  countMock.mockReset().mockResolvedValue(0);
  eventMock.mockReset().mockResolvedValue({});
  enviarMock.mockReset().mockResolvedValue({ status: "SENT" });
  moduloMock.mockReset().mockResolvedValue(true);
});

describe("el resumen a la institución", () => {
  it("sale al correo de contacto de la institución y queda anotado en la historia", async () => {
    const r = await sendPendingInstitutionSummaries(AHORA);
    expect(r.enviados).toBe(1);
    expect(enviarMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "sfpr@ejemplo.com", templateKey: "raffle-institution:r-1" }),
    );
    expect(enviarMock.mock.calls[0][0].body.text).toContain("Diego Luis Rovere, socio N° 565");
    expect(eventMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ raffleId: "r-1", type: "RESUMEN_INSTITUCION_ENVIADO" }),
    });
  });

  it("no busca sorteos que ya tienen el resumen enviado", async () => {
    await sendPendingInstitutionSummaries(AHORA);
    expect(findManyMock.mock.calls[0][0].where.events).toEqual({
      none: { type: "RESUMEN_INSTITUCION_ENVIADO" },
    });
  });

  it("espera a que se intenten los avisos, para no decir que fallaron antes de probar", async () => {
    findManyMock.mockResolvedValue([sorteo([{ award: award({ sponsorNotifiedAt: null }) }])]);
    const r = await sendPendingInstitutionSummaries(AHORA);
    expect(r.enviados).toBe(0);
    expect(enviarMock).not.toHaveBeenCalled();
  });

  it("un aviso que falló cuenta como intentado: el resumen sale y lo dice", async () => {
    findManyMock.mockResolvedValue([
      sorteo([{ award: award({ notifiedAt: null, noticeError: "El socio no tiene correo cargado." }) }]),
    ]);
    await sendPendingInstitutionSummaries(AHORA);
    expect(enviarMock.mock.calls[0][0].body.text).toContain("No le pudimos avisar al ganador");
  });

  it("pasada una hora del sorteo sale igual, aunque algún aviso no se haya podido intentar", async () => {
    findManyMock.mockResolvedValue([sorteo([{ award: award({ notifiedAt: null }) }])]);
    const r = await sendPendingInstitutionSummaries(new Date("2026-10-12T00:10:00Z"));
    expect(r.enviados).toBe(1);
  });

  it("los premios anulados no aparecen", async () => {
    findManyMock.mockResolvedValue([
      sorteo([{ award: award() }, { award: award({ status: "ANULADO", notifiedAt: null }) }]),
    ]);
    await sendPendingInstitutionSummaries(AHORA);
    const texto = enviarMock.mock.calls[0][0].body.text as string;
    expect(texto).toContain("Premio 1");
    expect(texto).not.toContain("Premio 2");
  });

  it("sin correo de contacto, o con el módulo apagado, no manda nada", async () => {
    findManyMock.mockResolvedValue([sorteo(undefined, { workspace: { fotofficeBranding: null } })]);
    await sendPendingInstitutionSummaries(AHORA);
    findManyMock.mockResolvedValue([sorteo()]);
    moduloMock.mockResolvedValue(false);
    await sendPendingInstitutionSummaries(AHORA);
    expect(enviarMock).not.toHaveBeenCalled();
  });

  it("si falló, no anota el evento y se reintenta; después de tres rechazos, deja de intentar", async () => {
    enviarMock.mockResolvedValue({ status: "PROVIDER_REJECTED" });
    const r = await sendPendingInstitutionSummaries(AHORA);
    expect(r.fallados).toBe(1);
    expect(eventMock).not.toHaveBeenCalled();

    enviarMock.mockClear();
    countMock.mockResolvedValue(3);
    await sendPendingInstitutionSummaries(AHORA);
    expect(enviarMock).not.toHaveBeenCalled();
  });
});
