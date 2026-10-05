// lib/course-classroom/grant.test.ts
import { describe, expect, it, vi } from "vitest";
import { avisarAccesoAlAula, type AvisoDeps } from "./grant";

const input = { enrollmentId: "insc-1", workspaceId: "ws-1", to: "ana@example.com", studentName: "Ana", courseTitle: "Retrato" };
const vence = new Date(Date.UTC(2027, 9, 4));

function deps(parcial: Partial<AvisoDeps> = {}): AvisoDeps {
  return {
    asegurarCuenta: vi.fn().mockResolvedValue({ userId: 7, creada: false, puedeEntrar: true }),
    otorgar: vi.fn().mockResolvedValue({ ok: true, accessId: "acc-1", expiresAt: vence, nuevo: true }),
    invitacionASociarse: vi.fn().mockResolvedValue(null),
    crearEnlaceContrasena: vi.fn().mockResolvedValue("https://fotoffice.com/recuperar/tok"),
    enviarCursoListo: vi.fn().mockResolvedValue({ sent: true }),
    enviarBienvenida: vi.fn().mockResolvedValue({ sent: true }),
    cargarFirma: vi.fn().mockResolvedValue(null),
    base: "https://fotoffice.com",
    ...parcial,
  };
}

describe("avisar el acceso", () => {
  it("quien ya puede entrar recibe 'ya está en tu portal'", async () => {
    const d = deps();
    expect(await avisarAccesoAlAula(input, d)).toEqual({ avisado: true });
    expect(d.otorgar).toHaveBeenCalledWith({ enrollmentId: "insc-1", userId: 7 });
    expect(d.enviarCursoListo).toHaveBeenCalledWith(
      expect.objectContaining({ to: "ana@example.com", portalUrl: "https://fotoffice.com/portal/cursos", expiresAt: vence }),
    );
    expect(d.enviarBienvenida).not.toHaveBeenCalled();
    expect(d.crearEnlaceContrasena).not.toHaveBeenCalled();
  });

  it("quien no puede entrar recibe la bienvenida con el enlace para crear la contraseña", async () => {
    const d = deps({ asegurarCuenta: vi.fn().mockResolvedValue({ userId: 8, creada: true, puedeEntrar: false }) });
    expect(await avisarAccesoAlAula(input, d)).toEqual({ avisado: true });
    expect(d.crearEnlaceContrasena).toHaveBeenCalledWith(8, "https://fotoffice.com");
    expect(d.enviarBienvenida).toHaveBeenCalledWith(
      expect.objectContaining({
        crearContrasenaUrl: "https://fotoffice.com/recuperar/tok",
        loginUrl: "https://fotoffice.com/login?next=/portal/cursos",
      }),
    );
  });

  it("si la invitación falla, el correo sale igual sin ella", async () => {
    const d = deps({ invitacionASociarse: vi.fn().mockRejectedValue(new Error("base caída")) });
    expect(await avisarAccesoAlAula(input, d)).toEqual({ avisado: true });
    expect(d.enviarCursoListo).toHaveBeenCalledWith(expect.objectContaining({ invitacion: null }));
  });

  it("lleva la invitación a asociarse cuando corresponde", async () => {
    const invitacion = { institucion: "SFPR", url: "https://fotoffice.com/w/sfpr/asociarse" };
    const d = deps({ invitacionASociarse: vi.fn().mockResolvedValue(invitacion) });
    await avisarAccesoAlAula(input, d);
    expect(d.invitacionASociarse).toHaveBeenCalledWith("ws-1", 7);
    expect(d.enviarCursoListo).toHaveBeenCalledWith(expect.objectContaining({ invitacion }));
  });

  it("un acceso que ya existía no manda otro correo", async () => {
    const d = deps({ otorgar: vi.fn().mockResolvedValue({ ok: true, accessId: "acc-1", expiresAt: vence, nuevo: false }) });
    expect((await avisarAccesoAlAula(input, d)).avisado).toBe(false);
    expect(d.enviarCursoListo).not.toHaveBeenCalled();
  });

  it("sin cuenta posible (correo inválido o bloqueada) no otorga ni manda", async () => {
    const d = deps({ asegurarCuenta: vi.fn().mockResolvedValue(null) });
    expect(await avisarAccesoAlAula(input, d)).toEqual({ avisado: false, motivo: "sin_cuenta" });
    expect(d.otorgar).not.toHaveBeenCalled();
  });

  it("sin dirección de la aplicación no hace nada", async () => {
    const d = deps({ base: "" });
    expect(await avisarAccesoAlAula(input, d)).toEqual({ avisado: false, motivo: "sin_app_url" });
    expect(d.asegurarCuenta).not.toHaveBeenCalled();
  });

  it("nunca lanza: el pago ya está aprobado", async () => {
    const d = deps({ otorgar: vi.fn().mockRejectedValue(new Error("base caída")) });
    await expect(avisarAccesoAlAula(input, d)).resolves.toEqual({ avisado: false, motivo: "error" });
  });

  it("un correo rechazado se informa sin lanzar", async () => {
    const d = deps({ enviarCursoListo: vi.fn().mockResolvedValue({ sent: false, reason: "rechazado" }) });
    expect(await avisarAccesoAlAula(input, d)).toEqual({ avisado: false, motivo: "rechazado" });
  });
});
