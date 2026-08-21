import { test } from "node:test";
import assert from "node:assert/strict";
import { renderEmailSignature } from "./render";

test("escapa HTML, no interpreta etiquetas, normaliza CRLF", () => {
  const { html, text } = renderEmailSignature({
    organizationName: "<script>alert(1)</script>SFPR",
    institutionalNote: "Línea 1\r\nLínea 2   ",
  });
  assert.ok(!html.includes("<script>"), "no debe emitir <script> crudo");
  assert.ok(html.includes("&lt;script&gt;"), "debe escapar la etiqueta");
  // Escapar PRIMERO, convertir saltos DESPUÉS: al revés los <br> quedarían escapados.
  assert.ok(html.includes("Línea 1<br>Línea 2"), "salto de línea → <br>");
  // El texto plano no lleva marcado NI entidades del renderer. Que el dato del usuario
  // contenga "<" es otra cosa: en text/plain no se parsea, y borrarlo falsearía su nombre.
  assert.ok(!/<br>|<table|<div|<td/i.test(text), "sin etiquetas del renderer");
  assert.ok(!/&lt;|&gt;|&amp;|&quot;/.test(text), "sin entidades escapadas");
  assert.ok(text.includes("Línea 1\nLínea 2"), "CRLF→LF y sin espacios finales");
});

test("omite el logo entero si la URL no es https absoluta", () => {
  for (const bad of [
    "javascript:alert(1)",
    "/uploads/l.png",
    "data:image/png;base64,AAA",
    "http://x.com/l.png",
  ]) {
    const { html } = renderEmailSignature({ organizationName: "SFPR", organizationLogoUrl: bad });
    assert.ok(!html.includes("<img"), `debía omitir el logo: ${bad}`);
  }
  const ok = renderEmailSignature({
    organizationName: "SFPR",
    organizationLogoUrl: "https://cdn.x/l.png",
  });
  assert.ok(ok.html.includes("<img"), "una URL https válida sí se renderiza");
  assert.ok(ok.html.includes('alt="SFPR"'), "alt útil, no vacío");
  assert.ok(ok.html.includes("width=") && ok.html.includes("height="), "dimensiones fijas");
});

test("HTML apto para email y accesible", () => {
  const { html } = renderEmailSignature({ organizationName: "SFPR" });
  assert.ok(html.includes("<table"), "layout con tablas");
  assert.ok(html.includes('role="presentation"'), "tabla de layout, no de datos");
  assert.ok(
    !/display:\s*(flex|grid)|<style|<script|<form|<svg/i.test(html),
    "sin flex/grid/style/script/form/svg",
  );
  assert.ok(
    /font-family:[^;"]*(Arial|Helvetica)[^;"]*sans-serif/i.test(html),
    "pila de fuentes con fallback",
  );
});

test("sin imágenes y sin campos opcionales sigue siendo legible y sin basura", () => {
  const { html, text } = renderEmailSignature({
    organizationName: "SFPR",
    website: "https://sfpr.org",
  });
  assert.ok(!/undefined|null/.test(html), "sin undefined/null en el HTML");
  assert.ok(!/undefined|null/.test(text), "sin undefined/null en el texto");
  assert.ok(!/\n\s*\n\s*\n/.test(text), "sin líneas en blanco de más");
  assert.ok(text.includes("SFPR"), "se entiende quién envía sin imágenes");
  assert.ok(text.includes("https://sfpr.org"), "URL visible en texto plano");
});

test("replyToEmail nunca se renderiza (es cabecera, no cuerpo)", () => {
  const { html, text } = renderEmailSignature({
    organizationName: "SFPR",
    replyToEmail: "t@sfpr.test",
  });
  assert.ok(!html.includes("t@sfpr.test"), "no va en el cuerpo HTML");
  assert.ok(!text.includes("t@sfpr.test"), "no va en el cuerpo de texto");
});
