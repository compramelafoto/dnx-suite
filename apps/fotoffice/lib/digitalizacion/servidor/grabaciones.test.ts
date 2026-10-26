import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  fotofficeProyecto: { findFirst: vi.fn() },
  digitalizacionGrabacion: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  digitalizacionParte: { findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
  digitalizacionEquipo: { findFirst: vi.fn() },
  digitalizacionAjustes: { upsert: vi.fn(), findUnique: vi.fn() },
  $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(db)),
}));
vi.mock("@repo/db", () => ({ prisma: db, Prisma: { DbNull: "DB_NULL" } }));
const almacen = vi.hoisted(() => ({ urlDeSubidaParte: vi.fn(async () => "https://r2/firmada"), tamanoDeParte: vi.fn(), urlDeLecturaParte: vi.fn(), borrarPrefijo: vi.fn(), urlDeVideo: vi.fn(async () => "https://r2/video") }));
vi.mock("./almacen", () => almacen);
const etapas = vi.hoisted(() => ({ avanzarTrabajos: vi.fn(async () => ({ MOVIDO: 1, SIN_CAMBIO: 0, FALLO: 0 })) }));
vi.mock("./etapas", () => etapas);

import type { NuevaGrabacion } from "../validar";
import { guardarAjustesEntrega, leerAjustes, cerrarGrabacion, confirmarParte, crearGrabacion, descartarGrabacion, pedirParte, registrarLatido, reintentarConversion, terminarConLoGrabado, urlDeVideo, urlsDeLectura, editarTitulo, listarGrabaciones, hlsDeGrabacion } from "./grabaciones";

const ctx = { workspaceId: "ws1", userId: 7 };
const vhs: NuevaGrabacion = { titulo: null, tipo: "VHS", proyectoId: "p1", cassetteNumero: 1, calidad: "MEDIA", mimeType: "video/webm;codecs=vp9,opus", corregirProporcion: false, equipoId: null, dvdArchivos: null };

beforeEach(() => vi.clearAllMocks());

const viejo = { ultimoLatidoAt: new Date(Date.now() - 3600_000), iniciadaAt: new Date(Date.now() - 7200_000) };
const fresco = { ultimoLatidoAt: new Date(), iniciadaAt: new Date(Date.now() - 7200_000) };

describe("crearGrabacion", () => {
  it("rechaza un trabajo de otro negocio", async () => {
    db.fotofficeProyecto.findFirst.mockResolvedValue(null);
    expect(await crearGrabacion(ctx, vhs)).toMatchObject({ ok: false });
    expect(db.fotofficeProyecto.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "p1", workspaceId: "ws1" } }));
    expect(db.digitalizacionGrabacion.create).not.toHaveBeenCalled();
  });
  it("crea la grabación del negocio", async () => {
    db.fotofficeProyecto.findFirst.mockResolvedValue({ id: "p1" });
    db.digitalizacionGrabacion.create.mockResolvedValue({ id: "g1" });
    expect(await crearGrabacion(ctx, vhs)).toEqual({ ok: true, id: "g1", tramo: 1 });
  });
  it("guarda el título", async () => {
    db.fotofficeProyecto.findFirst.mockResolvedValue({ id: "p1" });
    db.digitalizacionGrabacion.create.mockResolvedValue({ id: "g1" });
    await crearGrabacion(ctx, { ...vhs, titulo: "Boda" });
    expect(db.digitalizacionGrabacion.create.mock.calls[0][0].data.titulo).toBe("Boda");
  });
});

