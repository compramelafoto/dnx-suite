import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * El flujo de cursos de punta a punta, con el transporte REAL.
 *
 * A diferencia de `enrollment-email-audit.test.ts`, acá NO se sustituye
 * `sendTransactionalEmail`: corren la resolución de configuración, el armado del request y
 * la depuración de errores de verdad. Lo único reemplazado es `fetch`, con un doble local
 * que devuelve respuestas fabricadas —no hay red ni llamadas a Resend.
 *
 * Responde tres preguntas sobre el refactor: si el envío bueno sigue siendo bueno, si la
 * falta de configuración puede disfrazarse de éxito, y si un rechazo del proveedor puede
 * filtrar su cuerpo crudo hasta los logs del workflow.
 */

const {
  enrollmentFindUniqueMock,
  enrollmentUpdateManyMock,
  settingsFindUniqueMock,
  leadFindFirstMock,
  leadUpdateMock,
  logCourseEventMock,
  loadSignatureMock,
  approvedCountsMock,
} = vi.hoisted(() => ({
  enrollmentFindUniqueMock: vi.fn(),
  enrollmentUpdateManyMock: vi.fn(),
  settingsFindUniqueMock: vi.fn(),
  leadFindFirstMock: vi.fn(),
  leadUpdateMock: vi.fn(),
  logCourseEventMock: vi.fn(),
  loadSignatureMock: vi.fn(),
  approvedCountsMock: vi.fn(),
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
    courseEnrollment: {
      findUnique: enrollmentFindUniqueMock,
      updateMany: enrollmentUpdateManyMock,
    },
    courseSalesWorkspaceSettings: { findUnique: settingsFindUniqueMock },
    serviceSalesLead: {
      findFirst: leadFindFirstMock,
      update: leadUpdateMock,
      create: vi.fn(),
    },
  },
}));

vi.mock("./log", () => ({ logCourseEvent: logCourseEventMock }));
vi.mock("./availability", () => ({
  computeAvailableSpots: () => 5,
  getApprovedEnrollmentCountsByInstanceIds: approvedCountsMock,
}));
vi.mock("@/lib/communications/load-workspace-signature", () => ({
  loadWorkspaceSignature: loadSignatureMock,
}));

const { Prisma } = await import("@repo/db");
const { approveCourseEnrollment } = await import("./enrollment-workflow");

const API_KEY = "re_clave_de_prueba_0123456789";
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

const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

/** Doble de `fetch`: nunca sale de este proceso. */
function stubFetch(response: Response) {
  const impl = vi.fn(async () => response);
  vi.stubGlobal("fetch", impl);
  return impl;
}

