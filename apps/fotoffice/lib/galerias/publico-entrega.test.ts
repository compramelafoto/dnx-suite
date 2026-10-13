import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("@/lib/presupuestos/sitio", () => ({
  sitioDelWorkspace: async (ws: string) => ({ workspaceId: ws, slug: "dnxestudio", customDomain: null, nombre: "DNX Estudio", logoUrl: null, whatsapp: null, email: null }),
  workspaceDelSlug: async () => "ws-1",
}));
const firmarLote = vi.fn(async (fotos: { id: string; viewKey: string | null; thumbKey: string | null }[]) =>
  new Map(fotos.map((f) => [f.id, { thumbUrl: f.thumbKey ? `https://r2.test/${f.thumbKey}?firma` : null, viewUrl: f.viewKey ? `https://r2.test/${f.viewKey}?firma` : null }])),
);
const firmarUna = vi.fn(async (clave: string) => `https://r2.test/${clave}?firma`);
const firmarOriginal = vi.fn(async (clave: string, nombre: { ascii: string }) => `https://r2.test/${clave}?original=${nombre.ascii}`);
const firmarDescarga = vi.fn(async (clave: string, nombre: { ascii: string }) => `https://r2.test/${clave}?descarga=${nombre.ascii}`);
const firmarVideo = vi.fn(async (clave: string) => `https://r2.test/${clave}?inline`);
vi.mock("./almacen", () => ({
  urlsDeLecturaPorLote: firmarLote,
  urlDeLecturaFoto: firmarUna,
  urlDeDescargaFoto: firmarDescarga,
  urlDeDescargaOriginal: firmarOriginal,
  urlDeReproduccionVideo: firmarVideo,
}));

const P = await import("./publico");
const { tokenDeGaleriaCliente, hashDeToken } = await import("./enlace");
const { MENSAJES_PUBLICO: M } = await import("./publico-tipos");

const CLAVE = "clave-de-prueba";
const EMITIDO = new Date("2026-10-01T12:00:00.000Z");
const token = (id: string) => tokenDeGaleriaCliente(id, EMITIDO, CLAVE);
const TOKEN1 = token("gc1");

const galeria = (id = "ge") => B.datos.fotofficeGaleria.find((g) => g.id === id)!;
const cliente = (id = "gc1") => B.datos.fotofficeGaleriaCliente.find((c) => c.id === id)!;

function sembrarCliente(id: string, galeriaId = "ge", extra: Record<string, unknown> = {}) {
  B.agregar("fotofficeGaleriaCliente", {
    id, workspaceId: "ws-1", galeriaId, clientId: null, name: "Ana Gómez", email: "ana@x.com", tokenHash: hashDeToken(token(id)), tokenIssuedAt: EMITIDO, ...extra,
  });
}
function sembrarFoto(id: string, galeriaId = "ge", extra: Record<string, unknown> = {}) {
  B.agregar("fotofficeGaleriaFoto", {
    id, workspaceId: galeriaId === "g-ajena" ? "ws-2" : "ws-1", galeriaId, fileName: `${id}.jpg`, originalKey: `o/${id}`,
    viewKey: `v/${id}`, thumbKey: `t/${id}`, status: "LISTA", width: 3000, height: 2000, order: 0, mediaType: "FOTO", ...extra,
  });
}
function sembrarVideo(id: string, galeriaId = "ge", extra: Record<string, unknown> = {}) {
  sembrarFoto(id, galeriaId, { fileName: `${id}.mp4`, viewKey: null, thumbKey: null, width: null, height: null, mediaType: "VIDEO", contentType: "video/mp4", ...extra });
}

