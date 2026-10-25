// lib/course-classroom/invitacion.test.ts
import { describe, expect, it, vi } from "vitest";
import { invitarSinCargo, type InvitacionDeps } from "./invitacion";

const curso = { id: "curso-1", title: "Taller de XV", accessMonths: 12, workspaceId: "ws-1" };
const ahora = new Date(Date.UTC(2026, 9, 23));

function deps(parcial: Partial<InvitacionDeps> = {}): InvitacionDeps {
  return {
    cargarCurso: vi.fn().mockResolvedValue(curso),
    asegurarCuenta: vi.fn().mockResolvedValue({ userId: 7, creada: true, puedeEntrar: false }),
    yaTieneAcceso: vi.fn().mockResolvedValue(false),
    darAcceso: vi.fn().mockResolvedValue("CREADO"),
    crearEnlaceContrasena: vi.fn().mockResolvedValue("https://fotoffice.com/recuperar/tok"),
    enviar: vi.fn().mockResolvedValue({ status: "SENT", providerId: "re_1" }),
    cargarFirma: vi.fn().mockResolvedValue(null),
    cargarRemitente: vi.fn().mockResolvedValue({ name: "DNX Fotografía", replyTo: null }),
    esperar: vi.fn().mockResolvedValue(undefined),
    base: "https://fotoffice.com",
    ahora: () => ahora,
    ...parcial,
  };
}

const input = {
  workspaceId: "ws-1",
  courseId: "curso-1",
  invitados: [{ email: "ana@mail.com", nombre: "Ana" }],
  asunto: "Te invitamos",
  mensaje: "Creamos nuestra plataforma.\nEntrá gratis.",
};

describe("invitar sin cargo", () => {
  it("da el acceso por los meses del curso y manda el enlace para elegir contraseña", async () => {
    const d = deps();
    const r = await invitarSinCargo(input, d);
    expect(r).toEqual({ ok: true, resultados: [{ email: "ana@mail.com", estado: "INVITADO" }] });

    const acceso = vi.mocked(d.darAcceso).mock.calls[0][0];
    expect(acceso.expiresAt).toEqual(new Date(Date.UTC(2027, 9, 23)));
    const correo = vi.mocked(d.enviar).mock.calls[0][0];
    expect(correo.subject).toBe("Te invitamos");
    expect(correo.sender).toEqual({ name: "DNX Fotografía", replyTo: null });
    expect(correo.text).toContain("Hola Ana:");
    expect(correo.text).toContain("Entrá gratis.");
    expect(correo.text).toContain("https://fotoffice.com/recuperar/tok");
  });

  it("quien ya puede entrar recibe el enlace a sus cursos, sin crear contraseña", async () => {
    const d = deps({ asegurarCuenta: vi.fn().mockResolvedValue({ userId: 7, creada: false, puedeEntrar: true }) });
    await invitarSinCargo(input, d);
    expect(d.crearEnlaceContrasena).not.toHaveBeenCalled();
    expect(vi.mocked(d.enviar).mock.calls[0][0].text).toContain("https://fotoffice.com/portal/cursos");
  });

  it("quien ya tiene el curso no se toca ni recibe otro correo", async () => {
    const d = deps({ yaTieneAcceso: vi.fn().mockResolvedValue(true) });
    const r = await invitarSinCargo(input, d);
    expect(r.ok && r.resultados[0].estado).toBe("YA_TENIA");
    expect(d.darAcceso).not.toHaveBeenCalled();
    expect(d.enviar).not.toHaveBeenCalled();
  });

  it("si el correo falla, el acceso queda y lo informa; sigue con el resto", async () => {
    const enviar = vi
      .fn()
      .mockResolvedValueOnce({ status: "PROVIDER_REJECTED", detail: "rebotó" })
      .mockResolvedValueOnce({ status: "SENT", providerId: null });
    const d = deps({ enviar });
    const r = await invitarSinCargo(
      { ...input, invitados: [{ email: "a@mail.com", nombre: "" }, { email: "b@mail.com", nombre: "" }] },
      d,
    );
    expect(r.ok && r.resultados.map((x) => x.estado)).toEqual(["CORREO_NO_ENVIADO", "INVITADO"]);
    expect(d.esperar).toHaveBeenCalledTimes(1);
    expect(vi.mocked(enviar).mock.calls[0][0].text).toContain("Hola:");
  });

  it("no invita a un curso que no es grabado o de otro espacio", async () => {
    const r = await invitarSinCargo(input, deps({ cargarCurso: vi.fn().mockResolvedValue(null) }));
    expect(r.ok).toBe(false);
  });
});