describe("editarTitulo", () => {
  it("actualiza sólo dentro del negocio", async () => {
    db.digitalizacionGrabacion.updateMany.mockResolvedValue({ count: 1 });
    expect(await editarTitulo(ctx, "g1", "  Boda  ")).toEqual({ ok: true, titulo: "Boda" });
    expect(db.digitalizacionGrabacion.updateMany).toHaveBeenCalledWith({ where: { id: "g1", workspaceId: "ws1" }, data: { titulo: "Boda" } });
  });
  it("vacío borra el título", async () => {
    db.digitalizacionGrabacion.updateMany.mockResolvedValue({ count: 1 });
    expect(await editarTitulo(ctx, "g1", "  ")).toEqual({ ok: true, titulo: null });
  });
  it("grabación ajena: no existe", async () => {
    db.digitalizacionGrabacion.updateMany.mockResolvedValue({ count: 0 });
    expect(await editarTitulo(ctx, "g1", "x")).toMatchObject({ ok: false, definitivo: true });
  });
  it("rechaza título inválido o id inválido sin tocar la base", async () => {
    db.digitalizacionGrabacion.updateMany.mockClear();
    expect(await editarTitulo(ctx, "g1", "a".repeat(121))).toMatchObject({ ok: false });
    expect(await editarTitulo(ctx, "g1", 5)).toMatchObject({ ok: false });
    expect(await editarTitulo(ctx, "../x", "ok")).toMatchObject({ ok: false });
    expect(db.digitalizacionGrabacion.updateMany).not.toHaveBeenCalled();
  });
});

describe("listarGrabaciones", () => {
  it("pide título, número de pedido y cliente, del negocio", async () => {
    db.digitalizacionGrabacion.findMany.mockResolvedValue([]);
    await listarGrabaciones("ws1");
    const arg = db.digitalizacionGrabacion.findMany.mock.calls[0][0];
    expect(arg.where.workspaceId).toBe("ws1");
    expect(arg.select.titulo).toBe(true);
    expect(arg.select.proyecto.select.pedido).toEqual({ select: { number: true } });
    expect(arg.select.proyecto.select.client.select.businessName).toBe(true);
  });
});

describe("pedirParte", () => {
  it("no firma partes de una grabación ajena", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue(null);
    expect(await pedirParte(ctx, { grabacionId: "g1", tramo: 1, indice: 0, bytes: 10 })).toMatchObject({ ok: false, definitivo: true });
  });
  it("una parte ya LISTA no se vuelve a subir", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ id: "g1", workspaceId: "ws1", estado: "GRABANDO", mimeType: "video/webm", tramos: 1 });
    db.digitalizacionParte.findUnique.mockResolvedValue({ estado: "LISTA" });
    expect(await pedirParte(ctx, { grabacionId: "g1", tramo: 1, indice: 3, bytes: 10 })).toEqual({ ok: true, yaEstaba: true });
    expect(almacen.urlDeSubidaParte).not.toHaveBeenCalled();
  });
  it("firma la clave armada por el servidor", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ id: "g1", workspaceId: "ws1", estado: "GRABANDO", mimeType: "video/webm", tramos: 1 });
    db.digitalizacionParte.findUnique.mockResolvedValue(null);
    expect(await pedirParte(ctx, { grabacionId: "g1", tramo: 1, indice: 3, bytes: 10 })).toEqual({ ok: true, yaEstaba: false, url: "https://r2/firmada", tipoContenido: "video/webm" });
    expect(almacen.urlDeSubidaParte).toHaveBeenCalledWith("digitalizacion/ws1/g1/t1/000003.webm", "video/webm", 10);
  });
  it("no acepta un tramo que todavía no existe", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ id: "g1", workspaceId: "ws1", estado: "GRABANDO", mimeType: "video/webm", tramos: 1 });
    expect(await pedirParte(ctx, { grabacionId: "g1", tramo: 2, indice: 0, bytes: 10 })).toMatchObject({ ok: false, definitivo: true });
  });
});

