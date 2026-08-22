import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Auditoría del flujo de cursos después de pasar al transporte compartido.
 *
 * Acá corre el workflow REAL y el `sendEnrollmentApprovedEmail` REAL; lo único sustituido
 * es el transporte, para no tocar la red. La pregunta que responde este archivo es si el
 * cambio de transporte alteró algo de la inscripción: reglas, registros escritos o la forma
 * en que el workflow interpreta el resultado del email.
 */

const {
  enrollmentFindUniqueMock,
  enrollmentUpdateManyMock,
  settingsFindUniqueMock,
  leadFindFirstMock,
  leadUpdateMock,
  leadCreateMock,
  sendTransactionalEmailMock,
  logCourseEventMock,
  loadSignatureMock,
  approvedCountsMock,
} = vi.hoisted(() => ({
  enrollmentFindUniqueMock: vi.fn(),
  enrollmentUpdateManyMock: vi.fn(),
  settingsFindUniqueMock: vi.fn(),
  leadFindFirstMock: vi.fn(),
  leadUpdateMock: vi.fn(),
  leadCreateMock: vi.fn(),
  sendTransactionalEmailMock: vi.fn(),
  logCourseEventMock: vi.fn(),
  loadSignatureMock: vi.fn(),
  approvedCountsMock: vi.fn(),
}));

/**
 * Doble de `Prisma.Decimal`. `@prisma/client` es dependencia de `packages/db`, no de esta
 * app, así que no resuelve desde acá.
 *
 * Qué prueba: que el workflow siga aplicando la MISMA fórmula (multiplicar por el
 * porcentaje, dividir por cien, restar del total). Qué no prueba: la precisión decimal en
 * sí, que es responsabilidad de Prisma y no cambia con este refactor.
 */
class DecimalDouble {
  private readonly value: number;
  static readonly ROUND_HALF_UP = 4;

  constructor(input: string | number | DecimalDouble) {
    this.value = input instanceof DecimalDouble ? input.value : Number(input);
  }
  mul(other: string | number | DecimalDouble) {
    return new DecimalDouble(this.value * new DecimalDouble(other).value);
  }
  div(other: string | number | DecimalDouble) {
    return new DecimalDouble(this.value / new DecimalDouble(other).value);
  }
  minus(other: string | number | DecimalDouble) {
    return new DecimalDouble(this.value - new DecimalDouble(other).value);
  }
  toDecimalPlaces(places: number) {
    return new DecimalDouble(Number(this.value.toFixed(places)));
  }
  toString() {
    return String(this.value);
  }
}

vi.mock("@repo/db", () => {
  return {
    Prisma: { Decimal: DecimalDouble },
    prisma: {
      courseEnrollment: {
        findUnique: enrollmentFindUniqueMock,
        updateMany: enrollmentUpdateManyMock,
      },
      courseSalesWorkspaceSettings: { findUnique: settingsFindUniqueMock },
      serviceSalesLead: {
        findFirst: leadFindFirstMock,
        update: leadUpdateMock,
        create: leadCreateMock,
      },
    },
  };
});

vi.mock("./log", () => ({ logCourseEvent: logCourseEventMock }));

vi.mock("./availability", () => ({
  computeAvailableSpots: () => 5,
  getApprovedEnrollmentCountsByInstanceIds: approvedCountsMock,
}));

vi.mock("@/lib/communications/load-workspace-signature", () => ({
  loadWorkspaceSignature: loadSignatureMock,
}));

vi.mock("@/lib/communications/send-email", () => ({
  sendTransactionalEmail: sendTransactionalEmailMock,
}));

const { Prisma } = await import("@repo/db");
const { approveCourseEnrollment } = await import("./enrollment-workflow");

const SIGNATURE = { html: "<table>marca-de-firma</table>", text: "marca-de-firma" };

