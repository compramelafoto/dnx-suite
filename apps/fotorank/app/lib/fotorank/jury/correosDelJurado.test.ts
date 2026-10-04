import test from "node:test";
import assert from "node:assert/strict";

import {
  avisoDeJuzgamientoAbierto,
  recordatorioDeJuzgamiento,
  type DatosDelAviso,
} from "./correosDelJurado";

const DATOS: DatosDelAviso = {
  concurso: "Clickatón — Día del Fotógrafo Primavera 2026",
  obras: 170,
  consignas: 7,
  criterios: 4,
  enlace: "https://www.fotorank.com/jurado/panel",
};

/* ---------- lo que tiene que decir ---------- */

test("el asunto nombra el concurso", () => {
  const c = avisoDeJuzgamientoAbierto(DATOS);
  assert.ok(c.asunto.includes("Clickatón"), c.asunto);
});

test("dice cuántas obras, cuántas consignas y cuántos criterios", () => {
  const c = avisoDeJuzgamientoAbierto(DATOS);
  assert.ok(c.texto.includes("170 obras"));
  assert.ok(c.texto.includes("7 consignas"));
  assert.ok(c.texto.includes("4 criterios"));
});

test("el enlace viaja en el texto y en el html", () => {
  const c = avisoDeJuzgamientoAbierto(DATOS);
  assert.ok(c.texto.includes(DATOS.enlace));
  assert.ok(c.html.includes(DATOS.enlace));
});

/** Un correo sin la dirección escrita queda inservible si el botón no anda. */
test("la dirección también va escrita, por si el botón no funciona", () => {
  const c = avisoDeJuzgamientoAbierto(DATOS);
  const veces = c.html.split(DATOS.enlace).length - 1;
  assert.ok(veces >= 2, `la dirección aparece ${veces} vez/veces`);
});

test("explica que entra con su propia contraseña", () => {
  const c = avisoDeJuzgamientoAbierto(DATOS);
  assert.ok(/contraseña/.test(c.texto));
});

test("con fecha de cierre, la dice", () => {
  const c = avisoDeJuzgamientoAbierto({ ...DATOS, cierre: "5 de octubre" });
  assert.ok(c.texto.includes("5 de octubre"));
});

test("sin fecha de cierre, no inventa ninguna", () => {
  const c = avisoDeJuzgamientoAbierto(DATOS);
  assert.ok(!/tiempo hasta/.test(c.texto));
});

/* ---------- lo que NO tiene que decir ---------- */

/**
 * El envío anterior armaba el cuerpo volcando las variables del evento: un
 * jurado hubiera recibido "Evento: JURY_INVITATION" y abajo la lista.
 */
test("no se le escapa ninguna palabra del sistema", () => {
  const c = avisoDeJuzgamientoAbierto(DATOS);
  const todo = `${c.asunto} ${c.texto} ${c.html}`;
  for (const palabra of [
    "JURY_",
    "Evento:",
    "contestId",
    "snapshot",
    "rubric",
    "SUBMITTED",
  ]) {
    assert.ok(!todo.includes(palabra), `dice "${palabra}"`);
  }
});

/** Nombrar a un participante rompería el anonimato que el jurado promete. */
test("no nombra a nadie", () => {
  const c = avisoDeJuzgamientoAbierto(DATOS);
  assert.ok(/sin el nombre de quien las tomó/.test(c.texto));
});

/* ---------- singular y plural ---------- */

test("una sola obra se dice en singular", () => {
  const c = avisoDeJuzgamientoAbierto({
    ...DATOS,
    obras: 1,
    consignas: 1,
    criterios: 1,
  });
  assert.ok(c.texto.includes("1 obra,"), c.texto);
  assert.ok(c.texto.includes("1 consigna."));
  assert.ok(c.texto.includes("1 criterio,"));
});

/* ---------- el recordatorio ---------- */

/** A quien no empezó, "0 de 170" le suena a reproche. */
test("el recordatorio cuenta las que faltan, no las hechas", () => {
  const c = recordatorioDeJuzgamiento({ ...DATOS, faltan: 170 });
  assert.ok(c.asunto.includes("170 obras"));
  assert.ok(!c.texto.includes("0 de"));
});

test("el recordatorio ofrece la salida de avisar que no va a poder", () => {
  const c = recordatorioDeJuzgamiento({ ...DATOS, faltan: 12 });
  assert.ok(/no vas a poder/.test(c.texto));
});

/* ---------- el html ---------- */

test("el html escapa lo que podría romperlo", () => {
  const c = avisoDeJuzgamientoAbierto({
    ...DATOS,
    concurso: 'Foto <b>"rara"</b> & cía',
  });
  assert.ok(!c.html.includes("<b>"));
  assert.ok(c.html.includes("&lt;b&gt;"));
  assert.ok(c.html.includes("&amp;"));
});

/** El título de la primera Clickatón tiene un espacio doble guardado en la base. */
test("el nombre del concurso sale sin espacios de más", () => {
  const c = avisoDeJuzgamientoAbierto({
    ...DATOS,
    concurso: "Clickatón  - Día del Fotógrafo  Primavera 2026 ",
  });
  assert.ok(
    c.asunto.includes("Clickatón - Día del Fotógrafo Primavera 2026"),
    c.asunto,
  );
  assert.ok(!c.asunto.includes("  "));
});