describe("confirmarParte", () => {
  it("cuenta los bytes una sola vez aunque se confirme dos veces", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ id: "g1", workspaceId: "ws1", estado: "GRABANDO", mimeType: "video/webm", tramos: 1 });
    db.digitalizacionParte.findUnique.mockResolvedValue({ id: "pa1", key: "digitalizacion/ws1/g1/t1/000000.webm", bytes: BigInt(10), estado: "PENDIENTE" });
    almacen.tamanoDeParte.mockResolvedValue(10);
    db.digitalizacionParte.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    await confirmarParte(ctx, { grabacionId: "g1", tramo: 1, indice: 0 });
    await confirmarParte(ctx, { grabacionId: "g1", tramo: 1, indice: 0 });
    expect(db.digitalizacionGrabacion.update).toHaveBeenCalledTimes(1);
  });
  it("si el tamaño en R2 no coincide, no la confirma", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ id: "g1", workspaceId: "ws1", estado: "GRABANDO", mimeType: "video/webm", tramos: 1 });
    db.digitalizacionParte.findUnique.mockResolvedValue({ id: "pa1", key: "k", bytes: BigInt(10), estado: "PENDIENTE" });
    almacen.tamanoDeParte.mockResolvedValue(4);
    expect(await confirmarParte(ctx, { grabacionId: "g1", tramo: 1, indice: 0 })).toMatchObject({ ok: false });
  });
});

describe("descartarGrabacion", () => {
  it("si falla el borrado en R2, no la marca DESCARTADA y devuelve error", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ id: "g1", workspaceId: "ws1", estado: "GRABANDO", mimeType: "video/webm", tramos: 1, ...viejo });
    almacen.borrarPrefijo.mockRejectedValue(new Error("r2 caído"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await descartarGrabacion(ctx, "g1")).toEqual({ ok: false, error: "No pudimos borrar los archivos. Probá de nuevo." });
    expect(db.digitalizacionGrabacion.update).not.toHaveBeenCalled();
    spy.mockRestore();
  });
  it("tras borrar bien, la marca DESCARTADA", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ id: "g1", workspaceId: "ws1", estado: "GRABANDO", mimeType: "video/webm", tramos: 1, ...viejo });
    almacen.borrarPrefijo.mockResolvedValue(undefined);
    expect(await descartarGrabacion(ctx, "g1")).toEqual({ ok: true });
    expect(db.digitalizacionGrabacion.update).toHaveBeenCalledTimes(1);
  });
});

describe("descartarGrabacion y la conversión", () => {
  it("se niega mientras el worker la está convirtiendo", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ id: "g1", workspaceId: "ws1", estado: "COMPLETA", mimeType: "video/webm", tramos: 1, conversionEstado: "PROCESANDO", ...viejo });
    expect(await descartarGrabacion(ctx, "g1")).toEqual({ ok: false, error: "La grabación se está convirtiendo." });
    expect(almacen.borrarPrefijo).not.toHaveBeenCalled();
    expect(db.digitalizacionGrabacion.update).not.toHaveBeenCalled();
  });
  it("al descartar limpia conversionEstado", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ id: "g1", workspaceId: "ws1", estado: "COMPLETA", mimeType: "video/webm", tramos: 1, conversionEstado: "PENDIENTE", ...viejo });
    almacen.borrarPrefijo.mockResolvedValue(undefined);
    await descartarGrabacion(ctx, "g1");
    expect(db.digitalizacionGrabacion.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ estado: "DESCARTADA", conversionEstado: null }) }),
    );
  });
});

describe("pedirParte repetido", () => {
  it("renueva createdAt al volver a pedir una parte PENDIENTE", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ id: "g1", workspaceId: "ws1", estado: "GRABANDO", mimeType: "video/webm", tramos: 1, ...fresco });
    db.digitalizacionParte.findUnique.mockResolvedValue({ estado: "PENDIENTE" });
    await pedirParte(ctx, { grabacionId: "g1", tramo: 1, indice: 0, bytes: 10 });
    const arg = db.digitalizacionParte.upsert.mock.calls.at(-1)![0];
    expect(arg.update.createdAt).toBeInstanceOf(Date);
  });
});

describe("descartarGrabacion con latido fresco", () => {
  it("se niega si la grabación sigue en curso", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ id: "g1", workspaceId: "ws1", estado: "GRABANDO", mimeType: "video/webm", tramos: 1, ...fresco });
    expect(await descartarGrabacion(ctx, "g1")).toEqual({ ok: false, error: "La grabación sigue en curso." });
    expect(almacen.borrarPrefijo).not.toHaveBeenCalled();
    expect(db.digitalizacionGrabacion.update).not.toHaveBeenCalled();
  });
});

