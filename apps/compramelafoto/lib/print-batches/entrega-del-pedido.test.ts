import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  accionesPermitidas,
  actorDelSobre,
  esAccionDelSobre,
  notaDelHistorial,
  textoDelEstadoDelPedido,
  type ActorDelSobre,
} from "./entrega-del-pedido";

const ESTADOS = ["CREATED", "IN_PRODUCTION", "READY", "READY_TO_PICKUP", "SHIPPED", "DELIVERED", "CANCELED", "RETIRED"] as const;
const ACTORES: ActorDelSobre[] = ["FOTOGRAFO", "LAB_ENLACE", "LAB_CUENTA", "ANONIMO"];
const TERMINADOS = new Set(["DELIVERED", "CANCELED", "RETIRED"]);

/** La tabla esperada, escrita a mano para cada combinación. */
function esperado(actor: ActorDelSobre, retiraCliente: boolean, status: string): string[] {
  if (TERMINADOS.has(status)) return [];
  if (actor === "FOTOGRAFO") {
    if (!retiraCliente && status !== "READY_TO_PICKUP") return ["LISTO", "ENTREGADO"];
    return ["ENTREGADO"];
  }
  if (actor === "LAB_ENLACE" || actor === "LAB_CUENTA") return retiraCliente ? ["ENTREGADO"] : [];
  return status === "READY_TO_PICKUP" ? ["RECIBIDO_POR_CLIENTE"] : [];
}

describe("accionesPermitidas: todas las combinaciones", () => {
  for (const actor of ACTORES) {
    for (const retiraCliente of [false, true]) {
      for (const status of ESTADOS) {
        it(`${actor} · ${retiraCliente ? "retira el cliente" : "retira el fotógrafo"} · ${status}`, () => {
          assert.deepEqual(accionesPermitidas({ actor, retiraCliente, status }), esperado(actor, retiraCliente, status));
        });
      }
    }
  }
});

describe("accionesPermitidas: casos que importan", () => {
  it("el laboratorio nunca marca «Listo» ni entrega pedidos que retira el fotógrafo", () => {
    for (const actor of ["LAB_ENLACE", "LAB_CUENTA"] as const) {
      for (const status of ESTADOS) {
        assert.deepEqual(accionesPermitidas({ actor, retiraCliente: false, status }), []);
        assert.ok(!accionesPermitidas({ actor, retiraCliente: true, status }).includes("LISTO"));
      }
    }
  });
  it("el cliente sólo confirma con el pedido «Listo para retirar»", () => {
    assert.deepEqual(accionesPermitidas({ actor: "ANONIMO", retiraCliente: true, status: "READY" }), []);
    assert.deepEqual(accionesPermitidas({ actor: "ANONIMO", retiraCliente: false, status: "READY_TO_PICKUP" }), ["RECIBIDO_POR_CLIENTE"]);
    for (const status of ESTADOS) {
      const a = accionesPermitidas({ actor: "ANONIMO", retiraCliente: true, status });
      assert.ok(!a.includes("ENTREGADO") && !a.includes("LISTO"));
    }
  });
  it("el fotógrafo no dispara «Listo» si retira el cliente en el laboratorio", () => {
    assert.deepEqual(accionesPermitidas({ actor: "FOTOGRAFO", retiraCliente: true, status: "READY" }), ["ENTREGADO"]);
  });
  it("un estado desconocido no habilita «Listo» ni la confirmación del cliente", () => {
    assert.deepEqual(accionesPermitidas({ actor: "FOTOGRAFO", retiraCliente: false, status: "RARO" }), ["ENTREGADO"]);
    assert.deepEqual(accionesPermitidas({ actor: "ANONIMO", retiraCliente: true, status: "RARO" }), []);
  });
});

describe("actorDelSobre", () => {
  it("el dueño gana a todo; la cuenta del lab, al enlace; si no, anónimo", () => {
    assert.equal(actorDelSobre({ esDueno: true, esCuentaDelLab: true, tieneCookieDelLote: true }), "FOTOGRAFO");
    assert.equal(actorDelSobre({ esDueno: false, esCuentaDelLab: true, tieneCookieDelLote: true }), "LAB_CUENTA");
    assert.equal(actorDelSobre({ esDueno: false, esCuentaDelLab: false, tieneCookieDelLote: true }), "LAB_ENLACE");
    assert.equal(actorDelSobre({ esDueno: false, esCuentaDelLab: false, tieneCookieDelLote: false }), "ANONIMO");
  });
});

describe("esAccionDelSobre", () => {
  it("sólo las tres acciones", () => {
    for (const a of ["LISTO", "ENTREGADO", "RECIBIDO_POR_CLIENTE"]) assert.ok(esAccionDelSobre(a));
    for (const a of ["listo", "DELIVERED", "", null, undefined, 1, {}]) assert.ok(!esAccionDelSobre(a));
  });
});

describe("textos", () => {
  it("estados en castellano", () => {
    assert.equal(textoDelEstadoDelPedido("CREATED"), "En preparación");
    assert.equal(textoDelEstadoDelPedido("IN_PRODUCTION"), "En el laboratorio");
    assert.equal(textoDelEstadoDelPedido("READY"), "Listo en el laboratorio");
    assert.equal(textoDelEstadoDelPedido("READY_TO_PICKUP"), "Listo para retirar");
    assert.equal(textoDelEstadoDelPedido("DELIVERED"), "Entregado");
  });
  it("la confirmación del cliente queda anotada así", () => {
    assert.equal(notaDelHistorial("ANONIMO", "RECIBIDO_POR_CLIENTE"), "Confirmado por el cliente");
    assert.match(notaDelHistorial("LAB_ENLACE", "ENTREGADO"), /laboratorio/);
    assert.match(notaDelHistorial("FOTOGRAFO", "ENTREGADO"), /fotógrafo/);
  });
});
