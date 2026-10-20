import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  PASOS_EMBUDO,
  INFO_PASOS,
  contarPorPaso,
  disenosParaRevisar,
  esPasoEmbudo,
  pasoDeDiseno,
  pasoDeEstadoDiseno,
  pasoDeItemTienda,
  pasoMasAtrasado,
  textoCurso,
  ubicarPedido,
} from "./embudo-pedidos-escolares";

describe("pasos del embudo", () => {
  it("son siete, numerados en orden", () => {
    assert.equal(PASOS_EMBUDO.length, 7);
    PASOS_EMBUDO.forEach((p, i) => assert.equal(INFO_PASOS[p].numero, i + 1));
  });

  it("reconoce un paso válido y rechaza cualquier otra cosa", () => {
    assert.equal(esPasoEmbudo("REVISAR_DISENO"), true);
    assert.equal(esPasoEmbudo("PAGO_PENDIENTE"), false);
    assert.equal(esPasoEmbudo(undefined), false);
  });

  it("el más atrasado gana", () => {
    assert.equal(pasoMasAtrasado(["PARA_IMPRIMIR", "REVISAR_DISENO", "ENTREGADO"]), "REVISAR_DISENO");
    assert.equal(pasoMasAtrasado(["ENTREGADO"]), "ENTREGADO");
  });
});

describe("estado del diseño", () => {
  it("pendiente es revisar; cambios pedidos; aprobado (con o sin archivo) es para imprimir", () => {
    assert.equal(pasoDeEstadoDiseno("PENDING_PHOTOGRAPHER_APPROVAL"), "REVISAR_DISENO");
    assert.equal(pasoDeEstadoDiseno("NEEDS_ADJUSTMENT"), "CAMBIOS_PEDIDOS");
    assert.equal(pasoDeEstadoDiseno("APPROVED_FOR_EXPORT"), "PARA_IMPRIMIR");
    assert.equal(pasoDeEstadoDiseno("EXPORTED"), "PARA_IMPRIMIR");
    assert.equal(pasoDeEstadoDiseno("CUALQUIERA"), null);
    assert.equal(pasoDeEstadoDiseno(null), null);
  });

  it("las fechas de la tanda 2 hacen avanzar a un diseño aprobado", () => {
    const fecha = new Date("2026-10-14T12:00:00Z");
    assert.equal(pasoDeDiseno({ status: "EXPORTED" }), "PARA_IMPRIMIR");
    assert.equal(pasoDeDiseno({ status: "EXPORTED", sentToPrintAt: fecha }), "EN_IMPRENTA");
    assert.equal(pasoDeDiseno({ status: "EXPORTED", sentToPrintAt: fecha, printedAt: fecha }), "PARA_ENTREGAR");
    assert.equal(
      pasoDeDiseno({ status: "APPROVED_FOR_EXPORT", sentToPrintAt: fecha, printedAt: fecha, deliveredAt: fecha }),
      "ENTREGADO",
    );
    // Llegan como texto desde la API.
    assert.equal(pasoDeDiseno({ status: "EXPORTED", printedAt: "2026-10-14T12:00:00Z" }), "PARA_ENTREGAR");
  });

  it("un diseño que volvió a revisión ignora las fechas viejas de imprenta", () => {
    const fecha = new Date();
    assert.equal(
      pasoDeDiseno({ status: "PENDING_PHOTOGRAPHER_APPROVAL", sentToPrintAt: fecha, printedAt: fecha }),
      "REVISAR_DISENO",
    );
    assert.equal(pasoDeDiseno({ status: "NEEDS_ADJUSTMENT", deliveredAt: fecha }), "CAMBIOS_PEDIDOS");
  });
});

describe("ítems de la tienda escolar", () => {
  it("la cadena física manda sobre el diseño", () => {
    const aprobado = { status: "EXPORTED" };
    assert.equal(pasoDeItemTienda({ status: "PHYSICAL_IN_PROGRESS", diseno: aprobado }), "EN_IMPRENTA");
    assert.equal(pasoDeItemTienda({ status: "AT_SCHOOL", diseno: aprobado }), "PARA_ENTREGAR");
    assert.equal(pasoDeItemTienda({ status: "DELIVERED", diseno: aprobado }), "ENTREGADO");
  });

  it("EXPORTED del ítem (lo pone la aprobación) es para imprimir, no imprenta", () => {
    assert.equal(pasoDeItemTienda({ status: "EXPORTED", diseno: { status: "EXPORTED" } }), "PARA_IMPRIMIR");
    assert.equal(pasoDeItemTienda({ status: "EXPORTED", diseno: null }), "PARA_IMPRIMIR");
  });

  it("si el diseño se tocó después de aprobarlo, vuelve a revisión aunque el ítem diga EXPORTED", () => {
    assert.equal(
      pasoDeItemTienda({ status: "EXPORTED", diseno: { status: "PENDING_PHOTOGRAPHER_APPROVAL" } }),
      "REVISAR_DISENO",
    );
  });

  it("según el diseño", () => {
    assert.equal(
      pasoDeItemTienda({ status: "READY_TO_DESIGN", diseno: { status: "PENDING_PHOTOGRAPHER_APPROVAL" } }),
      "REVISAR_DISENO",
    );
    assert.equal(pasoDeItemTienda({ status: "READY_TO_DESIGN", diseno: { status: "NEEDS_ADJUSTMENT" } }), "CAMBIOS_PEDIDOS");
  });

  it("sin diseño, según el ítem", () => {
    assert.equal(pasoDeItemTienda({ status: "WAITING_SELFIE", diseno: null }), "POR_CANJEAR");
    assert.equal(pasoDeItemTienda({ status: "WAITING_SELECTION", diseno: null }), "POR_CANJEAR");
    assert.equal(pasoDeItemTienda({ status: "READY_TO_DESIGN", diseno: null }), "REVISAR_DISENO");
    assert.equal(pasoDeItemTienda({ status: "NEEDS_CHANGES", diseno: null }), "CAMBIOS_PEDIDOS");
    assert.equal(pasoDeItemTienda({ status: "APPROVED", diseno: null }), "PARA_IMPRIMIR");
  });
});

