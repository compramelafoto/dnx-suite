import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
const A = vi.hoisted(() => ({ subida: vi.fn(), urls: vi.fn(), borrar: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("./almacen", () => ({
  urlDeSubidaFoto: A.subida, urlsDeLecturaPorLote: A.urls, borrarObjetoFoto: A.borrar,
  tamanoDeObjeto: vi.fn(), leerObjeto: vi.fn(), guardarObjeto: vi.fn(),
}));
vi.mock("./procesar", () => ({ FotoNoProcesable: class extends Error {}, generarVariantes: vi.fn() }));

const F = await import("./fotos");
const { MENSAJES_GALERIA: M } = await import("./acceso");
const { MENSAJES_RONDA } = await import("./rondas");

type Nivel = "NONE" | "VIEW" | "MANAGE";
const ctx = (gallery: Nivel, workspaceId = "ws-1") => ({
  workspaceId, userId: 7, userLabel: "Ana", role: "STAFF", acceso: { role: "STAFF", levels: { gallery } } as never,
});
const GESTIONA = ctx("MANAGE");
const VER = ctx("VIEW");
const ARCHIVO = { nombre: "lamina-01.jpg", tipo: "image/jpeg", tamano: 2_000_000 };

const fotos = () => B.datos.fotofficeGaleriaFoto;

function galeria(id: string, kind: string, status = "PUBLICADA") {
  B.agregar("fotofficeGaleria", { id, workspaceId: "ws-1", proyectoId: "pr1", number: id, name: id, kind, status });
}
function lamina(id: string, galeriaId: string, rondaId: string | null, extra: Record<string, unknown> = {}) {
  B.agregar("fotofficeGaleriaFoto", {
    id, workspaceId: "ws-1", galeriaId, rondaId, fileName: `${id}.jpg`, originalKey: `galerias/ws-1/${galeriaId}/${id}/original`, status: "LISTA", order: 0, ...extra,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  B.vaciar();
  A.subida.mockResolvedValue("https://firmada/put");
  A.urls.mockResolvedValue(new Map());
  A.borrar.mockResolvedValue(undefined);
  galeria("alb", "ALBUM");
  B.agregar("fotofficeGaleriaRonda", { id: "r1", workspaceId: "ws-1", galeriaId: "alb", number: 1, status: "ABIERTA" });
});

describe("subir láminas a un álbum", () => {
  it("la lámina queda en la ronda abierta aunque el navegador no diga nada de rondas", async () => {
    const r = await F.pedirSubidaFoto(GESTIONA, "alb", ARCHIVO);
    expect(r).toMatchObject({ ok: true, url: "https://firmada/put" });
    expect(fotos()).toHaveLength(1);
    expect(fotos()[0]).toMatchObject({ workspaceId: "ws-1", galeriaId: "alb", rondaId: "r1", status: "PENDIENTE", mediaType: "FOTO" });
  });
  it("cuando se abre otra ronda, las láminas nuevas van a la nueva y no a la cerrada", async () => {
    B.datos.fotofficeGaleriaRonda[0]!.status = "CERRADA";
    B.datos.fotofficeGaleriaRonda[0]!.closedAt = new Date();
    B.agregar("fotofficeGaleriaRonda", { id: "r2", workspaceId: "ws-1", galeriaId: "alb", number: 2, status: "ABIERTA" });
    await F.pedirSubidaFoto(GESTIONA, "alb", ARCHIVO);
    expect(fotos()[0]!.rondaId).toBe("r2");
  });
  it("un álbum sin ronda abierta rechaza la subida y no deja filas", async () => {
    B.datos.fotofficeGaleriaRonda.length = 0;
    expect(await F.pedirSubidaFoto(GESTIONA, "alb", ARCHIVO)).toEqual({ ok: false, error: MENSAJES_RONDA.sinRonda });
    expect(fotos()).toHaveLength(0);
  });
  it("tope de 300 láminas por ronda: las de la ronda anterior no cuentan y las que fallaron para siempre tampoco", async () => {
    B.agregar("fotofficeGaleriaRonda", { id: "r0", workspaceId: "ws-1", galeriaId: "alb", number: 0, status: "CERRADA", closedAt: new Date() });
    for (let i = 0; i < 300; i++) lamina(`v${i}`, "alb", "r0");
    for (let i = 0; i < 299; i++) lamina(`n${i}`, "alb", "r1");
    lamina("e", "alb", "r1", { status: "ERROR", attempts: 3 });
    expect((await F.pedirSubidaFoto(GESTIONA, "alb", ARCHIVO)).ok).toBe(true);
    expect(await F.pedirSubidaFoto(GESTIONA, "alb", ARCHIVO)).toEqual({ ok: false, error: MENSAJES_RONDA.topeLaminas });
    expect(fotos().filter((f) => f.rondaId === "r1")).toHaveLength(301);
  });
  it("no admite videos, galería archivada ni subir sin Gestionar", async () => {
    expect(await F.pedirSubidaFoto(GESTIONA, "alb", { nombre: "v.mp4", tipo: "video/mp4", tamano: 10 })).toEqual({ ok: false, error: M.videoSoloEntrega });
    expect(await F.pedirSubidaFoto(VER, "alb", ARCHIVO)).toEqual({ ok: false, error: M.sinPermiso });
    B.datos.fotofficeGaleria[0]!.status = "ARCHIVADA";
    expect(await F.pedirSubidaFoto(GESTIONA, "alb", ARCHIVO)).toEqual({ ok: false, error: M.archivada });
    expect(fotos()).toHaveLength(0);
  });
  it("no sube a un álbum de otro workspace", async () => {
    expect(await F.pedirSubidaFoto(ctx("MANAGE", "ws-2"), "alb", ARCHIVO)).toEqual({ ok: false, error: M.noExiste });
  });
});

describe("las galerías de selección y de entrega siguen como siempre", () => {
  it("sus fotos no llevan ronda, sin consultar rondas y con el tope de 3.000 por galería", async () => {
    galeria("sel", "SELECCION");
    galeria("ent", "ENTREGA");
    expect((await F.pedirSubidaFoto(GESTIONA, "sel", ARCHIVO)).ok).toBe(true);
    expect((await F.pedirSubidaFoto(GESTIONA, "ent", { nombre: "v.mp4", tipo: "video/mp4", tamano: 10 })).ok).toBe(true);
    expect(fotos().map((f) => f.rondaId)).toEqual([null, null]);
    for (let i = 0; i < 2998; i++) lamina(`s${i}`, "sel", null);
    expect((await F.pedirSubidaFoto(GESTIONA, "sel", ARCHIVO)).ok).toBe(true);
    expect(await F.pedirSubidaFoto(GESTIONA, "sel", ARCHIVO)).toEqual({ ok: false, error: M.topeFotos });
  });
  it("listar sin rondas devuelve todas las fotos de la galería", async () => {
    galeria("sel", "SELECCION");
    lamina("a", "sel", null);
    lamina("b", "sel", null, { order: 1 });
    expect((await F.listarFotos(VER, "sel")).map((f) => f.id)).toEqual(["a", "b"]);
    // Un rondaId pedido no cambia nada en una galería que no es álbum.
    expect((await F.listarFotos(VER, "sel", { rondaId: "r1" })).map((f) => f.id)).toEqual(["a", "b"]);
  });
});

describe("listar láminas por ronda", () => {
  beforeEach(() => {
    B.datos.fotofficeGaleriaRonda[0]!.status = "CERRADA";
    B.datos.fotofficeGaleriaRonda[0]!.closedAt = new Date();
    B.agregar("fotofficeGaleriaRonda", { id: "r2", workspaceId: "ws-1", galeriaId: "alb", number: 2, status: "ABIERTA" });
    lamina("a1", "alb", "r1");
    lamina("a2", "alb", "r1", { order: 1 });
    lamina("b1", "alb", "r2", { order: 2 });
    galeria("otro", "ALBUM");
    B.agregar("fotofficeGaleriaRonda", { id: "r-otro", workspaceId: "ws-1", galeriaId: "otro", number: 1, status: "ABIERTA" });
    lamina("x1", "otro", "r-otro");
  });
  it("por omisión la ronda abierta; con rondaId, esa ronda", async () => {
    expect((await F.listarFotos(VER, "alb")).map((f) => f.id)).toEqual(["b1"]);
    expect((await F.listarFotos(VER, "alb", { rondaId: "r1" })).map((f) => f.id)).toEqual(["a1", "a2"]);
  });
  it("una ronda de otra galería no se puede espiar pidiéndola por id", async () => {
    expect(await F.listarFotos(VER, "alb", { rondaId: "r-otro" })).toEqual([]);
  });
  it("sin Ver o de otro workspace no devuelve nada", async () => {
    expect(await F.listarFotos(ctx("NONE"), "alb")).toEqual([]);
    expect(await F.listarFotos(ctx("VIEW", "ws-2"), "alb")).toEqual([]);
  });
});

describe("borrar y reordenar en un álbum", () => {
  beforeEach(() => {
    B.datos.fotofficeGaleriaRonda[0]!.status = "CERRADA";
    B.datos.fotofficeGaleriaRonda[0]!.closedAt = new Date();
    B.agregar("fotofficeGaleriaRonda", { id: "r2", workspaceId: "ws-1", galeriaId: "alb", number: 2, status: "ABIERTA" });
    lamina("a1", "alb", "r1", { order: 0 });
    lamina("b1", "alb", "r2", { order: 1 });
    lamina("b2", "alb", "r2", { order: 2 });
  });
  it("una lámina de una ronda cerrada no se borra; una de la abierta sí", async () => {
    expect(await F.borrarFoto(GESTIONA, "alb", "a1")).toEqual({ ok: false, error: MENSAJES_RONDA.rondaCerrada });
    expect(fotos().map((f) => f.id)).toContain("a1");
    expect(await F.borrarFoto(GESTIONA, "alb", "b1")).toEqual({ ok: true });
    expect(fotos().map((f) => f.id)).toEqual(["a1", "b2"]);
  });
  it("reordenar mueve sólo las láminas de la ronda abierta y deja las demás donde estaban", async () => {
    expect(await F.reordenarFotos(GESTIONA, "alb", ["b2", "b1"])).toEqual({ ok: true });
    const orden = (id: string) => fotos().find((f) => f.id === id)!.order;
    expect(orden("b2")).toBeLessThan(orden("b1") as number);
    expect(orden("a1")).toBe(0);
    // Una lámina de la ronda cerrada no es reordenable.
    expect(await F.reordenarFotos(GESTIONA, "alb", ["a1"])).toEqual({ ok: false, error: M.orden });
  });
  it("borrar una foto de una galería de selección (sin ronda) no consulta rondas", async () => {
    galeria("sel", "SELECCION");
    lamina("s1", "sel", null);
    expect(await F.borrarFoto(GESTIONA, "sel", "s1")).toEqual({ ok: true });
  });
});
