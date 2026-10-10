import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
const F = vi.hoisted(() => ({ borrarFoto: vi.fn(), urls: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("./fotos", () => ({ borrarFoto: F.borrarFoto }));
vi.mock("./almacen", () => ({ urlsDeLecturaPorLote: F.urls }));

const G = await import("./galerias");
const { MENSAJES_GALERIA: M } = await import("./acceso");
const { MENSAJE_DE_BIENVENIDA_DE_FABRICA } = await import("./ajustes");

type Nivel = "NONE" | "VIEW" | "MANAGE";
const ctx = (gallery: Nivel, workspaceId = "ws-1", extra: Record<string, Nivel> = {}) => ({
  workspaceId, userId: 7, userLabel: "Ana", role: "STAFF", acceso: { role: "STAFF", levels: { gallery, ...extra } } as never,
});
const GESTIONA = ctx("MANAGE");
const SOLO_VER = ctx("VIEW");
const SIN_ACCESO = ctx("NONE");
const OTRO_WS = ctx("MANAGE", "ws-2");
const AHORA = new Date("2026-10-10T15:00:00.000Z");

const galerias = () => B.datos.fotofficeGaleria;
const eventos = () => B.datos.fotofficeGaleriaEvento.map((e) => e.type);

beforeEach(() => {
  vi.clearAllMocks();
  B.vaciar();
  F.borrarFoto.mockResolvedValue({ ok: true });
  F.urls.mockResolvedValue(new Map());
  B.agregar("client", { id: "c1", workspaceId: "ws-1", kind: "PERSONA", firstName: "Ana", lastName: "Gómez", email: "ana@x.com" });
  B.agregar("client", { id: "c-ajeno", workspaceId: "ws-2", kind: "PERSONA", firstName: "Otra", lastName: "Ajena" });
  B.agregar("fotofficeProyecto", { id: "pr1", workspaceId: "ws-1", number: "PY-1", name: "Boda Ana y Luis", clientId: "c1", ownerUserId: 3 });
  B.agregar("fotofficeProyecto", { id: "pr-ajeno", workspaceId: "ws-2", number: "PY-9", name: "Ajeno", clientId: "c-ajeno" });
});

async function crear(c = GESTIONA, datos: Record<string, unknown> = { proyectoId: "pr1" }) {
  const r = await G.crearGaleria(c, datos, AHORA);
  if (!r.ok) throw new Error(r.error);
  return r.id;
}
function foto(galeriaId: string, id: string, status = "LISTA", workspaceId = "ws-1") {
  B.agregar("fotofficeGaleriaFoto", { id, workspaceId, galeriaId, fileName: `${id}.jpg`, originalKey: `galerias/${workspaceId}/${galeriaId}/${id}/original`, status });
}

describe("crear", () => {
  it("nace en borrador con el nombre del proyecto, los valores de fábrica, número y evento", async () => {
    const id = await crear();
    expect(galerias()).toHaveLength(1);
    expect(galerias()[0]).toMatchObject({
      id, workspaceId: "ws-1", proyectoId: "pr1", name: "Boda Ana y Luis", status: "BORRADOR", selectionMode: "LIBRE", minSelect: null, maxSelect: null,
      allowComments: true, downloadMode: "VISTA", orderMode: "NOMBRE", message: MENSAJE_DE_BIENVENIDA_DE_FABRICA, ownerUserId: 3, createdByUserId: 7,
    });
    expect(String(galerias()[0]!.number)).toMatch(/\d/);
    expect(eventos()).toEqual(["GALERIA_CREADA"]);
  });
  it("usa los ajustes de la organización y el nombre pedido", async () => {
    B.agregar("fotofficeGaleriaAjustes", { workspaceId: "ws-1", defaultMessage: null, defaultAllowComments: false, defaultDownloadMode: "NINGUNA" });
    const id = await crear(GESTIONA, { proyectoId: "pr1", nombre: "  Selección   álbum " });
    expect(galerias().find((g) => g.id === id)).toMatchObject({ name: "Selección álbum", message: null, allowComments: false, downloadMode: "NINGUNA" });
  });
  it("un ajuste por cantidad no rompe el CHECK: la galería nace libre", async () => {
    B.agregar("fotofficeGaleriaAjustes", { workspaceId: "ws-1", defaultSelectionMode: "CANTIDAD" });
    await crear();
    expect(galerias()[0]).toMatchObject({ selectionMode: "LIBRE", minSelect: null, maxSelect: null });
  });
  it("los números son correlativos", async () => {
    await crear();
    await crear();
    const [a, b] = galerias().map((g) => String(g.number));
    expect(a).not.toBe(b);
  });
  it("permisos y aislamiento: sin Gestionar no; proyecto de otro workspace no; datos mal formados no", async () => {
    expect(await G.crearGaleria(SOLO_VER, { proyectoId: "pr1" })).toEqual({ ok: false, error: M.sinPermiso });
    expect(await G.crearGaleria(SIN_ACCESO, { proyectoId: "pr1" })).toEqual({ ok: false, error: M.sinPermiso });
    expect(await G.crearGaleria({ ...GESTIONA, userId: null } as never, { proyectoId: "pr1" })).toEqual({ ok: false, error: M.sinPermiso });
    expect(await G.crearGaleria(GESTIONA, { proyectoId: "pr-ajeno" })).toEqual({ ok: false, error: M.proyecto });
    expect(await G.crearGaleria(OTRO_WS, { proyectoId: "pr1" })).toEqual({ ok: false, error: M.proyecto });
    expect(await G.crearGaleria(GESTIONA, { proyectoId: 5 })).toEqual({ ok: false, error: M.datosInvalidos });
    expect(await G.crearGaleria(GESTIONA, { proyectoId: "pr1", nombre: "x".repeat(121) })).toEqual({ ok: false, error: M.nombreGaleria });
    expect(galerias()).toHaveLength(0);
  });
});

describe("editar", () => {
  const BUENOS = { nombre: "Nuevo", mensaje: "Hola", selectionMode: "CANTIDAD", minSelect: "20", maxSelect: 40, allowComments: false, downloadMode: "NINGUNA" };
  it("guarda nombre, mensaje, selección por cantidad (acepta texto numérico), comentarios y descarga, y deja evento", async () => {
    const id = await crear();
    expect(await G.editarGaleria(GESTIONA, id, BUENOS)).toEqual({ ok: true });
    expect(galerias()[0]).toMatchObject({ name: "Nuevo", message: "Hola", selectionMode: "CANTIDAD", minSelect: 20, maxSelect: 40, allowComments: false, downloadMode: "NINGUNA" });
    expect(eventos()).toContain("GALERIA_EDITADA");
  });
  it("libre borra mínimo y máximo; mensaje vacío = sin mensaje", async () => {
    const id = await crear();
    await G.editarGaleria(GESTIONA, id, BUENOS);
    await G.editarGaleria(GESTIONA, id, { ...BUENOS, selectionMode: "LIBRE", mensaje: "  " });
    expect(galerias()[0]).toMatchObject({ selectionMode: "LIBRE", minSelect: null, maxSelect: null, message: null });
  });
  it("rechaza configuraciones incoherentes sin tocar nada", async () => {
    const id = await crear();
    const antes = { ...galerias()[0]! };
    for (const mala of [
      { ...BUENOS, minSelect: null, maxSelect: null },
      { ...BUENOS, minSelect: 50, maxSelect: 40 },
      { ...BUENOS, minSelect: 0 },
      { ...BUENOS, minSelect: 2.5 },
      { ...BUENOS, nombre: "" },
      { ...BUENOS, selectionMode: "OTRO" },
      { ...BUENOS, downloadMode: "TODO" },
      { ...BUENOS, allowComments: "si" },
      { ...BUENOS, mensaje: "x".repeat(2001) },
    ]) {
      expect((await G.editarGaleria(GESTIONA, id, mala)).ok, JSON.stringify(mala)).toBe(false);
    }
    expect(galerias()[0]).toEqual(antes);
  });
  it("permisos y aislamiento", async () => {
    const id = await crear();
    expect(await G.editarGaleria(SOLO_VER, id, BUENOS)).toEqual({ ok: false, error: M.sinPermiso });
    expect(await G.editarGaleria(OTRO_WS, id, BUENOS)).toEqual({ ok: false, error: M.noExiste });
    expect(galerias()[0]!.name).toBe("Boda Ana y Luis");
  });
});

describe("estados", () => {
  it("publicar exige al menos una foto lista; después queda PUBLICADA con fecha y evento", async () => {
    const id = await crear();
    expect(await G.publicarGaleria(GESTIONA, id, AHORA)).toEqual({ ok: false, error: M.sinFotosListas });
    foto(id, "f1", "PENDIENTE");
    expect(await G.publicarGaleria(GESTIONA, id, AHORA)).toEqual({ ok: false, error: M.sinFotosListas });
    foto(id, "f2", "LISTA");
    expect(await G.publicarGaleria(GESTIONA, id, AHORA)).toEqual({ ok: true });
    expect(galerias()[0]).toMatchObject({ status: "PUBLICADA", publishedAt: AHORA });
    expect(eventos()).toContain("PUBLICADA");
    expect(await G.publicarGaleria(GESTIONA, id, AHORA)).toEqual({ ok: false, error: M.yaPublicada });
  });
  it("las fotos de otra galería no cuentan para publicar", async () => {
    const id = await crear();
    const otra = await crear();
    foto(otra, "f1", "LISTA");
    expect((await G.publicarGaleria(GESTIONA, id, AHORA)).ok).toBe(false);
  });
  it("archivar desde borrador o publicada, y reactivar vuelve al estado anterior (publicada si ya se publicó)", async () => {
    const id = await crear();
    foto(id, "f1");
    await G.publicarGaleria(GESTIONA, id, AHORA);
    expect(await G.archivarGaleria(GESTIONA, id, AHORA)).toEqual({ ok: true });
    expect(galerias()[0]).toMatchObject({ status: "ARCHIVADA", archivedAt: AHORA });
    expect(await G.archivarGaleria(GESTIONA, id, AHORA)).toEqual({ ok: false, error: M.yaArchivada });
    expect(await G.publicarGaleria(GESTIONA, id, AHORA)).toEqual({ ok: false, error: M.galeriaArchivada });
    expect(await G.reactivarGaleria(GESTIONA, id)).toEqual({ ok: true });
    expect(galerias()[0]).toMatchObject({ status: "PUBLICADA", archivedAt: null });
    expect(eventos()).toEqual(expect.arrayContaining(["PUBLICADA", "ARCHIVADA", "REACTIVADA"]));
  });
  it("un borrador archivado y reactivado vuelve a borrador", async () => {
    const id = await crear();
    await G.archivarGaleria(GESTIONA, id, AHORA);
    await G.reactivarGaleria(GESTIONA, id);
    expect(galerias()[0]!.status).toBe("BORRADOR");
    expect(await G.reactivarGaleria(GESTIONA, id)).toEqual({ ok: false, error: M.noEstaArchivada });
  });
  it("cambiar el estado es una escritura condicional: si ya cambió, no se pisa", async () => {
    const id = await crear();
    foto(id, "f1");
    // Otra persona la archiva entre la lectura y la escritura.
    const original = B.tablas.fotofficeGaleria.updateMany;
    B.tablas.fotofficeGaleria.updateMany = async (a) => {
      galerias()[0]!.status = "ARCHIVADA";
      return original(a);
    };
    const r = await G.publicarGaleria(GESTIONA, id, AHORA);
    B.tablas.fotofficeGaleria.updateMany = original;
    expect(r.ok).toBe(false);
    expect(galerias()[0]!.status).toBe("ARCHIVADA");
    expect(eventos()).not.toContain("PUBLICADA");
  });
  it("permisos y aislamiento", async () => {
    const id = await crear();
    foto(id, "f1");
    for (const c of [SOLO_VER, SIN_ACCESO]) {
      expect(await G.publicarGaleria(c, id)).toEqual({ ok: false, error: M.sinPermiso });
      expect(await G.archivarGaleria(c, id)).toEqual({ ok: false, error: M.sinPermiso });
      expect(await G.reactivarGaleria(c, id)).toEqual({ ok: false, error: M.sinPermiso });
    }
    expect(await G.publicarGaleria(OTRO_WS, id)).toEqual({ ok: false, error: M.noExiste });
    expect(await G.archivarGaleria(OTRO_WS, id)).toEqual({ ok: false, error: M.noExiste });
    expect(galerias()[0]!.status).toBe("BORRADOR");
  });
});

describe("orden", () => {
  it("cambia el modo de orden con permiso y sólo en el workspace propio", async () => {
    const id = await crear();
    expect(await G.establecerModoOrden(GESTIONA, id, "MANUAL")).toEqual({ ok: true });
    expect(galerias()[0]!.orderMode).toBe("MANUAL");
    expect((await G.establecerModoOrden(GESTIONA, id, "RARO")).ok).toBe(false);
    expect(await G.establecerModoOrden(OTRO_WS, id, "NOMBRE")).toEqual({ ok: false, error: M.noExiste });
    expect((await G.establecerModoOrden(SOLO_VER, id, "NOMBRE")).ok).toBe(false);
    expect(galerias()[0]!.orderMode).toBe("MANUAL");
  });
});

describe("borrar una foto", () => {
  it("deja constancia con cuántas elecciones se llevó; una pendiente no deja rastro", async () => {
    const id = await crear();
    foto(id, "f1", "LISTA");
    foto(id, "f2", "PENDIENTE");
    B.agregar("fotofficeGaleriaSeleccion", { workspaceId: "ws-1", galeriaClienteId: "gc1", fotoId: "f1" });
    B.agregar("fotofficeGaleriaSeleccion", { workspaceId: "ws-1", galeriaClienteId: "gc2", fotoId: "f1" });
    expect(await G.borrarFotoDeGaleria(GESTIONA, id, "f1")).toEqual({ ok: true });
    expect(await G.borrarFotoDeGaleria(GESTIONA, id, "f2")).toEqual({ ok: true });
    expect(F.borrarFoto).toHaveBeenCalledTimes(2);
    const ev = B.datos.fotofficeGaleriaEvento.filter((e) => e.type === "FOTO_BORRADA");
    expect(ev).toHaveLength(1);
    expect(ev[0]!.data).toEqual({ selecciones: 2 });
  });
  it("foto de otra galería o de otro workspace: no existe; sin permiso no", async () => {
    const id = await crear();
    foto(id, "f1");
    expect(await G.borrarFotoDeGaleria(OTRO_WS, id, "f1")).toEqual({ ok: false, error: M.fotoNoExiste });
    expect(await G.borrarFotoDeGaleria(GESTIONA, id, "otra")).toEqual({ ok: false, error: M.fotoNoExiste });
    expect(await G.borrarFotoDeGaleria(SOLO_VER, id, "f1")).toEqual({ ok: false, error: M.sinPermiso });
    expect(F.borrarFoto).not.toHaveBeenCalled();
  });
  it("si el borrado falla no queda constancia", async () => {
    const id = await crear();
    foto(id, "f1");
    F.borrarFoto.mockResolvedValue({ ok: false, error: M.guardar });
    expect(await G.borrarFotoDeGaleria(GESTIONA, id, "f1")).toEqual({ ok: false, error: M.guardar });
    expect(eventos()).not.toContain("FOTO_BORRADA");
  });
});

describe("fotosPorIds", () => {
  it("devuelve sólo las fotos pedidas de esa galería y ese workspace, con URLs, y nada sin Ver", async () => {
    const id = await crear();
    foto(id, "f1");
    foto(id, "f2");
    const otra = await crear();
    foto(otra, "f3");
    F.urls.mockResolvedValue(new Map([["f1", { thumbUrl: "t1", viewUrl: "v1" }]]));
    const r = await G.fotosPorIds(SOLO_VER, id, ["f1", "f3"]);
    expect(r.map((f) => f.id)).toEqual(["f1"]);
    expect(r[0]).toMatchObject({ thumbUrl: "t1", viewUrl: "v1" });
    expect(JSON.stringify(r)).not.toContain("galerias/");
    expect(await G.fotosPorIds(OTRO_WS, id, ["f1"])).toEqual([]);
    expect(await G.fotosPorIds(SIN_ACCESO, id, ["f1"])).toEqual([]);
    expect(await G.fotosPorIds(SOLO_VER, id, Array.from({ length: 101 }, (_, i) => `x${i}`))).toEqual([]);
    expect(await G.fotosPorIds(SOLO_VER, id, [])).toEqual([]);
  });
});

describe("buscarProyectos", () => {
  it("pide Gestionar en Galería y Ver en Proyectos, y con menos de 2 letras no busca", async () => {
    const conProyectos = ctx("MANAGE", "ws-1", { projects: "VIEW" });
    expect(await G.buscarProyectos(GESTIONA, "boda")).toEqual({ ok: false, error: M.buscarProyectos });
    expect(await G.buscarProyectos(ctx("VIEW", "ws-1", { projects: "VIEW" }), "boda")).toEqual({ ok: false, error: M.sinPermiso });
    expect(await G.buscarProyectos(conProyectos, "a")).toEqual({ ok: true, proyectos: [] });
  });
});
