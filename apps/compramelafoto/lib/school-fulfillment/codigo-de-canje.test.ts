import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { codigoDeCanje, leerCodigoDeCanje, secretoDeEntrega } from "./codigo-de-canje";

describe("código del QR de entrega de los canjes", () => {
  const secreto = "secreto-de-prueba";

  it("ida y vuelta: el código lleva el pedido y se lee igual", () => {
    const codigo = codigoDeCanje(4801, secreto);
    assert.match(codigo, /^c4801\.[A-Za-z0-9_-]{20}$/);
    assert.equal(leerCodigoDeCanje(codigo, secreto), 4801);
    assert.equal(codigoDeCanje(4801, secreto), codigo, "siempre el mismo");
  });

  it("no se puede cambiar el número ni la firma", () => {
    const codigo = codigoDeCanje(4801, secreto);
    assert.equal(leerCodigoDeCanje(codigo.replace("c4801", "c4802"), secreto), null);
    assert.equal(leerCodigoDeCanje(codigo.slice(0, -1) + (codigo.endsWith("A") ? "B" : "A"), secreto), null);
    assert.equal(leerCodigoDeCanje(codigo, "otro-secreto"), null);
  });

  it("los códigos de la tienda escolar (otro formato) no se leen como canje", () => {
    assert.equal(leerCodigoDeCanje("abcDEF123_-xyz", secreto), null);
    assert.equal(leerCodigoDeCanje("c0.abc", secreto), null);
  });

  it("sin secreto configurado no hay códigos", () => {
    assert.equal(secretoDeEntrega({} as NodeJS.ProcessEnv), null);
    assert.equal(secretoDeEntrega({ CRON_SECRET: "x" } as NodeJS.ProcessEnv), "x");
  });
});
