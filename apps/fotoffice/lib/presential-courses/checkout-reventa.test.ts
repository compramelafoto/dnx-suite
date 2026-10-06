import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueMock, brandingMock } = vi.hoisted(() => ({ findUniqueMock: vi.fn(), brandingMock: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", async () => {
  const actual = await vi.importActual<typeof import("@repo/db")>("@repo/db");
  return {
    ...actual,
    prisma: {
      courseEnrollment: { findUnique: findUniqueMock },
      fotofficeWorkspaceBranding: { findUnique: brandingMock },
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
  });
});

describe("checkout de un curso revendido", () => {
  it("no cobra con Checkout Pro una inscripción con reventa", async () => {
    const r = await createCourseEnrollmentCheckout({ enrollmentId: "enr-1", workspaceSlug: "sfpr", courseSlug: "curso" });
    expect(r).toEqual({ ok: false, error: "Este curso todavía no está a la venta." });
  });
});
