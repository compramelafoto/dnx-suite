import { beforeEach, describe, expect, it, vi } from "vitest";

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock("@repo/db", () => ({ prisma: { sentEmailLog: { create: createMock } } }));

const { recordTestEmailAttempt } = await import("./email-log");

const BASE = {
  userId: 7,
  to: "destino@example.com",
  subject: "Prueba de configuración de email — Club SFPR",
};

beforeEach(() => {
  createMock.mockReset();
  createMock.mockResolvedValue({ id: 1 });
});

describe("registro de intentos de email de prueba", () => {
  it("guarda el envío exitoso con el id del proveedor", async () => {
    await recordTestEmailAttempt({ ...BASE, status: "SENT", providerId: "email_1" });
    const data = createMock.mock.calls[0]?.[0]?.data;
    expect(data.status).toBe("SENT");
    expect(data.resendId).toBe("email_1");
    expect(data.userId).toBe(7);
    expect(data.templateKey).toBe("fotoffice.email-test");
  });

  it.each(["CONFIGURATION_ERROR", "PROVIDER_REJECTED", "INTERNAL_ERROR"] as const)(
    "también registra los intentos fallidos: %s",
    async (status) => {
      await recordTestEmailAttempt({ ...BASE, status, detail: "algo salió mal" });
      const data = createMock.mock.calls[0]?.[0]?.data;
      expect(data.status).toBe(status);
      expect(data.error).toBe("algo salió mal");
      expect(data.userId).toBe(7);
    },
  );

  it("trunca el detalle largo", async () => {
    await recordTestEmailAttempt({ ...BASE, status: "INTERNAL_ERROR", detail: "x".repeat(4000) });
    const data = createMock.mock.calls[0]?.[0]?.data;
    expect(data.error.length).toBeLessThanOrEqual(500);
  });

  it("tacha cualquier cosa con forma de clave de Resend", async () => {
    await recordTestEmailAttempt({
      ...BASE,
      status: "PROVIDER_REJECTED",
      detail: "clave re_abcdef0123456789 rechazada",
    });
    const data = createMock.mock.calls[0]?.[0]?.data;
    expect(data.error).not.toContain("re_abcdef0123456789");
    expect(data.error).toContain("[redactado]");
  });

  /**
   * Registrar es diagnóstico, no parte del envío: si la escritura falla, el usuario ya
   * recibió (o no) su email y el resultado no debe cambiar por eso.
   */
  it("un fallo al registrar no propaga excepción", async () => {
    createMock.mockRejectedValue(new Error("db caída"));
    await expect(recordTestEmailAttempt({ ...BASE, status: "SENT" })).resolves.toBeUndefined();
  });
});
