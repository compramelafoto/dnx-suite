import { beforeEach, describe, expect, it, vi } from "vitest";

const albumFindMany = vi.fn();
const orderGroupBy = vi.fn();
const notificationUpdate = vi.fn();
const queueEmail = vi.fn();
const getAlbumsReadiness = vi.fn();

vi.mock("@/lib/prisma", () => ({
  OrderOrigin: { PREVENTA_PACK: "PREVENTA_PACK" },
  OrderStatus: { PAID: "PAID" },
  Prisma: { AnyNull: "AnyNull" },
  prisma: {
    album: { findMany: (...a: unknown[]) => albumFindMany(...a) },
    order: { groupBy: (...a: unknown[]) => orderGroupBy(...a) },
    albumNotification: { update: (...a: unknown[]) => notificationUpdate(...a) },
  },
}));
vi.mock("@/lib/email-queue", () => ({ queueEmail: (...a: unknown[]) => queueEmail(...a) }));
vi.mock("@/lib/analysis/album-analysis-readiness", () => ({
  getAlbumsReadiness: (...a: unknown[]) => getAlbumsReadiness(...a),
}));

import { fechaCorta, runSendAlbumNotifications } from "./send-album-notifications";

const DIA = 86_400_000;

type Album = Record<string, unknown> & { id: number };

/** El primer findMany es el de "ya están las fotos" (filtra por `photos`); los otros, recordatorios. */
function albumes({ listos = [] as Album[], recordatorios = [] as Album[] }) {
  albumFindMany.mockImplementation(async (args: { where: Record<string, unknown> }) =>
    "photos" in args.where ? listos : recordatorios
  );
}

/** groupBy de packs pagos: el primero cuenta todos, el segundo sólo los ya avisados. */
function packs({ conPacks = [] as number[], avisados = [] as number[] }) {
  orderGroupBy.mockImplementation(async (args: { where: Record<string, unknown> }) =>
    ("redemptionPaymentRefsJson" in args.where ? avisados : conPacks).map((albumId) => ({ albumId }))
  );
}

const ALBUM_LISTO: Album = {
  id: 1075,
  title: "FOTOGRAFIA ESCOLAR",
  firstPhotoDate: new Date(Date.now() - DIA),
  photos: [],
  notifications: [{ id: 1, email: "familia@example.com" }],
};

beforeEach(() => {
  for (const f of [albumFindMany, orderGroupBy, notificationUpdate, queueEmail, getAlbumsReadiness]) f.mockReset();
  getAlbumsReadiness.mockImplementation(async (ids: number[]) => new Map(ids.map((id) => [id, { ready: true }])));
  packs({});
});

describe("aviso «ya están las fotos» a los anotados", () => {
  it("álbum con preventa paga y sin «Avisar a las familias»: espera y no lo marca (álbum 1075)", async () => {
    albumes({ listos: [ALBUM_LISTO] });
    packs({ conPacks: [1075] });
    const r = await runSendAlbumNotifications();
    expect(queueEmail).not.toHaveBeenCalled();
    expect(notificationUpdate).not.toHaveBeenCalled();
    expect(r.notifiedWhenReady).toBe(0);
  });

  it("con preventa y el fotógrafo ya avisó: sale", async () => {
    albumes({ listos: [ALBUM_LISTO] });
    packs({ conPacks: [1075], avisados: [1075] });
    const r = await runSendAlbumNotifications();
    expect(queueEmail).toHaveBeenCalledTimes(1);
    expect(r.notifiedWhenReady).toBe(1);
  });

  it("sin preventa: sale como siempre, apenas el álbum está analizado", async () => {
    albumes({ listos: [ALBUM_LISTO] });
    const r = await runSendAlbumNotifications();
    expect(queueEmail).toHaveBeenCalledTimes(1);
    expect(r.notifiedWhenReady).toBe(1);
  });
});

describe("recordatorios antes de que se oculte el álbum", () => {
  const conPrimeraFoto = (haceDias: number): Album => ({
    id: 7,
    title: "Maratón",
    // Creado mucho antes: la cuenta vieja (desde createdAt) lo daba por vencido.
    createdAt: new Date(Date.now() - 60 * DIA),
    firstPhotoDate: new Date(Date.now() - haceDias * DIA),
    expirationExtensionDays: 0,
    isHidden: false,
    deletedAt: null,
    cleanupStatus: "NONE",
    notifications: [{ id: 9, email: "a@example.com" }],
  });

  it("cuenta desde la primera foto: a 7 días y medio del cierre sale el de la última semana, con la fecha", async () => {
    const album = conPrimeraFoto(22.5); // se oculta a los 30 días de la primera foto
    albumes({ recordatorios: [album] });
    const r = await runSendAlbumNotifications();
    expect(r.notifiedAt1Week).toBe(1);
    expect(r.notifiedAt2Weeks + r.notifiedAt3Weeks).toBe(0);
    const cierre = new Date((album.firstPhotoDate as Date).getTime() + 30 * DIA);
    const mail = queueEmail.mock.calls[0][0] as { subject: string; body: string };
    expect(mail.subject).toMatch(/Última semana/);
    expect(mail.body).toContain(`el ${fechaCorta(cierre)}`);
    expect(notificationUpdate).toHaveBeenCalledWith({ where: { id: 9 }, data: { notifiedAt1Week: true } });
  });

  it("álbum con fotos desde ayer: ningún recordatorio, aunque se haya creado hace dos meses (álbum 1075)", async () => {
    albumes({ recordatorios: [conPrimeraFoto(1)] });
    const r = await runSendAlbumNotifications();
    expect(queueEmail).not.toHaveBeenCalled();
    expect(r.total).toBe(0);
  });

  it("la extensión corre el cierre", async () => {
    // Primera foto hace 32,5 días + 10 de extensión: se oculta en 7,5 días.
    albumes({ recordatorios: [{ ...conPrimeraFoto(32.5), expirationExtensionDays: 10 }] });
    const r = await runSendAlbumNotifications();
    expect(r.notifiedAt1Week).toBe(1);
  });

  it("no manda uno más lejano si ya salió uno más cercano", async () => {
    albumes({ recordatorios: [] });
    await runSendAlbumNotifications();
    const where3w = albumFindMany.mock.calls
      .map((c) => (c[0] as { where: { notifications?: { some: Record<string, boolean> } } }).where)
      .find((w) => w.notifications?.some && "notifiedAt3Weeks" in w.notifications.some);
    expect(where3w?.notifications?.some).toEqual({ notifiedAt3Weeks: false, notifiedAt2Weeks: false, notifiedAt1Week: false });
  });
});

describe("fechaCorta", () => {
  it("dos dígitos y hora argentina", () => {
    expect(fechaCorta(new Date("2026-11-02T02:00:00Z"))).toBe("01/11");
    expect(fechaCorta(new Date("2026-11-22T15:00:00Z"))).toBe("22/11");
  });
});