beforeEach(() => {
  enrollmentFindUniqueMock.mockReset().mockResolvedValue(enrollment());
  enrollmentUpdateManyMock.mockReset().mockResolvedValue({ count: 1 });
  settingsFindUniqueMock.mockReset().mockResolvedValue({ coursesFeePercent: new Prisma.Decimal(10) });
  leadFindFirstMock.mockReset().mockResolvedValue({ id: "lead-1" });
  leadUpdateMock.mockReset().mockResolvedValue({ id: "lead-1" });
  approvedCountsMock.mockReset().mockResolvedValue(new Map());
  loadSignatureMock.mockReset().mockResolvedValue(SIGNATURE);
  logCourseEventMock.mockReset();
  warnSpy.mockClear();
  errorSpy.mockClear();
  vi.stubEnv("RESEND_API_KEY", API_KEY);
  vi.stubEnv("FOTOFFICE_NOTIFICATIONS_FROM", "FotoOffice <no-reply@mail.fotoffice.com>");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("configuración correcta y proveedor que acepta", () => {
  it("el envío sigue siendo exitoso y no deja advertencias", async () => {
    const fetchStub = stubFetch(
      new Response(JSON.stringify({ id: "email_1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await approveCourseEnrollment({ enrollmentId: "enr-1" });

    expect(result).toEqual({ ok: true, alreadyApproved: false });
    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("arma el request con el remitente configurado y un solo destinatario", async () => {
    const fetchStub = stubFetch(
      new Response(JSON.stringify({ id: "email_1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await approveCourseEnrollment({ enrollmentId: "enr-1" });

    const [url, init] = fetchStub.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    const body = JSON.parse(String(init.body));
    expect(body.from).toBe("FotoOffice <no-reply@mail.fotoffice.com>");
    expect(body.to).toEqual(["socio@example.com"]);
    expect(body.subject).toBe("Inscripción confirmada: Iluminación I");
    expect((body.html.match(/id="fo-signature"/g) ?? []).length).toBe(1);
    expect(body.text.split("marca-de-firma").length - 1).toBe(1);
  });
});

describe("configuración faltante", () => {
  it.each(["RESEND_API_KEY", "FOTOFFICE_NOTIFICATIONS_FROM"])(
    "sin %s no se presenta como envío exitoso y no se contacta al proveedor",
    async (missing) => {
      vi.stubEnv(missing, "");
      const fetchStub = stubFetch(new Response("{}", { status: 200 }));

      await approveCourseEnrollment({ enrollmentId: "enr-1" });

      expect(fetchStub).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const [, payload] = warnSpy.mock.calls[0] as [string, Record<string, unknown>];
      expect(String(payload.reason)).toContain(missing);
    },
  );

  /**
   * El remitente que faltaba antes se rellenaba con `no-reply@fotoffice.app`, un dominio no
   * verificado: el envío se rechazaba y nadie se enteraba. Ahora ni siquiera se intenta.
   */
  it("sin remitente no se inventa uno", async () => {
    vi.stubEnv("FOTOFFICE_NOTIFICATIONS_FROM", "");
    const fetchStub = stubFetch(new Response("{}", { status: 200 }));

    await approveCourseEnrollment({ enrollmentId: "enr-1" });

    expect(fetchStub).not.toHaveBeenCalled();
    const [, payload] = warnSpy.mock.calls[0] as [string, Record<string, unknown>];
    expect(String(payload.reason)).not.toContain("fotoffice.app");
  });
});

describe("rechazo del proveedor", () => {
  it("no filtra el cuerpo crudo hasta el log del workflow", async () => {
    const rawBody =
      "<html><body>Gateway Error — upstream 10.1.2.3 — trace-id 9f2c — internal-host resend-edge-07</body></html>";
    stubFetch(new Response(rawBody, { status: 502 }));

    await approveCourseEnrollment({ enrollmentId: "enr-1" });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [, payload] = warnSpy.mock.calls[0] as [string, Record<string, unknown>];
    const reason = String(payload.reason);
    expect(reason).toContain("502");
    expect(reason).not.toContain("10.1.2.3");
    expect(reason).not.toContain("resend-edge-07");
    expect(reason).not.toContain("<html>");
  });

  it("conserva solo los campos de error documentados cuando responde JSON", async () => {
    stubFetch(
      new Response(JSON.stringify({ name: "validation_error", message: "Invalid `from` field" }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await approveCourseEnrollment({ enrollmentId: "enr-1" });

    const [, payload] = warnSpy.mock.calls[0] as [string, Record<string, unknown>];
    expect(String(payload.reason)).toBe("HTTP 422 · validation_error · Invalid `from` field");
  });

  it("nunca deja la clave en el log, ni si el proveedor la devuelve", async () => {
    stubFetch(
      new Response(JSON.stringify({ name: "unauthorized", message: `key ${API_KEY} invalid` }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await approveCourseEnrollment({ enrollmentId: "enr-1" });

    const [, payload] = warnSpy.mock.calls[0] as [string, Record<string, unknown>];
    expect(String(payload.reason)).not.toContain(API_KEY);
    expect(String(payload.reason)).toContain("[redactado]");
  });

  it("un rechazo no revierte la aprobación ni reintenta", async () => {
    const fetchStub = stubFetch(new Response("{}", { status: 500 }));

    const result = await approveCourseEnrollment({ enrollmentId: "enr-1" });

    expect(result).toEqual({ ok: true, alreadyApproved: false });
    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(enrollmentUpdateManyMock).toHaveBeenCalledTimes(1);
  });
});
