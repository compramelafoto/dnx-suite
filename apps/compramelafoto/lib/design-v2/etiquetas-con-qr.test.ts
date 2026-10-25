import assert from "node:assert/strict";
import { test } from "node:test";
import { baseAppUrl, urlDeEntregaEscolar } from "../school-fulfillment/entrega-url";
import { geometriaDeEtiqueta, LADO_QR_ETIQUETA } from "./produccion-reglas";

// Las medidas reales de una etiqueta del sobre: A4 en 3 × 8 con 20 pt de margen.
const ANCHO = (595 - 40) / 3;
const ALTO = (842 - 40) / 8;

test("sin QR, la etiqueta queda como siempre: texto a lo ancho e «#id» abajo a la derecha", () => {
  const g = geometriaDeEtiqueta(ANCHO, ALTO, false);
  assert.equal(g.qr, null);
  assert.equal(g.textoX, 10);
  assert.equal(g.textoMax, ANCHO - 20);
  assert.deepEqual(g.id, { x: ANCHO - 40, y: 12 });
});

test("con QR, el código mide 2 cm, va a la derecha, centrado y adentro del borde", () => {
  const g = geometriaDeEtiqueta(ANCHO, ALTO, true);
  assert.ok(g.qr);
  assert.ok(Math.abs(g.qr.lado - 56.69) < 0.01, `lado ${g.qr.lado}`);
  assert.equal(g.qr.lado, LADO_QR_ETIQUETA);
  // Adentro del recuadro (que tiene 3 pt de sangría).
  assert.ok(g.qr.x + g.qr.lado <= ANCHO - 3);
  assert.ok(g.qr.y >= 3 && g.qr.y + g.qr.lado <= ALTO - 3);
  assert.ok(Math.abs(g.qr.y + g.qr.lado / 2 - ALTO / 2) < 0.001, "centrado en alto");
  assert.ok(g.qr.x > ANCHO / 2, "a la derecha");
});

test("con QR, el texto no pisa el código y sigue teniendo lugar para leerse", () => {
  const g = geometriaDeEtiqueta(ANCHO, ALTO, true);
  assert.ok(g.qr);
  assert.ok(g.textoX + g.textoMax < g.qr.x, "el texto termina antes del QR");
  assert.ok(g.textoMax >= 95, `ancho del texto ${g.textoMax}`);
  assert.ok(g.id.x + 30 < g.qr.x, "el #id también queda a la izquierda");
});

test("en una etiqueta chica, el QR se achica para no salirse", () => {
  const g = geometriaDeEtiqueta(120, 50, true);
  assert.ok(g.qr);
  assert.ok(g.qr.lado < LADO_QR_ETIQUETA);
  assert.ok(g.qr.y >= 0 && g.qr.y + g.qr.lado <= 50);
  assert.ok(g.textoMax > 0);
});

test("la URL del QR apunta a la ficha de entrega, sin barra doble y con el código escapado", () => {
  assert.equal(urlDeEntregaEscolar("https://compramelafoto.com/", "abc_-9"), "https://compramelafoto.com/escolar/entrega/abc_-9");
  assert.equal(urlDeEntregaEscolar("https://x.com", "a/b"), "https://x.com/escolar/entrega/a%2Fb");
  assert.equal(baseAppUrl({ NEXT_PUBLIC_APP_URL: "https://a.com/", APP_URL: "https://b.com" }), "https://a.com");
  assert.equal(baseAppUrl({ APP_URL: "https://b.com" }), "https://b.com");
  assert.equal(baseAppUrl({}), "http://localhost:3000");
});
