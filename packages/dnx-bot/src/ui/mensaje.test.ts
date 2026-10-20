import { describe, expect, it } from "vitest";
import { applySseEvent } from "./items";
import { claveMensajePrecargado, guardarMensajePrecargado, parseTarjetaMensaje, tomarMensajePrecargado, type AlmacenMensajes } from "./mensaje";

const T = {
  destino: { tipo: "PRESUPUESTO", id: "p1", ruta: "/presupuestos/p1" },
  canal: "WHATSAPP",
  cuerpo: "¡Hola [nombre]! [presupuesto_enlace]",
  avisos: [],
};

function almacen(): AlmacenMensajes & { datos: Map<string, string> } {
  const datos = new Map<string, string>();
  return { datos, getItem: (k) => datos.get(k) ?? null, setItem: (k, v) => void datos.set(k, v), removeItem: (k) => void datos.delete(k) };
}

describe("parseTarjetaMensaje", () => {
  it("acepta la tarjeta del servidor", () => {
    expect(parseTarjetaMensaje(T)).toEqual({ ...T, asunto: null });
  });
  it("sólo rutas de presupuestos o consultas del panel (nada de otra dirección)", () => {
    for (const ruta of ["https://malo.com/x", "//malo.com", "/presupuestos/../admin", "/socios/1", "javascript:alert(1)"]) {
      expect(parseTarjetaMensaje({ ...T, destino: { ...T.destino, ruta } })).toBeNull();
    }
    expect(parseTarjetaMensaje({ ...T, destino: { tipo: "CONSULTA", id: "l1", ruta: "/consultas/l1" } })).not.toBeNull();
  });
  it("canal o cuerpo inválidos → null", () => {
    expect(parseTarjetaMensaje({ ...T, canal: "SMS" })).toBeNull();
    expect(parseTarjetaMensaje({ ...T, cuerpo: "" })).toBeNull();
    expect(parseTarjetaMensaje(null)).toBeNull();
  });
});

describe("precarga por sessionStorage (nunca por la URL)", () => {
  it("guardar y tomar: se lee una sola vez", () => {
    const a = almacen();
    guardarMensajePrecargado(a, { tipo: "PRESUPUESTO", id: "p1" }, { canal: "EMAIL", asunto: "Tu presupuesto", cuerpo: "Hola [nombre]" });
    expect(a.datos.has(claveMensajePrecargado("PRESUPUESTO", "p1"))).toBe(true);
    expect(tomarMensajePrecargado(a, "PRESUPUESTO", "p1")).toEqual({ canal: "EMAIL", asunto: "Tu presupuesto", cuerpo: "Hola [nombre]" });
    expect(tomarMensajePrecargado(a, "PRESUPUESTO", "p1")).toBeNull();
  });
  it("es por destino: otro presupuesto no lo ve; algo roto se descarta", () => {
    const a = almacen();
    guardarMensajePrecargado(a, { tipo: "PRESUPUESTO", id: "p1" }, { canal: "WHATSAPP", asunto: null, cuerpo: "x" });
    expect(tomarMensajePrecargado(a, "PRESUPUESTO", "p2")).toBeNull();
    a.setItem(claveMensajePrecargado("CONSULTA", "l1"), "{roto");
    expect(tomarMensajePrecargado(a, "CONSULTA", "l1")).toBeNull();
    expect(a.datos.has(claveMensajePrecargado("CONSULTA", "l1"))).toBe(false);
  });
  it("sin almacén (navegador que lo bloquea) no rompe", () => {
    expect(tomarMensajePrecargado(null, "PRESUPUESTO", "p1")).toBeNull();
    expect(() => guardarMensajePrecargado(null, { tipo: "PRESUPUESTO", id: "p1" }, { canal: "EMAIL", asunto: null, cuerpo: "x" })).not.toThrow();
  });
});

describe("evento mensaje", () => {
  it("agrega la tarjeta y un bot vacío", () => {
    expect(applySseEvent([], "mensaje", T).map((i) => i.kind)).toEqual(["mensaje", "bot"]);
    expect(applySseEvent([], "mensaje", { ...T, canal: "x" })).toEqual([]);
  });
});
