import { test } from "node:test";
import assert from "node:assert/strict";
import { CLAVE_RESPONDER_A, conResponderA, normalizarResponderA, responderADe } from "./email-reply-to";
import { notaDeImpresas } from "./digital-download/nota-de-impresas";

test("normaliza la dirección del fotógrafo", () => {
  assert.equal(normalizarResponderA("  CMV.Cronicas@Gmail.com "), "cmv.cronicas@gmail.com");
});

test("descarta direcciones vacías, rotas o de la propia plataforma", () => {
  assert.equal(normalizarResponderA(null), null);
  assert.equal(normalizarResponderA(""), null);
  assert.equal(normalizarResponderA("no es un correo"), null);
  assert.equal(normalizarResponderA("a@b"), null);
  assert.equal(normalizarResponderA("Juan <juan@gmail.com>"), null);
  assert.equal(normalizarResponderA("info@compramelafoto.com"), null);
});

test("suma el responder-a sin pisar los datos de la plantilla", () => {
  const datos = conResponderA({ customerName: "Ana" }, "foto@gmail.com");
  assert.deepEqual(datos, { customerName: "Ana", [CLAVE_RESPONDER_A]: "foto@gmail.com" });
  assert.equal(responderADe(datos), "foto@gmail.com");
});

test("sin dirección válida deja los datos como estaban", () => {
  assert.equal(conResponderA(undefined, null), undefined);
  const datos = { a: 1 };
  assert.equal(conResponderA(datos, "roto"), datos);
});

test("leer responder-a de datos ajenos no falla", () => {
  assert.equal(responderADe(null), null);
  assert.equal(responderADe([1, 2]), null);
  assert.equal(responderADe({ customerName: "Ana" }), null);
  assert.equal(responderADe({ [CLAVE_RESPONDER_A]: 5 }), null);
});

test("pedido sin impresas: sin nota", () => {
  assert.equal(notaDeImpresas({ orderId: 1, cantidadImpresas: 0, fotografo: null }), null);
});

test("pedido con dos impresas: aclara que van en papel y que la digital es incluida", () => {
  const nota = notaDeImpresas({
    orderId: 5993,
    cantidadImpresas: 2,
    fotografo: { name: "Claudia Valenti", email: "cmv.cronicas@gmail.com" },
  });
  assert.ok(nota);
  assert.equal(nota.asunto, "Ya podés descargar la versión digital - Pedido #5993");
  assert.match(nota.texto, /Las 2 fotos impresas de tu pedido se imprimen en papel/);
  assert.match(nota.texto, /versión digital, que viene incluida/);
  assert.match(nota.texto, /respondé este correo y le llega a Claudia Valenti/);
  assert.match(nota.html, /<strong>Las 2 fotos impresas/);
});

test("una sola impresa y fotógrafo sin datos", () => {
  const nota = notaDeImpresas({ orderId: 7, cantidadImpresas: 1, fotografo: null });
  assert.ok(nota);
  assert.match(nota.texto, /^La foto impresa de tu pedido se imprime en papel/);
  assert.match(nota.texto, /Tu fotógrafo te avisa/);
  assert.doesNotMatch(nota.texto, /respondé este correo/);
});

test("el nombre del fotógrafo se escapa en el HTML", () => {
  const nota = notaDeImpresas({ orderId: 7, cantidadImpresas: 1, fotografo: { name: "<b>X</b>", email: null } });
  assert.ok(nota);
  assert.doesNotMatch(nota.html, /<b>X<\/b>/);
});
