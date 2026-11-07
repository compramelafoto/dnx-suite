import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  pedido: vi.fn(),
  proyecto: vi.fn(),
  vinculoFind: vi.fn(),
  upsert: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    fotofficePedido: { findFirst: H.pedido },
    fotofficeProyecto: { findFirst: H.proyecto },
    fotofficeClfVinculo: { findFirst: H.vinculoFind, upsert: H.upsert, deleteMany: H.deleteMany },
  },
}));

const V = await import("./vinculo");

const ENLACE = "https://www.compramelafoto.com/album/escuela-x/preventa";
const FILA = { clfAlbumId: 1283, albumSlug: "escuela-x", tituloSnapshot: "Colación 7°", tienePreventa: true, preventaCierraEl: null };

function fetchCon(status: number, cuerpo: unknown) {
  return (async () => new Response(JSON.stringify(cuerpo), { status })) as unknown as typeof fetch;
}
const CLF_OK = fetchCon(200, { id: 1283, titulo: "Colación 7°", slug: "escuela-x", tienePreventa: true, preventaCierraEl: null });

beforeEach(() => {
  vi.clearAllMocks();
  H.pedido.mockResolvedValue({ id: "ped-1" });
  H.proyecto.mockResolvedValue({ id: "pro-1", pedidoId: null });
  H.upsert.mockResolvedValue(FILA);
  H.vinculoFind.mockResolvedValue(null);
});

describe("vincularAlbum", () => {
  it("vincula un pedido con upsert por pedidoId", async () => {
    const r = await V.vincularAlbum("ws-1", 7, { pedidoId: "ped-1" }, ENLACE, { fetch: CLF_OK });
    expect(r).toEqual({ ok: true, vinculo: { titulo: "Colación 7°", enlace: ENLACE, albumId: 1283, tienePreventa: true, preventaCierraEl: null, heredadoDelPedido: false } });
    expect(H.pedido).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "ped-1", workspaceId: "ws-1" } }));
    const arg = H.upsert.mock.calls[0]![0];
    expect(arg.where).toEqual({ pedidoId: "ped-1" });
    expect(arg.create).toMatchObject({ workspaceId: "ws-1", pedidoId: "ped-1", clfAlbumId: 1283, creadoPorUserId: 7 });
  });

  it("texto que no es de CLF: no consulta nada", async () => {
    const f = vi.fn();
    expect(await V.vincularAlbum("ws-1", 7, { pedidoId: "ped-1" }, "https://otro.com/album/x", { fetch: f as unknown as typeof fetch })).toEqual({ ok: false, error: V.MENSAJES_VINCULO_CLF.enlace });
    expect(f).not.toHaveBeenCalled();
    expect(H.upsert).not.toHaveBeenCalled();
  });

  it("álbum inexistente", async () => {
    expect(await V.vincularAlbum("ws-1", 7, { pedidoId: "ped-1" }, ENLACE, { fetch: fetchCon(404, {}) })).toEqual({ ok: false, error: V.MENSAJES_VINCULO_CLF.noExiste });
  });

  it("CLF caído: mensaje distinto y no guarda", async () => {
    expect(await V.vincularAlbum("ws-1", 7, { pedidoId: "ped-1" }, ENLACE, { fetch: fetchCon(503, {}) })).toEqual({ ok: false, error: V.MENSAJES_VINCULO_CLF.sinConexion });
    expect(H.upsert).not.toHaveBeenCalled();
  });

  it("pedido de otro workspace", async () => {
    H.pedido.mockResolvedValue(null);
    expect(await V.vincularAlbum("ws-1", 7, { pedidoId: "ajeno" }, ENLACE, { fetch: CLF_OK })).toEqual({ ok: false, error: V.MENSAJES_VINCULO_CLF.pedido });
  });

  it("proyecto con pedido: se vincula desde el pedido", async () => {
    H.proyecto.mockResolvedValue({ id: "pro-1", pedidoId: "ped-1" });
    expect(await V.vincularAlbum("ws-1", 7, { proyectoId: "pro-1" }, ENLACE, { fetch: CLF_OK })).toEqual({ ok: false, error: V.MENSAJES_VINCULO_CLF.heredado });
    expect(H.upsert).not.toHaveBeenCalled();
  });

  it("proyecto sin pedido: vínculo propio", async () => {
    await V.vincularAlbum("ws-1", 7, { proyectoId: "pro-1" }, ENLACE, { fetch: CLF_OK });
    expect(H.upsert.mock.calls[0]![0].where).toEqual({ proyectoId: "pro-1" });
  });
});

describe("lectura", () => {
  it("el proyecto con pedido muestra el vínculo del pedido, heredado", async () => {
    H.proyecto.mockResolvedValue({ id: "pro-1", pedidoId: "ped-1" });
    H.vinculoFind.mockResolvedValue(FILA);
    const v = await V.vinculoDe("ws-1", { proyectoId: "pro-1" });
    expect(v?.heredadoDelPedido).toBe(true);
    expect(H.vinculoFind.mock.calls[0]![0].where).toEqual({ workspaceId: "ws-1", pedidoId: "ped-1" });
  });

  it("enlacePreventaDelPedido: /preventa con preventa; null sin vínculo", async () => {
    H.vinculoFind.mockResolvedValueOnce(FILA);
    expect(await V.enlacePreventaDelPedido("ws-1", "ped-1")).toBe(ENLACE);
    expect(await V.enlacePreventaDelPedido("ws-1", "ped-2")).toBeNull();
  });
});

describe("quitarVinculo", () => {
  it("borra sólo dentro del workspace", async () => {
    expect(await V.quitarVinculo("ws-1", { pedidoId: "ped-1" })).toEqual({ ok: true });
    expect(H.deleteMany).toHaveBeenCalledWith({ where: { workspaceId: "ws-1", pedidoId: "ped-1" } });
  });
});