describe("partes tras terminar con lo grabado", () => {
  const completa = { id: "g1", workspaceId: "ws1", estado: "COMPLETA", mimeType: "video/webm", tramos: 2, ...viejo };
  it("pedirParte acepta una COMPLETA si el tramo existe", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue(completa);
    db.digitalizacionParte.findUnique.mockResolvedValue(null);
    expect(await pedirParte(ctx, { grabacionId: "g1", tramo: 2, indice: 4, bytes: 10 })).toMatchObject({ ok: true, yaEstaba: false });
  });
  it("pedirParte rechaza un tramo inexistente o una DESCARTADA", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue(completa);
    expect(await pedirParte(ctx, { grabacionId: "g1", tramo: 3, indice: 0, bytes: 10 })).toMatchObject({ ok: false, definitivo: true });
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ ...completa, estado: "DESCARTADA" });
    expect(await pedirParte(ctx, { grabacionId: "g1", tramo: 1, indice: 0, bytes: 10 })).toMatchObject({ ok: false, definitivo: true });
  });
  it("pedirParte sigue salteando las LISTAS en una COMPLETA", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue(completa);
    db.digitalizacionParte.findUnique.mockResolvedValue({ estado: "LISTA" });
    expect(await pedirParte(ctx, { grabacionId: "g1", tramo: 1, indice: 0, bytes: 10 })).toEqual({ ok: true, yaEstaba: true });
  });
  it("confirmarParte acepta una COMPLETA y rechaza una DESCARTADA", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue(completa);
    db.digitalizacionParte.findUnique.mockResolvedValue({ id: "pa1", key: "k", bytes: BigInt(10), estado: "PENDIENTE" });
    almacen.tamanoDeParte.mockResolvedValue(10);
    db.digitalizacionParte.updateMany.mockResolvedValue({ count: 1 });
    expect(await confirmarParte(ctx, { grabacionId: "g1", tramo: 2, indice: 4 })).toEqual({ ok: true });
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ ...completa, estado: "DESCARTADA" });
    expect(await confirmarParte(ctx, { grabacionId: "g1", tramo: 2, indice: 4 })).toMatchObject({ ok: false, definitivo: true });
  });
});

describe("urlsDeLectura", () => {
  it("rechaza una DESCARTADA", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ id: "g1", workspaceId: "ws1", estado: "DESCARTADA", mimeType: "video/webm", tramos: 1, ...viejo });
    expect(await urlsDeLectura(ctx, "g1")).toMatchObject({ ok: false });
  });
});

describe("urlsDeLectura nombre", () => {
  it("usa pedido, cliente y la extensión de la grabación (vob en DVD)", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ id: "g1", workspaceId: "ws1", estado: "COMPLETA", tipo: "DVD", mimeType: "video/dvd", tramos: 1, proyectoId: "p1", titulo: null, cassetteNumero: null, partesBorradasAt: null });
    db.fotofficeProyecto.findFirst.mockResolvedValue({ pedido: { number: "8" }, client: { firstName: null, lastName: null, businessName: "Foto SA" } });
    db.digitalizacionParte.findMany.mockResolvedValue([]);
    expect(await urlsDeLectura(ctx, "g1")).toMatchObject({ ok: true, nombre: "Pedido 8 - Foto SA - DVD.vob" });
  });
});

describe("registrarLatido entre tramos", () => {
  it("acumula la duración de los tramos anteriores y combina sinImagen", async () => {
    db.digitalizacionGrabacion.findFirst
      .mockResolvedValueOnce({ id: "g1", workspaceId: "ws1", estado: "GRABANDO", mimeType: "video/webm", tramos: 2, ...fresco })
      .mockResolvedValueOnce({ tramosSinSenal: [{ tramo: 1, desde: 0, hasta: 600, clase: "DURACION" }], sinImagen: false });
    await registrarLatido(ctx, "g1", { tramo: 2, duracionSeg: 100, primeraImagenSeg: null, ultimaImagenSeg: null, sinImagen: true, tramosSinSenal: [] });
    const data = db.digitalizacionGrabacion.update.mock.calls[0][0].data;
    expect(data.duracionSeg).toBe(700);
    expect(data.sinImagen).toBe(false);
  });
});