beforeEach(() => {
  vi.clearAllMocks();
  B.vaciar();
  B.agregar("fotofficeGaleria", { id: "ge", workspaceId: "ws-1", proyectoId: "pr1", number: "G-1", name: "Entrega boda", kind: "ENTREGA", status: "PUBLICADA", saleMode: "SELECCION", downloadMode: "SELECCIONADAS", orderMode: "NOMBRE" });
  B.agregar("fotofficeGaleria", { id: "gs", workspaceId: "ws-1", proyectoId: "pr1", number: "G-2", name: "Selección", kind: "SELECCION", status: "PUBLICADA", saleMode: "SELECCION", downloadMode: "NINGUNA", orderMode: "NOMBRE" });
  B.agregar("fotofficeGaleria", { id: "g-ajena", workspaceId: "ws-2", proyectoId: "pr9", number: "G-1", name: "Ajena", kind: "ENTREGA", status: "PUBLICADA" });
  sembrarCliente("gc1");
  sembrarFoto("f1");
  sembrarFoto("f2");
  sembrarVideo("v1");
  sembrarFoto("f-pendiente", "ge", { status: "PENDIENTE", viewKey: null, thumbKey: null });
  sembrarFoto("f-selec", "gs", { originalKey: "o/f-selec" });
  sembrarFoto("f-ajena", "g-ajena");
  sembrarVideo("v-ajeno", "g-ajena");
});

describe("la página de una entrega", () => {
  it("el token resuelve con kind ENTREGA", async () => {
    expect(await P.resolverTokenGaleria("ws-1", TOKEN1)).toMatchObject({ ok: true, galeria: { id: "ge", kind: "ENTREGA" } });
  });
  it("la vista trae fotos y videos (el video sin miniatura), todos descargables en alta, sin selección, comentarios ni venta", async () => {
    const r = await P.resolverTokenGaleria("ws-1", TOKEN1);
    if (!r.ok) throw new Error();
    const v = await P.armarVistaGaleria(r);
    expect(v.galeria).toMatchObject({ tipo: "ENTREGA", permiteOriginales: true, permiteDescarga: false, permiteComentarios: false });
    expect(v.venta).toBeNull();
    expect(v.seleccionadas).toEqual([]);
    expect(v.comentarios).toEqual([]);
    expect(v.fotos.map((f) => [f.id, f.tipo, f.thumbUrl])).toEqual([
      ["f1", "FOTO", "https://r2.test/t/f1?firma"],
      ["f2", "FOTO", "https://r2.test/t/f2?firma"],
      ["v1", "VIDEO", null],
    ]);
    expect([...v.originales].sort()).toEqual(["f1", "f2", "v1"]);
    // Lo que no está LISTO ni es de esta galería no aparece.
    expect(JSON.stringify(v)).not.toMatch(/f-pendiente|f-ajena|v-ajeno|f-selec|o\/f1/);
  });
});

describe("reproducir un video", () => {
  it("firma el original (inline, 1 h) del video LISTO y nada más", async () => {
    expect(await P.urlDeReproduccion("ws-1", TOKEN1, "v1")).toEqual({ ok: true, url: "https://r2.test/o/v1?inline" });
    expect(firmarVideo).toHaveBeenCalledWith("o/v1");
  });
  it("una foto, un video pendiente, de otra galería u otra organización o inexistente: 'no encontramos esa foto'", async () => {
    sembrarVideo("v-pend", "ge", { status: "PENDIENTE" });
    for (const id of ["f1", "v-pend", "v-ajeno", "f-ajena", "no-existe", "", 7, null]) {
      expect(await P.urlDeReproduccion("ws-1", TOKEN1, id)).toMatchObject({ ok: false, error: M.fotoInvalida });
    }
    expect(firmarVideo).not.toHaveBeenCalled();
  });
  it("no sirve en una galería de selección, con enlace anulado, galería en borrador ni con otro workspace", async () => {
    sembrarCliente("gcs", "gs");
    sembrarVideo("v-sel", "gs");
    expect(await P.urlDeReproduccion("ws-1", token("gcs"), "v-sel")).toMatchObject({ ok: false, error: M.videoNoDisponible });
    expect(await P.urlDeReproduccion("ws-2", TOKEN1, "v1")).toMatchObject({ ok: false, codigo: "INVALIDO" });
    cliente().revokedAt = new Date();
    expect(await P.urlDeReproduccion("ws-1", TOKEN1, "v1")).toMatchObject({ ok: false, codigo: "INVALIDO" });
    cliente().revokedAt = null;
    galeria().status = "BORRADOR";
    expect(await P.urlDeReproduccion("ws-1", TOKEN1, "v1")).toMatchObject({ ok: false, codigo: "INVALIDO" });
    expect(firmarVideo).not.toHaveBeenCalled();
  });
});

