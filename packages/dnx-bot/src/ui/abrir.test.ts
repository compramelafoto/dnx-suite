import { describe, expect, it, vi } from "vitest";
import { abrirDnxBot, EVENTO_ABRIR, leerPedidoAbrir } from "./abrir";

describe("leerPedidoAbrir", () => {
  it("texto válido, con contexto de strings", () => {
    expect(leerPedidoAbrir({ texto: " Hola ", contexto: { pantalla: "precios", presupuestoId: "p1" } })).toEqual({
      texto: "Hola",
      contexto: { pantalla: "precios", presupuestoId: "p1" },
    });
  });
  it("sin texto o con cualquier otra cosa → null", () => {
    for (const d of [null, undefined, "hola", 3, {}, { texto: "   " }, { texto: 5 }]) expect(leerPedidoAbrir(d)).toBeNull();
  });
  it("recorta el texto a 2000 y descarta del contexto lo que no es string corto", () => {
    const r = leerPedidoAbrir({ texto: "x".repeat(2500), contexto: { a: "ok", b: 3, c: "y".repeat(101), d: null } });
    expect(r!.texto).toHaveLength(2000);
    expect(r!.contexto).toEqual({ a: "ok" });
  });
  it("contexto vacío o inválido → sin contexto", () => {
    expect(leerPedidoAbrir({ texto: "a", contexto: "x" })).toEqual({ texto: "a" });
    expect(leerPedidoAbrir({ texto: "a", contexto: { b: 1 } })).toEqual({ texto: "a" });
  });
});

describe("abrirDnxBot", () => {
  it("dispara el evento en window con el pedido", () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { dispatchEvent });
    vi.stubGlobal("CustomEvent", class { constructor(public type: string, public init: { detail: unknown }) {} });
    abrirDnxBot({ texto: "Hola", contexto: { pantalla: "precios" } });
    const ev = dispatchEvent.mock.calls[0]![0] as { type: string; init: { detail: unknown } };
    expect(ev.type).toBe(EVENTO_ABRIR);
    expect(ev.init.detail).toEqual({ texto: "Hola", contexto: { pantalla: "precios" } });
    vi.unstubAllGlobals();
  });
});
