import { describe, expect, it } from "vitest";
import { estadoVisible, validarCierre, validarLatido, validarNuevaGrabacion, validarPedidoParte } from "./validar";
import { cortesDeArchivo } from "./dvd";

const ahora = new Date("2026-11-01T15:00:00Z");
const hace = (s: number) => new Date(ahora.getTime() - s * 1000);

describe("estado visible", () => {
  it("una grabación sin latido hace más de 3 minutos está interrumpida", () => {
    expect(estadoVisible({ estado: "GRABANDO", ultimoLatidoAt: hace(181), iniciadaAt: hace(900) }, ahora)).toBe("INTERRUMPIDA");
    expect(estadoVisible({ estado: "GRABANDO", ultimoLatidoAt: hace(60), iniciadaAt: hace(900) }, ahora)).toBe("GRABANDO");
    expect(estadoVisible({ estado: "GRABANDO", ultimoLatidoAt: null, iniciadaAt: hace(200) }, ahora)).toBe("INTERRUMPIDA");
    expect(estadoVisible({ estado: "COMPLETA", ultimoLatidoAt: hace(9999), iniciadaAt: hace(9999) }, ahora)).toBe("COMPLETA");
  });
});

describe("validaciones", () => {
  it("nueva grabación de VHS y de DVD", () => {
    expect(validarNuevaGrabacion({ tipo: "VHS", proyectoId: "p1", cassetteNumero: 2, calidad: "MEDIA", mimeType: "video/webm;codecs=vp9,opus", corregirProporcion: true, equipoId: null, dvdArchivos: null }))
      .toMatchObject({ tipo: "VHS", cassetteNumero: 2 });
    expect(validarNuevaGrabacion({ tipo: "DVD", proyectoId: null, cassetteNumero: null, calidad: null, mimeType: "video/dvd", corregirProporcion: false, equipoId: null, dvdArchivos: [{ nombre: "VTS_01_1.VOB", bytes: 1000 }] }))
      .toMatchObject({ tipo: "DVD" });
    expect(validarNuevaGrabacion({ tipo: "VHS", proyectoId: "p1", cassetteNumero: 1, calidad: "ULTRA", mimeType: "video/webm", corregirProporcion: false, equipoId: null, dvdArchivos: null })).toBeNull();
    expect(validarNuevaGrabacion({ tipo: "VHS", proyectoId: "../x", cassetteNumero: 1, calidad: "MEDIA", mimeType: "video/webm", corregirProporcion: false, equipoId: null, dvdArchivos: null })).toBeNull();
    expect(validarNuevaGrabacion({ tipo: "DVD", proyectoId: null, cassetteNumero: null, calidad: null, mimeType: "video/dvd", corregirProporcion: false, equipoId: null, dvdArchivos: [] })).toBeNull();
  });
  it("pedido de parte", () => {
    expect(validarPedidoParte({ grabacionId: "g1", tramo: 1, indice: 0, bytes: 1000 })).toEqual({ grabacionId: "g1", tramo: 1, indice: 0, bytes: 1000 });
    expect(validarPedidoParte({ grabacionId: "g1", tramo: 1, indice: 0, bytes: 0 })).toBeNull();
    expect(validarPedidoParte({ grabacionId: "g1", tramo: 1, indice: 0, bytes: 65 * 1024 * 1024 })).toBeNull();
  });
  it("latido y cierre", () => {
    const latido = { tramo: 1, duracionSeg: 120, primeraImagenSeg: 3, ultimaImagenSeg: 119, sinImagen: false, tramosSinSenal: [{ tramo: 1, desde: 0, hasta: 2, clase: "NEGRO" }] };
    expect(validarLatido(latido)).toEqual(latido);
    expect(validarLatido({ ...latido, tramosSinSenal: [{ tramo: 1, desde: 5, hasta: 2, clase: "NEGRO" }] })).toBeNull();
    expect(validarLatido({ ...latido, tramosSinSenal: [{ tramo: 1, desde: 0, hasta: 2, clase: "ROJO" }] })).toBeNull();
    expect(validarCierre({ ...latido, motivoFin: "SIN_SENAL" })).toMatchObject({ motivoFin: "SIN_SENAL" });
    expect(validarCierre({ ...latido, motivoFin: "TERMINADA_CON_LO_GRABADO" })).toBeNull();
  });
  it("rechaza nombres de la cadena de prototipos y tipos incompatibles", () => {
    // VHS con calidad "constructor" (nombre del prototipo)
    expect(validarNuevaGrabacion({ tipo: "VHS", proyectoId: "p1", cassetteNumero: 1, calidad: "constructor", mimeType: "video/webm", corregirProporcion: false, equipoId: null, dvdArchivos: null })).toBeNull();
    // VHS con mimeType incorrecto; DVD con mimeType incorrecto
    expect(validarNuevaGrabacion({ tipo: "VHS", proyectoId: "p1", cassetteNumero: 1, calidad: "MEDIA", mimeType: "video/dvd", corregirProporcion: false, equipoId: null, dvdArchivos: null })).toBeNull();
    expect(validarNuevaGrabacion({ tipo: "DVD", proyectoId: null, cassetteNumero: null, calidad: null, mimeType: "video/mp4;codecs=avc1", corregirProporcion: false, equipoId: null, dvdArchivos: [{ nombre: "VTS_01_1.VOB", bytes: 1000 }] })).toBeNull();
    // DVD con calidad no nula; VHS con dvdArchivos
    expect(validarNuevaGrabacion({ tipo: "DVD", proyectoId: null, cassetteNumero: null, calidad: "MEDIA", mimeType: "video/dvd", corregirProporcion: false, equipoId: null, dvdArchivos: [{ nombre: "VTS_01_1.VOB", bytes: 1000 }] })).toBeNull();
    expect(validarNuevaGrabacion({ tipo: "VHS", proyectoId: "p1", cassetteNumero: 1, calidad: "MEDIA", mimeType: "video/webm", corregirProporcion: false, equipoId: null, dvdArchivos: [{ nombre: "VTS_01_1.VOB", bytes: 10 }] })).toBeNull();
    // DVD con nombres inválidos
    expect(validarNuevaGrabacion({ tipo: "DVD", proyectoId: null, cassetteNumero: null, calidad: null, mimeType: "video/dvd", corregirProporcion: false, equipoId: null, dvdArchivos: [{ nombre: "../VTS_01_1.VOB", bytes: 1000 }] })).toBeNull();
    expect(validarNuevaGrabacion({ tipo: "DVD", proyectoId: null, cassetteNumero: null, calidad: null, mimeType: "video/dvd", corregirProporcion: false, equipoId: null, dvdArchivos: [{ nombre: "VTS_01_0.VOB", bytes: 1000 }] })).toBeNull();
  });
  it("rechaza valores inválidos en pedidoParte", () => {
    // tramo: 1.5 (no entero)
    expect(validarPedidoParte({ grabacionId: "g1", tramo: 1.5, indice: 0, bytes: 1000 })).toBeNull();
    // indice: -1 (negativo)
    expect(validarPedidoParte({ grabacionId: "g1", tramo: 1, indice: -1, bytes: 1000 })).toBeNull();
    // bytes: NaN
    expect(validarPedidoParte({ grabacionId: "g1", tramo: 1, indice: 0, bytes: NaN })).toBeNull();
  });
  it("estadoVisible con 180 s exactos retorna GRABANDO", () => {
    expect(estadoVisible({ estado: "GRABANDO", ultimoLatidoAt: hace(180), iniciadaAt: hace(900) }, ahora)).toBe("GRABANDO");
  });
  it("cortesDeArchivo retorna vacío con parámetros inválidos", () => {
    expect(cortesDeArchivo(Infinity)).toEqual([]);
    expect(cortesDeArchivo(NaN)).toEqual([]);
    expect(cortesDeArchivo(100, 1.5)).toEqual([]);
    expect(cortesDeArchivo(100, 0)).toEqual([]);
    expect(cortesDeArchivo(100, -10)).toEqual([]);
  });
});
