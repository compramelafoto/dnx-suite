import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  identityCount: vi.fn(),
  phoneCount: vi.fn(),
  listingGroupBy: vi.fn(),
  saleCount: vi.fn(),
  contactCount: vi.fn(),
  favCount: vi.fn(),
  alertCount: vi.fn(),
  requestCount: vi.fn(),
  blockCount: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    identityVerification: { count: m.identityCount },
    phoneVerification: { count: m.phoneCount },
    gearListing: { groupBy: m.listingGroupBy },
    gearSale: { count: m.saleCount },
    gearListingContact: { count: m.contactCount },
    gearListingFavorite: { count: m.favCount },
    gearSearchAlert: { count: m.alertCount },
    purchaseRequest: { count: m.requestCount },
    portalAccountBlock: { count: m.blockCount },
  },
}));

import { portalStats } from "./estadisticas";

const AHORA = new Date("2026-11-27T12:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  m.identityCount.mockResolvedValue(40);
  m.phoneCount.mockResolvedValue(55);
  m.listingGroupBy.mockResolvedValue([
    { status: "PUBLISHED", _count: { _all: 12 } },
    { status: "IN_REVIEW", _count: { _all: 2 } },
    { status: "SOLD", _count: { _all: 4 } },
  ]);
  m.saleCount.mockResolvedValue(3);
  m.contactCount.mockResolvedValue(18);
  m.favCount.mockResolvedValue(25);
  m.alertCount.mockResolvedValue(6);
  m.requestCount.mockResolvedValue(5);
  m.blockCount.mockResolvedValue(1);
});

describe("portalStats", () => {
  it("cuenta todo lo del tablero, con 0 para los estados sin publicaciones", async () => {
    expect(await portalStats(AHORA)).toEqual({
      identidadesAprobadas: 40,
      telefonosVerificados: 55,
      publicadas: 12,
      enRevision: 2,
      pausadas: 0,
      vendidas: 4,
      ventasConfirmadas: 3,
      contactos30d: 18,
      favoritos: 25,
      alertasActivas: 6,
      pedidosActivos: 5,
      cuentasBloqueadas: 1,
    });
  });

  it("usa los criterios de cada conteo", async () => {
    await portalStats(AHORA);
    expect(m.identityCount.mock.calls[0][0].where).toEqual({ status: "APPROVED" });
    expect(m.phoneCount.mock.calls[0][0].where).toEqual({ verifiedAt: { not: null } });
    expect(m.saleCount.mock.calls[0][0].where).toEqual({ status: "CONFIRMED" });
    expect(m.contactCount.mock.calls[0][0].where).toEqual({
      createdAt: { gte: new Date("2026-10-28T12:00:00Z") },
    });
    expect(m.alertCount.mock.calls[0][0].where).toEqual({ active: true });
    expect(m.requestCount.mock.calls[0][0].where).toEqual({ status: "ACTIVE", expiresAt: { gt: AHORA } });
    expect(m.blockCount.mock.calls[0][0].where).toEqual({ liftedAt: null });
  });
});
