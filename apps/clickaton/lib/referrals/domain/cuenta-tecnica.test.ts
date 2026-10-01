import assert from "node:assert/strict";
import test from "node:test";

import { esCuentaTecnica } from "./cuenta-tecnica";

test("las cuentas que dejan las pruebas automatizadas no reciben correo", () => {
  // Existía una de verdad en producción: e2e.live.10g7.e30d21@dnxsuite.com.
  assert.equal(esCuentaTecnica("e2e.live.10g7.e30d21@dnxsuite.com"), true);
  assert.equal(esCuentaTecnica("smoke.checkout.abc@dnxsuite.com"), true);
  assert.equal(esCuentaTecnica("fixture.pago@dnxsuite.com"), true);
});

test("cualquier dirección del dominio interno queda afuera", () => {
  assert.equal(esCuentaTecnica("loquesea@dnxsuite.com"), true);
  assert.equal(esCuentaTecnica("LoQueSea@DnxSuite.com"), true, "sin importar mayúsculas");
});

test("las direcciones de gente real sí reciben", () => {
  // La última es la trampa: empieza parecido a un prefijo técnico pero es
  // una persona.
  for (const email of [
    "cuart.daniel@gmail.com",
    "erikitalangner@gmail.com",
    "nora_cslt131@hotmail.com",
    "e2etrabajo@gmail.com",
  ]) {
    assert.equal(esCuentaTecnica(email), false, `${email} debería recibir`);
  }
});

test("los espacios alrededor no engañan al filtro", () => {
  assert.equal(esCuentaTecnica("  e2e.algo@dnxsuite.com  "), true);
});
