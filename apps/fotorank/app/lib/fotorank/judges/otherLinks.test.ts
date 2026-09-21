/**
 * Los "otros links" del jurado: se escriben como texto, una línea por link.
 * Si se guarda cualquier cosa, la página pública termina con enlaces rotos o
 * peor, con un javascript: que alguien pegó.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { parsearOtrosLinks, otrosLinksATexto } from "./otherLinks";

test("una línea por link, con el nombre antes de la barra", () => {
  assert.deepEqual(
    parsearOtrosLinks("Behance | behance.net/ana\nFlickr | https://flickr.com/ana"),
    [
      { nombre: "Behance", url: "https://behance.net/ana" },
      { nombre: "Flickr", url: "https://flickr.com/ana" },
    ],
  );
});

test("sin nombre, se usa el dominio", () => {
  assert.deepEqual(parsearOtrosLinks("behance.net/ana"), [
    { nombre: "behance.net", url: "https://behance.net/ana" },
  ]);
});

test("una línea sin URL válida se descarta entera", () => {
  assert.deepEqual(parsearOtrosLinks("Mi perfil | no es una url con espacios"), []);
  assert.deepEqual(parsearOtrosLinks(""), []);
  assert.deepEqual(parsearOtrosLinks("   \n  \n"), []);
});

test("javascript: no pasa, aunque le pongan nombre", () => {
  assert.deepEqual(parsearOtrosLinks("Mirá esto | javascript:alert(1)"), []);
  assert.deepEqual(parsearOtrosLinks("Mirá esto | data:text/html,<script>"), []);
});

test("se guardan hasta diez: más es una lista de enlaces, no un perfil", () => {
  const muchas = Array.from({ length: 15 }, (_, i) => `Link ${i} | ejemplo${i}.com`).join("\n");
  assert.equal(parsearOtrosLinks(muchas).length, 10);
});

test("lo guardado se vuelve a mostrar como texto editable", () => {
  const links = [{ nombre: "Behance", url: "https://behance.net/ana" }];
  assert.equal(otrosLinksATexto(links), "Behance | https://behance.net/ana");
  assert.equal(otrosLinksATexto(null), "");
  assert.equal(otrosLinksATexto("cualquier cosa"), "");
});

test("ida y vuelta: lo que se guarda se puede volver a editar", () => {
  const texto = "Behance | behance.net/ana\nFlickr | flickr.com/ana";
  const ida = parsearOtrosLinks(texto);
  const vuelta = parsearOtrosLinks(otrosLinksATexto(ida));
  assert.deepEqual(vuelta, ida);
});