function enrollment() {
  return {
    id: "enr-1",
    paymentStatus: "PENDING",
    workspaceId: "ws-sfpr",
    courseId: "course-1",
    courseInstanceId: "inst-1",
    email: "socio@example.com",
    name: "Juan",
    whatsapp: "+5493410000000",
    amountArs: new Prisma.Decimal("10000.00"),
    paymentRef: null,
    workspace: { id: "ws-sfpr", name: "Club SFPR" },
    course: {
      title: "Iluminación I",
      slug: "iluminacion-i",
      classroomLink: null,
      classroomCode: null,
      classroomInstructions: null,
    },
    courseInstance: {
      title: "Marzo 2026",
      capacity: 20,
      startDateTime: new Date("2026-03-01T14:00:00Z"),
      endDateTime: new Date("2026-03-01T18:00:00Z"),
      locationName: "Sede SFPR",
      locationAddress: "Calle 123",
    },
  };
}

/** Todas las escrituras del flujo, para comparar escenarios. */
function writeCounts() {
  return {
    enrollmentUpdates: enrollmentUpdateManyMock.mock.calls.length,
    leadUpdates: leadUpdateMock.mock.calls.length,
    leadCreates: leadCreateMock.mock.calls.length,
  };
}

const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

beforeEach(() => {
  enrollmentFindUniqueMock.mockReset().mockResolvedValue(enrollment());
  enrollmentUpdateManyMock.mockReset().mockResolvedValue({ count: 1 });
  settingsFindUniqueMock.mockReset().mockResolvedValue({ coursesFeePercent: new Prisma.Decimal(10) });
  leadFindFirstMock.mockReset().mockResolvedValue({ id: "lead-1" });
  leadUpdateMock.mockReset().mockResolvedValue({ id: "lead-1" });
  leadCreateMock.mockReset().mockResolvedValue({ id: "lead-2" });
  approvedCountsMock.mockReset().mockResolvedValue(new Map());
  loadSignatureMock.mockReset().mockResolvedValue(SIGNATURE);
  logCourseEventMock.mockReset();
  sendTransactionalEmailMock.mockReset().mockResolvedValue({ status: "SENT", providerId: "email_1" });
  warnSpy.mockClear();
  errorSpy.mockClear();
});

