import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isTestAccountIdentity } from "./live-account-guard.js";

describe("detección de cuentas de prueba de Mercado Pago", () => {
  it("reconoce la cuenta de prueba que causó el 403 del 2026-11-02", () => {
    assert.equal(
      isTestAccountIdentity({
        id: "3141372692",
        nickname: "TESTUSER313600323196489184",
        email: "test_user_313600323196489184@testuser.com",
      }),
      true,
    );
  });

  it("alcanza con el apodo, sin importar las mayúsculas", () => {
    assert.equal(
      isTestAccountIdentity({ id: "1", nickname: "testuser999", email: null }),
      true,
    );
    assert.equal(
      isTestAccountIdentity({ id: "1", nickname: "TEST_USER_42", email: null }),
      true,
    );
  });

  it("alcanza con el dominio del correo, sin apodo", () => {
    assert.equal(
      isTestAccountIdentity({ id: "1", nickname: null, email: "alguien@testuser.com" }),
      true,
    );
  });

  it("acepta una cuenta real", () => {
    assert.equal(
      isTestAccountIdentity({
        id: "123456789",
        nickname: "DNXFOTOGRAFIA",
        email: "dnxfotografia@gmail.com",
      }),
      false,
    );
  });

  it("no confunde una cuenta real cuyo apodo arranca con TEST pero no es un usuario de prueba", () => {
    // "TESTIMONIOS" no es "TESTUSER": el prefijo que marca la prueba es el completo.
    assert.equal(
      isTestAccountIdentity({ id: "9", nickname: "TESTIMONIOS", email: "hola@ejemplo.com" }),
      false,
    );
  });

  it("no confunde un dominio parecido", () => {
    assert.equal(
      isTestAccountIdentity({ id: "9", nickname: "REAL", email: "hola@testuser.com.ar" }),
      false,
    );
  });

  it("con identidad vacía no afirma que sea de prueba: eso lo frena otro control", () => {
    assert.equal(isTestAccountIdentity({ id: null, nickname: null, email: null }), false);
    assert.equal(isTestAccountIdentity({ id: "1", nickname: "  ", email: "  " }), false);
  });
});
