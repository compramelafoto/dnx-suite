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

const A = await import("./avisos-compra");
const E = await import("./enlace");

const AHORA = new Date("2026-10-10T15:00:00.000Z");
type Salida = { to: string; subject: string; html: string; text: string };
let clientes: Salida[];
let internos: Salida[];
const CLAVE = "clave-de-prueba";
const deps = () => ({
  ahora: () => AHORA,
  appOrigin: "https://app.test",
  clave: CLAVE,
  enviar: async (m: Salida) => {
    clientes.push(m);
    return { status: "SENT", providerId: "p1" } as never;
  },
  enviarInterno: async (m: Salida) => {
    internos.push(m);
    return { status: "SENT", providerId: "i" } as never;
  },
});
const eventos = () => B.datos.fotofficeGaleriaEvento.map((e) => e.type);

beforeEach(() => {
  B.vaciar();
  clientes = [];
  internos = [];
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  B.agregar("user", { id: 7, email: "duena@estudio.test", name: "Dueña" });
  B.agregar("workspaceMembership", { workspaceId: "ws-1", userId: 7, role: "WORKSPACE_OWNER", createdAt: new Date("2026-01-01") });
  B.agregar("fotofficeGaleria", { id: "g1", workspaceId: "ws-1", proyectoId: "pr1", number: "G-1", name: "Boda Ana", status: "PUBLICADA", ownerUserId: 7 });
  const token = E.tokenDeGaleriaCliente("gc1", AHORA, CLAVE);
  B.agregar("fotofficeGaleriaCliente", { id: "gc1", workspaceId: "ws-1", galeriaId: "g1", name: "Ana Gómez", email: "ana@x.com", tokenHash: E.hashDeToken(token), tokenIssuedAt: AHORA });
  B.agregar("fotofficeGaleriaCompra", { id: "c1", workspaceId: "ws-1", galeriaId: "g1", galeriaClienteId: "gc1", status: "PAGADA", extraCount: 3, subtotalArs: "4500.00", totalArs: "4500.00", pricingSnapshot: {} });
});

describe("avisos de la compra pagada", () => {
  it("confirma al cliente con la cantidad, el total y el enlace para volver, y avisa al responsable", async () => {
    const r = await A.avisarCompraPagada({ workspaceId: "ws-1", compraId: "c1" }, deps());
    expect(r).toEqual({ cliente: "ENVIADO", estudio: "ENVIADO" });
    expect(clientes).toHaveLength(1);
    expect(clientes[0]!.to).toBe("ana@x.com");
    expect(clientes[0]!.text).toContain("3 fotos extra");
    expect(clientes[0]!.text).toMatch(/\$\s4\.500,00/);
    expect(clientes[0]!.text).toContain(`https://app.test/w/dnxestudio/galeria/${E.tokenDeGaleriaCliente("gc1", AHORA, CLAVE)}`);
    expect(internos).toHaveLength(1);
    expect(internos[0]!.to).toBe("duena@estudio.test");
    expect(internos[0]!.text).toContain("https://app.test/galerias/g1");
    expect(eventos()).toEqual(["CONFIRMACION_ENVIADA", "AVISO_ESTUDIO_ENVIADO"]);
    // El enlace personal no queda en el registro de mensajes.
    expect(JSON.stringify(B.datos.fotofficeMessage)).not.toContain(E.tokenDeGaleriaCliente("gc1", AHORA, CLAVE));
    expect(JSON.stringify(B.datos.fotofficeGaleriaEvento)).not.toMatch(/ana@x\.com|Gómez/);
  });

  it("el aviso al estudio dice si no se anotó en Caja o si había fotos ya pagas", async () => {
    await A.avisarCompraPagada({ workspaceId: "ws-1", compraId: "c1", sinCaja: true, fotosRepetidas: true }, deps());
    expect(internos[0]!.text).toContain("No se anotó en Caja");
    expect(internos[0]!.text).toContain("Llegó un pago por fotos que ya estaban pagas: revisá si corresponde devolverlo.");
  });

  it("sin correo del cliente igual avisa al estudio", async () => {
    B.datos.fotofficeGaleriaCliente[0]!.email = null;
    expect(await A.avisarCompraPagada({ workspaceId: "ws-1", compraId: "c1" }, deps())).toEqual({ cliente: "SIN_CORREO", estudio: "ENVIADO" });
    expect(clientes).toHaveLength(0);
  });

  it("una compra de otra organización no manda nada", async () => {
    expect(await A.avisarCompraPagada({ workspaceId: "ws-2", compraId: "c1" }, deps())).toEqual({ cliente: "ERROR", estudio: "ERROR" });
    expect(clientes).toHaveLength(0);
    expect(internos).toHaveLength(0);
  });

  it("un pago que no se pudo acreditar avisa al estudio con los importes", async () => {
    const r = await A.avisarPagoNoAcreditado({ workspaceId: "ws-1", galeriaId: "g1", galeriaClienteId: "gc1", compraId: "c1", motivo: "IMPORTE_MENOR", pagadoCents: 100_000, totalCents: 450_000 }, deps());
    expect(r).toBe("ENVIADO");
    expect(internos[0]!.text).toMatch(/\$\s1\.000,00/);
    expect(internos[0]!.text).toMatch(/\$\s4\.500,00/);
    expect(clientes).toHaveLength(0);
  });
});
