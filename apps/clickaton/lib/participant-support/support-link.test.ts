import assert from "node:assert/strict";
import test from "node:test";

import { construirEnlaceDeAyuda, normalizarWhatsappArgentino } from "./support-link";

test("un numero local de Rosario se vuelve internacional", () => {
  assert.equal(normalizarWhatsappArgentino("3413748324"), "5493413748324");
});

test("acepta el numero como lo escribe una persona", () => {
  assert.equal(normalizarWhatsappArgentino("+54 9 341 374-8324"), "5493413748324");
  assert.equal(normalizarWhatsappArgentino("(341) 374 8324"), "5493413748324");
  assert.equal(normalizarWhatsappArgentino("0341 374-8324"), "5493413748324");
  assert.equal(normalizarWhatsappArgentino("54 341 3748324"), "5493413748324");
});

test("un numero que no sirve NO genera enlace, en vez de mandar a un desconocido", () => {
  // Preferimos esconder el boton antes que abrir un chat con quien no es.
  assert.equal(normalizarWhatsappArgentino("1234"), null);
  assert.equal(normalizarWhatsappArgentino(""), null);
  assert.equal(normalizarWhatsappArgentino(null), null);
  assert.equal(normalizarWhatsappArgentino("no tengo"), null);
});

test("el enlace lleva el mensaje ya escrito con quien pide ayuda", () => {
  const url = construirEnlaceDeAyuda({
    telefono: "3413748324",
    nombreEdicion: "Clickatón Argentina 2026",
    nombreParticipante: "Ana",
    numeroParticipante: "A-014",
  });
  assert.ok(url);
  assert.ok(url.startsWith("https://wa.me/5493413748324?text="));
  const texto = decodeURIComponent(url.split("text=")[1] ?? "");
  assert.match(texto, /Ana/);
  assert.match(texto, /A-014/);
  assert.match(texto, /Clickatón Argentina 2026/);
});

test("sin numero cargado no hay boton de ayuda", () => {
  assert.equal(
    construirEnlaceDeAyuda({
      telefono: null,
      nombreEdicion: "Clickatón",
      nombreParticipante: "Ana",
      numeroParticipante: null,
    }),
    null,
  );
});

test("un participante sin numero asignado igual puede pedir ayuda", () => {
  const url = construirEnlaceDeAyuda({
    telefono: "3413748324",
    nombreEdicion: "Clickatón",
    nombreParticipante: "Ana",
    numeroParticipante: null,
  });
  assert.ok(url);
  assert.doesNotMatch(decodeURIComponent(url.split("text=")[1] ?? ""), /null|undefined/);
});
