import { describe, expect, it } from "vitest";
import { datoDeBotonVendedor, leerBotonVendedor, tecladoModelo, tecladoRespuesta, type AccionVendedor } from "./botones";

const ID = "cmh7x2k9a0001qz8w3e5r6t7y";

describe("botones del Vendedor", () => {
  it("ve: ida y vuelta para las 5 acciones", () => {
    const acciones: AccionVendedor[] = ["APROBAR", "CORREGIR", "DESCARTAR", "ENVIAR", "YO"];
    const letras = acciones.map((a) => datoDeBotonVendedor(a, ID).split(":")[1]);
    expect(letras).toEqual(["a", "c", "d", "e", "y"]);
    for (const a of acciones) expect(leerBotonVendedor(datoDeBotonVendedor(a, ID))).toEqual({ accion: a, id: ID });
  });

  it("un pe: no es del Vendedor", () => {
    expect(leerBotonVendedor(`pe:p:${ID}`)).toBeNull();
    expect(leerBotonVendedor(`ve:x:${ID}`)).toBeNull();
    expect(leerBotonVendedor("ve:a:corto")).toBeNull();
    expect(leerBotonVendedor(`ve:a:${ID}:extra`)).toBeNull();
  });

  it("entra en los 64 bytes con un cuid", () => {
    const dato = datoDeBotonVendedor("DESCARTAR", ID);
    expect(Buffer.byteLength(dato, "utf8")).toBeLessThanOrEqual(64);
    expect(Buffer.byteLength(datoDeBotonVendedor("YO", "x".repeat(40)), "utf8")).toBeLessThanOrEqual(64);
  });

  it("teclado del modelo: Aprobar, Corregir y Descartar", () => {
    const datos = tecladoModelo(ID).inline_keyboard.flat().map((b) => ("callback_data" in b ? b.callback_data : ""));
    expect(datos).toEqual([`ve:a:${ID}`, `ve:c:${ID}`, `ve:d:${ID}`]);
  });

  it("teclado de una respuesta: con propuesta tres botones, sin propuesta sólo «Lo contesto yo»", () => {
    const con = tecladoRespuesta(ID, { conPropuesta: true }).inline_keyboard.flat();
    expect(con.map((b) => ("callback_data" in b ? b.callback_data : ""))).toEqual([`ve:e:${ID}`, `ve:c:${ID}`, `ve:y:${ID}`]);
    const sin = tecladoRespuesta(ID, { conPropuesta: false }).inline_keyboard.flat();
    expect(sin).toHaveLength(1);
    expect(sin[0]!.text).toMatch(/Lo contesto yo/);
    expect("callback_data" in sin[0]! && sin[0].callback_data).toBe(`ve:y:${ID}`);
  });
});
