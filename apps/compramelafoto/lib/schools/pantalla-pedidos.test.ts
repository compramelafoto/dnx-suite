import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { coincideBusqueda, contadoresPorPaso, pedidosParaTarjetas, planDeAdelanto } from "./pantalla-pedidos";

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

describe("adelantar un pedido al paso siguiente", () => {
  it("no se adelantan los pasos que esperan a la familia ni el último", () => {
    for (const paso of ["POR_CANJEAR", "CAMBIOS_PEDIDOS", "ENTREGADO", "CANCELADO"] as const) {
      assert.equal(planDeAdelanto({ paso, disenos: [] }).puede, false, paso);
    }
  });

  it("revisar diseño → aprueba los pendientes y avisa los huecos", () => {
    const plan = planDeAdelanto({
      paso: "REVISAR_DISENO",
      disenos: [
        { id: 7, status: "PENDING_PHOTOGRAPHER_APPROVAL", emptySlots: 2 },
        { id: 8, status: "EXPORTED" },
      ],
    });
    assert.ok(plan.puede);
    assert.equal(plan.destino, "PARA_IMPRIMIR");
    assert.deepEqual(plan.llamadas, [{ url: "/api/fotografo/disenos/7/approve", body: {} }]);
    assert.match(plan.aviso ?? "", /2 lugares/);
    assert.match(plan.explicacion, /correo/);
  });

  it("revisar diseño sin diseño todavía no se puede adelantar", () => {
    assert.equal(planDeAdelanto({ paso: "REVISAR_DISENO", disenos: [], items: [{ id: 1, status: "READY_TO_DESIGN" }] }).puede, false);
  });

  it("para imprimir → un lote con los aprobados que no se mandaron", () => {
    const plan = planDeAdelanto({
      paso: "PARA_IMPRIMIR",
      disenos: [
        { id: 3, status: "EXPORTED" },
        { id: 4, status: "EXPORTED", sentToPrintAt: "2026-11-01" },
      ],
    });
    assert.ok(plan.puede);
    assert.deepEqual(plan.llamadas, [{ url: "/api/fotografo/escolar/lotes", body: { ids: [3], copias: [] } }]);
  });

  it("para imprimir sin librito, de la tienda → marca los ítems en imprenta", () => {
    const plan = planDeAdelanto({ paso: "PARA_IMPRIMIR", disenos: [], items: [{ id: 9, status: "EXPORTED" }] });
    assert.ok(plan.puede);
    assert.deepEqual(plan.llamadas, [{ url: "/api/fotografo/school-order-items/9/start-physical-fulfillment" }]);
  });

  it("copias sueltas sin librito: lote, impreso y entregado por su pedido de canje", () => {
    const base = { disenos: [], redemptionOrderId: 4801 };
    const lote = planDeAdelanto({ ...base, paso: "PARA_IMPRIMIR", copias: { sentToPrintAt: null } });
    assert.ok(lote.puede);
    assert.equal(lote.destino, "EN_IMPRENTA");
    assert.deepEqual(lote.llamadas, [{ url: "/api/fotografo/escolar/lotes", body: { ids: [], copias: [4801] } }]);
    assert.match(lote.explicacion, /copias sueltas/);

    const impreso = planDeAdelanto({ ...base, paso: "EN_IMPRENTA", copias: { sentToPrintAt: "2026-11-01" } });
    assert.ok(impreso.puede);
    assert.deepEqual(impreso.llamadas, [
      { url: "/api/fotografo/escolar/lotes/marcar", body: { ids: [], copias: [4801], paso: "IMPRESO" } },
    ]);

    const entregado = planDeAdelanto({
      ...base,
      paso: "PARA_ENTREGAR",
      copias: { sentToPrintAt: "2026-11-01", printedAt: "2026-11-02" },
    });
    assert.ok(entregado.puede);
    assert.deepEqual(entregado.llamadas, [
      { url: "/api/fotografo/escolar/lotes/marcar", body: { ids: [], copias: [4801], paso: "ENTREGADO" } },
    ]);
  });

  it("sin librito, sin copias ni ítems → no hay qué mandar a imprimir", () => {
    assert.equal(planDeAdelanto({ paso: "PARA_IMPRIMIR", disenos: [] }).puede, false);
  });

  it("en imprenta → impreso; para entregar → entregado", () => {
    const impreso = planDeAdelanto({
      paso: "EN_IMPRENTA",
      disenos: [{ id: 5, status: "EXPORTED", sentToPrintAt: "2026-11-01" }],
    });
    assert.ok(impreso.puede);
    assert.equal(impreso.destino, "PARA_ENTREGAR");
    assert.deepEqual(impreso.llamadas, [{ url: "/api/fotografo/escolar/lotes/marcar", body: { ids: [5], copias: [], paso: "IMPRESO" } }]);

    const entregado = planDeAdelanto({
      paso: "PARA_ENTREGAR",
      disenos: [{ id: 5, status: "EXPORTED", sentToPrintAt: "2026-11-01", printedAt: "2026-11-03" }],
    });
    assert.ok(entregado.puede);
    assert.equal(entregado.destino, "ENTREGADO");
    assert.deepEqual(entregado.llamadas, [{ url: "/api/fotografo/escolar/lotes/marcar", body: { ids: [5], copias: [], paso: "ENTREGADO" } }]);
  });

  it("ítems de la tienda sin librito: en la escuela y entregado", () => {
    const enEscuela = planDeAdelanto({ paso: "EN_IMPRENTA", disenos: [], items: [{ id: 2, status: "PHYSICAL_IN_PROGRESS" }] });
    assert.ok(enEscuela.puede);
    assert.deepEqual(enEscuela.llamadas, [{ url: "/api/fotografo/school-order-items/2/mark-at-school" }]);
    const entregado = planDeAdelanto({ paso: "PARA_ENTREGAR", disenos: [], items: [{ id: 2, status: "AT_SCHOOL" }] });
    assert.ok(entregado.puede);
    assert.deepEqual(entregado.llamadas, [{ url: "/api/fotografo/school-order-items/2/mark-delivered" }]);
  });
});

describe("búsqueda", () => {
  it("sin tildes ni mayúsculas, todas las palabras", () => {
    const textos = ["Alés Facundo", "5° Año B", "Colegio San Patricio"];
    assert.equal(coincideBusqueda(textos, "ales"), true);
    assert.equal(coincideBusqueda(textos, "facundo patricio"), true);
    assert.equal(coincideBusqueda(textos, "facundo goethe"), false);
    assert.equal(coincideBusqueda(textos, "  "), true);
  });
});
