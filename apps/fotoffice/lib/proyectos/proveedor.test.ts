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
vi.mock("@/lib/carpetas/carpeta", () => ({
  enlaceDeCarpeta: async () => ({ ok: true, url: "https://x/carpeta" }),
  enlaceLaboratorioSiHayArchivos: async () => null,
}));
vi.mock("./avance", () => ({ moverAFase: async () => ({ ok: true, movido: false }) }));
vi.mock("./acceso", () => ({ puedeGestionarProyectos: () => true, MENSAJES_PROYECTO: { sinPermiso: "Sin permiso.", datosInvalidos: "x", noExiste: "x" } }));

const { seMandaAlCobrar, enviarTrabajosDelPedidoAlProveedor } = await import("./proveedor");

const WS = "ws-1";
const ctx = { workspaceId: WS, userId: 1 } as never;

function trabajo(id: string, producto: { id: string; name: string }) {
  B.agregar("product", { id: producto.id, workspaceId: WS, name: producto.name, priceArs: "800", costArs: "300", isActive: true, sku: null, preferredProveedorId: null });
  B.agregar("fotofficeProyecto", { id, number: id, circuitId: "c", workspaceId: WS, pedidoId: "ped1", productId: producto.id, proveedorId: "lab1", proveedorEnviadoAt: null, name: id });
}

beforeEach(() => {
  B.vaciar();
  H.enviar.mockClear();
  B.agregar("fotofficeProveedor", { id: "lab1", workspaceId: WS, name: "Laboratorio Uno", email: "lab@x.com" });
});

describe("seMandaAlCobrar", () => {
  const base = { esCopia: false, esDeMostrador: false, archivosListos: 0, esFotolibro: false };
  it("otros productos se mandan como siempre", () => expect(seMandaAlCobrar(base)).toBe(true));
  it("fotolibro no", () => expect(seMandaAlCobrar({ ...base, esFotolibro: true, archivosListos: 5 })).toBe(false));
  it("mostrador no", () => expect(seMandaAlCobrar({ ...base, esDeMostrador: true, archivosListos: 5 })).toBe(false));
  it("copia sin archivos no; con archivos sí", () => {
    expect(seMandaAlCobrar({ ...base, esCopia: true })).toBe(false);
    expect(seMandaAlCobrar({ ...base, esCopia: true, archivosListos: 2 })).toBe(true);
  });
});

describe("enviarTrabajosDelPedidoAlProveedor", () => {
  it("copia con carpeta vacía: no manda, queda sin enviar y deja la nota", async () => {
    trabajo("t1", { id: "c10", name: "Copia para mañana 10x15" });
    await enviarTrabajosDelPedidoAlProveedor(ctx, "ped1");
    expect(H.enviar).not.toHaveBeenCalled();
    expect(B.datos.fotofficeProyecto[0]!.proveedorEnviadoAt).toBeNull();
    expect(B.datos.fotofficeProyectoNota.map((n) => n.body)).toEqual(["Falta subir los archivos para mandarlo a Laboratorio Uno."]);
  });

  it("copia con archivos listos: se manda", async () => {
    trabajo("t1", { id: "c10", name: "Copia para mañana 10x15" });
    B.agregar("fotofficeArchivoTrabajo", { id: "a1", workspaceId: WS, proyectoId: "t1", key: "k", nombre: "a.jpg", tipo: "image/jpeg", estado: "LISTO" });
    await enviarTrabajosDelPedidoAlProveedor(ctx, "ped1");
    expect(H.enviar).toHaveBeenCalledTimes(1);
    expect(B.datos.fotofficeProyecto[0]!.proveedorEnviadoAt).toBeInstanceOf(Date);
  });

  it("trabajo de mostrador: no se manda ni deja nota (lo manda el cron), aunque tenga archivos", async () => {
    trabajo("t1", { id: "c10", name: "Copia para mañana 10x15" });
    B.agregar("fotofficeArchivoTrabajo", { id: "a1", workspaceId: WS, proyectoId: "t1", key: "k", nombre: "a.jpg", tipo: "image/jpeg", estado: "LISTO" });
    B.agregar("fotofficePrintOrder", { id: "po1", workspaceId: WS, source: "MOSTRADOR" });
    B.agregar("fotofficePrintOrderItem", { id: "i1", orderId: "po1", proyectoId: "t1" });
    await enviarTrabajosDelPedidoAlProveedor(ctx, "ped1");
    expect(H.enviar).not.toHaveBeenCalled();
    expect(B.datos.fotofficeProyecto[0]!.proveedorEnviadoAt).toBeNull();
    expect(B.datos.fotofficeProyectoNota).toHaveLength(0);
  });

  it("otro producto: se manda como hoy", async () => {
    trabajo("t1", { id: "cuadro", name: "Cuadro 30x40" });
    await enviarTrabajosDelPedidoAlProveedor(ctx, "ped1");
    expect(H.enviar).toHaveBeenCalledTimes(1);
  });
});
