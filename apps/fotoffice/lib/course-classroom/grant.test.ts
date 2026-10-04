// lib/course-classroom/grant.test.ts
import { describe, expect, it, vi } from "vitest";
import { hashInvitationToken } from "@/lib/members/invitation-tokens";
import { avisarAccesoAlAula, reenviarEnlaces, type AvisoDeps, type ReenvioDeps } from "./grant";

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

describe("reenviar el enlace del aula", () => {
  const ahora = new Date(Date.UTC(2026, 9, 3));
  const acceso = (id: string) => ({
    id,
    workspaceId: "ws-1",
    expiresAt: new Date(Date.UTC(2027, 9, 3)),
    to: "ana@example.com",
    studentName: "Ana",
    courseTitle: `Curso ${id}`,
    tokenHash: `hash-viejo-${id}`,
    ultimaRotacion: new Date(Date.UTC(2026, 8, 1)),
  });

  function depsReenvio(parcial: Partial<ReenvioDeps> = {}): ReenvioDeps {
    let n = 0;
    return {
      buscar: vi.fn().mockResolvedValue([acceso("a1"), acceso("a2")]),
      guardarHash: vi.fn().mockResolvedValue(undefined),
      enviar: vi.fn().mockResolvedValue({ sent: true }),
      cargarFirma: vi.fn().mockResolvedValue(null),
      base: "https://fotoffice.com",
      generarToken: () => `tok-${++n}`,
      ...parcial,
    };
  }

  it("un enlace nuevo por cada curso vigente, y el viejo deja de servir", async () => {
    const d = depsReenvio();
    const r = await reenviarEnlaces(" Ana@Example.com ", d, ahora);
    expect(r).toEqual({ enviados: 2 });
    expect(d.buscar).toHaveBeenCalledWith("ana@example.com", ahora);
    expect(d.guardarHash).toHaveBeenCalledWith("a1", hashInvitationToken("tok-1"));
    expect(d.guardarHash).toHaveBeenCalledWith("a2", hashInvitationToken("tok-2"));
    expect(d.enviar).toHaveBeenCalledWith(
      expect.objectContaining({ enlace: "https://fotoffice.com/aula/tok-1", courseTitle: "Curso a1" }),
    );
  });

  it("sin cursos para ese correo no hace nada", async () => {
    const d = depsReenvio({ buscar: vi.fn().mockResolvedValue([]) });
    expect(await reenviarEnlaces("nadie@example.com", d, ahora)).toEqual({ enviados: 0 });
    expect(d.enviar).not.toHaveBeenCalled();
  });

  it("un correo que no parece correo ni consulta", async () => {
    const d = depsReenvio();
    expect(await reenviarEnlaces("hola", d, ahora)).toEqual({ enviados: 0 });
    expect(d.buscar).not.toHaveBeenCalled();
  });

  it("si el envío falla restaura el hash viejo y sigue con el siguiente", async () => {
    const enviar = vi
      .fn()
      .mockResolvedValueOnce({ sent: false, reason: "resend caído" })
      .mockResolvedValueOnce({ sent: true });
    const d = depsReenvio({ enviar });
    expect(await reenviarEnlaces("ana@example.com", d, ahora)).toEqual({ enviados: 1 });
    expect(d.guardarHash).toHaveBeenCalledWith("a1", "hash-viejo-a1");
    expect(d.guardarHash).not.toHaveBeenCalledWith("a2", "hash-viejo-a2");
    expect(enviar).toHaveBeenCalledTimes(2);
  });

  it("si enviar lanza restaura el hash viejo y sigue con el siguiente", async () => {
    const enviar = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce({ sent: true });
    const d = depsReenvio({ enviar });
    expect(await reenviarEnlaces("ana@example.com", d, ahora)).toEqual({ enviados: 1 });
    expect(d.guardarHash).toHaveBeenCalledWith("a1", "hash-viejo-a1");
    expect(enviar).toHaveBeenCalledTimes(2);
  });

  it("si cargarFirma lanza también restaura el hash viejo", async () => {
    const d = depsReenvio({ cargarFirma: vi.fn().mockRejectedValue(new Error("firma")) });
    expect(await reenviarEnlaces("ana@example.com", d, ahora)).toEqual({ enviados: 0 });
    expect(d.guardarHash).toHaveBeenCalledWith("a1", "hash-viejo-a1");
    expect(d.guardarHash).toHaveBeenCalledWith("a2", "hash-viejo-a2");
  });

  it("un acceso rotado hace 2 minutos se saltea y otro de hace 10 se procesa", async () => {
    const d = depsReenvio({
      buscar: vi.fn().mockResolvedValue([
        { ...acceso("reciente"), ultimaRotacion: new Date(ahora.getTime() - 2 * 60 * 1000) },
        { ...acceso("viejo"), ultimaRotacion: new Date(ahora.getTime() - 10 * 60 * 1000) },
      ]),
    });
    expect(await reenviarEnlaces("ana@example.com", d, ahora)).toEqual({ enviados: 1 });
    expect(d.guardarHash).toHaveBeenCalledTimes(1);
    expect(d.guardarHash).toHaveBeenCalledWith("viejo", expect.any(String));
  });

  it("el reenvío sale marcado como reenvío", async () => {
    const d = depsReenvio();
    await reenviarEnlaces("ana@example.com", d, ahora);
    expect(d.enviar).toHaveBeenCalledWith(expect.objectContaining({ reenvio: true }));
  });

  it("sin APP_URL no hace nada", async () => {
    const d = depsReenvio({ base: "" });
    expect(await reenviarEnlaces("ana@example.com", d, ahora)).toEqual({ enviados: 0 });
    expect(d.buscar).not.toHaveBeenCalled();
  });
});
