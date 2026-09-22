import assert from "node:assert/strict";
import { test } from "node:test";
import {
  authorRoleLabel,
  MIN_TESTIMONIALS_TO_SHOW,
  shouldRenderVoices,
  testimonialPhotoPath,
  toInitials,
} from "./voices-presentation";

test("con menos de tres publicados la sección no se dibuja", () => {
  assert.equal(shouldRenderVoices(0), false);
  assert.equal(shouldRenderVoices(1), false);
  assert.equal(shouldRenderVoices(2), false);
  assert.equal(shouldRenderVoices(3), true);
  assert.equal(shouldRenderVoices(9), true);
});

test("el mínimo publicado es tres", () => {
  assert.equal(MIN_TESTIMONIALS_TO_SHOW, 3);
});

test("la etiqueta del rol se muestra en español", () => {
  assert.equal(authorRoleLabel("PARTICIPANT"), "Participante");
  assert.equal(authorRoleLabel("JUROR"), "Jurado");
  assert.equal(authorRoleLabel("VENUE"), "Sede");
});

test("la foto se pide por el id del testimonio, no por la clave del archivo", () => {
  assert.equal(testimonialPhotoPath("abc123"), "/api/public/testimonios/abc123/foto");
});

test("sin foto se muestran las iniciales", () => {
  assert.equal(toInitials("Ana Pérez"), "AP");
  assert.equal(toInitials("Ana"), "A");
  assert.equal(toInitials("  ana maría lópez  "), "AL");
  assert.equal(toInitials(""), "?");
});
