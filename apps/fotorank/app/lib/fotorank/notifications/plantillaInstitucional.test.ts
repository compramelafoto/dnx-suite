/**
 * Los correos de FotoRank salían como "Evento: <tipo>" con los datos crudos.
 * Estas pruebas fijan que cada tipo tenga texto propio y el marco institucional.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { componerCorreo } from "./plantillaInstitucional";
import { TRANSACTIONAL_EMAIL_TEMPLATES, type TransactionalEmailKind } from "./outbox";

const BASE = "https://fotorank.com";
const DATOS = {
  firstName: "Belén",
  contestTitle: "Retratos 2026",
  organizationName: "CASAMAR",
  nombre: "Melisa Risso",
  respuesta: "aceptada",
  resultado: "aprobada",
  verifyUrl: `${BASE}/jurados/verificar/abc`,
  resetUrl: `${BASE}/jurado/recuperar/xyz`,
  colaUrl: `${BASE}/super-admin/jurados`,
  registrationNumber: "R-12",
  anonymousCode: "GENERA-0001",
  horas: 2,
};

test("todos los tipos de correo tienen texto propio, no el nombre técnico", () => {
  for (const kind of Object.keys(TRANSACTIONAL_EMAIL_TEMPLATES) as TransactionalEmailKind[]) {
    const c = componerCorreo(kind, DATOS, BASE);
    assert.ok(c.asunto.length > 0, kind);
    assert.ok(!c.asunto.includes("{{"), `${kind}: asunto sin reemplazar`);
    assert.ok(!c.html.includes(kind), `${kind}: el cuerpo nombra el tipo técnico`);
    assert.ok(!c.texto.includes("Evento:"), kind);
    assert.ok(c.html.includes(`${BASE}/fotorank-email-logo.png`), `${kind}: sin logo`);
  }
});

test("la invitación a jurado nombra concurso y organización y lleva a responderla", () => {
  const c = componerCorreo("JURY_INVITATION", DATOS, BASE);
  assert.match(c.asunto, /Retratos 2026/);
  assert.match(c.html, /CASAMAR/);
  assert.match(c.html, /\/jurado\/invitaciones/);
});

test("lo que escribe una persona no se interpreta como HTML", () => {
  const c = componerCorreo("JURY_INVITATION", { ...DATOS, mensaje: '<script>x</script>' }, BASE);
  assert.ok(!c.html.includes("<script>"));
  assert.match(c.html, /&lt;script&gt;/);
});

test("la respuesta al organizador distingue aceptar de rechazar", () => {
  assert.match(componerCorreo("JURY_INVITATION_ANSWERED", DATOS, BASE).asunto, /aceptó/);
  assert.match(
    componerCorreo("JURY_INVITATION_ANSWERED", { ...DATOS, respuesta: "rechazada" }, BASE).asunto,
    /rechazó/,
  );
});
