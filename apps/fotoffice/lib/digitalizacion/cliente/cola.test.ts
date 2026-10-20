import { describe, expect, it, vi } from "vitest";
import { ColaDeSubida, ErrorDefinitivo, almacenEnMemoria, esperaReintento, idParte, type ParteEnCola } from "./cola";

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
});
