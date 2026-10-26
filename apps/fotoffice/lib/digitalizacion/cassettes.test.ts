import { describe, expect, it } from "vitest";
import {
  cassettesEsperados, confirmacionEnvioIncompleto, contarPedido, contarTrabajo, cuentasDeTrabajos, cumpleGrabado, estaHecha, textoDeCassettes,
  textoFaltanCassettes, trabajoCompleto,
} from "./cassettes";
import { envioAutomaticoDesde } from "./entrega";

const lista = { estado: "COMPLETA", conversionEstado: "LISTA", sinImagen: false };
const convirtiendo = { estado: "COMPLETA", conversionEstado: "PROCESANDO", sinImagen: false };
const enCola = { estado: "COMPLETA", conversionEstado: "PENDIENTE", sinImagen: false };
const sinImagen = { estado: "COMPLETA", conversionEstado: "SIN_IMAGEN", sinImagen: true };
const grabando = { estado: "GRABANDO", conversionEstado: null, sinImagen: false };
const descartada = { estado: "DESCARTADA", conversionEstado: "LISTA", sinImagen: false };
const conError = { estado: "COMPLETA", conversionEstado: "ERROR", sinImagen: false };
/** El pedido 2026-0006 de Liliana: «Digitalización de VHS» × 2 en `items[0]`. */
const LILIANA = [{ id: "i0", nombre: "Digitalización de VHS", cantidad: 2, precioUnitario: 15000 }];

describe("cassettesEsperados", () => {
  it("la cantidad del ítem del trabajo", () => {
    expect(cassettesEsperados(LILIANA, 0)).toBe(2);
    expect(cassettesEsperados([{ nombre: "Pasar DVD a pendrive", cantidad: 1 }], 0)).toBe(1);
  });
  it("sin índice, sin ítem o sin items: desconocido", () => {
    expect(cassettesEsperados(LILIANA, null)).toBeNull();
    expect(cassettesEsperados(LILIANA, 3)).toBeNull();
    expect(cassettesEsperados(LILIANA, -1)).toBeNull();
    expect(cassettesEsperados(null, 0)).toBeNull();
    expect(cassettesEsperados({}, 0)).toBeNull();
  });
  it("cantidad no entera, cero o que no es número: desconocido", () => {
    for (const cantidad of [0, 1.5, -2, "2", null, undefined, Number.NaN]) {
      expect(cassettesEsperados([{ nombre: "Digitalización de VHS", cantidad }], 0)).toBeNull();
    }
  });
  it("un renglón de cargo extra (`cargo-*`) no cuenta", () => {
    expect(cassettesEsperados([{ id: "cargo-c1", nombre: "Digitalización de VHS", cantidad: 1 }], 0)).toBeNull();
  });
  it("un ítem que no es de digitalización no cuenta, salvo que el producto del trabajo lo sea", () => {
    const items = [{ id: "i0", nombre: "Combo recuerdos", cantidad: 3 }];
    expect(cassettesEsperados(items, 0)).toBeNull();
    expect(cassettesEsperados(items, 0, ["Digitalización de VHS"])).toBe(3);
    expect(cassettesEsperados([{ nombre: "Copia 15x21", cantidad: 10 }], 0, ["Impresiones"])).toBeNull();
  });
});

describe("estaHecha", () => {
  it("LISTA y SIN_IMAGEN sí; grabando, en cola, convirtiendo o con error no", () => {
    expect([lista, sinImagen].map(estaHecha)).toEqual([true, true]);
    expect([grabando, enCola, convirtiendo, conError].map(estaHecha)).toEqual([false, false, false, false]);
  });
  it("las de antes de la conversión: como en `estadoDeEntrega` (sin imagen hecha; con imagen, no)", () => {
    expect(estaHecha({ estado: "COMPLETA", conversionEstado: null, sinImagen: true })).toBe(true);
    expect(estaHecha({ estado: "COMPLETA", conversionEstado: null, sinImagen: false })).toBe(false);
  });
});

