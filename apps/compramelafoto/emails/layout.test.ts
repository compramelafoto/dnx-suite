import test from "node:test";
import assert from "node:assert/strict";
import { EMAIL_LOGO_URL, isWrappedInEmailLayout, textToEmailHtml, wrapEmailLayout } from "./layout";

// Contenido real de la plantilla digital_download en producción (tabla EmailTemplate)
const DIGITAL_DOWNLOAD = `<p>Hola cliente,</p>
<p>Lo que compraste en el pedido <strong>#5128</strong> ya está listo para descargar.</p>
<p><a href="https://compramelafoto.com/descargas/abc">Ver mi compra</a></p>
<p><small>Este link estará disponible hasta el 7/11/2026.</small></p>
<p>Saludos,<br>ComprameLaFoto</p>`;

test("pone el logo y el contenido dentro del diseño", () => {
  const html = wrapEmailLayout(DIGITAL_DOWNLOAD);
  assert.ok(html.includes(EMAIL_LOGO_URL));
  assert.ok(html.includes("ya está listo para descargar"));
  assert.ok(html.includes("info@compramelafoto.com"));
  assert.ok(isWrappedInEmailLayout(html));
});

test("un párrafo que sólo tiene un link se dibuja como botón", () => {
  const html = wrapEmailLayout(DIGITAL_DOWNLOAD);
  assert.match(html, /<td align="center" bgcolor="#c27b3d"[^>]*>\s*<a href="https:\/\/compramelafoto\.com\/descargas\/abc"[^>]*>Ver mi compra<\/a>/);
  assert.doesNotMatch(html, /<p><a href="https:\/\/compramelafoto\.com\/descargas\/abc">/);
});

test("un botón con estilos propios también se unifica", () => {
  const html = wrapEmailLayout(
    `<p><a href="https://x.test/pedidos" style="display: inline-block; background: #10b981; color: #fff;">Ver pedidos</a></p>`,
  );
  assert.ok(!html.includes("#10b981"));
  assert.match(html, /bgcolor="#c27b3d"[\s\S]*>Ver pedidos<\/a>/);
});

test("los links dentro de un texto no se convierten en botón", () => {
  const html = wrapEmailLayout(
    `<p>Compraste como invitado.<br><a href="https://x.test/login">Iniciar sesión</a> · <a href="https://x.test/pedidos">Mis pedidos</a></p>`,
  );
  assert.ok(!html.includes('bgcolor="#c27b3d"'));
  assert.match(html, /<a style="color:#c27b3d;font-weight:600;" href="https:\/\/x\.test\/login">/);
});

test("aplicarlo dos veces no anida el diseño", () => {
  const once = wrapEmailLayout(DIGITAL_DOWNLOAD);
  assert.equal(wrapEmailLayout(once), once);
});

test("de un documento completo se queda con el body", () => {
  const html = wrapEmailLayout(
    `<!DOCTYPE html><html><head><title>viejo</title></head><body style="background:#000"><p>Hola</p></body></html>`,
  );
  assert.ok(!html.includes("viejo"));
  assert.ok(!html.includes("background:#000"));
  assert.equal(html.match(/<body/g)?.length, 1);
  assert.ok(html.includes("<p>Hola</p>"));
});

test("el texto plano se escapa y se arma en párrafos", () => {
  assert.equal(textToEmailHtml("Hola <b>\nlínea 2\n\nChau"), "<p>Hola &lt;b&gt;<br>línea 2</p>\n<p>Chau</p>");
});
