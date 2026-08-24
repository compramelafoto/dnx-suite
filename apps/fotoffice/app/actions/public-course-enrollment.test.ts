import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  brandingFindUniqueMock,
  moduleFindUniqueMock,
  courseFindFirstMock,
  enrollmentCreateMock,
  countsMock,
  getPlatformFeeBpsMock,
  redirectMock,
} = vi.hoisted(() => ({
  brandingFindUniqueMock: vi.fn(),
  moduleFindUniqueMock: vi.fn(),
  courseFindFirstMock: vi.fn(),
  enrollmentCreateMock: vi.fn(),
  countsMock: vi.fn(),
  getPlatformFeeBpsMock: vi.fn(),
  redirectMock: vi.fn(() => {
    // `redirect` corta el flujo lanzando; se replica para que el test vea lo mismo.
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@repo/db", async () => {
  const actual = await vi.importActual<typeof import("@repo/db")>("@repo/db");
  return {
    ...actual,
    prisma: {
      fotofficeWorkspaceBranding: { findUnique: brandingFindUniqueMock },
      workspaceFeatureModule: { findUnique: moduleFindUniqueMock },
      course: { findFirst: courseFindFirstMock },
      courseEnrollment: { create: enrollmentCreateMock },
    },
  };
});
vi.mock("@/lib/presential-courses/availability", () => ({
  getApprovedEnrollmentCountsByInstanceIds: countsMock,
  computeAvailableSpots: (capacity: number, approved: number) => capacity - approved,
}));
vi.mock("@/lib/presential-courses/log", () => ({ logCourseEvent: vi.fn() }));
vi.mock("@/lib/platform-fee/store", () => ({ getPlatformFeeBps: getPlatformFeeBpsMock }));

const { Prisma } = await import("@repo/db");
const { createPublicCourseEnrollmentAction } = await import("./public-course-enrollment");

function formOf(): FormData {
  const fd = new FormData();
  fd.set("name", "Ana Fotógrafa");
  fd.set("email", "ana@test.com");
  fd.set("whatsapp", "3410000000");
  fd.set("dni", "30111222");
  fd.set("courseInstanceId", "inst-1");
  return fd;
}

/** Corre la acción hasta el `redirect` final y devuelve los datos con que se creó la inscripción. */
async function createEnrollment(priceArs: string) {
  courseFindFirstMock.mockResolvedValue({
    id: "course-1",
    instances: [
      { id: "inst-1", status: "ACTIVE", capacity: 30, priceArs: new Prisma.Decimal(priceArs) },
    ],
  });
  try {
    await createPublicCourseEnrollmentAction("sfpr", "curso-retrato", undefined, formOf());
  } catch (e) {
    if ((e as Error).message !== "NEXT_REDIRECT") throw e;
  }
  return enrollmentCreateMock.mock.calls[0]?.[0]?.data;
}

beforeEach(() => {
  brandingFindUniqueMock.mockReset().mockResolvedValue({ workspaceId: "ws-sfpr" });
  moduleFindUniqueMock.mockReset().mockResolvedValue({ enabled: true });
  courseFindFirstMock.mockReset();
  enrollmentCreateMock.mockReset().mockResolvedValue({ id: "enr-1" });
  countsMock.mockReset().mockResolvedValue(new Map());
  getPlatformFeeBpsMock.mockReset().mockResolvedValue(500);
  redirectMock.mockClear();
});

describe("comisión de la inscripción", () => {
  it("usa la comisión del módulo de cursos, no coursesFeePercent", async () => {
    getPlatformFeeBpsMock.mockResolvedValue(700);
    const data = await createEnrollment("10000");

    expect(data.platformFeeArs.toFixed(2)).toBe("700.00");
    expect(data.netAmountArs.toFixed(2)).toBe("9300.00");
    expect(data.platformFeePercent.toFixed(2)).toBe("7.00");
    expect(getPlatformFeeBpsMock).toHaveBeenCalledWith("ws-sfpr", "courses-sales");
  });

  it("sin configuración cobra el 5% por defecto", async () => {
    getPlatformFeeBpsMock.mockResolvedValue(500);
    const data = await createEnrollment("10000");

    expect(data.platformFeeArs.toFixed(2)).toBe("500.00");
    expect(data.netAmountArs.toFixed(2)).toBe("9500.00");
  });

  it("con comisión cero el neto es el precio completo", async () => {
    getPlatformFeeBpsMock.mockResolvedValue(0);
    const data = await createEnrollment("10000");

    expect(data.platformFeeArs.toFixed(2)).toBe("0.00");
    expect(data.netAmountArs.toFixed(2)).toBe("10000.00");
  });

  it("fee + neto siempre da el precio", async () => {
    getPlatformFeeBpsMock.mockResolvedValue(333);
    const data = await createEnrollment("12345.67");

    expect(data.platformFeeArs.plus(data.netAmountArs).toFixed(2)).toBe("12345.67");
  });

  it("ya no consulta coursesFeePercent", async () => {
    // Si la acción volviera a leer CourseSalesWorkspaceSettings, el mock de prisma no
    // tiene ese modelo y la llamada explotaría antes de crear la inscripción.
    const data = await createEnrollment("10000");
    expect(data).toBeDefined();
  });
});
