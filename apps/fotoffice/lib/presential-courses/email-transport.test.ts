import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendTransactionalEmailMock } = vi.hoisted(() => ({
  sendTransactionalEmailMock: vi.fn(),
}));

vi.mock("@/lib/communications/send-email", () => ({
  sendTransactionalEmail: sendTransactionalEmailMock,
}));

const { sendEnrollmentApprovedEmail } = await import("./email");

const INPUT = {
  to: "socio@example.com",
  studentName: "Juan",
  courseTitle: "Iluminación I",
  instanceLabel: "Marzo 2026",
  startDateTime: new Date("2026-03-01T14:00:00Z"),
  endDateTime: new Date("2026-03-01T18:00:00Z"),
  locationName: "Sede SFPR",
  locationAddress: "Calle 123",
  classroomLink: null,
  classroomCode: null,
  classroomInstructions: null,
};

beforeEach(() => {
  sendTransactionalEmailMock.mockReset();
});

describe("email de inscripción sobre el transporte compartido", () => {
  it("usa el transporte único, no un fetch propio", async () => {
    sendTransactionalEmailMock.mockResolvedValue({ status: "SENT", providerId: "email_1" });
    await sendEnrollmentApprovedEmail(INPUT);
    expect(sendTransactionalEmailMock).toHaveBeenCalledTimes(1);
  });

  it("manda destinatario, asunto, HTML y texto", async () => {
    sendTransactionalEmailMock.mockResolvedValue({ status: "SENT", providerId: "email_1" });
    await sendEnrollmentApprovedEmail(INPUT);
    const message = sendTransactionalEmailMock.mock.calls[0]?.[0];
    expect(message.to).toBe("socio@example.com");
    expect(message.subject).toBe("Inscripción confirmada: Iluminación I");
    expect(message.html).toContain("Iluminación I");
    expect(message.text).toContain("Iluminación I");
  });

  it("informa el envío exitoso", async () => {
    sendTransactionalEmailMock.mockResolvedValue({ status: "SENT", providerId: "email_1" });
    expect(await sendEnrollmentApprovedEmail(INPUT)).toEqual({ sent: true });
  });

  /**
   * Antes esto lanzaba un `Error` con el cuerpo crudo de Resend, que terminaba en un
   * `console.error` sin depurar. Ahora devuelve un resultado y el detalle ya viene limpio.
   */
  it("un rechazo del proveedor no lanza: devuelve el motivo depurado", async () => {
    sendTransactionalEmailMock.mockResolvedValue({
      status: "PROVIDER_REJECTED",
      detail: "HTTP 422 · validation_error",
    });
    const result = await sendEnrollmentApprovedEmail(INPUT);
    expect(result).toEqual({ sent: false, reason: "HTTP 422 · validation_error" });
  });

  it("la falta de configuración también se informa, no se traga", async () => {
    sendTransactionalEmailMock.mockResolvedValue({
      status: "CONFIGURATION_ERROR",
      detail: "Faltan variables de entorno: RESEND_API_KEY",
    });
    const result = await sendEnrollmentApprovedEmail(INPUT);
    expect(result.sent).toBe(false);
    if (result.sent) return;
    expect(result.reason).toContain("RESEND_API_KEY");
  });

  it("un error interno tampoco propaga una excepción", async () => {
    sendTransactionalEmailMock.mockResolvedValue({
      status: "INTERNAL_ERROR",
      detail: "socket hang up",
    });
    await expect(sendEnrollmentApprovedEmail(INPUT)).resolves.toMatchObject({ sent: false });
  });
});
