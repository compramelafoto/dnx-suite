// lib/course-marketplace/reventa.test.ts
import { describe, expect, it } from "vitest";
import {
  aplicarAccion,
  estadoAlPedir,
  mensajeDeAcuerdos,
  porcentajeABps,
  simularReventa,
  validarDescuentoDeSocios,
  validarOferta,
  validarPedidoDeReventa,
} from "./reventa";

const benef = [
  { id: "sfpr", nombre: "SFPR", bps: 3000, absorbeMp: false },
  { id: "prod", nombre: "Productora", bps: 2000, absorbeMp: false },
  { id: "doc", nombre: "Docente", bps: 5000, absorbeMp: true },
];

const pedidoBase = {
  pedidoBps: 2500,
  descuentoBps: 0,
  ofrecido: true,
  sugeridoBps: 2500,
  esDueno: false,
  esBeneficiario: false,
  cantidadBeneficiarios: 3,
  acuerdoVigente: false,
};

describe("porcentajes escritos a mano", () => {
  it("acepta coma, punto y el signo %", () => {
    expect(porcentajeABps("25")).toBe(2500);
    expect(porcentajeABps("12,5")).toBe(1250);
    expect(porcentajeABps("12.5 %")).toBe(1250);
  });
  it("vacío o basura es null", () => {
    expect(porcentajeABps("")).toBeNull();
    expect(porcentajeABps(undefined)).toBeNull();
    expect(porcentajeABps("mucho")).toBeNull();
  });
  it("rechaza notación científica, negativos y más de 2 decimales", () => {
    for (const x of ["1e1", "-5", "1.005", "  ", "1,2,3"]) expect(porcentajeABps(x)).toBeNull();
  });
});

describe("ofrecer un curso a otras instituciones", () => {
  it("apagado no pide nada", () => {
    expect(validarOferta({ ofrecido: false, sugeridoBps: null, grabadoConPrecio: false })).toEqual([]);
  });
  it("encendido exige grabado con precio y un sugerido entre 0 y 90%", () => {
    expect(validarOferta({ ofrecido: true, sugeridoBps: 2500, grabadoConPrecio: true })).toEqual([]);
    expect(validarOferta({ ofrecido: true, sugeridoBps: 2500, grabadoConPrecio: false }).join()).toMatch(/grabados con precio/);
    expect(validarOferta({ ofrecido: true, sugeridoBps: null, grabadoConPrecio: true }).join()).toMatch(/sugerido/);
    expect(validarOferta({ ofrecido: true, sugeridoBps: 9000, grabadoConPrecio: true })).toEqual([]);
    expect(validarOferta({ ofrecido: true, sugeridoBps: 9001, grabadoConPrecio: true }).join()).toMatch(/90%/);
    expect(validarOferta({ ofrecido: true, sugeridoBps: 0, grabadoConPrecio: true }).join()).toMatch(/mayor que 0/);
    expect(validarOferta({ ofrecido: true, sugeridoBps: 9500, grabadoConPrecio: true }).join()).toMatch(/90%/);
  });
});

describe("pedir una reventa", () => {
  it("hasta el sugerido queda activo al instante; por encima, pendiente", () => {
    expect(estadoAlPedir(2500, 2500)).toBe("ACTIVO");
    expect(estadoAlPedir(2000, 2500)).toBe("ACTIVO");
    expect(estadoAlPedir(2501, 2500)).toBe("PENDIENTE");
  });

  it("un pedido correcto no tiene errores", () => {
    expect(validarPedidoDeReventa(pedidoBase)).toEqual([]);
  });

  it("no se pide un curso que no se ofrece, el propio, uno donde ya sos beneficiario ni uno con acuerdo vigente", () => {
    expect(validarPedidoDeReventa({ ...pedidoBase, ofrecido: false }).join()).toMatch(/no se ofrece/);
    expect(validarPedidoDeReventa({ ...pedidoBase, esDueno: true }).join()).toMatch(/propio negocio/);
    expect(validarPedidoDeReventa({ ...pedidoBase, esBeneficiario: true }).join()).toMatch(/beneficiario/);
    expect(validarPedidoDeReventa({ ...pedidoBase, acuerdoVigente: true }).join()).toMatch(/Ya tenés un acuerdo/);
  });

  it("el % tiene que estar entre 0 y 100, sin incluirlos", () => {
    expect(validarPedidoDeReventa({ ...pedidoBase, pedidoBps: 0 }).join()).toMatch(/mayor que 0/);
    expect(validarPedidoDeReventa({ ...pedidoBase, pedidoBps: 10000 }).join()).toMatch(/menor que 100%/);
    expect(validarPedidoDeReventa({ ...pedidoBase, pedidoBps: null }).join()).toMatch(/mayor que 0/);
  });

  it("el descuento para socios no supera la parte del revendedor (regla del servidor)", () => {
    expect(validarPedidoDeReventa({ ...pedidoBase, descuentoBps: 2500 })).toEqual([]);
    expect(validarPedidoDeReventa({ ...pedidoBase, descuentoBps: 2600 }).join()).toMatch(/no puede superar 25%/);
    expect(validarDescuentoDeSocios(-1, 2500).join()).toMatch(/no es válido/);
  });

  it("no entra un revendedor si el curso ya llegó al máximo de cuentas de Mercado Pago", () => {
    expect(validarPedidoDeReventa({ ...pedidoBase, cantidadBeneficiarios: 10 })).toEqual([]);
    expect(validarPedidoDeReventa({ ...pedidoBase, cantidadBeneficiarios: 11 }).join()).toMatch(/máximo de cuentas/);
  });
});

