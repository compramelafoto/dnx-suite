import { describe, expect, it } from "vitest";
import { CATALOGO_BOX_SOYBELUZ } from "./catalogo-soybeluz";
import {
  direccionDeEnvio,
  direccionLegible,
  esMesPagado,
  etiquetaBox,
  leerMateriales,
  materialesDesdeFormulario,
  mesesPagados,
  periodoArgentino,
  prepararCajas,
  recorridoBox,
  type CajaDelRecorrido,
  type CargoParaBox,
} from "./secuencia";

const PAGO = new Date("2026-11-05T15:00:00Z");
const HOY = new Date("2026-11-09T15:00:00Z");

const cuota = (period: string, extra: Partial<CargoParaBox> = {}): CargoParaBox => ({
  concept: "MENSUAL",
  period,
  amountMinor: 1_500_000,
  balanceMinor: 0,
  acreditadoEn: PAGO,
  ...extra,
});

const cajas = (n: number): CajaDelRecorrido[] =>
  Array.from({ length: n }, (_, i) => ({ id: `box${i + 1}`, number: i + 1, name: `Caja ${i + 1}`, isActive: true }));

const meses = (n: number): Date[] => Array.from({ length: n }, (_, i) => new Date(Date.UTC(2026, i, 5)));

describe("periodoArgentino", () => {
  it("usa el mes de Argentina, no el de UTC", () => {
    // 1/12 a las 01:00 UTC todavía es 30/11 en Argentina.
    expect(periodoArgentino(new Date("2026-12-01T01:00:00Z"))).toBe("2026-11");
    expect(periodoArgentino(new Date("2026-12-01T04:00:00Z"))).toBe("2026-12");
  });
});

describe("esMesPagado", () => {
  it("una cuota mensual cancelada con un pago acreditado cuenta", () => {
    expect(esMesPagado(cuota("2026-11"), "2026-11")).toBe(true);
  });

  it("las cuotas de ingreso son meses y cuentan igual", () => {
    expect(esMesPagado(cuota("2026-11", { concept: "INGRESO" }), "2026-11")).toBe(true);
  });

  it("una renovación acreditada (categoría que se renueva cuando quiere) cuenta", () => {
    expect(esMesPagado(cuota("RENOV-20261105-120000", { concept: "OTRO" }), "2026-11")).toBe(true);
  });

  it("con saldo pendiente no cuenta, aunque haya un pago parcial", () => {
    expect(esMesPagado(cuota("2026-11", { balanceMinor: 100 }), "2026-11")).toBe(false);
  });

  it("sin pago acreditado no cuenta (pendiente, rechazado o devuelto)", () => {
    expect(esMesPagado(cuota("2026-11", { acreditadoEn: null }), "2026-11")).toBe(false);
  });

  it("un mes adelantado no cuenta hasta que empieza", () => {
    expect(esMesPagado(cuota("2026-12"), "2026-11")).toBe(false);
    expect(esMesPagado(cuota("2026-12"), "2026-12")).toBe(true);
  });

  it("no cuentan la extraordinaria, el carnet impreso, la apertura ni un cargo en cero", () => {
    expect(esMesPagado(cuota("2026-11", { concept: "EXTRAORDINARIA" }), "2026-11")).toBe(false);
    expect(esMesPagado(cuota("TARJETA", { concept: "OTRO" }), "2026-11")).toBe(false);
    expect(esMesPagado(cuota("APERTURA", { concept: "OTRO" }), "2026-11")).toBe(false);
    expect(esMesPagado(cuota("2026-11", { amountMinor: 0 }), "2026-11")).toBe(false);
  });
});

