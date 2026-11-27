import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  listingFindFirst: vi.fn(),
  identityFindUnique: vi.fn(),
  reportFindMany: vi.fn(),
  signed: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    gearListing: { findFirst: m.listingFindFirst },
    identityVerification: { findUnique: m.identityFindUnique },
    stolenGearReport: { findMany: m.reportFindMany },
  },
}));
vi.mock("@/lib/archivos", () => ({ getSignedFileUrl: m.signed }));

import { denunciasCitadas, getListingForAdmin } from "./admin-detalle";

const fila = (over: Record<string, unknown> = {}) => ({
  id: 5,
  status: "IN_REVIEW",
  kind: "BODY",
  make: "Canon",
  model: "R5",
  priceArs: 1850000,
  priceUsdRef: null,
  condition: "GOOD",
  description: "Poco uso",
  accessories: null,
  province: "Santa Fe",
  city: "Rafaela",
  reviewNote: "Denuncia activa #3",
  createdAt: new Date("2026-11-20T12:00:00Z"),
  publishedAt: null,
  serialPhotoKey: "equipos/serie.jpg",
  sellerId: 2,
  seller: { email: "v@e.test" },
  gearItem: { serialRaw: "ab-123", serialNormalized: "AB123", photoKeys: ["equipos/a.jpg", "equipos/serie.jpg"] },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  m.signed.mockImplementation(async (k: string) => `https://firmada/${k}`);
  m.identityFindUnique.mockResolvedValue({ legalName: " Víctor Vendedor " });
  // findActiveReportsForSerial y la carga de denuncias usan findMany: se distinguen por el where.
  m.reportFindMany.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
    "serialNormalized" in where
      ? [{ id: 8 }]
      : [
          { id: 3, incident: "THEFT", status: "ACTIVE", createdAt: new Date("2026-10-01"), reporterId: 40 },
          { id: 8, incident: "LOST", status: "ACTIVE", createdAt: new Date("2026-11-01"), reporterId: 41 },
        ],
  );
});

describe("denunciasCitadas", () => {
  it("lee los números de «Denuncia activa #N» sin repetir", () => {
    expect(denunciasCitadas("Denuncia activa #3\nReporte #2\nDenuncia activa #3\nDenuncia activa #8")).toEqual([3, 8]);
    expect(denunciasCitadas(null)).toEqual([]);
  });
});

describe("getListingForAdmin", () => {
  it("inexistente -> null", async () => {
    m.listingFindFirst.mockResolvedValue(null);
    expect(await getListingForAdmin(5)).toBeNull();
  });

  it("trae la publicación en cualquier estado, con serie completa, foto de la serie y fotos firmadas", async () => {
    m.listingFindFirst.mockResolvedValue(fila({ status: "CLOSED" }));
    const d = await getListingForAdmin(5);
    expect(m.listingFindFirst.mock.calls[0][0].where).toEqual({ id: 5 });
    expect(d?.status).toBe("CLOSED");
    expect(d?.serialRaw).toBe("ab-123");
    expect(d?.serialNormalized).toBe("AB123");
    expect(d?.fotoSerie).toBe("https://firmada/equipos/serie.jpg");
    expect(d?.fotos).toEqual(["https://firmada/equipos/a.jpg"]);
    expect(d?.vendedor).toEqual({ id: 2, nombreLegal: "Víctor Vendedor", email: "v@e.test" });
  });

  it("denuncias citadas y activas, sin datos del denunciante más allá de su id", async () => {
    m.listingFindFirst.mockResolvedValue(fila());
    const d = await getListingForAdmin(5);
    const carga = m.reportFindMany.mock.calls.find((c) => "id" in c[0].where)![0];
    expect(carga.where).toEqual({ id: { in: [3, 8] } });
    expect(carga.select).toEqual({ id: true, incident: true, status: true, createdAt: true, reporterId: true });
    expect(d?.denuncias.map((x) => [x.id, x.citada])).toEqual([
      [3, true],
      [8, false],
    ]);
  });

  it("si una foto no se puede firmar queda null («Sin foto») y sigue", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.signed.mockRejectedValue(new Error("sin bucket"));
    m.listingFindFirst.mockResolvedValue(fila());
    const d = await getListingForAdmin(5);
    expect(d?.fotos).toEqual([null]);
    expect(d?.fotoSerie).toBeNull();
  });

  it("sin foto de la serie: undefined", async () => {
    m.listingFindFirst.mockResolvedValue(fila({ serialPhotoKey: null }));
    const d = await getListingForAdmin(5);
    expect(d?.fotoSerie).toBeUndefined();
  });
});
