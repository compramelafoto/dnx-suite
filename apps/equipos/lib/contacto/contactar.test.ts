import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  listingFindFirst: vi.fn(),
  contactFindUnique: vi.fn(),
  contactCount: vi.fn(),
  contactCreate: vi.fn(),
  contactFindMany: vi.fn(),
  userFindUnique: vi.fn(),
  identityFindUnique: vi.fn(),
  identityFindMany: vi.fn(),
  phoneFindUnique: vi.fn(),
  viewAggregate: vi.fn(),
  email: vi.fn(),
  activeReport: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    gearListing: { findFirst: m.listingFindFirst },
    gearListingContact: {
      findUnique: m.contactFindUnique,
      count: m.contactCount,
      create: m.contactCreate,
      findMany: m.contactFindMany,
    },
    user: { findUnique: m.userFindUnique },
    identityVerification: {
      findUnique: m.identityFindUnique,
      findMany: m.identityFindMany,
    },
    phoneVerification: { findUnique: m.phoneFindUnique },
    gearListingView: { aggregate: m.viewAggregate },
  },
}));
vi.mock("@/lib/publicaciones/denuncia-activa", () => ({
  findActiveReportForSerial: m.activeReport,
}));
vi.mock("@/lib/correo", () => ({ sendPortalEmail: m.email }));
vi.mock("@/lib/sesion", () => ({ urlBaseDeLaApp: () => "https://e.test" }));

import {
  contactedBefore,
  contactSeller,
  isSellerOf,
  listInterested,
} from "./contactar";

const buyer = { id: 2, displayName: "Ana Compradora" };
const listing = (over: Record<string, unknown> = {}) => ({
  id: 5,
  sellerId: 1,
  status: "PUBLISHED",
  make: "Canon",
  model: "R5",
  gearItem: { serialNormalized: "ABC123" },
  seller: { identityVerification: { status: "APPROVED" } },
  ...over,
});

beforeEach(() => {
  vi.resetAllMocks();
  m.listingFindFirst.mockResolvedValue(listing());
  m.contactFindUnique.mockResolvedValue(null);
  m.contactCount.mockResolvedValue(0);
  m.contactCreate.mockResolvedValue({ id: 1 });
  m.userFindUnique.mockResolvedValue({ email: "vendedor@e.test" });
  m.identityFindUnique.mockResolvedValue({ legalName: "Víctor Vendedor" });
  m.phoneFindUnique.mockResolvedValue({
    phone: "+5493410000000",
    verifiedAt: new Date(),
  });
  m.email.mockResolvedValue({ success: true });
  m.activeReport.mockResolvedValue(null);
});

