import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  branding: vi.fn(),
  crear: vi.fn(),
  notificar: vi.fn(),
  numerar: vi.fn(),
  responder: vi.fn(),
  cabeceras: vi.fn(async () => new Headers()),
}));

vi.mock("@repo/db", () => ({
  Prisma: { JsonNull: null },
  prisma: {
    fotofficeWorkspaceBranding: { findUnique: H.branding },
    serviceSalesLead: { create: H.crear },
  },
}));
vi.mock("@/lib/circuitos/eventos", () => ({ notificarEvento: H.notificar }));
vi.mock("@/lib/service-leads/numero", () => ({ numerarConsultaNueva: H.numerar }));
vi.mock("@/lib/plantillas/automaticos", () => ({ responderConsultaNueva: H.responder }));
vi.mock("next/headers", () => ({ headers: H.cabeceras }));

const { createServiceLead } = await import("./service-lead");
const { resetRateLimit } = await import("@/lib/geocode/rate-limit");

const ALTA = new Date("2026-10-01T15:00:00Z");
const ENTRADA = { workspaceSlug: "dnx-estudio", name: "Laura Pérez", email: "laura@example.com", eventType: "BODA" };

beforeEach(() => {
  vi.clearAllMocks();
  H.branding.mockResolvedValue({ workspaceId: "ws-1", publicSlug: "dnx-estudio" });
  H.crear.mockResolvedValue({ id: "lead-9", createdAt: ALTA });
  H.numerar.mockResolvedValue({ year: 2026, value: 1, display: "2026-0001" });
  H.notificar.mockResolvedValue({ movido: true });
  H.responder.mockResolvedValue("APAGADA");
  H.cabeceras.mockImplementation(async () => new Headers());
  resetRateLimit();
});

describe("createServiceLead", () => {
  it("crea la consulta y avisa CONSULTA_RECIBIDA al motor con el workspace del slug", async () => {
    expect(await createServiceLead(ENTRADA)).toEqual({ success: true });
    expect(H.crear).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ workspaceId: "ws-1", status: "NEW" }) }));
    expect(H.notificar).toHaveBeenCalledWith("ws-1", { tipo: "CAPTACION", id: "lead-9" }, "CONSULTA_RECIBIDA", "lead-9");
  });

  it("numera la consulta recién creada, después del alta y antes de avisar al motor", async () => {
    await createServiceLead(ENTRADA);
    expect(H.numerar).toHaveBeenCalledWith("ws-1", "lead-9", ALTA);
    expect(H.crear.mock.invocationCallOrder[0]).toBeLessThan(H.numerar.mock.invocationCallOrder[0]!);
    expect(H.numerar.mock.invocationCallOrder[0]).toBeLessThan(H.notificar.mock.invocationCallOrder[0]!);
  });

  it("sin número (la numeración no pudo) el alta igual sale bien", async () => {
    H.numerar.mockResolvedValue(null);
    expect(await createServiceLead(ENTRADA)).toEqual({ success: true });
    expect(H.notificar).toHaveBeenCalled();
  });

  it("una falla del motor no hace fallar el alta", async () => {
    const errores = vi.spyOn(console, "error").mockImplementation(() => {});
    H.notificar.mockRejectedValue(new Error("motor caído"));
    expect(await createServiceLead(ENTRADA)).toEqual({ success: true });
    H.notificar.mockResolvedValue({ movido: false });
    expect(await createServiceLead(ENTRADA)).toEqual({ success: true });
    expect(JSON.stringify(errores.mock.calls)).not.toContain("Laura");
    errores.mockRestore();
  });

  it("sin workspace no crea ni avisa", async () => {
    H.branding.mockResolvedValue(null);
    expect(await createServiceLead(ENTRADA)).toEqual({ success: false, error: "Workspace no encontrado." });
    expect(H.crear).not.toHaveBeenCalled();
    expect(H.notificar).not.toHaveBeenCalled();
  });

  it("si falla el alta, no registra los datos de la persona", async () => {
    const errores = vi.spyOn(console, "error").mockImplementation(() => {});
    H.crear.mockRejectedValue(Object.assign(new Error("Invalid value laura@example.com Laura Pérez"), { code: "P2000" }));
    expect(await createServiceLead(ENTRADA)).toEqual({ success: false, error: "No se pudo registrar el lead." });
    const registrado = JSON.stringify(errores.mock.calls);
    expect(registrado).not.toContain("laura@example.com");
    expect(registrado).toContain("P2000");
    expect(H.notificar).not.toHaveBeenCalled();
    errores.mockRestore();
  });

  it("responde la consulta automáticamente después de numerarla, con el workspace del slug", async () => {
    await createServiceLead(ENTRADA);
    expect(H.responder).toHaveBeenCalledTimes(1);
    expect(H.responder).toHaveBeenCalledWith("ws-1", "lead-9");
    expect(H.numerar.mock.invocationCallOrder[0]).toBeLessThan(H.responder.mock.invocationCallOrder[0]!);
  });

  it("si la respuesta automática explota, el alta igual sale bien y sigue al motor", async () => {
    const errores = vi.spyOn(console, "error").mockImplementation(() => {});
    H.responder.mockRejectedValue(new Error("Resend caído laura@example.com"));
    expect(await createServiceLead(ENTRADA)).toEqual({ success: true });
    expect(H.notificar).toHaveBeenCalled();
    expect(JSON.stringify(errores.mock.calls)).not.toContain("laura@example.com");
    errores.mockRestore();
  });

  it("sin workspace o si falla el alta, no responde", async () => {
    H.branding.mockResolvedValue(null);
    await createServiceLead(ENTRADA);
    H.branding.mockResolvedValue({ workspaceId: "ws-1", publicSlug: "dnx-estudio" });
    const errores = vi.spyOn(console, "error").mockImplementation(() => {});
    H.crear.mockRejectedValue(new Error("x"));
    await createServiceLead(ENTRADA);
    errores.mockRestore();
    expect(H.responder).not.toHaveBeenCalled();
  });

  it("no quedan console.log en el archivo", () => {
    const fuente = readFileSync(path.join(__dirname, "service-lead.ts"), "utf8");
    expect(fuente).not.toMatch(/console\.log/);
  });
});

