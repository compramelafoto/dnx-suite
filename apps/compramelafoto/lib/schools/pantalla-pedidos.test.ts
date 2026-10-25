import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  RESERVA_CAMARA,
  calcularGrilla,
  contadoresPorPaso,
  paginaDeLaVuelta,
  paginar,
  pedidosParaTarjetas,
  ubicarEnCeldas,
} from "./pantalla-pedidos";

describe("contadores de la pantalla", () => {
  it("son los siete pasos en orden, con su cantidad, sin los pedidos fuera de la línea", () => {
    const c = contadoresPorPaso([
      "REVISAR_DISENO",
      "REVISAR_DISENO",
      "ENTREGADO",
      "PAGO_PENDIENTE",
      "CANCELADO",
      "EN_IMPRENTA",
    ]);
    assert.deepEqual(
      c.map((x) => x.paso),
      ["POR_CANJEAR", "REVISAR_DISENO", "CAMBIOS_PEDIDOS", "PARA_IMPRIMIR", "EN_IMPRENTA", "PARA_ENTREGAR", "ENTREGADO"],
    );
    assert.deepEqual(
      c.map((x) => x.cantidad),
      [0, 2, 0, 0, 1, 0, 1],
    );
    assert.equal(c[1].numero, 2);
    assert.equal(c[1].titulo, "Revisar diseño");
  });

  it("sin pedidos, todos en cero", () => {
    assert.ok(contadoresPorPaso([]).every((x) => x.cantidad === 0));
  });
});

describe("pedidos en tarjetas", () => {
  const pedidos = [
    { id: 1, nombre: "Zoe", paso: "PARA_IMPRIMIR" as const },
    { id: 2, nombre: "ana", paso: "REVISAR_DISENO" as const },
    { id: 3, nombre: "Bruno", paso: "REVISAR_DISENO" as const },
    { id: 4, nombre: "Carla", paso: "ENTREGADO" as const },
    { id: 5, nombre: "Dante", paso: "PAGO_PENDIENTE" as const },
    { id: 6, nombre: "Eva", paso: "CANCELADO" as const },
    { id: 7, nombre: "Ana", paso: "REVISAR_DISENO" as const },
  ];

  it("van por paso (el más atrasado primero) y por nombre; sin fuera de la línea ni entregados", () => {
    assert.deepEqual(
      pedidosParaTarjetas(pedidos).map((p) => p.id),
      [2, 7, 3, 1],
    );
  });

  it("los entregados se pueden incluir, al final", () => {
    assert.deepEqual(
      pedidosParaTarjetas(pedidos, { incluirEntregados: true }).map((p) => p.id),
      [2, 7, 3, 1, 4],
    );
  });
});

describe("grilla de tarjetas", () => {
  it("cuenta columnas y filas con la separación", () => {
    const g = calcularGrilla({ ancho: 1000, alto: 500, anchoTarjeta: 300, altoTarjeta: 150, separacion: 20 });
    assert.equal(g.columnas, 3);
    assert.equal(g.filas, 3);
    assert.deepEqual(g.reservadas, []);
    assert.equal(g.porPagina, 9);
  });

  it("deja vacías las celdas del rincón de la cámara (abajo a la derecha)", () => {
    // Pantalla de televisor: 1840 × 760 de grilla, tarjetas de 360 × 170.
    const g = calcularGrilla({
      ancho: 1840,
      alto: 760,
      anchoTarjeta: 360,
      altoTarjeta: 170,
      separacion: 20,
      reserva: RESERVA_CAMARA,
    });
    assert.equal(g.columnas, 4);
    assert.equal(g.filas, 4);
    // Celdas de 445 × 175: el rincón de 280 × 180 sólo toca la última celda.
    assert.deepEqual(g.reservadas, [15]);
    assert.equal(g.porPagina, 15);
  });

  it("un rincón más ancho que una celda ocupa dos columnas", () => {
    const g = calcularGrilla({
      ancho: 1000,
      alto: 400,
      anchoTarjeta: 200,
      altoTarjeta: 190,
      separacion: 20,
      reserva: { ancho: 280, alto: 180 },
    });
    assert.equal(g.columnas, 4);
    assert.equal(g.filas, 2);
    assert.deepEqual(g.reservadas, [6, 7]);
    assert.equal(g.porPagina, 6);
  });

  it("en una pantalla muy chica queda al menos una celda útil", () => {
    const g = calcularGrilla({
      ancho: 200,
      alto: 100,
      anchoTarjeta: 360,
      altoTarjeta: 170,
      separacion: 20,
      reserva: RESERVA_CAMARA,
    });
    assert.equal(g.columnas, 1);
    assert.equal(g.filas, 1);
    assert.deepEqual(g.reservadas, []);
    assert.equal(g.porPagina, 1);
  });
});

describe("páginas que van rotando", () => {
  it("parte en páginas del tamaño pedido", () => {
    assert.deepEqual(paginar([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
    assert.deepEqual(paginar([1, 2], 5), [[1, 2]]);
  });

  it("sin pedidos hay una página vacía; un tamaño inválido se toma como 1", () => {
    assert.deepEqual(paginar([], 4), [[]]);
    assert.deepEqual(paginar([1, 2], 0), [[1], [2]]);
  });

  it("la página vuelve a empezar al terminar", () => {
    assert.deepEqual(
      [0, 1, 2, 3, 4].map((v) => paginaDeLaVuelta(v, 3)),
      [0, 1, 2, 0, 1],
    );
    assert.equal(paginaDeLaVuelta(7, 1), 0);
    assert.equal(paginaDeLaVuelta(7, 0), 0);
  });

  it("si la lista se achica, la vuelta sigue dando una página que existe", () => {
    // Iba por la página 3 de 4 y quedaron 2 páginas.
    assert.equal(paginaDeLaVuelta(3, 2), 1);
  });
});

describe("celdas", () => {
  it("salta las reservadas y completa con vacías", () => {
    const g = { columnas: 3, filas: 2, reservadas: [5], porPagina: 5 };
    const celdas = ubicarEnCeldas(["a", "b", "c", "d"], g);
    assert.deepEqual(
      celdas.map((c) => (c.tipo === "pedido" ? c.pedido : c.tipo)),
      ["a", "b", "c", "d", "vacia", "reservada"],
    );
  });

  it("una página llena no pisa el rincón", () => {
    const g = { columnas: 2, filas: 2, reservadas: [3], porPagina: 3 };
    const celdas = ubicarEnCeldas(["a", "b", "c"], g);
    assert.equal(celdas[3].tipo, "reservada");
    assert.equal(celdas.filter((c) => c.tipo === "pedido").length, 3);
  });
});
