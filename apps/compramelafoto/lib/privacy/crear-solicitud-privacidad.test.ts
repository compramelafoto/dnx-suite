import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ create: vi.fn(), mail: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { privacyRequest: { create: (...a: unknown[]) => m.create(...a) } },
}));
vi.mock("@/emails/send", () => ({ sendEmail: (...a: unknown[]) => m.mail(...a) }));
import {
  crearSolicitudDePrivacidad,
  privacyRequestSchema,
  PRIVACY_REQUEST_TYPES,
  PRIVACY_RELATIONSHIPS,
} from "./crear-solicitud-privacidad";

const data = privacyRequestSchema.parse({
  type: "SUPRESION",
  fullName: "Juana Pérez",
  email: "juana@mail.com",
  isRepresentative: true,
});
const META = { ip: "x".repeat(60), userAgent: "UA", sourcePage: "bot" };

const envOriginal = process.env.RESEND_API_KEY;
beforeEach(() => {
  m.create.mockReset();
  m.mail.mockReset();
  m.create.mockResolvedValue({ id: 8 });
  delete process.env.RESEND_API_KEY;
});
afterEach(() => {
  if (envOriginal === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = envOriginal;
});

describe("crearSolicitudDePrivacidad", () => {
  it("expone los tipos y vínculos del formulario", () => {
    expect(PRIVACY_REQUEST_TYPES).toEqual([
      "ACCESO",
      "RECTIFICACION",
      "SUPRESION",
      "OCULTAR_FOTO",
      "BAJA_MARKETING",
      "DESACTIVAR_BIOMETRIA",
    ]);
    expect(PRIVACY_RELATIONSHIPS).toEqual(["TITULAR", "PADRE_MADRE_TUTOR"]);
    expect(data.relationship).toBe("TITULAR");
  });
  it("crea RECEIVED, recorta la IP a 45 y no manda mail sin RESEND_API_KEY", async () => {
    expect(await crearSolicitudDePrivacidad(data, META)).toEqual({ id: 8 });
    const d = m.create.mock.calls[0][0].data;
    expect(d.status).toBe("RECEIVED");
    expect(d.type).toBe("SUPRESION");
    expect(d.metadata).toEqual({ ip: "x".repeat(45), userAgent: "UA", sourcePage: "bot" });
    expect(m.mail).not.toHaveBeenCalled();
  });
  it("con RESEND_API_KEY manda la confirmación", async () => {
    process.env.RESEND_API_KEY = "re_test";
    await crearSolicitudDePrivacidad(data, META);
    expect(m.mail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "juana@mail.com", templateKey: "ADMIN_MANUAL", meta: {} }),
    );
  });
});
