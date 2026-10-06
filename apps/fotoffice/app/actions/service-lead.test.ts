import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  branding: vi.fn(),
  alta: vi.fn(),
  cabeceras: vi.fn(async () => new Headers()),
}));

vi.mock("@repo/db", () => ({
  Prisma: { JsonNull: null },
  prisma: { fotofficeWorkspaceBranding: { findUnique: H.branding } },
}));
// El alta única (contacto, consulta, número, circuito, aviso y respuesta automática) se prueba
// en lib/consultas/alta.test.ts; acá, lo propio del formulario público.
vi.mock("@/lib/consultas/alta", () => ({
  altaDeConsulta: H.alta,
  altaDelSistema: (workspaceId: string) => ({ workspaceId, userId: null, userLabel: "Sistema", role: null }),
  MENSAJES_ALTA: { fallo: "No se pudo registrar la consulta." },
}));
vi.mock("next/headers", () => ({ headers: H.cabeceras }));

const { createServiceLead } = await import("./service-lead");
const { resetRateLimit } = await import("@/lib/geocode/rate-limit");

const ENTRADA = { workspaceSlug: "dnx-estudio", name: "Laura Pérez", email: "laura@example.com", eventType: "BODA" };

beforeEach(() => {
  vi.clearAllMocks();
  H.branding.mockResolvedValue({ workspaceId: "ws-1", publicSlug: "dnx-estudio" });
  H.alta.mockResolvedValue({ ok: true, leadId: "lead-9", consultaId: "q-9", clientId: "c-9", avisos: {} });
  H.cabeceras.mockImplementation(async () => new Headers());
  resetRateLimit();
});

describe("createServiceLead", () => {
  it("da de alta por el camino único como WEB, con el workspace del slug y sin usuario", async () => {
    expect(
      await createServiceLead({
        ...ENTRADA, phone: " 341 555 ", eventDate: "2026-12-20", eventLocation: " Salón ", message: "Hola",
        formId: "f1", formSlug: "boda", meta: { budgetType: "FULL" },
      }),
    ).toEqual({ success: true });
    expect(H.alta).toHaveBeenCalledTimes(1);
    const [quien, datos, opciones] = H.alta.mock.calls[0]!;
    expect(quien).toEqual({ workspaceId: "ws-1", userId: null, userLabel: "Sistema", role: null });
    expect(opciones).toEqual({ origenDelAlta: "WEB" });
    expect(datos).toEqual({
      contacto: { nombre: "Laura Pérez", email: "laura@example.com", telefono: "341 555" },
      eventType: "BODA",
      eventSubtype: "FULL",
      eventDate: new Date("2026-12-20"),
      eventLocation: "Salón",
      message: "Hola",
      metaJson: { budgetType: "FULL" },
      formId: "f1",
      formSlug: "boda",
    });
  });

  it("los vacíos llegan como null", async () => {
    await createServiceLead(ENTRADA);
    expect(H.alta.mock.calls[0]![1]).toMatchObject({
      contacto: { nombre: "Laura Pérez", email: "laura@example.com", telefono: null },
      eventSubtype: null, eventDate: null, eventLocation: null, message: null, metaJson: null, formId: null, formSlug: null,
    });
  });

  it("sin workspace no da de alta", async () => {
    H.branding.mockResolvedValue(null);
    expect(await createServiceLead(ENTRADA)).toEqual({ success: false, error: "Workspace no encontrado." });
    expect(H.alta).not.toHaveBeenCalled();
  });

  it("si el alta no sale, avisa sin datos; un error de validación se muestra tal cual", async () => {
    H.alta.mockResolvedValue({ ok: false, error: "No se pudo registrar la consulta." });
    expect(await createServiceLead(ENTRADA)).toEqual({ success: false, error: "No se pudo registrar el lead." });
    H.alta.mockResolvedValue({ ok: false, error: "Elegí una categoría." });
    expect(await createServiceLead(ENTRADA)).toEqual({ success: false, error: "Elegí una categoría." });
  });

  it("si el alta explota, no registra los datos de la persona", async () => {
    const errores = vi.spyOn(console, "error").mockImplementation(() => {});
    H.alta.mockRejectedValue(Object.assign(new Error("Invalid value laura@example.com Laura Pérez"), { code: "P2000" }));
    expect(await createServiceLead(ENTRADA)).toEqual({ success: false, error: "No se pudo registrar el lead." });
    const registrado = JSON.stringify(errores.mock.calls);
    expect(registrado).not.toContain("laura@example.com");
    expect(registrado).toContain("P2000");
    errores.mockRestore();
  });

  it("datos inválidos: no llega al alta", async () => {
    expect((await createServiceLead({ ...ENTRADA, email: "no-es-correo" })).success).toBe(false);
    expect((await createServiceLead({ ...ENTRADA, name: "" })).success).toBe(false);
    expect(H.alta).not.toHaveBeenCalled();
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
    expect(H.alta).toHaveBeenCalledTimes(10);
    H.cabeceras.mockImplementation(ip("200.2.2.2"));
    expect(await createServiceLead(ENTRADA)).toEqual({ success: true });
  });

  it("sin IP conocida (o fuera de un pedido) no frena", async () => {
    for (let i = 0; i < 12; i++) expect(await createServiceLead(ENTRADA)).toEqual({ success: true });
    H.cabeceras.mockRejectedValue(new Error("fuera de un pedido"));
    expect(await createServiceLead(ENTRADA)).toEqual({ success: true });
  });
});
