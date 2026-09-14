import { describe, expect, test } from "vitest";
import { decidirDesdeElPago } from "./aviso";

const PAGO = { id: 123456789, status: "approved", external_reference: "orden-1" };

describe("qué hacer con un aviso de Mercado Pago", () => {
  test("un pago aprobado marca la orden como pagada", () => {
    expect(decidirDesdeElPago(PAGO)).toEqual({
      accion: "PAGAR",
      ordenId: "orden-1",
      mpPaymentId: "123456789",
    });
  });

  test.each(["rejected", "cancelled"])("un pago %s marca la orden como fallida", (status) => {
    expect(decidirDesdeElPago({ ...PAGO, status })).toEqual({
      accion: "FALLAR",
      ordenId: "orden-1",
      mpPaymentId: "123456789",
    });
  });

  test.each(["pending", "in_process", "authorized"])("un pago %s no se toca todavía", (status) => {
    // Va a llegar otro aviso cuando se resuelva. Marcar algo ahora sería
    // adelantarse: un `in_process` termina aprobado la mayoría de las veces.
    expect(decidirDesdeElPago({ ...PAGO, status }).accion).toBe("ESPERAR");
  });

  test.each(["refunded", "charged_back"])("un %s marca la devolución", (status) => {
    expect(decidirDesdeElPago({ ...PAGO, status }).accion).toBe("DEVOLVER");
  });

  test("un estado que no conocemos no se interpreta", () => {
    // Mercado Pago puede agregar estados. Adivinar qué significa uno nuevo es
    // peor que no hacer nada: el aviso queda registrado y se mira a mano.
    expect(decidirDesdeElPago({ ...PAGO, status: "algo_nuevo" }).accion).toBe("IGNORAR");
  });

  test("sin referencia de orden no se puede hacer nada", () => {
    expect(decidirDesdeElPago({ ...PAGO, external_reference: null }).accion).toBe("IGNORAR");
    expect(decidirDesdeElPago({ ...PAGO, external_reference: "" }).accion).toBe("IGNORAR");
  });

  test("el id del pago siempre viaja como texto", () => {
    // Mercado Pago lo manda como número y la base lo guarda como texto. Si se
    // guardara a veces de una forma y a veces de otra, la restricción de
    // unicidad no serviría para nada y un aviso repetido crearía dos eventos.
    const r = decidirDesdeElPago({ ...PAGO, id: 987 });
    expect(r.accion === "PAGAR" && r.mpPaymentId).toBe("987");
  });
});
