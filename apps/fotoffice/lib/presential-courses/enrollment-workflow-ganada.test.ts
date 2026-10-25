import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Inscripción aprobada de alguien que ya había consultado: la consulta queda ganada y su
 * contacto pasa a "Cliente" aunque no tuviera recorrido abierto (el motor no lo cerró).
 *
 * Corre el workflow REAL; se sustituyen la base, el motor y el perfil del contacto.
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
const G = vi.hoisted(() => ({ ganar: vi.fn(), marcar: vi.fn() }));

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
vi.mock("@/lib/circuitos/eventos", () => ({ ganarConsultaPorSistema: G.ganar }));
vi.mock("@/lib/contactos/perfil", () => ({ marcarClienteDeConsultaGanada: G.marcar }));
vi.mock("@/lib/service-leads/numero", () => ({ numerarConsultaNueva: vi.fn(async () => null) }));

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

beforeEach(() => {
  enrollmentFindUniqueMock.mockReset().mockResolvedValue(inscripcion(true));
  enrollmentUpdateManyMock.mockReset().mockResolvedValue({ count: 1 });
  leadFindFirstMock.mockReset().mockResolvedValue({ id: "lead-1" });
  leadUpdateMock.mockReset().mockResolvedValue({ id: "lead-1" });
  leadCreateMock.mockReset().mockResolvedValue({ id: "lead-2" });
  avisarMock.mockReset().mockResolvedValue({ avisado: true });
  sendApprovedMock.mockReset().mockResolvedValue({ sent: true });
  G.ganar.mockReset();
  G.marcar.mockReset().mockResolvedValue(true);
});

describe("consulta existente ganada por una inscripción", () => {
  it("sin recorrido abierto (el motor no cerró nada), marca al contacto como Cliente", async () => {
    G.ganar.mockResolvedValue({ cerrado: false });
    expect(await approveCourseEnrollment({ enrollmentId: "enr-1" })).toEqual({ ok: true, alreadyApproved: false });
    expect(leadUpdateMock.mock.calls[0]?.[0]).toMatchObject({ where: { id: "lead-1" }, data: { status: "WON" } });
    expect(G.marcar).toHaveBeenCalledWith("ws-1", "lead-1");
    expect(G.marcar.mock.invocationCallOrder[0]).toBeGreaterThan(G.ganar.mock.invocationCallOrder[0]!);
  });

  it("con recorrido cerrado por el motor, no lo repite (el cierre ya lo marcó)", async () => {
    G.ganar.mockResolvedValue({ cerrado: true });
    await approveCourseEnrollment({ enrollmentId: "enr-1" });
    expect(G.marcar).not.toHaveBeenCalled();
  });

  it("una consulta nueva (sin contacto previo) no llama a ninguno de los dos", async () => {
    leadFindFirstMock.mockResolvedValue(null);
    await approveCourseEnrollment({ enrollmentId: "enr-1" });
    expect(G.ganar).not.toHaveBeenCalled();
    expect(G.marcar).not.toHaveBeenCalled();
  });
});
