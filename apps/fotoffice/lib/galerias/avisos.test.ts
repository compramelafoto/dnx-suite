import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("@/lib/presupuestos/sitio", () => ({
  sitioDelWorkspace: async (ws: string) => ({ workspaceId: ws, slug: "dnxestudio", customDomain: null, nombre: "DNX", logoUrl: null, whatsapp: null, email: null }),
  workspaceDelSlug: async () => "ws-1",
}));
vi.mock("@/lib/communications/load-workspace-signature", () => ({
  loadWorkspaceEmailContext: async () => ({ organizationName: "DNX Estudio", signature: { html: "<p>DNX</p>", text: "DNX" }, contact: { email: "hola@dnx.test", phone: null, whatsapp: null, website: null, instagram: null, city: null } }),
}));

const A = await import("./avisos");
const { TOPE_AUTOMATICOS_DIA } = await import("@/lib/plantillas/constantes");

const AHORA = new Date("2026-10-10T15:00:00.000Z");
type Salida = { to: string; subject: string; html: string; text: string };
let clientes: Salida[];
let internos: Salida[];
let resultadoCliente: { status: "SENT"; providerId: string } | { status: "PROVIDER_REJECTED"; detail: string };
const deps = () => ({
  ahora: () => AHORA,
  appOrigin: "https://app.test",
  enviar: async (m: Salida) => {
    clientes.push(m);
    return resultadoCliente as never;
  },
  enviarInterno: async (m: Salida) => {
    internos.push(m);
    return { status: "SENT", providerId: "i" } as never;
  },
});
const DATOS = { workspaceId: "ws-1", galeriaId: "g1", galeriaClienteId: "gc1", cantidad: 12 };
const eventos = () => B.datos.fotofficeGaleriaEvento.map((e) => e.type);

beforeEach(() => {
  B.vaciar();
  clientes = [];
  internos = [];
  resultadoCliente = { status: "SENT", providerId: "p1" };
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  B.agregar("user", { id: 7, email: "duena@estudio.test", name: "Dueña" });
  B.agregar("workspaceMembership", { workspaceId: "ws-1", userId: 7, role: "WORKSPACE_OWNER", createdAt: new Date("2026-01-01") });
  B.agregar("fotofficeGaleria", { id: "g1", workspaceId: "ws-1", proyectoId: "pr1", number: "G-1", name: "Boda Ana", status: "PUBLICADA", ownerUserId: 7 });
  B.agregar("fotofficeGaleriaCliente", { id: "gc1", workspaceId: "ws-1", galeriaId: "g1", name: "Ana Gómez", email: "ana@x.com", tokenHash: "h".repeat(64), tokenIssuedAt: AHORA, status: "EN_REVISION" });
});

describe("avisos de la selección enviada", () => {
  it("manda la copia al cliente con la cantidad y avisa al responsable con el enlace a la ficha", async () => {
    const r = await A.avisarSeleccionEnviada(DATOS, deps());
    expect(r).toEqual({ cliente: "ENVIADO", estudio: "ENVIADO" });
    expect(clientes).toHaveLength(1);
    expect(clientes[0]!.to).toBe("ana@x.com");
    expect(clientes[0]!.text).toContain("12 fotos");
    expect(clientes[0]!.subject).toContain("Boda Ana");
    expect(internos).toHaveLength(1);
    expect(internos[0]!.to).toBe("duena@estudio.test");
    expect(internos[0]!.text).toContain("Ana Gómez");
    expect(internos[0]!.text).toContain("12 fotos");
    expect(internos[0]!.text).toContain("https://app.test/galerias/g1");
    expect(eventos()).toEqual(["CONFIRMACION_ENVIADA", "AVISO_ESTUDIO_ENVIADO"]);
  });
  it("la copia al cliente queda en el registro de mensajes de la galería", async () => {
    await A.avisarSeleccionEnviada(DATOS, deps());
    expect(B.datos.fotofficeMessage).toHaveLength(1);
    expect(B.datos.fotofficeMessage[0]).toMatchObject({ entityType: "GALERIA", entityId: "g1", toAddress: "ana@x.com", status: "SENT", automatic: true });
  });
  it("sin correo del cliente: no manda la copia pero igual avisa al estudio", async () => {
    B.datos.fotofficeGaleriaCliente[0]!.email = null;
    const r = await A.avisarSeleccionEnviada(DATOS, deps());
    expect(r).toEqual({ cliente: "SIN_CORREO", estudio: "ENVIADO" });
    expect(clientes).toHaveLength(0);
    expect(eventos()).toEqual(["AVISO_ESTUDIO_ENVIADO"]);
  });
  it("si el proveedor rechaza la copia, queda en el historial sin datos personales y el aviso interno sale igual", async () => {
    resultadoCliente = { status: "PROVIDER_REJECTED", detail: "HTTP 422" };
    const r = await A.avisarSeleccionEnviada(DATOS, deps());
    expect(r.cliente).toBe("NO_ENVIADO");
    expect(r.estudio).toBe("ENVIADO");
    expect(eventos()).toEqual(["CONFIRMACION_NO_ENVIADA", "AVISO_ESTUDIO_ENVIADO"]);
    expect(JSON.stringify(B.datos.fotofficeGaleriaEvento)).not.toMatch(/ana@x\.com|Gómez|duena@/);
  });
  it("respeta el tope diario de correos automáticos (la copia no sale; el historial lo dice)", async () => {
    for (let i = 0; i < TOPE_AUTOMATICOS_DIA; i++) {
      B.agregar("fotofficeMessage", { workspaceId: "ws-1", channel: "EMAIL", entityType: "GALERIA", entityId: "g1", toAddress: `x${i}@x.com`, subject: "s", body: "b", status: "SENT", automatic: true, createdAt: AHORA });
    }
    const r = await A.avisarSeleccionEnviada(DATOS, deps());
    expect(r.cliente).toBe("TOPE");
    expect(clientes).toHaveLength(0);
    expect(eventos()).toContain("CONFIRMACION_NO_ENVIADA");
  });
  it("el aviso interno tiene su propio tope por día", async () => {
    for (let i = 0; i < A.TOPE_AVISOS_ESTUDIO_DIA; i++) B.agregar("fotofficeGaleriaEvento", { workspaceId: "ws-1", galeriaId: "g1", type: "AVISO_ESTUDIO_ENVIADO", createdAt: AHORA });
    const r = await A.avisarSeleccionEnviada(DATOS, deps());
    expect(r.estudio).toBe("TOPE");
    expect(internos).toHaveLength(0);
  });
  it("si el responsable ya no está, avisa al dueño del workspace", async () => {
    B.datos.fotofficeGaleria[0]!.ownerUserId = 99;
    await A.avisarSeleccionEnviada(DATOS, deps());
    expect(internos[0]!.to).toBe("duena@estudio.test");
  });
  it("un cliente o galería de otro workspace no se avisa; nunca lanza", async () => {
    expect(await A.avisarSeleccionEnviada({ ...DATOS, workspaceId: "ws-2" }, deps())).toEqual({ cliente: "ERROR", estudio: "ERROR" });
    expect(clientes).toHaveLength(0);
    expect(internos).toHaveLength(0);
  });
});
