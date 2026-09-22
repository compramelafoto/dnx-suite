import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeAuthorLink } from "./author-link.ts";

test("un usuario de Instagram se convierte en URL", () => {
  assert.equal(normalizeAuthorLink("@fulano"), "https://instagram.com/fulano");
});

test("el arroba puede venir con espacios alrededor", () => {
  assert.equal(normalizeAuthorLink("  @fulano  "), "https://instagram.com/fulano");
});

test("una URL con https se acepta tal cual", () => {
  assert.equal(
    normalizeAuthorLink("https://misitio.com/foto"),
    "https://misitio.com/foto",
  );
});

test("una URL con http se acepta", () => {
  assert.equal(normalizeAuthorLink("http://misitio.com"), "http://misitio.com/");
});

test("un dominio suelto recibe https", () => {
  assert.equal(normalizeAuthorLink("misitio.com"), "https://misitio.com/");
});

test("javascript: se rechaza", () => {
  assert.equal(normalizeAuthorLink("javascript:alert(1)"), null);
});

test("data: se rechaza", () => {
  assert.equal(normalizeAuthorLink("data:text/html,<script>"), null);
});

test("vacío devuelve null", () => {
  assert.equal(normalizeAuthorLink("   "), null);
  assert.equal(normalizeAuthorLink(null), null);
});

test("un arroba sin nombre no arma una URL rota", () => {
  assert.equal(normalizeAuthorLink("@"), null);
});

test("un usuario de Instagram con caracteres raros se rechaza", () => {
  assert.equal(normalizeAuthorLink("@fula no/../otro"), null);
});
