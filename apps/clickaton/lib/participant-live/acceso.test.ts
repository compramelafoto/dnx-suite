import assert from "node:assert/strict";
import test from "node:test";

import { puedeVerLaPantallaDelParticipante } from "./acceso";

/**
 * Quién puede abrir la pantalla "en vivo" de una inscripción.
 *
 * La regla de siempre: sólo su dueño. La excepción nueva: un administrador
 * puede mirar la de un participante ficticio, y sólo si la edición está
 * marcada como copia de ensayo. Sin esa marca, ni un administrador entra: las
 * inscripciones de gente real no se espían desde el panel.
 */

const DUENO = { actorId: 7, actorEmail: "ana@example.com", esAdmin: false };
const INSCRIPCION = {
  userId: 7,
  email: "ana@example.com",
  edicionEsCopiaDeEnsayo: false,
};

test("el dueño ve su pantalla", () => {
  assert.equal(puedeVerLaPantallaDelParticipante(DUENO, INSCRIPCION), true);
});

test("el dueño la ve aunque el correo esté en mayúsculas", () => {
  assert.equal(
    puedeVerLaPantallaDelParticipante(
      { ...DUENO, actorId: 999, actorEmail: "ANA@EXAMPLE.COM" },
      INSCRIPCION,
    ),
    true,
  );
});

test("otra persona no ve una inscripción ajena", () => {
  assert.equal(
    puedeVerLaPantallaDelParticipante(
      { actorId: 8, actorEmail: "otro@example.com", esAdmin: false },
      INSCRIPCION,
    ),
    false,
  );
});

test("un administrador NO ve la inscripción de una persona real", () => {
  assert.equal(
    puedeVerLaPantallaDelParticipante(
      { actorId: 1, actorEmail: "admin@example.com", esAdmin: true },
      INSCRIPCION,
    ),
    false,
  );
});

test("un administrador sí ve la del participante ficticio de un ensayo", () => {
  assert.equal(
    puedeVerLaPantallaDelParticipante(
      { actorId: 1, actorEmail: "admin@example.com", esAdmin: true },
      { ...INSCRIPCION, edicionEsCopiaDeEnsayo: true },
    ),
    true,
  );
});

test("alguien que no es administrador no entra ni en una copia de ensayo", () => {
  assert.equal(
    puedeVerLaPantallaDelParticipante(
      { actorId: 8, actorEmail: "otro@example.com", esAdmin: false },
      { ...INSCRIPCION, edicionEsCopiaDeEnsayo: true },
    ),
    false,
  );
});

test("sin correo ni usuario que coincidan, no alcanza con que la edición sea de ensayo", () => {
  assert.equal(
    puedeVerLaPantallaDelParticipante(
      { actorId: 8, actorEmail: "otro@example.com", esAdmin: false },
      { userId: null, email: "ficticio@clickaton.test", edicionEsCopiaDeEnsayo: true },
    ),
    false,
  );
});
