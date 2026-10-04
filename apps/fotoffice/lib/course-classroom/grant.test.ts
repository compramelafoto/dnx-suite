// lib/course-classroom/grant.test.ts
import { describe, expect, it, vi } from "vitest";
import { avisarAccesoAlAula, type AvisoDeps } from "./grant";

const input = {
  enrollmentId: "insc-1",
  workspaceId: "ws-1",
  to: "ana@example.com",
  studentName: "Ana",
  courseTitle: "Retrato",
};
const vence = new Date(Date.UTC(2027, 9, 3));

function deps(parcial: Partial<AvisoDeps> = {}): AvisoDeps {
  return {
    otorgar: vi.fn().mockResolvedValue({ ok: true, creado: true, token: "tok-crudo", expiresAt: vence }),
    enviar: vi.fn().mockResolvedValue({ sent: true }),
    cargarFirma: vi.fn().mockResolvedValue(null),
    base: "https://fotoffice.com",
    ...parcial,
  };
}

describe("avisar el acceso al aula", () => {
  it("al crear el acceso manda un correo con el enlace", async () => {
    const d = deps();
    const r = await avisarAccesoAlAula(input, d);
    expect(r).toEqual({ avisado: true });
    expect(d.enviar).toHaveBeenCalledTimes(1);
    expect(d.enviar).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "ana@example.com",
        enlace: "https://fotoffice.com/aula/tok-crudo",
        expiresAt: vence,
      }),
    );
  });

  it("si el acceso ya existía no manda nada: el aviso repetido de Mercado Pago no duplica correos", async () => {
    const d = deps({ otorgar: vi.fn().mockResolvedValue({ ok: true, creado: false }) });
    const r = await avisarAccesoAlAula(input, d);
    expect(r.avisado).toBe(false);
    expect(d.enviar).not.toHaveBeenCalled();
  });

  it("sin dirección de la aplicación no manda un enlace roto", async () => {
    const d = deps({ base: "" });
    const r = await avisarAccesoAlAula(input, d);
    expect(r).toEqual({ avisado: false, motivo: "sin_app_url" });
    expect(d.enviar).not.toHaveBeenCalled();
  });

  it("si el correo falla no lanza: el pago ya está aprobado", async () => {
    const d = deps({ enviar: vi.fn().mockResolvedValue({ sent: false, reason: "rechazado" }) });
    await expect(avisarAccesoAlAula(input, d)).resolves.toEqual({ avisado: false, motivo: "rechazado" });
  });

  it("si otorgar explota tampoco lanza", async () => {
    const d = deps({ otorgar: vi.fn().mockRejectedValue(new Error("base caída")) });
    await expect(avisarAccesoAlAula(input, d)).resolves.toEqual({ avisado: false, motivo: "error" });
  });
});
