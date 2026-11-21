import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { archivosDelPedido } from "./archivos-del-pedido";
import { copiasFueraDelDiseno } from "./copias-fuera-del-diseno";
import type { OrderDesign } from "./order-designs";

// Pedido con librito (fotos 1, 2 y 3) y, aparte, una 15x21 de la foto 1 y una 10x15 de la foto 9.
const items = [
  { photoId: 1, quantity: 1, size: "Librito", finish: "", metadata: null, photo: { originalKey: "fotos/IMG_1.jpg" } },
  { photoId: 2, quantity: 1, size: "Librito", finish: "", metadata: null, photo: { originalKey: "fotos/IMG_2.jpg" } },
  { photoId: 3, quantity: 1, size: "Librito", finish: "", metadata: null, photo: { originalKey: "fotos/IMG_3.jpg" } },
  { photoId: 1, quantity: 1, size: "15x21", finish: "Mate", metadata: null, photo: { originalKey: "fotos/IMG_1.jpg" } },
  { photoId: 9, quantity: 2, size: "10x15", finish: "Brillo", metadata: null, photo: { originalKey: "fotos/IMG_9.jpg" } },
];
const librito: OrderDesign = {
  id: 77,
  templateName: "Librito",
  photoIds: [1, 2, 3],
  ready: true,
  pdfUrl: "disenos/77.pdf",
  jpgUrls: ["disenos/77-1.jpg"],
};
const pendiente: OrderDesign = { ...librito, id: 78, ready: false, pdfUrl: null, jpgUrls: [] };
const folder = "3888 Juan Perez";
const getProductName = () => "Foto impresa";

function armar(designs: OrderDesign[], incluirDisenos: boolean) {
  const sueltas = copiasFueraDelDiseno(items, designs.flatMap((d) => d.photoIds));
  return archivosDelPedido({ items, sueltas, designs, folder, getProductName, incluirDisenos });
}

describe("archivosDelPedido", () => {
  it("sin los diseños (lote de impresión): sólo las copias sueltas, ni PDF ni caras del librito", () => {
    const r = armar([librito], false);
    assert.deepEqual(
      r.files.map((f) => f.r2Key),
      ["fotos/IMG_1.jpg", "fotos/IMG_9.jpg"],
    );
    assert.ok(r.files.every((f) => f.impresion));
    assert.deepEqual(
      r.files.map((f) => [f.impresion!.tamano, f.impresion!.copias]),
      [["15x21", 1], ["10x15", 2]],
    );
    assert.deepEqual(r.notes, []);
    assert.deepEqual(r.designLines, []);
  });

  it("sin los diseños tampoco deja el aviso de un diseño pendiente", () => {
    const r = armar([pendiente], false);
    assert.deepEqual(r.notes, []);
    assert.deepEqual(r.designLines, []);
    assert.equal(r.files.length, 2);
  });

  it("con los diseños (descarga de siempre): las sueltas más el PDF y las caras", () => {
    const r = armar([librito], true);
    assert.deepEqual(
      r.files.map((f) => f.r2Key),
      ["fotos/IMG_1.jpg", "fotos/IMG_9.jpg", "disenos/77.pdf", "disenos/77-1.jpg"],
    );
    assert.equal(r.designLines.length, 1);
  });

  it("con un diseño pendiente deja el aviso, como antes", () => {
    const r = armar([pendiente], true);
    assert.equal(r.notes.length, 1);
    assert.match(r.notes[0]!.name, /PENDIENTE DE APROBAR/);
  });
});
