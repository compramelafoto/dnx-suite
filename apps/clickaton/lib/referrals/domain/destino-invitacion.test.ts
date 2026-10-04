import assert from "node:assert/strict";
import test from "node:test";

import { destinoDeLaInvitacion } from "./destino-invitacion";

const ABIERTA = {
  slug: "navidad-2026",
  isPublished: true,
  registrationEnabled: true,
  status: "REGISTRATION_OPEN",
  isOpsFixture: false,
};

test("manda a la inscripción de la edición abierta", () => {
  assert.equal(destinoDeLaInvitacion([ABIERTA]), "/maratones/navidad-2026/inscripcion");
});

test("sin ninguna edición abierta manda al listado, no a un 404", () => {
  assert.equal(destinoDeLaInvitacion([]), "/maratones");
});

test("entre varias, gana la más vigente", () => {
  const destino = destinoDeLaInvitacion([
    { ...ABIERTA, slug: "vieja", status: "COMPLETED", registrationEnabled: false },
    { ...ABIERTA, slug: "actual" },
  ]);
  assert.equal(destino, "/maratones/actual/inscripcion");
});

test("una edición sin publicar no recibe invitados", () => {
  const destino = destinoDeLaInvitacion([{ ...ABIERTA, isPublished: false }]);
  assert.equal(destino, "/maratones");
});

test("una edición con la inscripción cerrada manda a su ficha, no al formulario", () => {
  // Mejor que vea de qué se trata a que choque contra un formulario cerrado.
  const destino = destinoDeLaInvitacion([
    { ...ABIERTA, registrationEnabled: false, status: "REGISTRATION_CLOSED" },
  ]);
  assert.equal(destino, "/maratones/navidad-2026");
});

test("una edición de prueba NUNCA recibe invitados", () => {
  // Un invitado real no puede aterrizar en una demo que cobra de verdad.
  const destino = destinoDeLaInvitacion([{ ...ABIERTA, isOpsFixture: true }]);
  assert.equal(destino, "/maratones");
});

test("el destino nunca queda vacío", () => {
  for (const candidatas of [[], [{ ...ABIERTA, isOpsFixture: true }]]) {
    assert.ok(destinoDeLaInvitacion(candidatas).startsWith("/"));
  }
});