describe("mesesPagados", () => {
  it("cuenta un mes por cuota pagada y los ordena del más viejo al más nuevo", () => {
    const r = mesesPagados(
      [
        cuota("2026-10", { acreditadoEn: new Date("2026-10-08T12:00:00Z") }),
        cuota("2026-09", { acreditadoEn: new Date("2026-09-08T12:00:00Z") }),
      ],
      HOY,
    );
    expect(r.map((d) => d.toISOString())).toEqual(["2026-09-08T12:00:00.000Z", "2026-10-08T12:00:00.000Z"]);
  });

  it("un mes que no pagó no suma: sigue donde quedó", () => {
    const r = mesesPagados([cuota("2026-08"), cuota("2026-09", { balanceMinor: 1_500_000, acreditadoEn: null }), cuota("2026-10")], HOY);
    expect(r).toHaveLength(2);
  });

  it("un adelanto habilita la caja recién cuando empieza el mes", () => {
    const adelantado = cuota("2026-11", { acreditadoEn: new Date("2026-09-20T12:00:00Z") });
    const [desde] = mesesPagados([adelantado], HOY);
    expect(desde?.toISOString()).toBe("2026-11-01T03:00:00.000Z");
    expect(mesesPagados([cuota("2026-12"), cuota("2027-01")], HOY)).toHaveLength(0);
  });

  it("el mismo mes no cuenta dos veces aunque tenga dos cargos", () => {
    expect(mesesPagados([cuota("2026-10"), cuota("2026-10", { concept: "INGRESO" })], HOY)).toHaveLength(1);
  });

  it("dos renovaciones en el mismo mes son dos meses pagados", () => {
    const r = mesesPagados(
      [cuota("RENOV-20261101-100000", { concept: "OTRO" }), cuota("RENOV-20261108-100000", { concept: "OTRO" })],
      HOY,
    );
    expect(r).toHaveLength(2);
  });
});

describe("recorridoBox", () => {
  it("quien recién se suma y pagó su primer mes recibe la BOX N°1, sin importar cuándo entró", () => {
    const r = recorridoBox({ meses: meses(1), cajasEnviadas: [], cajas: cajas(10) });
    expect(r.estado).toBe("PARA_ENVIAR");
    expect(r.proxima?.number).toBe(1);
    expect(r.porEnviar.map((c) => c.number)).toEqual([1]);
  });

  it("con todas las cajas de sus meses enviadas, espera el próximo pago", () => {
    const r = recorridoBox({ meses: meses(3), cajasEnviadas: ["box1", "box2", "box3"], cajas: cajas(10) });
    expect(r.estado).toBe("ESPERANDO_PAGO");
    expect(r.proxima?.number).toBe(4);
    expect(r.pendientes).toBe(0);
    expect(r.porEnviar).toEqual([]);
    expect(r.esperaDesde).toBeNull();
  });

  it("si debe dos cajas, hacen falta las dos siguientes y espera desde el primer mes sin caja", () => {
    const m = meses(4);
    const r = recorridoBox({ meses: m, cajasEnviadas: ["box1", "box2"], cajas: cajas(10) });
    expect(r.pendientes).toBe(2);
    expect(r.porEnviar.map((c) => c.number)).toEqual([3, 4]);
    expect(r.esperaDesde).toEqual(m[2]);
  });

  it("después de la N°10 queda al día: no vuelve a la N°1", () => {
    const enviadas = cajas(10).map((c) => c.id);
    const r = recorridoBox({ meses: meses(11), cajasEnviadas: enviadas, cajas: cajas(10) });
    expect(r.estado).toBe("AL_DIA");
    expect(r.proxima).toBeNull();
    expect(r.porEnviar).toEqual([]);
  });

  it("cuando se carga la N°11, sigue con esa", () => {
    const enviadas = cajas(10).map((c) => c.id);
    const r = recorridoBox({ meses: meses(11), cajasEnviadas: enviadas, cajas: cajas(11) });
    expect(r.estado).toBe("PARA_ENVIAR");
    expect(r.proxima?.number).toBe(11);
  });

  it("una caja desactivada no se ofrece y se pasa a la siguiente", () => {
    const lista = cajas(3).map((c) => (c.number === 2 ? { ...c, isActive: false } : c));
    const r = recorridoBox({ meses: meses(2), cajasEnviadas: ["box1"], cajas: lista });
    expect(r.proxima?.number).toBe(3);
  });

  it("una caja desactivada que ya recibió sigue contando como enviada", () => {
    const lista = cajas(3).map((c) => (c.number === 1 ? { ...c, isActive: false } : c));
    const r = recorridoBox({ meses: meses(1), cajasEnviadas: ["box1"], cajas: lista });
    expect(r.enviadas).toBe(1);
    expect(r.estado).toBe("ESPERANDO_PAGO");
  });

  it("si un pago se revierte después de enviar, no queda debiendo cajas negativas", () => {
    const r = recorridoBox({ meses: meses(1), cajasEnviadas: ["box1", "box2"], cajas: cajas(10) });
    expect(r.pendientes).toBe(0);
    expect(r.estado).toBe("ESPERANDO_PAGO");
  });

  it("sin meses pagados no hay nada para enviar", () => {
    const r = recorridoBox({ meses: [], cajasEnviadas: [], cajas: cajas(10) });
    expect(r.estado).toBe("ESPERANDO_PAGO");
    expect(r.proxima?.number).toBe(1);
  });
});