describe("terminarConLoGrabado", () => {
  it("se niega si la grabación sigue en curso", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ id: "g1", workspaceId: "ws1", estado: "GRABANDO", mimeType: "video/webm", tramos: 1, ...fresco });
    expect(await terminarConLoGrabado(ctx, "g1")).toEqual({ ok: false, error: "La grabación sigue en curso." });
    expect(db.digitalizacionGrabacion.updateMany).not.toHaveBeenCalled();
  });
  it("cierra una interrumpida", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ id: "g1", workspaceId: "ws1", estado: "GRABANDO", mimeType: "video/webm", tramos: 1, ...viejo });
    db.digitalizacionGrabacion.updateMany.mockResolvedValue({ count: 1 });
    expect(await terminarConLoGrabado(ctx, "g1")).toEqual({ ok: true });
  });
  it("rechaza un id inválido sin tocar la base", async () => {
    expect(await terminarConLoGrabado(ctx, "../x")).toMatchObject({ ok: false, definitivo: true });
    expect(db.digitalizacionGrabacion.updateMany).not.toHaveBeenCalled();
  });
});

describe("cola de conversión al cerrar", () => {
  const abierta = { id: "g1", workspaceId: "ws1", estado: "GRABANDO", mimeType: "video/webm", tramos: 1, tipo: "VHS", ...fresco };
  const cierre = { tramo: 1, duracionSeg: 100, primeraImagenSeg: null, ultimaImagenSeg: null, sinImagen: false, tramosSinSenal: [], motivoFin: "MANUAL" as const };
  it("cerrarGrabacion VHS sin imagen queda SIN_IMAGEN", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValueOnce(abierta).mockResolvedValueOnce({ tramosSinSenal: [], sinImagen: true });
    await cerrarGrabacion(ctx, "g1", { ...cierre, sinImagen: true });
    expect(db.digitalizacionGrabacion.update.mock.calls[0][0].data.conversionEstado).toBe("SIN_IMAGEN");
  });
  it("cerrarGrabacion con imagen queda PENDIENTE", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValueOnce(abierta).mockResolvedValueOnce({ tramosSinSenal: [], sinImagen: false });
    await cerrarGrabacion(ctx, "g1", cierre);
    expect(db.digitalizacionGrabacion.update.mock.calls[0][0].data.conversionEstado).toBe("PENDIENTE");
  });
  it("cerrarGrabacion de un DVD queda PENDIENTE aunque sinImagen sea true", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValueOnce({ ...abierta, tipo: "DVD" }).mockResolvedValueOnce({ tramosSinSenal: [], sinImagen: true });
    await cerrarGrabacion(ctx, "g1", { ...cierre, sinImagen: true });
    expect(db.digitalizacionGrabacion.update.mock.calls[0][0].data.conversionEstado).toBe("PENDIENTE");
  });
  it("terminarConLoGrabado de un VHS sin imagen queda SIN_IMAGEN", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ ...abierta, ...viejo, sinImagen: true });
    db.digitalizacionGrabacion.updateMany.mockResolvedValue({ count: 1 });
    await terminarConLoGrabado(ctx, "g1");
    expect(db.digitalizacionGrabacion.updateMany.mock.calls[0][0].data.conversionEstado).toBe("SIN_IMAGEN");
  });
  it("terminarConLoGrabado queda PENDIENTE", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ ...abierta, ...viejo });
    db.digitalizacionGrabacion.updateMany.mockResolvedValue({ count: 1 });
    await terminarConLoGrabado(ctx, "g1");
    expect(db.digitalizacionGrabacion.updateMany.mock.calls[0][0].data.conversionEstado).toBe("PENDIENTE");
  });
});