describe("descargar el original de una entrega", () => {
  const descargar = (id: unknown) => P.descargarOriginal("ws-1", TOKEN1, id);
  it("cualquier foto o video LISTO se baja, sin comprar ni elegir, con su nombre", async () => {
    expect(await descargar("f1")).toEqual({ ok: true, url: "https://r2.test/o/f1?original=f1.jpg" });
    expect(await descargar("v1")).toEqual({ ok: true, url: "https://r2.test/o/v1?original=v1.mp4" });
    expect(firmarOriginal).toHaveBeenCalledWith("o/v1", { ascii: "v1.mp4", utf8: "v1.mp4" });
    expect(B.datos.fotofficeGaleriaEvento.filter((e) => e.type === "DESCARGA").map((e) => e.data)).toEqual([{ fotoId: "f1" }, { fotoId: "v1" }]);
  });
  it("el nombre se sanea (sin comillas, barras ni saltos de línea)", async () => {
    sembrarVideo("v-raro", "ge", { fileName: 'Mi "clip"\r\n/../final;1.mov' });
    await descargar("v-raro");
    const nombre = firmarOriginal.mock.calls.at(-1)![1] as { ascii: string; utf8: string };
    expect(nombre.ascii).not.toMatch(/["\\/\r\n;]/);
    expect(nombre.utf8).not.toMatch(/["\\/\r\n;]/);
    expect(nombre.utf8).toMatch(/\.mov$/);
  });
  it("aunque el downloadMode de la entrega sea otro, se baja igual (es una entrega)", async () => {
    galeria().downloadMode = "NINGUNA";
    expect(await descargar("f1")).toMatchObject({ ok: true });
  });
  it("lo pendiente, de otra galería, de otra organización o inexistente: 'no encontramos esa foto' (IDOR)", async () => {
    for (const id of ["f-pendiente", "f-selec", "f-ajena", "v-ajeno", "no-existe", "", 7, null]) {
      expect(await descargar(id)).toMatchObject({ ok: false, error: M.fotoInvalida });
    }
    expect(firmarOriginal).not.toHaveBeenCalled();
  });
  it("el enlace de otra organización, anulado o de una entrega en borrador o archivada no baja nada", async () => {
    expect(await P.descargarOriginal("ws-2", TOKEN1, "f1")).toMatchObject({ ok: false, codigo: "INVALIDO" });
    cliente().revokedAt = new Date();
    expect(await descargar("f1")).toMatchObject({ ok: false, codigo: "INVALIDO" });
    cliente().revokedAt = null;
    for (const estado of ["BORRADOR", "ARCHIVADA"]) {
      galeria().status = estado;
      expect(await descargar("f1")).toMatchObject({ ok: false, codigo: "INVALIDO" });
    }
    expect(firmarOriginal).not.toHaveBeenCalled();
  });
  it("una galería de SELECCIÓN sigue como antes: sin downloadMode SELECCIONADAS no se baja", async () => {
    sembrarCliente("gcs", "gs");
    expect(await P.descargarOriginal("ws-1", token("gcs"), "f-selec")).toMatchObject({ ok: false, error: M.sinDescarga });
  });
  it("la vista liviana no se ofrece en una entrega", async () => {
    expect(await P.urlDeDescarga("ws-1", TOKEN1, "f1")).toMatchObject({ ok: false, error: M.sinDescarga });
  });
});

describe("una entrega no tiene selección, comentarios ni envío", () => {
  it("elegir, comentar y enviar se rechazan y no escriben", async () => {
    expect(await P.elegirFoto("ws-1", TOKEN1, "f1", true)).toMatchObject({ ok: false, error: M.entregaSinSeleccion });
    expect(await P.comentarFoto("ws-1", TOKEN1, "f1", "hola")).toMatchObject({ ok: false, error: M.entregaSinSeleccion });
    expect(await P.enviarSeleccion("ws-1", TOKEN1, "")).toMatchObject({ ok: false, error: M.entregaSinSeleccion });
    expect(B.datos.fotofficeGaleriaSeleccion).toHaveLength(0);
    expect(B.datos.fotofficeGaleriaComentario).toHaveLength(0);
    expect(cliente().status ?? "EN_PROGRESO").toBe("EN_PROGRESO");
  });
});
