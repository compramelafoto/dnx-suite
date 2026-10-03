import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filtrarPiezasParaDescarga,
  nombreDeArchivoDePlaca,
  nombresSinRepetir,
} from "../participant-card-descarga-masiva";

/**
 * Los nombres de archivo de una descarga masiva.
 *
 * Quien abre el comprimido tiene que poder encontrar una placa sin abrirlas todas, así que el
 * nombre lleva el número de participante adelante. Y tiene que poder descomprimirlo en
 * cualquier computadora: nada de acentos, barras ni dos puntos.
 */
describe("nombre de archivo de una placa", () => {
  it("lleva el número de participante y el tipo de placa", () => {
    assert.equal(
      nombreDeArchivoDePlaca({ visibleCode: "CKA26-00023", cardType: "welcome" }),
      "CKA26-00023-bienvenida.png",
    );
  });

  it("nombra la otra placa en castellano", () => {
    assert.equal(
      nombreDeArchivoDePlaca({ visibleCode: "CKA26-00023", cardType: "member" }),
      "CKA26-00023-soy-parte.png",
    );
  });

  it("saca acentos y caracteres que rompen en otras computadoras", () => {
    assert.equal(
      nombreDeArchivoDePlaca({ visibleCode: "Ñoño/Ágil: 12", cardType: "welcome" }),
      "Nono-Agil-12-bienvenida.png",
    );
  });

  it("usa el identificador cuando la inscripción no tiene número visible", () => {
    assert.equal(
      nombreDeArchivoDePlaca({ visibleCode: null, registrationId: "cmt7izo6u0001", cardType: "welcome" }),
      "cmt7izo6u0001-bienvenida.png",
    );
  });
});

/**
 * Dos inscripciones pueden compartir número visible —pasa cuando alguien lo carga a mano—. Si
 * se repite el nombre, el comprimido pierde silenciosamente una de las dos placas.
 */
describe("nombres repetidos", () => {
  it("numera los repetidos en vez de pisarlos", () => {
    const nombres = nombresSinRepetir([
      "CKA26-00023-bienvenida.png",
      "CKA26-00023-bienvenida.png",
      "CKA26-00024-bienvenida.png",
    ]);

    assert.deepEqual(nombres, [
      "CKA26-00023-bienvenida.png",
      "CKA26-00023-bienvenida-2.png",
      "CKA26-00024-bienvenida.png",
    ]);
  });

  it("deja en paz los que no se repiten", () => {
    const nombres = nombresSinRepetir(["a.png", "b.png"]);
    assert.deepEqual(nombres, ["a.png", "b.png"]);
  });
});

/**
 * Qué piezas entran en la descarga en ZIP según el filtro que llega por la URL.
 *
 * Sin filtros tiene que comportarse exactamente como la descarga de siempre: todo. Con
 * filtros, sólo lo pedido — y una selección vacía es "ninguna", no "todas".
 */
describe("filtrarPiezasParaDescarga", () => {
  const piezas = [
    { registrationId: "r1", cardType: "welcome" as const },
    { registrationId: "r1", cardType: "diploma" as const },
    { registrationId: "r2", cardType: "diploma" as const },
  ];

  it("sin filtros devuelve todo, como hasta ahora", () => {
    assert.equal(filtrarPiezasParaDescarga(piezas, {}).length, 3);
  });

  it("filtra por tipo de pieza", () => {
    const out = filtrarPiezasParaDescarga(piezas, { cardType: "diploma" });
    assert.equal(out.length, 2);
    assert.ok(out.every((p) => p.cardType === "diploma"));
  });

  it("filtra por las inscripciones elegidas", () => {
    const out = filtrarPiezasParaDescarga(piezas, {
      cardType: "diploma",
      registrationIds: ["r2"],
    });
    assert.deepEqual(out.map((p) => p.registrationId), ["r2"]);
  });

  it("una lista de inscripciones vacía no significa 'todas'", () => {
    assert.equal(filtrarPiezasParaDescarga(piezas, { registrationIds: [] }).length, 0);
  });
});