describe("partes tras la conversión", () => {
  const base = { id: "g1", workspaceId: "ws1", estado: "COMPLETA", mimeType: "video/webm", tramos: 1, ...viejo };
  it.each([["PROCESANDO"], ["LISTA"]])("pedirParte rechaza con conversión %s", async (conversionEstado) => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ ...base, conversionEstado, partesBorradasAt: null });
    expect(await pedirParte(ctx, { grabacionId: "g1", tramo: 1, indice: 0, bytes: 10 })).toMatchObject({ ok: false, definitivo: true });
    expect(almacen.urlDeSubidaParte).not.toHaveBeenCalled();
  });
  it("pedirParte y confirmarParte rechazan con partes borradas", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ ...base, conversionEstado: "LISTA", partesBorradasAt: new Date() });
    expect(await pedirParte(ctx, { grabacionId: "g1", tramo: 1, indice: 0, bytes: 10 })).toMatchObject({ ok: false, definitivo: true });
    expect(await confirmarParte(ctx, { grabacionId: "g1", tramo: 1, indice: 0 })).toMatchObject({ ok: false, definitivo: true });
  });
  it("pedirParte sigue aceptando con conversión PENDIENTE", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ ...base, conversionEstado: "PENDIENTE", partesBorradasAt: null });
    db.digitalizacionParte.findUnique.mockResolvedValue(null);
    expect(await pedirParte(ctx, { grabacionId: "g1", tramo: 1, indice: 0, bytes: 10 })).toMatchObject({ ok: true });
  });
  it("urlsDeLectura rechaza con partes borradas", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ ...base, conversionEstado: "LISTA", partesBorradasAt: new Date() });
    expect(await urlsDeLectura(ctx, "g1")).toMatchObject({ ok: false });
    expect(db.digitalizacionParte.findMany).not.toHaveBeenCalled();
  });
});

describe("reintentarConversion", () => {
  it("sólo pasa de ERROR a PENDIENTE, con intentos en 0 y sin error", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ id: "g1", workspaceId: "ws1", estado: "COMPLETA", mimeType: "video/webm", tramos: 1, conversionEstado: "ERROR" });
    db.digitalizacionGrabacion.updateMany.mockResolvedValue({ count: 1 });
    expect(await reintentarConversion(ctx, "g1")).toEqual({ ok: true });
    expect(db.digitalizacionGrabacion.updateMany).toHaveBeenCalledWith({
      where: { id: "g1", workspaceId: "ws1", conversionEstado: "ERROR" },
      data: { conversionEstado: "PENDIENTE", conversionIntentos: 0, conversionError: null, conversionLockAt: null },
    });
  });
  it("si ya no está en ERROR, no hace nada", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ id: "g1", workspaceId: "ws1", estado: "COMPLETA", mimeType: "video/webm", tramos: 1, conversionEstado: "PROCESANDO" });
    db.digitalizacionGrabacion.updateMany.mockResolvedValue({ count: 0 });
    expect(await reintentarConversion(ctx, "g1")).toMatchObject({ ok: false });
  });
});

