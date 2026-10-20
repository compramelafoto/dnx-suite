import { describe, expect, it, vi } from "vitest";
import { AVISO_SIN_ESPACIO, ColaDeSubida, ErrorDefinitivo, almacenEnMemoria, esperaReintento, idParte, type ParteEnCola } from "./cola";

const parte = (indice: number, grabacionId = "g1"): ParteEnCola => ({ id: idParte(grabacionId, 1, indice), grabacionId, tramo: 1, indice, datos: new Blob([new Uint8Array(10)]) });
const sinEspera = async () => {};

describe("ColaDeSubida", () => {
  it("la espera crece y tiene techo", () => {
    expect([0, 1, 2, 5, 10].map(esperaReintento)).toEqual([2000, 4000, 8000, 60000, 60000]);
  });
  it("sube todo, reintenta lo que falla y borra lo subido del almacén", async () => {
    const almacen = almacenEnMemoria();
    let fallas = 2;
    const subir = vi.fn(async (p: ParteEnCola) => { if (p.indice === 1 && fallas-- > 0) throw new Error("sin red"); });
    const cola = new ColaDeSubida(almacen, subir, { dormir: sinEspera });
    await Promise.all([0, 1, 2].map((i) => cola.agregar(parte(i))));
    await cola.vaciada();
    expect(subir).toHaveBeenCalledTimes(5);
    expect(await almacen.pendientes()).toEqual([]);
    expect(cola.resumen()).toMatchObject({ pendientes: 0, bytesPendientes: 0 });
  });
  it("nunca sube más de 2 a la vez", async () => {
    let enVuelo = 0, maximo = 0;
    const subir = async () => { enVuelo++; maximo = Math.max(maximo, enVuelo); await new Promise((r) => setTimeout(r, 5)); enVuelo--; };
    const cola = new ColaDeSubida(almacenEnMemoria(), subir, { dormir: sinEspera });
    await Promise.all([0, 1, 2, 3, 4].map((i) => cola.agregar(parte(i))));
    await cola.vaciada();
    expect(maximo).toBe(2);
  });
  it("un error definitivo descarta la parte en vez de reintentar para siempre", async () => {
    const almacen = almacenEnMemoria();
    const cola = new ColaDeSubida(almacen, async () => { throw new ErrorDefinitivo("cerrada"); }, { dormir: sinEspera });
    await cola.agregar(parte(0));
    await cola.vaciada();
    expect(await almacen.pendientes()).toEqual([]);
    expect(cola.resumen().descartadas).toBe(1);
  });
  it("reanudar sube primero lo que quedó guardado, en orden", async () => {
    const almacen = almacenEnMemoria();
    await almacen.guardar(parte(1));
    await almacen.guardar(parte(0));
    const orden: number[] = [];
    const cola = new ColaDeSubida(almacen, async (p) => { orden.push(p.indice); }, { dormir: sinEspera, concurrencia: 1 });
    await cola.reanudar();
    await cola.vaciada();
    expect(orden).toEqual([0, 1]);
  });
  it("si el almacén rechaza guardar, la parte igual se sube desde la memoria", async () => {
    const almacen = almacenEnMemoria();
    almacen.guardar = vi.fn(async () => { throw new DOMException("cuota", "QuotaExceededError"); });
    const avisos: (string | null)[] = [];
    const subir = vi.fn(async () => {});
    const cola = new ColaDeSubida(almacen, subir, { dormir: sinEspera, alCambiar: (r) => avisos.push(r.ultimoError) });
    await expect(cola.agregar(parte(0))).resolves.toBeUndefined();
    await cola.vaciada();
    expect(subir).toHaveBeenCalledTimes(1);
    expect(avisos).toContain(AVISO_SIN_ESPACIO);
    expect(cola.resumen()).toMatchObject({ pendientes: 0 });
  });
  it("si el almacén rechaza borrar, vaciada() aún se resuelve y pendientes es 0", async () => {
    const almacen = almacenEnMemoria();
    almacen.borrar = vi.fn(async () => { throw new Error("sin cuota"); });
    const cola = new ColaDeSubida(almacen, async () => {}, { dormir: sinEspera });
    await cola.agregar(parte(0));
    await cola.vaciada();
    expect(cola.resumen()).toMatchObject({ pendientes: 0 });
    expect(cola.resumen().ultimoError).toContain("sin cuota");
  });
  it("reanudar ordena numéricamente por grabacionId, tramo, indice (tramos 2 y 10)", async () => {
    const almacen = almacenEnMemoria();
    const p10 = { id: idParte("g1", 10, 0), grabacionId: "g1", tramo: 10, indice: 0, datos: new Blob([new Uint8Array(10)]) };
    const p2 = { id: idParte("g1", 2, 0), grabacionId: "g1", tramo: 2, indice: 0, datos: new Blob([new Uint8Array(10)]) };
    await almacen.guardar(p10);
    await almacen.guardar(p2);
    const orden: number[] = [];
    const cola = new ColaDeSubida(almacen, async (p) => { orden.push(p.tramo); }, { dormir: sinEspera, concurrencia: 1 });
    await cola.reanudar();
    await cola.vaciada();
    expect(orden).toEqual([2, 10]);
  });
});