describe("las transiciones de un acuerdo", () => {
  const pendiente = { status: "PENDIENTE" as const, pausadoPor: null };
  const activo = { status: "ACTIVO" as const, pausadoPor: null };

  it("sólo el dueño aprueba o rechaza, y sólo lo pendiente", () => {
    expect(aplicarAccion(pendiente, "APROBAR", "DUENO")).toEqual({ ok: true, status: "ACTIVO", pausadoPor: null });
    expect(aplicarAccion(pendiente, "RECHAZAR", "DUENO")).toEqual({ ok: true, status: "RECHAZADO", pausadoPor: null });
    expect(aplicarAccion(pendiente, "APROBAR", "REVENDEDOR")).toEqual({ ok: false, codigo: "no-es-dueno" });
    expect(aplicarAccion(activo, "APROBAR", "DUENO")).toEqual({ ok: false, codigo: "no-pendiente" });
  });

  it("cualquiera pausa lo activo; lo reanuda sólo quien lo pausó", () => {
    const pausado = aplicarAccion(activo, "PAUSAR", "REVENDEDOR");
    expect(pausado).toEqual({ ok: true, status: "PAUSADO", pausadoPor: "REVENDEDOR" });
    expect(aplicarAccion({ status: "PAUSADO", pausadoPor: "REVENDEDOR" }, "REANUDAR", "DUENO")).toEqual({ ok: false, codigo: "no-pausaste" });
    expect(aplicarAccion({ status: "PAUSADO", pausadoPor: "REVENDEDOR" }, "REANUDAR", "REVENDEDOR")).toEqual({ ok: true, status: "ACTIVO", pausadoPor: null });
    expect(aplicarAccion(pendiente, "PAUSAR", "DUENO")).toEqual({ ok: false, codigo: "no-activo" });
  });

  it("cualquiera termina lo vigente; lo terminado o rechazado no se vuelve a terminar", () => {
    expect(aplicarAccion(pendiente, "TERMINAR", "REVENDEDOR")).toEqual({ ok: true, status: "TERMINADO", pausadoPor: null });
    expect(aplicarAccion({ status: "PAUSADO", pausadoPor: "DUENO" }, "TERMINAR", "REVENDEDOR")).toEqual({ ok: true, status: "TERMINADO", pausadoPor: null });
    expect(aplicarAccion({ status: "TERMINADO", pausadoPor: null }, "TERMINAR", "DUENO")).toEqual({ ok: false, codigo: "ya-termino" });
    expect(aplicarAccion({ status: "RECHAZADO", pausadoPor: null }, "TERMINAR", "DUENO")).toEqual({ ok: false, codigo: "ya-termino" });
  });
});

describe("mensajes de la página de acuerdos", () => {
  it("traduce sólo códigos conocidos", () => {
    expect(mensajeDeAcuerdos("aprobado")).toMatch(/aprobaste/i);
    expect(mensajeDeAcuerdos("no-pausaste")).toMatch(/quien lo pausó/);
    expect(mensajeDeAcuerdos("<script>")).toBeNull();
    expect(mensajeDeAcuerdos(undefined)).toBeNull();
  });
});

describe("simular la reventa al pedirla (spec, sección 6)", () => {
  it("curso de $100.000 revendido al 25%: tu parte $25.000; tu socio con 25% paga $80.000", () => {
    const s = simularReventa({ listaCentavos: 10_000_000, comisionPlataformaBps: 500, beneficiarios: benef, pedidoBps: 2500, descuentoBps: 2500 });
    expect(s).toEqual({ ok: true, parteCentavos: 2_500_000, pagaElAlumno: 10_500_000, pagaElSocio: 8_000_000 });
  });

  it("devuelve los errores del motor", () => {
    const s = simularReventa({ listaCentavos: 10_000_000, comisionPlataformaBps: 500, beneficiarios: benef, pedidoBps: 2500, descuentoBps: 3000 });
    expect(s.ok).toBe(false);
  });
});
