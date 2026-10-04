import test from "node:test";
import assert from "node:assert/strict";

import {
  puedeEntrarConLaSesionDelSitio,
  type CuentaDeJuradoParaPuente,
  type UsuarioDelSitio,
} from "./puenteDeSesion";

const AYER = new Date("2026-09-21T10:00:00Z");

function usuario(p: Partial<UsuarioDelSitio> = {}): UsuarioDelSitio {
  return { email: "jurado@ejemplo.com", emailVerifiedAt: AYER, ...p };
}

function jurado(p: Partial<CuentaDeJuradoParaPuente> = {}): CuentaDeJuradoParaPuente {
  return { accountStatus: "ACTIVE", emailVerifiedAt: AYER, ...p };
}

test("con las dos puntas confirmadas, entra sin pedir la otra contraseña", () => {
  const r = puedeEntrarConLaSesionDelSitio({ usuario: usuario(), cuentaDeJurado: jurado() });
  assert.equal(r.ok, true);
});

test("sin sesión del sitio no hay puente", () => {
  const r = puedeEntrarConLaSesionDelSitio({ usuario: null, cuentaDeJurado: jurado() });
  assert.equal(r.ok, false);
  assert.ok(!r.ok && r.razon === "SIN_SESION_DE_SITIO");
});

test("quien no es jurado no entra al panel de jurado", () => {
  const r = puedeEntrarConLaSesionDelSitio({ usuario: usuario(), cuentaDeJurado: null });
  assert.equal(r.ok, false);
  assert.ok(!r.ok && r.razon === "SIN_CUENTA_DE_JURADO");
});

test("una cuenta suspendida o dada de baja no entra", () => {
  for (const accountStatus of ["SUSPENDED", "DISABLED"]) {
    const r = puedeEntrarConLaSesionDelSitio({
      usuario: usuario(),
      cuentaDeJurado: jurado({ accountStatus }),
    });
    assert.equal(r.ok, false, `${accountStatus} no debería entrar`);
    assert.ok(!r.ok && r.razon === "CUENTA_NO_ACTIVA");
  }
});

test("una cuenta invitada tampoco: el atajo del menú es más permisivo que la puerta", () => {
  const r = puedeEntrarConLaSesionDelSitio({
    usuario: usuario(),
    cuentaDeJurado: jurado({ accountStatus: "INVITED" }),
  });
  assert.equal(r.ok, false);
  assert.ok(!r.ok && r.razon === "CUENTA_NO_ACTIVA");
});

/**
 * El caso que hace que todo esto sea necesario: el registro del sitio abre
 * sesión sin esperar la confirmación, así que una sesión activa no prueba, por
 * sí sola, que esa persona controle el buzón.
 */
test("con el correo del sitio sin confirmar no se abre el puente", () => {
  const r = puedeEntrarConLaSesionDelSitio({
    usuario: usuario({ emailVerifiedAt: null }),
    cuentaDeJurado: jurado(),
  });
  assert.equal(r.ok, false);
  assert.ok(!r.ok && r.razon === "FALTA_CONFIRMAR_EL_CORREO_DEL_SITIO");
});

test("quien se anotó en el sitio con un correo ajeno no entra al panel de su dueño", () => {
  // El atacante tiene sesión (el registro se la da) pero nunca confirmó nada.
  // La ficha de jurado sí está confirmada, porque es de la víctima.
  const r = puedeEntrarConLaSesionDelSitio({
    usuario: usuario({ emailVerifiedAt: null }),
    cuentaDeJurado: jurado({ emailVerifiedAt: AYER }),
  });
  assert.equal(r.ok, false, "la sesión sola no puede alcanzar");
});
