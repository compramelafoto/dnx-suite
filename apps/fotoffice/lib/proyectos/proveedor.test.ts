import { beforeEach, describe, expect, it, vi } from "vitest";

const H = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return { B: crearBaseEnMemoria(), enviar: vi.fn(async () => ({ status: "SENT" })) };
});
const B = H.B;
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));
// Nunca se manda correo de verdad.
vi.mock("@/lib/communications/send-email", () => ({ sendTransactionalEmail: H.enviar }));
vi.mock("@/lib/communications/load-workspace-sender", () => ({ loadWorkspaceSender: async () => null }));
vi.mock("@/lib/carpetas/carpeta", () => ({ emitirEnlace: async () => ({ ok: true, url: "https://x/carpeta" }) }));
vi.mock("./avance", () => ({ moverAFase: async () => ({ ok: true, movido: false }) }));
vi.mock("./acceso", () => ({ puedeGestionarProyectos: () => true, MENSAJES_PROYECTO: { sinPermiso: "Sin permiso.", datosInvalidos: "x", noExiste: "x" } }));

const { enviarAlProveedor, enviarTrabajosCompletos, enviarTrabajosDelPedidoAlProveedor, MENSAJE_FALTAN_ARCHIVOS } = await import("./proveedor");

const WS = "ws-1";
const ctx = { workspaceId: WS, userId: 1 } as never;

function trabajo(id: string, producto: { id: string; name: string; sku?: string }, extra: Record<string, unknown> = {}) {
  B.agregar("product", { id: producto.id, workspaceId: WS, name: producto.name, priceArs: "800", costArs: "300", isActive: true, sku: producto.sku ?? null, preferredProveedorId: null });
  B.agregar("fotofficeProyecto", {
    id, number: id, circuitId: "c", workspaceId: WS, pedidoId: "ped1", pedidoItemIndex: null, productId: producto.id, proveedorId: "lab1",
    proveedorEnviadoAt: null, name: id, suspendedAt: null, createdAt: new Date("2026-11-07T12:00:00Z"), ...extra,
  });
}

function archivo(id: string, proyectoId: string, extra: Record<string, unknown> = {}) {
  B.agregar("fotofficeArchivoTrabajo", { id, workspaceId: WS, proyectoId, key: `k-${id}`, nombre: "a.jpg", tipo: "image/jpeg", estado: "LISTO", createdAt: new Date("2026-11-07T12:00:00Z"), ...extra });
}

beforeEach(() => {
  B.vaciar();
  H.enviar.mockClear();
  B.agregar("fotofficeProveedor", { id: "lab1", workspaceId: WS, name: "Laboratorio Uno", email: "lab@x.com" });
});

describe("enviarTrabajosDelPedidoAlProveedor", () => {
  it("copia con carpeta vacía: no manda, queda sin enviar y deja la nota", async () => {
    trabajo("t1", { id: "c10", name: "Copia para mañana 10x15" });
    await enviarTrabajosDelPedidoAlProveedor(ctx, "ped1");
    expect(H.enviar).not.toHaveBeenCalled();
    expect(B.datos.fotofficeProyecto[0]!.proveedorEnviadoAt).toBeNull();
    expect(B.datos.fotofficeProyectoNota.map((n) => n.body)).toEqual([
      "Faltan los archivos para Laboratorio Uno. Subilos en la carpeta del trabajo: el pedido sale solo a los pocos minutos.",
    ]);
  });

  it("cualquier otro producto sin archivos (un canvas) tampoco sale vacío", async () => {
    trabajo("t1", { id: "cnv", name: "Canvas 30x40" });
    await enviarTrabajosDelPedidoAlProveedor(ctx, "ped1");
    expect(H.enviar).not.toHaveBeenCalled();
    expect(B.datos.fotofficeProyecto[0]!.proveedorEnviadoAt).toBeNull();
  });

  it("con archivos listos: se manda con el enlace", async () => {
    trabajo("t1", { id: "c10", name: "Copia para mañana 10x15" });
    archivo("a1", "t1");
    await enviarTrabajosDelPedidoAlProveedor(ctx, "ped1");
    expect(H.enviar).toHaveBeenCalledTimes(1);
    expect((H.enviar.mock.calls[0] as unknown as [{ text: string }])[0].text).toContain("Archivos: https://x/carpeta");
    expect(B.datos.fotofficeProyecto[0]!.proveedorEnviadoAt).toBeInstanceOf(Date);
  });

  it("material físico (revelado de rollo): sale al cobrar sin archivos y lo dice", async () => {
    trabajo("t1", { id: "rev", name: "Revelado de rollo" });
    B.agregar("fotofficeProductoProyecto", { id: "r1", workspaceId: WS, productId: "rev", circuitId: "c", envioSinArchivos: true });
    await enviarTrabajosDelPedidoAlProveedor(ctx, "ped1");
    expect(H.enviar).toHaveBeenCalledTimes(1);
    expect((H.enviar.mock.calls[0] as unknown as [{ text: string }])[0].text).toContain("Es material físico");
  });

  it("trabajo de mostrador: no se manda ni deja nota (lo manda el cron), aunque tenga archivos", async () => {
    trabajo("t1", { id: "c10", name: "Copia para mañana 10x15" });
    archivo("a1", "t1");
    B.agregar("fotofficePrintOrder", { id: "po1", workspaceId: WS, source: "MOSTRADOR" });
    B.agregar("fotofficePrintOrderItem", { id: "i1", orderId: "po1", proyectoId: "t1" });
    await enviarTrabajosDelPedidoAlProveedor(ctx, "ped1");
    expect(H.enviar).not.toHaveBeenCalled();
    expect(B.datos.fotofficeProyecto[0]!.proveedorEnviadoAt).toBeNull();
    expect(B.datos.fotofficeProyectoNota).toHaveLength(0);
  });

  it("fotolibro: no sale al cobrar", async () => {
    trabajo("t1", { id: "fl", name: "Fotolibro tapa rígida", sku: "FOTOLIBRO-RIGIDA" });
    archivo("a1", "t1");
    await enviarTrabajosDelPedidoAlProveedor(ctx, "ped1");
    expect(H.enviar).not.toHaveBeenCalled();
  });
});

