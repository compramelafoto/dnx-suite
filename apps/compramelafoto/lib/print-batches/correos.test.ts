import assert from "node:assert/strict";
import { test } from "node:test";
import {
  correoAlLaboratorio,
  correoListoRetiraEnLaboratorio,
  correoListoRetiraFotografo,
  correoPedidoSacadoDelLote,
  resumirCopias,
} from "./correos";

const base = {
  nombreLote: "Lote 12 · 20/11",
  fotografo: "Daniel Cuart",
  pedidos: 3,
  copias: [
    { medida: "13x18", acabado: "Brillo", cantidad: 4 },
    { medida: "10x15", acabado: "Mate", cantidad: 2 },
    { medida: "13x18", acabado: "Brillo", cantidad: 1 },
  ],
  mensaje: "Para el viernes, por favor.",
  enlace: "https://www.compramelafoto.com/lab/lote/abc123",
  labEmail: "lab@procolor.com",
  baseUrl: "https://www.compramelafoto.com",
};

test("resumirCopias junta por medida y acabado", () => {
  assert.deepEqual(resumirCopias(base.copias), [
    { medida: "10x15", acabado: "Mate", cantidad: 2 },
    { medida: "13x18", acabado: "Brillo", cantidad: 5 },
  ]);
});

test("correo al laboratorio: asunto, resumen, mensaje y botón", () => {
  const c = correoAlLaboratorio({ ...base, labTieneCuenta: true });
  assert.equal(c.subject, "Lote 12 · 20/11 de Daniel Cuart — 3 pedidos, 7 copias");
  assert.match(c.body, /5× 13x18 Brillo/);
  assert.match(c.body, /2× 10x15 Mate/);
  assert.match(c.body, /Para el viernes, por favor\./);
  assert.match(c.body, /Abrir el lote: https:\/\/www\.compramelafoto\.com\/lab\/lote\/abc123/);
  assert.match(c.htmlBody, /href="https:\/\/www\.compramelafoto\.com\/lab\/lote\/abc123"[^>]*>Abrir el lote</);
  assert.doesNotMatch(c.body, /creá tu cuenta/);
  assert.doesNotMatch(c.htmlBody, /lab\/registro/);
});

test("correo al laboratorio sin cuenta: suma la invitación con el correo cargado", () => {
  const c = correoAlLaboratorio({ ...base, labTieneCuenta: false });
  const invitacion =
    "Si querés ver todos tus lotes en un solo lugar, creá tu cuenta de laboratorio en CompraMeLaFoto.";
  assert.ok(c.body.includes(invitacion));
  assert.ok(c.htmlBody.includes(invitacion));
  assert.ok(c.body.includes("https://www.compramelafoto.com/lab/registro?email=lab%40procolor.com"));
  assert.ok(c.htmlBody.includes('href="https://www.compramelafoto.com/lab/registro?email=lab%40procolor.com"'));
});

test("correo al laboratorio en singular y sin mensaje", () => {
  const c = correoAlLaboratorio({
    ...base,
    pedidos: 1,
    copias: [{ medida: "10x15", acabado: "Brillo", cantidad: 1 }],
    mensaje: "  ",
    labTieneCuenta: true,
  });
  assert.equal(c.subject, "Lote 12 · 20/11 de Daniel Cuart — 1 pedido, 1 copia");
  assert.doesNotMatch(c.body, /Mensaje de/);
});

test("el html escapa lo que escribe el fotógrafo", () => {
  const c = correoAlLaboratorio({ ...base, mensaje: "<script>x</script>", labTieneCuenta: true });
  assert.doesNotMatch(c.htmlBody, /<script>/);
  assert.match(c.htmlBody, /&lt;script&gt;/);
});

test("cliente, retira el fotógrafo", () => {
  const c = correoListoRetiraFotografo({ fotografo: "Daniel Cuart", contactoFotografo: "+54 9 341 555-1234" });
  assert.equal(c.subject, "Tus copias están listas");
  const frase = "Daniel Cuart ya tiene tus copias. Coordiná el retiro con él: +54 9 341 555-1234.";
  assert.ok(c.body.includes(frase));
  assert.ok(c.htmlBody.includes(frase));
});

test("cliente, retira en el laboratorio", () => {
  const c = correoListoRetiraEnLaboratorio({
    fotografo: "Daniel Cuart",
    laboratorio: "Procolor",
    direccion: "Córdoba 1234",
    horario: "lunes a viernes de 9 a 18",
    cliente: "Ana Pérez",
  });
  assert.equal(c.subject, "Tus copias están listas para retirar");
  const frase =
    "Tus copias de Daniel Cuart están listas. Retiralas en Procolor, Córdoba 1234, lunes a viernes de 9 a 18. " +
    "Ya están pagas: decí que vas a buscar el pedido de Daniel Cuart a nombre de Ana Pérez.";
  assert.ok(c.body.includes(frase));
  assert.ok(c.htmlBody.includes(frase));
});

test("retira en el laboratorio sin dirección ni horario: no deja comas sueltas", () => {
  const c = correoListoRetiraEnLaboratorio({
    fotografo: "Daniel",
    laboratorio: "Procolor",
    direccion: null,
    horario: "  ",
    cliente: "Ana",
  });
  assert.ok(c.body.includes("Retiralas en Procolor. Ya están pagas"));
});

test("correoPedidoSacadoDelLote: dice qué pedido salió, que no lo imprima y escapa el html", () => {
  const c = correoPedidoSacadoDelLote({
    nombreLote: "Lote 12 · 20/11", fotografo: "Daniel <b>", pedido: 15, aNombreDe: "Daniel + Ana",
    copias: [{ medida: "13x18", acabado: "Brillo", cantidad: 2 }],
  });
  assert.equal(c.subject, "Lote 12 · 20/11 de Daniel <b>: sacaron el pedido #15");
  assert.match(c.body, /sacó el pedido #15 \(a nombre de Daniel \+ Ana, 2× 13x18 Brillo\) del Lote 12/);
  assert.match(c.body, /no lo imprimas/);
  assert.match(c.body, /ya no figura/);
  assert.doesNotMatch(c.htmlBody, /<b>/);
});
