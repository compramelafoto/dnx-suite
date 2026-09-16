import { describe, expect, test } from "vitest";
import { decidirDesdeElPago } from "./aviso";

const PAGO = {
  id: 123456789,
  status: "approved",
  external_reference: "subilafoto-orden-cmtzuj5rr0001jq046f51k9st",
};
const ORDEN = "cmtzuj5rr0001jq046f51k9st";

describe("qué hacer con un aviso de Mercado Pago", () => {
  test("un pago aprobado marca la orden como pagada", () => {
    expect(decidirDesdeElPago(PAGO)).toEqual({
      accion: "PAGAR",
      ordenId: ORDEN,
      mpPaymentId: "123456789",
    });
  });

  test.each(["rejected", "cancelled"])("un pago %s marca la orden como fallida", (status) => {
    expect(decidirDesdeElPago({ ...PAGO, status }).accion).toBe("FALLAR");
  });

  test.each(["pending", "in_process", "authorized"])("un pago %s no se toca todavía", (status) => {
    expect(decidirDesdeElPago({ ...PAGO, status }).accion).toBe("ESPERAR");
  });

  test.each(["refunded", "charged_back"])("un %s marca la devolución", (status) => {
    expect(decidirDesdeElPago({ ...PAGO, status }).accion).toBe("DEVOLVER");
  });

  test("un estado que no conocemos no se interpreta", () => {
    expect(decidirDesdeElPago({ ...PAGO, status: "algo_nuevo" }).accion).toBe("IGNORAR");
  });

  test("un aviso de otro producto de la suite se ignora", () => {
    // La cuenta de Mercado Pago es la misma para toda la suite. Sin esta
    // comprobación, un pago de Clickatón podría tocar una orden de SubiLaFoto
    // que por casualidad tenga ese identificador.
    for (const ajena of [
      "clickaton-registration-cmtzuj5rr0001jq046f51k9st",
      "fotoffice-cuota-abc",
      "cmtzuj5rr0001jq046f51k9st",
      null,
      "",
    ]) {
      expect(decidirDesdeElPago({ ...PAGO, external_reference: ajena }).accion).toBe("IGNORAR");
    }
  });

  test("el id del pago siempre viaja como texto", () => {
    // Mercado Pago lo manda como número y la base lo guarda como texto. Guardarlo
    // a veces de una forma y a veces de otra dejaría inservible la restricción de
    // unicidad, y un aviso repetido crearía dos eventos.
    const r = decidirDesdeElPago({ ...PAGO, id: 987 });
    expect(r.accion === "PAGAR" && r.mpPaymentId).toBe("987");
  });
});