describe("abuso del formulario público", () => {
  /** Un correo válido (etiquetas de dominio de hasta 63) del largo pedido (≥ 200). */
  const correoDeLargo = (n: number) => {
    const resto = n - 64 - 1 - 60 - 1 - 60 - 1 - 1 - 4;
    const c = `${"a".repeat(64)}@${"b".repeat(60)}.${"c".repeat(60)}.${"d".repeat(resto)}.test`;
    expect(c).toHaveLength(n);
    return c;
  };
  it("topes de largo: nombre 120, correo 254, teléfono 40, mensaje 4000", async () => {
    const casos: [Record<string, string>, boolean][] = [
      [{ name: "a".repeat(120) }, true],
      [{ name: "a".repeat(121) }, false],
      [{ email: correoDeLargo(254) }, true],
      [{ email: correoDeLargo(255) }, false],
      [{ phone: "1".repeat(40) }, true],
      [{ phone: "1".repeat(41) }, false],
      [{ message: "m".repeat(4000) }, true],
      [{ message: "m".repeat(4001) }, false],
    ];
    for (const [cambio, valido] of casos) {
      const r = await createServiceLead({ ...ENTRADA, ...cambio });
      expect(r.success, JSON.stringify(Object.keys(cambio))).toBe(valido);
    }
  });

  it("freno por IP: 10 consultas cada 10 minutos; otra IP sigue pudiendo", async () => {
    const ip = (x: string) => async () => new Headers({ "x-forwarded-for": `${x}, 10.0.0.1` });
    H.cabeceras.mockImplementation(ip("200.1.1.1"));
    for (let i = 0; i < 10; i++) expect(await createServiceLead(ENTRADA)).toEqual({ success: true });
    const frenada = await createServiceLead(ENTRADA);
    expect(frenada.success).toBe(false);
    expect(H.crear).toHaveBeenCalledTimes(10);
    expect(H.responder).toHaveBeenCalledTimes(10);
    H.cabeceras.mockImplementation(ip("200.2.2.2"));
    expect(await createServiceLead(ENTRADA)).toEqual({ success: true });
  });

  it("sin IP conocida (o fuera de un pedido) no frena", async () => {
    for (let i = 0; i < 12; i++) expect(await createServiceLead(ENTRADA)).toEqual({ success: true });
    H.cabeceras.mockRejectedValue(new Error("fuera de un pedido"));
    expect(await createServiceLead(ENTRADA)).toEqual({ success: true });
  });
});
