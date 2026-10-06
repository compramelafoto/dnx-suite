import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Un pago aprobado no puede quedar sin acceso al aula porque el CRM falló.
 *
 * Corre el workflow REAL; se sustituyen la base, el aviso del aula y el correo presencial.
 */

const {
  enrollmentFindUniqueMock,
  enrollmentUpdateManyMock,
  leadFindFirstMock,
  leadUpdateMock,
  leadCreateMock,
  avisarMock,
  sendApprovedMock,
} = vi.hoisted(() => ({
  enrollmentFindUniqueMock: vi.fn(),
  enrollmentUpdateManyMock: vi.fn(),
  leadFindFirstMock: vi.fn(),
  leadUpdateMock: vi.fn(),
  leadCreateMock: vi.fn(),
  avisarMock: vi.fn(),
  sendApprovedMock: vi.fn(),
}));

/** Ver la nota sobre el doble de Decimal en `enrollment-email-audit.test.ts`. */
class DecimalDouble {
  private readonly value: number;
  static readonly ROUND_HALF_UP = 4;
  constructor(input: string | number | DecimalDouble) {
    this.value = input instanceof DecimalDouble ? input.value : Number(input);
  }
  mul(o: string | number | DecimalDouble) {
    return new DecimalDouble(this.value * new DecimalDouble(o).value);
  }
  div(o: string | number | DecimalDouble) {
    return new DecimalDouble(this.value / new DecimalDouble(o).value);
  }
  minus(o: string | number | DecimalDouble) {
    return new DecimalDouble(this.value - new DecimalDouble(o).value);
  }
  toDecimalPlaces(places: number) {
    return new DecimalDouble(Number(this.value.toFixed(places)));
  }
  toString() {
    return String(this.value);
  }
}

vi.mock("@repo/db", () => ({
  Prisma: { Decimal: DecimalDouble },
  prisma: {
    courseEnrollment: { findUnique: enrollmentFindUniqueMock, updateMany: enrollmentUpdateManyMock },
    serviceSalesLead: { findFirst: leadFindFirstMock, update: leadUpdateMock, create: leadCreateMock },
  },
}));
vi.mock("./log", () => ({ logCourseEvent: vi.fn() }));
vi.mock("./availability", () => ({
  computeAvailableSpots: () => 5,
  getApprovedEnrollmentCountsByInstanceIds: vi.fn().mockResolvedValue(new Map()),
}));
vi.mock("@/lib/communications/load-workspace-signature", () => ({
  loadWorkspaceSignature: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/course-classroom/grant", () => ({ avisarAccesoAlAula: avisarMock }));
vi.mock("./email", () => ({ sendEnrollmentApprovedEmail: sendApprovedMock }));

const { Prisma } = await import("@repo/db");
const { approveCourseEnrollment } = await import("./enrollment-workflow");

function inscripcion(conEdicion: boolean) {
  return {
    id: "enr-1",
    paymentStatus: "PENDING",
    workspaceId: "ws-1",
    courseId: "course-1",
    courseInstanceId: conEdicion ? "inst-1" : null,
    email: "ana@example.com",
    name: "Ana",
    whatsapp: "+5493410000000",
    amountArs: new Prisma.Decimal("10000.00"),
    platformFeePercent: new Prisma.Decimal("5.00"),
    paymentRef: null,
    workspace: { id: "ws-1" },
    course: { title: "Retrato", slug: "retrato", classroomLink: null, classroomCode: null, classroomInstructions: null },
    courseInstance: conEdicion
      ? {
          id: "inst-1",
          title: "Marzo",
          capacity: 20,
          startDateTime: new Date("2026-03-01T14:00:00Z"),
          endDateTime: new Date("2026-03-01T18:00:00Z"),
          locationName: "Sede",
          locationAddress: "Calle 123",
        }
      : null,
  };
}

const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

beforeEach(() => {
  enrollmentFindUniqueMock.mockReset().mockResolvedValue(inscripcion(false));
  enrollmentUpdateManyMock.mockReset().mockResolvedValue({ count: 1 });
  leadFindFirstMock.mockReset().mockResolvedValue({ id: "lead-1" });
  leadUpdateMock.mockReset().mockResolvedValue({ id: "lead-1" });
  leadCreateMock.mockReset().mockResolvedValue({ id: "lead-2" });
  avisarMock.mockReset().mockResolvedValue({ avisado: true });
  sendApprovedMock.mockReset().mockResolvedValue({ sent: true });
  errorSpy.mockClear();
});

describe("curso grabado: el acceso va antes que el CRM", () => {
  it("avisa el acceso antes de tocar el CRM, una sola vez", async () => {
    const r = await approveCourseEnrollment({ enrollmentId: "enr-1" });
    expect(r).toEqual({ ok: true, alreadyApproved: false });
    expect(avisarMock).toHaveBeenCalledTimes(1);
    expect(avisarMock.mock.invocationCallOrder[0]).toBeLessThan(leadFindFirstMock.mock.invocationCallOrder[0]);
    expect(leadUpdateMock).toHaveBeenCalledTimes(1);
  });

  it("si el CRM lanza, el acceso ya se dio y la aprobación termina bien", async () => {
    leadFindFirstMock.mockRejectedValue(new Error("crm caído"));
    const r = await approveCourseEnrollment({ enrollmentId: "enr-1" });
    expect(r).toEqual({ ok: true, alreadyApproved: false });
    expect(avisarMock).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const payload = errorSpy.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("email");
    expect(sendApprovedMock).not.toHaveBeenCalled();
  });
});

describe("curso presencial: mismo orden, el CRM ya no corta el correo", () => {
  beforeEach(() => {
    enrollmentFindUniqueMock.mockResolvedValue(inscripcion(true));
  });

  it("no avisa acceso al aula y manda el correo de confirmación", async () => {
    await approveCourseEnrollment({ enrollmentId: "enr-1" });
    expect(avisarMock).not.toHaveBeenCalled();
    expect(sendApprovedMock).toHaveBeenCalledTimes(1);
    expect(leadUpdateMock.mock.invocationCallOrder[0]).toBeLessThan(sendApprovedMock.mock.invocationCallOrder[0]);
  });

  it("si el CRM lanza, el correo de confirmación sale igual", async () => {
    leadUpdateMock.mockRejectedValue(new Error("crm caído"));
    const r = await approveCourseEnrollment({ enrollmentId: "enr-1" });
    expect(r).toEqual({ ok: true, alreadyApproved: false });
    expect(sendApprovedMock).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});