describe("enviarAlProveedor (botón «Enviar»)", () => {
  it("sin archivos no manda nada y avisa", async () => {
    trabajo("t1", { id: "cnv", name: "Canvas 30x40" });
    const r = await enviarAlProveedor(ctx, "t1", "lab1", null);
    expect(r).toEqual({ ok: false, error: MENSAJE_FALTAN_ARCHIVOS });
    expect(H.enviar).not.toHaveBeenCalled();
    expect(B.datos.fotofficeProyecto[0]!.proveedorEnviadoAt).toBeNull();
  });

  it("si el correo no sale, el trabajo sigue sin enviar", async () => {
    trabajo("t1", { id: "cnv", name: "Canvas 30x40" });
    archivo("a1", "t1");
    H.enviar.mockResolvedValueOnce({ status: "PROVIDER_REJECTED" });
    const r = await enviarAlProveedor(ctx, "t1", "lab1", null);
    expect(r.ok).toBe(false);
    expect(B.datos.fotofficeProyecto[0]!.proveedorEnviadoAt).toBeNull();
  });
});

describe("enviarTrabajosCompletos (cron)", () => {
  const ahora = new Date("2026-11-07T13:00:00Z");

  it("manda el que ya tiene archivos y no el que no", async () => {
    trabajo("t1", { id: "c10", name: "Copia para mañana 10x15" });
    trabajo("t2", { id: "c13", name: "Copia para mañana 13x18" });
    archivo("a1", "t1");
    expect(await enviarTrabajosCompletos(ahora)).toBe(1);
    expect(B.datos.fotofficeProyecto.find((p) => p.id === "t1")!.proveedorEnviadoAt).toBeInstanceOf(Date);
    expect(B.datos.fotofficeProyecto.find((p) => p.id === "t2")!.proveedorEnviadoAt).toBeNull();
  });

  it("espera si el último archivo es de hace menos de 5 minutos o si hay uno subiendo", async () => {
    trabajo("t1", { id: "c10", name: "Copia para mañana 10x15" });
    archivo("a1", "t1", { createdAt: new Date("2026-11-07T12:58:00Z") });
    expect(await enviarTrabajosCompletos(ahora)).toBe(0);
    B.datos.fotofficeArchivoTrabajo[0]!.createdAt = new Date("2026-11-07T12:00:00Z");
    archivo("a2", "t1", { estado: "PENDIENTE", createdAt: new Date("2026-11-07T12:50:00Z") });
    expect(await enviarTrabajosCompletos(ahora)).toBe(0);
  });

  it("no toca trabajos de antes del 07/11 (pudieron salir por WhatsApp)", async () => {
    trabajo("t1", { id: "c10", name: "Copia para mañana 10x15" }, { createdAt: new Date("2026-11-02T12:00:00Z") });
    archivo("a1", "t1");
    expect(await enviarTrabajosCompletos(ahora)).toBe(0);
  });
});