describe("urlDeVideo", () => {
  const lista = { id: "g1", workspaceId: "ws1", estado: "COMPLETA", mimeType: "video/webm", tramos: 1, cassetteNumero: 3, conversionEstado: "LISTA", videoKey: "digitalizacion/ws1/g1/final.mp4" };
  it("firma el MP4 final cuando está LISTA", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue(lista);
    expect(await urlDeVideo(ctx, "g1", "ver")).toEqual({ ok: true, url: "https://r2/video" });
    expect(almacen.urlDeVideo).toHaveBeenCalledWith("digitalizacion/ws1/g1/final.mp4", "Prueba - Cassette 3.mp4", "ver");
  });
  it("nombra el archivo con pedido, cliente y título", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ ...lista, proyectoId: "p1", titulo: "Boda de Ana" });
    db.fotofficeProyecto.findFirst.mockResolvedValue({ pedido: { number: "77" }, client: { firstName: "Ana", lastName: "Gómez", businessName: null } });
    await urlDeVideo(ctx, "g1", "descargar");
    expect(db.fotofficeProyecto.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "p1", workspaceId: "ws1" } }));
    expect(almacen.urlDeVideo).toHaveBeenCalledWith("digitalizacion/ws1/g1/final.mp4", "Pedido 77 - Ana Gómez - Boda de Ana.mp4", "descargar");
  });
  it("rechaza una videoKey de otro negocio o de otra grabación", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ ...lista, videoKey: "digitalizacion/otro/g1/final.mp4" });
    expect(await urlDeVideo(ctx, "g1", "ver")).toMatchObject({ ok: false });
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ ...lista, videoKey: "digitalizacion/ws1/g2/final.mp4" });
    expect(await urlDeVideo(ctx, "g1", "ver")).toMatchObject({ ok: false });
    expect(almacen.urlDeVideo).not.toHaveBeenCalled();
  });
  it("rechaza si no está LISTA o no tiene videoKey", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ ...lista, conversionEstado: "PROCESANDO" });
    expect(await urlDeVideo(ctx, "g1", "ver")).toMatchObject({ ok: false });
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ ...lista, videoKey: null });
    expect(await urlDeVideo(ctx, "g1", "descargar")).toMatchObject({ ok: false });
    expect(almacen.urlDeVideo).not.toHaveBeenCalled();
  });
});

describe("ajustes de la entrega", () => {
  it("guarda el envío automático y las franjas ordenadas", async () => {
    const r = await guardarAjustesEntrega(ctx, false, [{ hastaKm: 20, precioArs: 8000 }, { hastaKm: 5, precioArs: 3000 }]);
    expect(r).toEqual({ ok: true, franjas: [{ hastaKm: 5, precioArs: 3000 }, { hastaKm: 20, precioArs: 8000 }] });
    const arg = db.digitalizacionAjustes.upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ workspaceId: "ws1" });
    expect(arg.update).toEqual({ envioAutomatico: false, enviosFranjas: [{ hastaKm: 5, precioArs: 3000 }, { hastaKm: 20, precioArs: 8000 }] });
  });
  it("sin franjas guarda null (a coordinar)", async () => {
    await guardarAjustesEntrega(ctx, true, []);
    expect(db.digitalizacionAjustes.upsert.mock.calls[0][0].update).toEqual({ envioAutomatico: true, enviosFranjas: "DB_NULL" });
  });
  it("datos inválidos: no escribe", async () => {
    expect(await guardarAjustesEntrega(ctx, "sí", [])).toMatchObject({ ok: false });
    expect(await guardarAjustesEntrega(ctx, true, [{ hastaKm: -1, precioArs: 1 }])).toMatchObject({ ok: false });
    expect(db.digitalizacionAjustes.upsert).not.toHaveBeenCalled();
  });
  it("leerAjustes: valores por defecto sin fila", async () => {
    db.digitalizacionAjustes.findUnique.mockResolvedValue(null);
    expect(await leerAjustes("ws1")).toEqual({ minutosSinSenal: 5, envioAutomatico: true, franjas: [] });
  });
});

describe("hlsDeGrabacion", () => {
  const lista = { id: "g1", workspaceId: "ws1", conversionEstado: "LISTA", hlsKey: "digitalizacion/ws1/g1/hls", videoBorradoAt: null };
  it("busca sólo en el negocio y devuelve la carpeta HLS", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue(lista);
    expect(await hlsDeGrabacion(ctx, "g1")).toEqual({ ok: true, hlsKey: "digitalizacion/ws1/g1/hls" });
    expect(db.digitalizacionGrabacion.findFirst.mock.calls[0][0].where).toEqual({ id: "g1", workspaceId: "ws1" });
  });
  it("sin HLS, borrada, no LISTA o con una carpeta ajena: no", async () => {
    for (const g of [{ ...lista, hlsKey: null }, { ...lista, videoBorradoAt: new Date() }, { ...lista, conversionEstado: "PROCESANDO" }, { ...lista, hlsKey: "digitalizacion/ws2/g1/hls" }]) {
      db.digitalizacionGrabacion.findFirst.mockResolvedValue(g);
      expect(await hlsDeGrabacion(ctx, "g1")).toMatchObject({ ok: false });
    }
    db.digitalizacionGrabacion.findFirst.mockResolvedValue(null);
    expect(await hlsDeGrabacion(ctx, "g1")).toMatchObject({ ok: false });
  });
});