describe("contarTrabajo y las reglas (pedido 2026-0006)", () => {
  const liliana = (grabaciones: { estado: string; conversionEstado: string | null; sinImagen: boolean }[]) =>
    contarTrabajo({ items: LILIANA, pedidoItemIndex: 0, grabaciones });

  it("cantidad 2 y 1 hecho: ni completo ni «Grabado»", () => {
    const c = liliana([lista]);
    expect(c).toEqual({ esperados: 2, grabados: 1, grabadosConImagen: 1, hechos: 1, listas: 1, sinTerminar: 0 });
    expect(trabajoCompleto(c)).toBe(false);
    expect(cumpleGrabado(c)).toBe(false);
  });
  it("con el 2.º recién grabado: «Grabado» (aunque se convierta), pero todavía no completo", () => {
    const c = liliana([lista, enCola]);
    expect(cumpleGrabado(c)).toBe(true);
    expect(trabajoCompleto(c)).toBe(false);
  });
  it("con el 2.º convertido: completo", () => {
    expect(trabajoCompleto(liliana([lista, lista]))).toBe(true);
  });
  it("las descartadas no cuentan", () => {
    const c = liliana([lista, descartada]);
    expect(c).toMatchObject({ grabados: 1, hechos: 1 });
    expect(trabajoCompleto(c)).toBe(false);
    expect(cumpleGrabado(c)).toBe(false);
  });
  it("una que sigue grabando no cuenta", () => {
    expect(liliana([lista, grabando])).toMatchObject({ grabados: 1, hechos: 1 });
  });
  it("SIN_IMAGEN: cuenta como hecha y como grabada, pero «Grabado» pide al menos una con imagen", () => {
    const c = liliana([lista, sinImagen]);
    expect(c).toEqual({ esperados: 2, grabados: 2, grabadosConImagen: 1, hechos: 2, listas: 1, sinTerminar: 0 });
    expect(trabajoCompleto(c)).toBe(true);
    expect(cumpleGrabado(c)).toBe(true);
    const vacios = liliana([sinImagen, sinImagen]);
    expect(trabajoCompleto(vacios)).toBe(true);
    expect(cumpleGrabado(vacios)).toBe(false);
  });
  it("un DVD cuenta como 1", () => {
    const c = contarTrabajo({ items: [{ nombre: "Digitalización de DVD", cantidad: 1 }], pedidoItemIndex: 0, grabaciones: [lista] });
    expect(trabajoCompleto(c)).toBe(true);
  });
  it("cantidad desconocida: la regla de antes (completo siempre; «Grabado» con la primera con imagen)", () => {
    const c = contarTrabajo({ items: LILIANA, pedidoItemIndex: null, grabaciones: [lista] });
    expect(c.esperados).toBeNull();
    expect(trabajoCompleto(c)).toBe(true);
    expect(cumpleGrabado(c)).toBe(true);
    expect(cumpleGrabado(contarTrabajo({ items: null, pedidoItemIndex: null, grabaciones: [sinImagen] }))).toBe(false);
  });
});

describe("contarPedido", () => {
  const t = (esperados: number | null, grabados: number, hechos = grabados) => ({ esperados, grabados, grabadosConImagen: grabados, hechos, listas: hechos, sinTerminar: 0 });
  it("suma los trabajos con cantidad conocida", () => {
    expect(contarPedido([t(1, 1), t(2, 1)])).toEqual({ esperados: 3, grabados: 2, hechos: 2, faltan: 1 });
    expect(contarPedido([t(1, 1), t(2, 2)])).toEqual({ esperados: 3, grabados: 3, hechos: 3, faltan: 0 });
  });
  it("con un trabajo desconocido el pedido es desconocido, pero los faltantes conocidos siguen contando", () => {
    expect(contarPedido([t(2, 1), t(null, 3)])).toEqual({ esperados: null, grabados: 4, hechos: 4, faltan: 1 });
  });
  it("un trabajo con más grabaciones que las vendidas no tapa al que le faltan", () => {
    expect(contarPedido([t(1, 3), t(2, 0)])).toMatchObject({ esperados: 3, grabados: 1, faltan: 2 });
  });
  it("sin trabajos de digitalización: desconocido", () => {
    expect(contarPedido([])).toEqual({ esperados: null, grabados: 0, hechos: 0, faltan: 0 });
  });
});

describe("cuentasDeTrabajos", () => {
  it("deja afuera los trabajos que no son de digitalización", () => {
    const base = { pedidoItemIndex: 0, product: null, pedido: { items: LILIANA }, grabaciones: [] };
    const r = cuentasDeTrabajos([
      { ...base, id: "t1", name: "Digitalización de VHS" },
      { ...base, id: "t2", name: "Fotolibro", pedidoItemIndex: 1 },
    ]);
    expect(r.map((x) => [x.trabajo.id, x.cuenta.esperados])).toEqual([["t1", 2]]);
  });
});

describe("margen del envío automático", () => {
  const g = [{ estado: "COMPLETA", terminadaAt: new Date("2026-10-22T10:00:00Z"), convertidaAt: new Date("2026-10-22T11:00:00Z") }];
  it("12 h si no se sabe cuántos cassettes son; 30 min si se sabe", () => {
    expect(envioAutomaticoDesde(g)).toEqual(new Date("2026-10-22T23:00:00Z"));
    expect(envioAutomaticoDesde(g, { cantidadConocida: true })).toEqual(new Date("2026-10-22T11:30:00Z"));
  });
});

describe("textos", () => {
  it("N de M cassettes grabados, o N cassettes grabados", () => {
    expect(textoDeCassettes({ esperados: 2, grabados: 1 })).toBe("1 de 2 cassettes grabados");
    expect(textoDeCassettes({ esperados: 1, grabados: 1 })).toBe("1 de 1 cassette grabado");
    expect(textoDeCassettes({ esperados: null, grabados: 1 })).toBe("1 cassette grabado");
    expect(textoDeCassettes({ esperados: null, grabados: 3 })).toBe("3 cassettes grabados");
  });
  it("lo que falta y la confirmación del botón manual", () => {
    expect(textoFaltanCassettes(1)).toBe("Falta grabar 1 cassette");
    expect(textoFaltanCassettes(2)).toBe("Falta grabar 2 cassettes");
    expect(confirmacionEnvioIncompleto({ esperados: 2, faltan: 1 })).toBe("Falta grabar 1 de 2 cassettes: ¿enviar igual?");
    expect(confirmacionEnvioIncompleto({ esperados: 2, faltan: 0 })).toBeNull();
    expect(confirmacionEnvioIncompleto({ esperados: null, faltan: 1 })).toBe("Falta grabar 1 cassette: ¿enviar igual?");
  });
});