describe("aprobación con envío exitoso", () => {
  it("aprueba la inscripción y manda el email", async () => {
    const result = await approveCourseEnrollment({ enrollmentId: "enr-1" });
    expect(result).toEqual({ ok: true, alreadyApproved: false });
    expect(sendTransactionalEmailMock).toHaveBeenCalledTimes(1);
  });

  it("no deja advertencias cuando el envío salió bien", async () => {
    await approveCourseEnrollment({ enrollmentId: "enr-1" });
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("la firma entra una sola vez en HTML y en texto", async () => {
    await approveCourseEnrollment({ enrollmentId: "enr-1" });
    const message = sendTransactionalEmailMock.mock.calls[0]?.[0];
    expect((message.html.match(/id="fo-signature"/g) ?? []).length).toBe(1);
    expect(message.text.split("marca-de-firma").length - 1).toBe(1);
  });

  it("conserva las reglas de comisión: 10% sobre 10000", async () => {
    await approveCourseEnrollment({ enrollmentId: "enr-1" });
    const data = enrollmentUpdateManyMock.mock.calls[0]?.[0]?.data;
    expect(data.paymentStatus).toBe("APPROVED");
    expect(data.platformFeeArs.toString()).toBe("1000");
    expect(data.netAmountArs.toString()).toBe("9000");
  });

  it("solo aprueba lo que sigue PENDING", async () => {
    await approveCourseEnrollment({ enrollmentId: "enr-1" });
    const where = enrollmentUpdateManyMock.mock.calls[0]?.[0]?.where;
    expect(where).toEqual({ id: "enr-1", paymentStatus: "PENDING" });
  });
});

describe("el workflow interpreta el fallo, no lo ignora", () => {
  it.each(["CONFIGURATION_ERROR", "PROVIDER_REJECTED", "INTERNAL_ERROR"] as const)(
    "%s deja una advertencia con el motivo",
    async (status) => {
      sendTransactionalEmailMock.mockResolvedValue({ status, detail: "motivo-depurado" });
      await approveCourseEnrollment({ enrollmentId: "enr-1" });

      expect(warnSpy).toHaveBeenCalledTimes(1);
      const [tag, payload] = warnSpy.mock.calls[0] as [string, Record<string, unknown>];
      expect(tag).toContain("enrollment_email_not_sent");
      expect(payload.reason).toBe("motivo-depurado");
      expect(payload.enrollmentId).toBe("enr-1");
    },
  );

  /**
   * El punto del refactor: antes, la falta de configuración devolvía `{sent:false}` con un
   * motivo fijo y un rechazo del proveedor lanzaba. Ahora ninguno de los dos puede pasar por
   * envío exitoso.
   */
  it.each(["CONFIGURATION_ERROR", "PROVIDER_REJECTED", "INTERNAL_ERROR"] as const)(
    "%s nunca se presenta como envío exitoso",
    async (status) => {
      sendTransactionalEmailMock.mockResolvedValue({ status, detail: "motivo-depurado" });
      await approveCourseEnrollment({ enrollmentId: "enr-1" });
      expect(warnSpy).toHaveBeenCalled();
    },
  );
});

describe("el email no altera la inscripción", () => {
  it("un fallo de envío no cambia el resultado de la aprobación", async () => {
    sendTransactionalEmailMock.mockResolvedValue({
      status: "PROVIDER_REJECTED",
      detail: "HTTP 422",
    });
    const result = await approveCourseEnrollment({ enrollmentId: "enr-1" });
    expect(result).toEqual({ ok: true, alreadyApproved: false });
  });

  it("escribe exactamente los mismos registros falle o no el email", async () => {
    await approveCourseEnrollment({ enrollmentId: "enr-1" });
    const okCounts = writeCounts();
    const okUpdate = enrollmentUpdateManyMock.mock.calls[0]?.[0];

    enrollmentUpdateManyMock.mockClear();
    leadUpdateMock.mockClear();
    leadCreateMock.mockClear();
    sendTransactionalEmailMock.mockResolvedValue({
      status: "CONFIGURATION_ERROR",
      detail: "sin configuración",
    });

    await approveCourseEnrollment({ enrollmentId: "enr-1" });
    expect(writeCounts()).toEqual(okCounts);
    expect(enrollmentUpdateManyMock.mock.calls[0]?.[0]).toEqual(okUpdate);
  });

  it("el envío no crea registros nuevos por su cuenta", async () => {
    await approveCourseEnrollment({ enrollmentId: "enr-1" });
    // El contacto CRM ya existía: se actualiza, no se crea. El email no agrega escrituras.
    expect(leadCreateMock).not.toHaveBeenCalled();
    expect(leadUpdateMock).toHaveBeenCalledTimes(1);
    expect(enrollmentUpdateManyMock).toHaveBeenCalledTimes(1);
  });

  /**
   * El email cuelga de una aprobación efectiva. Si la actualización condicional no tocó
   * ninguna fila —otro proceso la aprobó primero— no hay nada que confirmar y no debe salir
   * un segundo email al mismo inscripto.
   */
  it("si la inscripción ya estaba aprobada por otro proceso, no se manda email", async () => {
    enrollmentUpdateManyMock.mockResolvedValue({ count: 0 });
    const result = await approveCourseEnrollment({ enrollmentId: "enr-1" });
    expect(result).toEqual({ ok: true, alreadyApproved: true });
    expect(sendTransactionalEmailMock).not.toHaveBeenCalled();
  });

  it("una inscripción que ya figura APPROVED no reabre el flujo", async () => {
    enrollmentFindUniqueMock.mockResolvedValue({ ...enrollment(), paymentStatus: "APPROVED" });
    const result = await approveCourseEnrollment({ enrollmentId: "enr-1" });
    expect(result).toEqual({ ok: true, alreadyApproved: true });
    expect(enrollmentUpdateManyMock).not.toHaveBeenCalled();
    expect(sendTransactionalEmailMock).not.toHaveBeenCalled();
  });
});
