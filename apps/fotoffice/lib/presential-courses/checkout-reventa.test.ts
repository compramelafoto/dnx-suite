import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueMock, brandingMock, transactionMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  brandingMock: vi.fn(),
  transactionMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", async () => {
  const actual = await vi.importActual<typeof import("@repo/db")>("@repo/db");
  return {
    ...actual,
    prisma: {
      courseEnrollment: { findUnique: findUniqueMock, update: vi.fn() },
      fotofficeWorkspaceBranding: { findUnique: brandingMock },
      courseSaleShare: { deleteMany: vi.fn(), createMany: vi.fn() },
      $transaction: transactionMock,
    },
  };
});
vi.mock("@/lib/payments/connect/collector", () => ({
  resolveWorkspaceCollector: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("@/lib/platform-fee/store", () => ({ getPlatformFeeBps: vi.fn().mockResolvedValue(500) }));
vi.mock("@/lib/course-marketplace/cargar", () => ({
  cargarBeneficiarios: vi.fn().mockResolvedValue([]),
  cargarDueno: vi.fn().mockResolvedValue({ workspaceId: "ws-otro", nombre: "Otro" }),
}));

const { Prisma } = await import("@repo/db");
const { cargarDueno } = await import("@/lib/course-marketplace/cargar");
const { createCourseEnrollmentCheckout } = await import("./checkout");

beforeEach(() => {
  brandingMock.mockReset().mockResolvedValue({ workspaceId: "ws-sfpr" });
  findUniqueMock.mockReset().mockResolvedValue({
    id: "enr-1",
    workspaceId: "ws-sfpr",
    courseId: "course-ajeno",
    paymentStatus: "PENDING",
    resaleAgreementId: "ac-1",
    listPriceArs: new Prisma.Decimal("10000"),
    course: { id: "course-ajeno", slug: "curso", status: "PUBLISHED", workspaceId: "ws-otro" },
    courseInstance: null,
    resaleAgreement: { shareBps: 2500, status: "ACTIVO" },
  });
  transactionMock.mockReset().mockRejectedValue(new Error("corte-del-test"));
});

describe("checkout de un curso revendido", () => {
  it("no cobra con Checkout Pro una inscripción con reventa", async () => {
    const r = await createCourseEnrollmentCheckout({ enrollmentId: "enr-1", workspaceSlug: "sfpr", courseSlug: "curso" });
    expect(r).toEqual({ ok: false, error: "Este curso todavía no está a la venta." });
  });

  it("un curso regalado (acuerdo al 100%) lo cobra entero quien lo vende", async () => {
    findUniqueMock.mockResolvedValueOnce({ ...(await findUniqueMock.getMockImplementation()?.()), resaleAgreement: { shareBps: 10000, status: "ACTIVO" } });
    await expect(createCourseEnrollmentCheckout({ enrollmentId: "enr-1", workspaceSlug: "sfpr", courseSlug: "curso" })).rejects.toThrow("corte-del-test");
    expect(cargarDueno).toHaveBeenLastCalledWith("ws-sfpr");
  });

  it("un acuerdo al 100% pausado ya no vende", async () => {
    findUniqueMock.mockResolvedValueOnce({ ...(await findUniqueMock.getMockImplementation()?.()), resaleAgreement: { shareBps: 10000, status: "PAUSADO" } });
    const r = await createCourseEnrollmentCheckout({ enrollmentId: "enr-1", workspaceSlug: "sfpr", courseSlug: "curso" });
    expect(r).toEqual({ ok: false, error: "Este curso todavía no está a la venta." });
  });
});
