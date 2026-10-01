import { describe, expect, test } from "vitest";
import {
  DIAS_DE_RETENCION,
  HORAS_DE_PAGO_EN_CURSO,
  desdeCuandoUnPagoSigueEnCurso,
  motivoParaNoBorrar,
  retencionHasta,
} from "./candado";

const AHORA = new Date("2026-11-10T12:00:00Z");

/** Un evento que ya venció y no tiene nada que lo frene. */
const LIBRE = {
  retentionUntil: new Date("2026-11-10T00:00:00Z"),
  purgedAt: null,
  ahora: AHORA,
  pagosEnCurso: 0,
  disputas: 0,
  entregasPendientes: 0,
  paquetesEnCurso: 0,
} as const;

describe("cuánto dura el material", () => {
  test("son 30 días desde el cierre", () => {
    expect(DIAS_DE_RETENCION).toBe(30);
    expect(retencionHasta(new Date("2026-10-11T08:00:00Z"))).toEqual(
      new Date("2026-11-10T08:00:00Z"),
    );
  });
});

describe("el candado del borrado", () => {
  test("sin nada que lo frene, se borra", () => {
    expect(motivoParaNoBorrar(LIBRE)).toBeNull();
  });

  test("lo que ya se borró no se vuelve a borrar", () => {
    expect(motivoParaNoBorrar({ ...LIBRE, purgedAt: new Date("2026-11-10T01:00:00Z") })).toBe(
      "ya-borrado",
    );
  });

  test("un evento sin plazo no se toca", () => {
    expect(motivoParaNoBorrar({ ...LIBRE, retentionUntil: null })).toBe("sin-plazo");
  });

  test("antes del vencimiento no se borra", () => {
    const r = motivoParaNoBorrar({ ...LIBRE, ahora: new Date("2026-11-09T23:59:59Z") });
    expect(r).toBe("no-vencio");
  });

  test("en el minuto exacto del vencimiento ya se puede borrar", () => {
    expect(motivoParaNoBorrar({ ...LIBRE, ahora: LIBRE.retentionUntil })).toBeNull();
  });

  test("un pago en curso frena el borrado", () => {
    expect(motivoParaNoBorrar({ ...LIBRE, pagosEnCurso: 1 })).toBe("pago-en-curso");
  });

  test("una disputa abierta frena el borrado", () => {
    expect(motivoParaNoBorrar({ ...LIBRE, disputas: 1 })).toBe("disputa-abierta");
  });

  test("una entrega que nunca salió frena el borrado", () => {
    expect(motivoParaNoBorrar({ ...LIBRE, entregasPendientes: 1 })).toBe("entrega-pendiente");
  });

  test("un paquete a medio armar frena el borrado", () => {
    expect(motivoParaNoBorrar({ ...LIBRE, paquetesEnCurso: 1 })).toBe("paquete-en-curso");
  });

  test("el borrado se revisa antes que los frenos", () => {
    // Si ya se borró, no importa lo que haya quedado dando vueltas.
    const r = motivoParaNoBorrar({ ...LIBRE, purgedAt: AHORA, pagosEnCurso: 3, disputas: 2 });
    expect(r).toBe("ya-borrado");
  });

  test("la disputa pesa más que el pago en curso", () => {
    // El motivo que se anota tiene que ser el más grave de los que aplican.
    expect(motivoParaNoBorrar({ ...LIBRE, pagosEnCurso: 1, disputas: 1 })).toBe("disputa-abierta");
  });
});

describe("desde cuándo un pago sigue en curso", () => {
  test("la ventana es de 72 horas", () => {
    expect(HORAS_DE_PAGO_EN_CURSO).toBe(72);
  });

  test("devuelve el momento a partir del cual un pendiente todavía cuenta", () => {
    expect(desdeCuandoUnPagoSigueEnCurso(AHORA)).toEqual(new Date("2026-11-07T12:00:00Z"));
  });
});