describe("avance a «Grabado» al terminar la grabación", () => {
  const abierta = { id: "g1", workspaceId: "ws1", estado: "GRABANDO", mimeType: "video/webm", tramos: 1, tipo: "VHS", proyectoId: "p1", ...fresco };
  const cierre = { tramo: 1, duracionSeg: 100, primeraImagenSeg: 3, ultimaImagenSeg: 90, sinImagen: false, tramosSinSenal: [], motivoFin: "MANUAL" as const };

  it("cerrarGrabacion con imagen: guarda COMPLETA y después avanza el trabajo", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValueOnce(abierta).mockResolvedValueOnce({ tramosSinSenal: [], sinImagen: false });
    expect(await cerrarGrabacion(ctx, "g1", cierre)).toEqual({ ok: true });
    expect(etapas.avanzarTrabajos).toHaveBeenCalledWith("ws1", ["p1"], "GRABADO");
    expect(db.digitalizacionGrabacion.update.mock.invocationCallOrder[0]).toBeLessThan(etapas.avanzarTrabajos.mock.invocationCallOrder[0]!);
  });
  it("sin imagen o sin trabajo: no avanza", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValueOnce(abierta).mockResolvedValueOnce({ tramosSinSenal: [], sinImagen: true });
    await cerrarGrabacion(ctx, "g1", { ...cierre, sinImagen: true });
    db.digitalizacionGrabacion.findFirst.mockResolvedValueOnce({ ...abierta, proyectoId: null }).mockResolvedValueOnce({ tramosSinSenal: [], sinImagen: false });
    await cerrarGrabacion(ctx, "g1", cierre);
    expect(etapas.avanzarTrabajos).not.toHaveBeenCalled();
  });
  it("un error en el avance no rompe el cierre", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    etapas.avanzarTrabajos.mockRejectedValueOnce(new Error("motor caído"));
    db.digitalizacionGrabacion.findFirst.mockResolvedValueOnce(abierta).mockResolvedValueOnce({ tramosSinSenal: [], sinImagen: false });
    expect(await cerrarGrabacion(ctx, "g1", cierre)).toEqual({ ok: true });
    expect(db.digitalizacionGrabacion.update.mock.calls[0][0].data.estado).toBe("COMPLETA");
  });
  it("terminarConLoGrabado: avanza si tiene imagen, no si no tiene, y un error no la rompe", async () => {
    db.digitalizacionGrabacion.updateMany.mockResolvedValue({ count: 1 });
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ ...abierta, ...viejo, sinImagen: false });
    expect(await terminarConLoGrabado(ctx, "g1")).toEqual({ ok: true });
    expect(etapas.avanzarTrabajos).toHaveBeenCalledWith("ws1", ["p1"], "GRABADO");
    etapas.avanzarTrabajos.mockClear();
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ ...abierta, ...viejo, sinImagen: true });
    await terminarConLoGrabado(ctx, "g1");
    expect(etapas.avanzarTrabajos).not.toHaveBeenCalled();
    vi.spyOn(console, "error").mockImplementation(() => {});
    etapas.avanzarTrabajos.mockRejectedValueOnce(new Error("motor caído"));
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ ...abierta, ...viejo, sinImagen: false });
    expect(await terminarConLoGrabado(ctx, "g1")).toEqual({ ok: true });
  });
  it("terminarConLoGrabado que no cerró nada no avanza", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ ...abierta, ...viejo, sinImagen: false });
    db.digitalizacionGrabacion.updateMany.mockResolvedValue({ count: 0 });
    expect(await terminarConLoGrabado(ctx, "g1")).toMatchObject({ ok: false });
    expect(etapas.avanzarTrabajos).not.toHaveBeenCalled();
  });
});