describe("prepararCajas", () => {
  const catalogo = [
    { id: "box1", number: 1, name: "Uno", materials: [{ material: "Lápiz HB", perBox: 1 }, { material: "Tarjetas", perBox: 5 }] },
    { id: "box2", number: 2, name: "Dos", materials: [{ material: "lápiz hb", perBox: 2 }] },
    { id: "box3", number: 3, name: "Tres", materials: [{ material: "Goma", perBox: 1 }] },
  ];

  it("cuenta cuántas cajas de cada BOX hacen falta y multiplica los materiales", () => {
    const r = prepararCajas([[{ id: "box1" }], [{ id: "box1" }], [{ id: "box2" }]], catalogo);
    expect(r.totalCajas).toBe(3);
    expect(r.porCaja.map((f) => [f.caja.number, f.cantidad])).toEqual([[1, 2], [2, 1]]);
    expect(r.porCaja[0]?.materiales).toEqual([
      { material: "Lápiz HB", perBox: 1, total: 2 },
      { material: "Tarjetas", perBox: 5, total: 10 },
    ]);
  });

  it("suma el mismo material de distintas cajas en una sola fila de compra", () => {
    const r = prepararCajas([[{ id: "box1" }, { id: "box2" }]], catalogo);
    expect(r.totales).toEqual([
      { material: "Lápiz HB", total: 3 },
      { material: "Tarjetas", total: 5 },
    ]);
  });

  it("sin nadie para enviar, no hay nada que preparar", () => {
    expect(prepararCajas([], catalogo)).toEqual({ porCaja: [], totales: [], totalCajas: 0 });
  });
});

describe("materiales", () => {
  it("leerMateriales descarta lo que no tiene forma de material", () => {
    expect(
      leerMateriales([{ material: " Goma ", perBox: 1 }, { material: "", perBox: 1 }, { material: "X", perBox: 0 }, "basura"]),
    ).toEqual([{ material: "Goma", perBox: 1 }]);
    expect(leerMateriales(null)).toEqual([]);
  });

  it("materialesDesdeFormulario ignora filas vacías y exige cantidades enteras", () => {
    expect(materialesDesdeFormulario(["Goma", "", "Lápiz"], ["1", "", "2"])).toEqual({
      ok: true,
      materiales: [
        { material: "Goma", perBox: 1 },
        { material: "Lápiz", perBox: 2 },
      ],
    });
    expect(materialesDesdeFormulario(["Goma"], ["1,5"]).ok).toBe(false);
    expect(materialesDesdeFormulario(["", ], ["3"]).ok).toBe(false);
  });
});

describe("dirección de envío", () => {
  it("sin calle o sin localidad no se puede enviar", () => {
    expect(direccionDeEnvio({ address: "  ", city: "Rafaela", province: null, postalCode: null })).toBeNull();
    expect(direccionDeEnvio({ address: "San Martín 100", city: null, province: null, postalCode: null })).toBeNull();
  });

  it("copia la dirección limpia y la muestra legible", () => {
    const d = direccionDeEnvio({ address: " San Martín 100 ", city: "Rafaela", province: "Santa Fe", postalCode: "2300" });
    expect(d).toEqual({ address: "San Martín 100", city: "Rafaela", province: "Santa Fe", postalCode: "2300" });
    expect(direccionLegible(d!)).toBe("San Martín 100, Rafaela, Santa Fe (CP 2300)");
  });
});

describe("catálogo de SOYBELUZ", () => {
  it("son las 10 cajas, numeradas del 1 al 10, con materiales válidos", () => {
    expect(CATALOGO_BOX_SOYBELUZ.map((c) => c.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const caja of CATALOGO_BOX_SOYBELUZ) {
      expect(caja.materials.length).toBeGreaterThan(0);
      expect(leerMateriales(caja.materials)).toEqual(caja.materials);
    }
  });

  it("se muestran como «BOX N°1 — nombre»", () => {
    expect(etiquetaBox(CATALOGO_BOX_SOYBELUZ[0]!)).toBe("BOX N°1 — Mi primer universo creativo: Soltar la mano");
    expect(etiquetaBox(CATALOGO_BOX_SOYBELUZ[9]!)).toBe("BOX N°10 — Encontrar mi propio trazo");
  });
});
