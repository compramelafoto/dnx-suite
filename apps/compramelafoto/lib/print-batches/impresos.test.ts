import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";

import { limpio, lineasDelSobre, pdfDeSobres, pdfEtiquetaDeLote, pdfRemito, textoDeContenido, type SobreDePedido } from "./impresos";

const sobre = (n: number, extra: Partial<SobreDePedido> = {}): SobreDePedido => ({
  fotografo: "Ana Foto", cliente: "María Pérez", album: "Egresados", pedido: 100 + n, contenido: "2× 10x15",
  lote: "Lote 3", retiraCliente: false, qrUrl: `https://x.test/pedido/entrega/p${n}.abc`, ...extra,
});
const paginas = async (bytes: Uint8Array) => (await PDFDocument.load(bytes)).getPageCount();

describe("textoDeContenido", () => {
  it("agrupa medida y acabado, omite el acabado vacío y ordena por medida", () => {
    assert.equal(
      textoDeContenido([
        { medida: "13x18", acabado: "brillo", cantidad: 1 },
        { medida: "10x15", acabado: "", cantidad: 2 },
        { medida: "13x18", acabado: "brillo", cantidad: 2 },
      ]),
      "2× 10x15 · 3× 13x18 brillo",
    );
  });
});

describe("lineasDelSobre", () => {
  it("la primera línea es «<Fotógrafo> + <Cliente>»", () => {
    assert.equal(lineasDelSobre(sobre(1))[0], "Ana Foto + María Pérez");
  });
  it("si retira el cliente, avisa que está pagado y nombra el laboratorio", () => {
    const l = lineasDelSobre(sobre(1, { retiraCliente: true, laboratorio: "Lab Centro" }));
    assert.ok(l.includes("RETIRA EL CLIENTE · PAGADO, no cobrar"));
    assert.ok(l.includes("Lab Centro"));
  });
  it("si no retira el cliente, no lleva la marca", () => {
    assert.ok(!lineasDelSobre(sobre(1)).some((x) => x.includes("RETIRA EL CLIENTE")));
  });
});

describe("pdfDeSobres", () => {
  it("24 sobres entran en una hoja y 25 piden dos", async () => {
    assert.equal(await paginas(await pdfDeSobres(Array.from({ length: 24 }, (_, i) => sobre(i)))), 1);
    assert.equal(await paginas(await pdfDeSobres(Array.from({ length: 25 }, (_, i) => sobre(i)))), 2);
  });
});

describe("pdfEtiquetaDeLote y pdfRemito", () => {
  it("la etiqueta es de una hoja", async () => {
    const b = await pdfEtiquetaDeLote({ lote: "Lote 3", fotografo: "Ana", laboratorio: "Lab", pedidos: 2, copias: 5, qrUrl: "https://x.test/a" });
    assert.equal(await paginas(b), 1);
  });
  it("el remito pasa a una segunda hoja cuando las filas no entran", async () => {
    const fila = (i: number) => ({ pedido: i, nombre: "Ana + Cliente", contenido: "2× 10x15", retiraCliente: i % 2 === 0 });
    const uno = await pdfRemito({ lote: "Lote 3", fotografo: "Ana", laboratorio: "Lab", filas: Array.from({ length: 10 }, (_, i) => fila(i)) });
    const dos = await pdfRemito({ lote: "Lote 3", fotografo: "Ana", laboratorio: "Lab", filas: Array.from({ length: 50 }, (_, i) => fila(i)), noIncluidos: ["Pedido 9: sin fotos"] });
    assert.equal(await paginas(uno), 1);
    assert.equal(await paginas(dos), 2);
  });
});

describe("limpio", () => {
  it("conserva tildes, ñ, «×» y «·», y saca los emojis", () => {
    assert.equal(limpio("Peña José"), "Peña José");
    const c = textoDeContenido([{ medida: "13x18", acabado: "brillo", cantidad: 3 }, { medida: "10x15", acabado: "", cantidad: 2 }]);
    assert.equal(limpio(c), c);
    assert.equal(limpio("Ana 😀 Foto"), "Ana  Foto");
    assert.equal(limpio("Dvořák Łucja Čech"), "Dvorák Lucja Cech");
    for (const l of lineasDelSobre(sobre(1, { cliente: "Peña", contenido: c }))) assert.equal(limpio(l), l);
  });
  it("un sobre con esos textos no rompe el PDF", async () => {
    const b = await pdfDeSobres([sobre(1, { cliente: "Peña 😀", contenido: "2× 10x15 · 3× 13x18 brillo", retiraCliente: true, laboratorio: "Lab ñandú" })]);
    assert.equal(await paginas(b), 1);
  });
});