describe("contactSeller", () => {
  it("rechaza contactar la publicación propia", async () => {
    await expect(
      contactSeller({ id: 1, displayName: "X" }, 5),
    ).rejects.toMatchObject({
      code: "PROPIA",
    });
    expect(m.contactCreate).not.toHaveBeenCalled();
  });

  it.each(["PAUSED", "IN_REVIEW"])("rechaza si está %s", async (status) => {
    m.listingFindFirst.mockResolvedValue(listing({ status }));
    await expect(contactSeller(buyer, 5)).rejects.toMatchObject({
      code: "NO_DISPONIBLE",
    });
  });

  it("denuncia activa sobre la serie: NO_DISPONIBLE, sin contacto ni correo", async () => {
    m.activeReport.mockResolvedValue({ id: 77 });
    await expect(contactSeller(buyer, 5)).rejects.toMatchObject({
      code: "NO_DISPONIBLE",
    });
    expect(m.activeReport).toHaveBeenCalledWith("ABC123", 1);
    expect(m.contactCreate).not.toHaveBeenCalled();
    expect(m.email).not.toHaveBeenCalled();
  });

  it.each([null, "PENDING", "REJECTED"])(
    "vendedor sin identidad aprobada (%s): NO_DISPONIBLE",
    async (status) => {
      m.listingFindFirst.mockResolvedValue(
        listing({
          seller: { identityVerification: status ? { status } : null },
        }),
      );
      await expect(contactSeller(buyer, 5)).rejects.toMatchObject({
        code: "NO_DISPONIBLE",
      });
      expect(m.contactCreate).not.toHaveBeenCalled();
      expect(m.email).not.toHaveBeenCalled();
    },
  );

  it("contacto repetido con denuncia nueva: NO_DISPONIBLE y no devuelve datos", async () => {
    m.contactFindUnique.mockResolvedValue({ id: 9 });
    m.activeReport.mockResolvedValue({ id: 78 });
    await expect(contactSeller(buyer, 5)).rejects.toMatchObject({
      code: "NO_DISPONIBLE",
    });
    expect(m.userFindUnique).not.toHaveBeenCalled();
  });

  it("el nombre del vendedor sale sólo de una verificación APROBADA", async () => {
    await contactSeller(buyer, 5);
    expect(m.identityFindUnique.mock.calls[0][0].where).toEqual({
      userId: 1,
      status: "APPROVED",
    });
    m.identityFindUnique.mockResolvedValue(null); // sin aprobada
    expect((await contactSeller(buyer, 5)).sellerName).toBe(
      "Vendedor verificado",
    );
  });

  it("primer contacto: crea, avisa al vendedor y devuelve sus datos", async () => {
    const r = await contactSeller(buyer, 5);
    expect(r).toEqual({
      sellerName: "Víctor Vendedor",
      sellerEmail: "vendedor@e.test",
      sellerPhone: "+5493410000000",
      firstTime: true,
    });
    expect(m.contactCreate).toHaveBeenCalledOnce();
    expect(m.email).toHaveBeenCalledOnce();
    const [to, template, data] = m.email.mock.calls[0]!;
    expect(to).toBe("vendedor@e.test");
    expect(template).toBe("nueva_consulta");
    expect(data).toMatchObject({
      comprador: "Ana Compradora",
      equipo: "Canon R5",
      url: "https://e.test/mis-publicaciones/5",
    });
    expect(JSON.stringify(data)).not.toContain("@");
  });

  it("segundo contacto: firstTime false y sin correo", async () => {
    m.contactFindUnique.mockResolvedValue({ id: 9 });
    const r = await contactSeller(buyer, 5);
    expect(r.firstTime).toBe(false);
    expect(m.email).not.toHaveBeenCalled();
    expect(m.contactCreate).not.toHaveBeenCalled();
  });

  it("20 contactos en 24 h: LIMITE y no crea nada", async () => {
    m.contactCount.mockResolvedValue(20);
    await expect(contactSeller(buyer, 5)).rejects.toMatchObject({
      code: "LIMITE",
      message: "Llegaste al máximo de contactos por hoy. Probá mañana.",
    });
    expect(m.contactCreate).not.toHaveBeenCalled();
    expect(m.email).not.toHaveBeenCalled();
  });

  it("teléfono sin verificar: sellerPhone null", async () => {
    m.phoneFindUnique.mockResolvedValue({
      phone: "+5493410000000",
      verifiedAt: null,
    });
    const r = await contactSeller(buyer, 5);
    expect(r.sellerPhone).toBeNull();
  });

  it("si falla el correo igual devuelve los datos", async () => {
    m.email.mockRejectedValue(new Error("boom"));
    const r = await contactSeller(buyer, 5);
    expect(r.firstTime).toBe(true);
  });

  it("publicación inexistente: NO_DISPONIBLE", async () => {
    m.listingFindFirst.mockResolvedValue(null);
    await expect(contactSeller(buyer, 5)).rejects.toMatchObject({
      code: "NO_DISPONIBLE",
    });
  });
});

describe("contactSeller: carrera", () => {
  it("P2002 al crear: firstTime false y sin correo", async () => {
    m.contactCreate.mockRejectedValue({ code: "P2002" });
    const r = await contactSeller(buyer, 5);
    expect(r.firstTime).toBe(false);
    expect(m.email).not.toHaveBeenCalled();
  });
});

describe("isSellerOf", () => {
  it("true si la publicación es suya", async () => {
    m.listingFindFirst.mockResolvedValue({ id: 5 });
    expect(await isSellerOf(1, 5)).toBe(true);
    expect(m.listingFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 5, sellerId: 1 } }),
    );
  });
  it("false si no", async () => {
    m.listingFindFirst.mockResolvedValue(null);
    expect(await isSellerOf(2, 5)).toBe(false);
  });
});

describe("contactedBefore", () => {
  it("true si existe el contacto", async () => {
    m.contactFindUnique.mockResolvedValue({ id: 1 });
    expect(await contactedBefore(2, 5)).toBe(true);
  });
  it("false si no existe", async () => {
    expect(await contactedBefore(2, 5)).toBe(false);
  });
});

describe("listInterested", () => {
  it("publicación ajena: NO_ENCONTRADO", async () => {
    m.listingFindFirst.mockResolvedValue(null);
    await expect(listInterested(1, 5)).rejects.toMatchObject({
      code: "NO_ENCONTRADO",
    });
  });

  it("devuelve visitas, personas y consultas con nombre legal", async () => {
    const at = new Date("2026-11-01T12:00:00Z");
    m.viewAggregate.mockResolvedValue({
      _sum: { count: 7 },
      _count: { _all: 3 },
    });
    m.contactFindMany.mockResolvedValue([
      { buyerId: 2, createdAt: at, buyer: { name: "Ana cuenta" } },
      { buyerId: 3, createdAt: at, buyer: { name: "Beto cuenta" } },
    ]);
    m.identityFindMany.mockResolvedValue([
      { userId: 2, legalName: "Ana Legal" },
    ]);
    const r = await listInterested(1, 5);
    expect(r.views).toBe(7);
    expect(r.viewers).toBe(3);
    expect(r.contacts).toEqual([
      { name: "Ana Legal", at },
      { name: "Beto cuenta", at },
    ]);
  });
});
