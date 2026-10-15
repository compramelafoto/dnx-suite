import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { fechaCorta, fechaParaInput, textoMandato } from "./fechas";

describe("fechas de la comisión, en hora argentina", () => {
  // Fin de mandato como lo guarda parseTermDates: 31/12/2027 23:59:59.999 de Buenos Aires.
  const fin = new Date(Date.UTC(2028, 0, 1, 2, 59, 59, 999));

  it("el fin de mandato no se corre al día siguiente", () => {
    assert.equal(fechaCorta(fin), "31/12/2027");
    assert.equal(textoMandato(fin), "hasta 31/12/2027");
  });

  it("sin fecha de fin dice que no vence", () => {
    assert.equal(textoMandato(null), "sin vencimiento");
  });

  it("el valor del input de fecha es AAAA-MM-DD en hora argentina", () => {
    assert.equal(fechaParaInput(fin), "2027-12-31");
    assert.equal(fechaParaInput(null), "");
  });
});