describe("ubicar un pedido", () => {
  it("tienda escolar: pago pendiente y cancelados quedan fuera de la línea", () => {
    assert.equal(ubicarPedido({ kind: "TIENDA_ESCOLAR", orderStatus: "CREATED", items: [] }), "PAGO_PENDIENTE");
    assert.equal(
      ubicarPedido({ kind: "TIENDA_ESCOLAR", orderStatus: "CANCELED", items: [{ status: "DELIVERED", diseno: null }] }),
      "CANCELADO",
    );
  });

  it("tienda escolar pagada: el ítem más atrasado", () => {
    assert.equal(
      ubicarPedido({
        kind: "TIENDA_ESCOLAR",
        orderStatus: "PAID_HELD",
        items: [
          { status: "DELIVERED", diseno: { status: "EXPORTED" } },
          { status: "READY_TO_DESIGN", diseno: { status: "PENDING_PHOTOGRAPHER_APPROVAL" } },
        ],
      }),
      "REVISAR_DISENO",
    );
    assert.equal(ubicarPedido({ kind: "TIENDA_ESCOLAR", orderStatus: "PAID_HELD", items: [] }), "POR_CANJEAR");
  });

  it("pack externo sin canje: por canjear", () => {
    assert.equal(
      ubicarPedido({ kind: "PACK_EXTERNO", canjeado: false, disenos: [], tieneCopiasFisicas: false }),
      "POR_CANJEAR",
    );
  });

  it("pack externo canjeado: según sus libritos, el más atrasado", () => {
    assert.equal(
      ubicarPedido({
        kind: "PACK_EXTERNO",
        canjeado: true,
        disenos: [{ status: "EXPORTED" }, { status: "NEEDS_ADJUSTMENT" }],
        tieneCopiasFisicas: true,
      }),
      "CAMBIOS_PEDIDOS",
    );
    assert.equal(
      ubicarPedido({ kind: "PACK_EXTERNO", canjeado: true, disenos: [{ status: "EXPORTED" }], tieneCopiasFisicas: false }),
      "PARA_IMPRIMIR",
    );
    // Estado desconocido: se trata como "para revisar".
    assert.equal(
      ubicarPedido({ kind: "PACK_EXTERNO", canjeado: true, disenos: [{ status: "RARO" }], tieneCopiasFisicas: false }),
      "REVISAR_DISENO",
    );
  });

  it("pack externo canjeado sin librito: copias impresas para imprimir; sólo digital ya entregado", () => {
    assert.equal(
      ubicarPedido({ kind: "PACK_EXTERNO", canjeado: true, disenos: [], tieneCopiasFisicas: true }),
      "PARA_IMPRIMIR",
    );
    assert.equal(
      ubicarPedido({ kind: "PACK_EXTERNO", canjeado: true, disenos: [], tieneCopiasFisicas: false }),
      "ENTREGADO",
    );
  });

  it("pack externo con fechas de la tanda 2", () => {
    assert.equal(
      ubicarPedido({
        kind: "PACK_EXTERNO",
        canjeado: true,
        disenos: [{ status: "EXPORTED", sentToPrintAt: new Date() }],
        tieneCopiasFisicas: true,
      }),
      "EN_IMPRENTA",
    );
  });
});

describe("contar y recorrer", () => {
  it("cuenta por paso con ceros para los vacíos", () => {
    const c = contarPorPaso(["POR_CANJEAR", "POR_CANJEAR", "ENTREGADO", "CANCELADO"]);
    assert.equal(c.POR_CANJEAR, 2);
    assert.equal(c.ENTREGADO, 1);
    assert.equal(c.CANCELADO, 1);
    assert.equal(c.EN_IMPRENTA, 0);
    assert.equal(c.PAGO_PENDIENTE, 0);
  });

  it("los diseños a revisar salen en el orden de la lista, sin repetir y sólo los pendientes", () => {
    const ids = disenosParaRevisar([
      { disenos: [{ id: 5, status: "PENDING_PHOTOGRAPHER_APPROVAL" }, { id: 6, status: "EXPORTED" }] },
      { disenos: [{ id: null, status: null }] },
      { disenos: [{ id: 2, status: "PENDING_PHOTOGRAPHER_APPROVAL" }, { id: 5, status: "PENDING_PHOTOGRAPHER_APPROVAL" }] },
      { disenos: [{ id: 9, status: "NEEDS_ADJUSTMENT" }] },
    ]);
    assert.deepEqual(ids, [5, 2]);
  });

  it("texto del curso", () => {
    assert.equal(textoCurso({ name: "5°", division: "A" }), "5° A");
    assert.equal(textoCurso({ name: "Sala de 5", division: null }), "Sala de 5");
    assert.equal(textoCurso(null), null);
    assert.equal(textoCurso({ name: "  ", division: "B" }), null);
  });
});
