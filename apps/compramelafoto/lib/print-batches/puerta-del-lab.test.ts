import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { nuevoTokenDeLote } from "./codigos";
import {
  aNombreDe,
  botonesDelLab,
  copiasDelLote,
  esEstadoDelLab,
  fechaCorta,
  leerResumen,
  nombreDeLaCookie,
  nombreDelFotografo,
  nombreSinContacto,
  textoDeCopias,
  tokenConFormatoValido,
} from "./puerta-del-lab";

describe("tokenConFormatoValido", () => {
  it("acepta los tokens que genera el lote", () => {
    for (let i = 0; i < 20; i++) assert.equal(tokenConFormatoValido(nuevoTokenDeLote().token), true);
  });
  it("rechaza largos, caracteres y tipos que no son", () => {
    const t = nuevoTokenDeLote().token;
    assert.equal(tokenConFormatoValido(t.slice(1)), false);
    assert.equal(tokenConFormatoValido(`${t}A`), false);
    assert.equal(tokenConFormatoValido(`${t.slice(1)}=`), false);
    assert.equal(tokenConFormatoValido(`${t.slice(1)}/`), false);
    assert.equal(tokenConFormatoValido(""), false);
    assert.equal(tokenConFormatoValido(undefined), false);
    assert.equal(tokenConFormatoValido(123), false);
    assert.equal(tokenConFormatoValido("a".repeat(64)), false);
  });
});

describe("botonesDelLab", () => {
  const textos = (b: Array<{ texto: string }>) => b.map((x) => x.texto);
  it("recién enviado: empezar o listo; despachar sólo si envía el lab", () => {
    assert.deepEqual(textos(botonesDelLab("ENVIADO", "RETIRA_FOTOGRAFO")), ["Lo empezamos", "Está listo"]);
    assert.deepEqual(textos(botonesDelLab("ENVIADO", "ENVIA_LAB")), ["Lo empezamos", "Está listo", "Lo despachamos"]);
  });
  it("en producción ya no ofrece empezar", () => {
    assert.deepEqual(textos(botonesDelLab("EN_PRODUCCION", "RETIRA_FOTOGRAFO")), ["Está listo"]);
  });
  it("listo: nada si retira el fotógrafo, despachar si envía el lab", () => {
    assert.deepEqual(botonesDelLab("LISTO", "RETIRA_FOTOGRAFO"), []);
    assert.deepEqual(botonesDelLab("LISTO", "ENVIA_LAB"), [{ hacia: "DESPACHADO", texto: "Lo despachamos" }]);
  });
  it("sin botones en armado, despachado, recibido, cerrado o anulado", () => {
    for (const e of ["ARMADO", "DESPACHADO", "RECIBIDO", "CERRADO", "ANULADO"] as const) {
      assert.deepEqual(botonesDelLab(e, "ENVIA_LAB"), [], e);
    }
  });
});

describe("esEstadoDelLab", () => {
  it("sólo los tres estados del laboratorio", () => {
    assert.equal(esEstadoDelLab("EN_PRODUCCION"), true);
    assert.equal(esEstadoDelLab("LISTO"), true);
    assert.equal(esEstadoDelLab("DESPACHADO"), true);
    for (const v of ["RECIBIDO", "CERRADO", "ANULADO", "ENVIADO", "ARMADO", "", null, 3]) assert.equal(esEstadoDelLab(v), false);
  });
});

describe("leerResumen y texto del pedido", () => {
  it("lee el resumen que guarda armarLote y no trae nada más", () => {
    const r = leerResumen({
      cliente: "Ana Pérez", pedido: 3888, album: "Egresados 2026", totalCopias: 5,
      copias: [{ medida: "13x18", acabado: "BRILLO", cantidad: 3 }, { medida: "10x15", acabado: "", cantidad: 2 }],
      buyerEmail: "ana@ejemplo.com",
    });
    assert.deepEqual(r, {
      cliente: "Ana Pérez", pedido: 3888, album: "Egresados 2026", totalCopias: 5,
      copias: [{ medida: "13x18", acabado: "BRILLO", cantidad: 3 }, { medida: "10x15", acabado: "", cantidad: 2 }],
    });
    assert.equal(JSON.stringify(r).includes("@"), false);
  });
  it("nunca muestra un correo o teléfono guardado como nombre", () => {
    assert.equal(leerResumen({ cliente: "ana.perez@gmail.com", pedido: 1 }).cliente, "Cliente");
    assert.equal(nombreSinContacto("+54 9 341 555-1234"), "Cliente");
    assert.equal(nombreSinContacto("Ana Pérez"), "Ana Pérez");
    assert.equal(nombreSinContacto("Juan 2"), "Juan 2");
  });
  it("tolera un resumen roto", () => {
    assert.deepEqual(leerResumen(null), { cliente: "Cliente", pedido: null, album: "", copias: [], totalCopias: 0 });
    assert.deepEqual(leerResumen({ pedido: "x", copias: [{ cantidad: -1 }, null, { medida: " ", cantidad: 1 }] }), {
      cliente: "Cliente", pedido: null, album: "", copias: [{ medida: "Sin medida", acabado: "", cantidad: 1 }], totalCopias: 1,
    });
  });
  it("a nombre de «Fotógrafo + Cliente»", () => {
    assert.equal(aNombreDe("Daniel Cuart", "Ana Pérez"), "Daniel Cuart + Ana Pérez");
    assert.equal(nombreDelFotografo({ name: "  ", companyName: "DNX Estudio" }), "DNX Estudio");
    assert.equal(nombreDelFotografo({ name: null, companyName: null }), "Fotógrafo");
  });
  it("copias en una línea y sumadas por medida y acabado", () => {
    assert.equal(textoDeCopias([{ medida: "13x18", acabado: "BRILLO", cantidad: 3 }, { medida: "10x15", acabado: "", cantidad: 2 }]), "3× 13x18 BRILLO · 2× 10x15");
    assert.deepEqual(
      copiasDelLote([
        { copias: [{ medida: "13x18", acabado: "MATE", cantidad: 1 }] },
        { copias: [{ medida: "13x18", acabado: "MATE", cantidad: 2 }, { medida: "10x15", acabado: "BRILLO", cantidad: 4 }] },
      ]),
      [{ medida: "10x15", acabado: "BRILLO", cantidad: 4 }, { medida: "13x18", acabado: "MATE", cantidad: 3 }],
    );
  });
});

describe("cookie y fechas", () => {
  it("una cookie por lote", () => {
    assert.equal(nombreDeLaCookie(12), "lab_lote_12");
  });
  it("una fecha sin hora no se corre al día anterior", () => {
    assert.equal(fechaCorta(new Date("2026-11-25T00:00:00.000Z")), "25/11/2026");
  });
  it("una fecha con hora va en hora argentina", () => {
    assert.equal(fechaCorta(new Date("2026-11-25T02:30:00.000Z")), "24/11/2026");
  });
});
