import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { organizarPorTamano } from "./organizar-por-tamano";
import { streamPrintExportZip, type PrintExportFile, type PrintExportPlan } from "./stream-print-export-zip";
import { carpetaDeImpresion, nombreDeCopia } from "./rutas-cortas";
import { filasDelZip } from "./verificacion";
import { calidadDeLaFoto, copiasPorTamano, medidaEnCm, textoDelPeso } from "./verificacion-reglas";

function copia(folder: string, tamano: string, acabado: string, copias: number, foto: string): PrintExportFile {
  const impresion = { producto: "Foto impresa", acabado, tamano, copias };
  const zipPath = `${folder}/${carpetaDeImpresion(impresion)}/${nombreDeCopia(copias, foto)}`;
  return { zipPath, r2Key: `fotos/${foto}`, manifestLine: zipPath, missingLine: "(FALTA)", impresion };
}

function pedido(folder: string, files: PrintExportFile[]): PrintExportPlan {
  return { folder, codigo: folder.split(" ")[0], manifestHeader: [folder], files, pdfBytes: new Uint8Array([37, 80, 68, 70]) };
}

/** Los nombres que de verdad quedan dentro del ZIP (con `unzip -Z1`). */
async function nombresDelZip(plans: PrintExportPlan[]): Promise<string[]> {
  const leer = async (k: string) => Buffer.from(`foto ${k}`);
  const res = streamPrintExportZip(plans, "prueba", [], leer);
  const dir = mkdtempSync(path.join(tmpdir(), "verificar-"));
  const zip = path.join(dir, "prueba.zip");
  writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  return execFileSync("unzip", ["-Z1", zip], { encoding: "utf8" }).trim().split("\n");
}

describe("filasDelZip", () => {
  const planes = organizarPorTamano(
    [
      pedido("3888 Juan Perez", [copia("3888 Juan Perez", "10x15", "Brillo", 2, "IMG_1.jpg"), copia("3888 Juan Perez", "15x21", "", 1, "IMG_2.jpg")]),
      // Mismo archivo y tamaño en otro pedido con el mismo número delante no pasa; pero dos fotos
      // con el mismo nombre en el mismo pedido sí: el ZIP les pone «(2)».
      pedido("3890 Ana", [copia("3890 Ana", "10x15", "Brillo", 1, "IMG_1.jpg"), copia("3890 Ana", "10x15", "Brillo", 1, "IMG_1.jpg")]),
    ],
    { separarClientes: false },
  ).plans;

  it("muestra exactamente las rutas que entran al ZIP, en el mismo orden", async () => {
    const filas = filasDelZip(planes, "Lote 1 - parte 1 de 1.zip");
    const enElZip = await nombresDelZip(planes);
    assert.deepEqual(
      filas.map((f) => f.ruta),
      enElZip.filter((n) => !n.startsWith("Control/")),
    );
    assert.ok(filas.some((f) => f.ruta.endsWith("(2).jpg")), "el repetido lleva (2) igual que en el ZIP");
  });

  it("trae pedido, cliente, copias, tamaño y acabado de cada archivo", () => {
    const [primera, segunda] = filasDelZip(planes, "Lote 1.zip");
    assert.equal(primera!.n, 1);
    assert.equal(primera!.pedido, "3888");
    assert.equal(primera!.cliente, "Juan Perez");
    assert.equal(primera!.copias, 2);
    assert.equal(primera!.tamano, "10x15");
    assert.equal(primera!.acabado, "Brillo");
    assert.equal(primera!.carpeta, "10x15 Brillo");
    assert.equal(primera!.zip, "Lote 1.zip");
    assert.equal(primera!.tipo, "FOTO");
    assert.equal(segunda!.acabado, null);
  });

  it("numera seguido entre partes con `desde`", () => {
    assert.equal(filasDelZip(planes, "parte 2", 10)[0]!.n, 10);
  });

  it("un PDF sin datos de impresión cuenta una copia y trae su detalle y vista previa", () => {
    const [f] = filasDelZip(
      [
        {
          folder: "Lote 3",
          manifestHeader: [],
          pdfBytes: new Uint8Array(),
          files: [
            {
              zipPath: "Lote 3/001 - 7 A - Celoria Pedro (diseño 1).pdf",
              r2Key: "x.pdf",
              manifestLine: "",
              missingLine: "",
              detalle: "Librito · 7 A · Celoria Pedro",
              vistaPrevia: ["cara1.jpg"],
            },
          ],
        },
      ],
      "Lote 3.zip",
    );
    assert.equal(f!.tipo, "PDF");
    assert.equal(f!.copias, 1);
    assert.equal(f!.pedido, null);
    assert.equal(f!.detalle, "Librito · 7 A · Celoria Pedro");
    assert.deepEqual(f!.vistaPrevia, ["cara1.jpg"]);
  });
});

describe("reglas de pantalla", () => {
  it("suma copias por tamaño y acabado, de más a menos", () => {
    const filas = filasDelZip(
      [pedido("1 A", [copia("1 A", "10x15", "Brillo", 3, "a.jpg"), copia("1 A", "15x21", "", 1, "b.jpg"), copia("1 A", "10x15", "Brillo", 2, "c.jpg")])],
      "z",
    );
    assert.deepEqual(copiasPorTamano(filas), [
      { texto: "10x15 Brillo", copias: 5, archivos: 2 },
      { texto: "15x21", copias: 1, archivos: 1 },
    ]);
  });

  it("entiende la medida en cm", () => {
    assert.deepEqual(medidaEnCm("10x15"), [10, 15]);
    assert.deepEqual(medidaEnCm("13 x 18 cm"), [13, 18]);
    assert.deepEqual(medidaEnCm("Foto grupal"), null);
  });

  it("calcula los dpi y avisa resolución baja", () => {
    const buena = calidadDeLaFoto(4000, 6000, "10x15")!;
    assert.equal(buena.dpi, 1016);
    assert.deepEqual(buena.avisos, []);
    const baja = calidadDeLaFoto(400, 600, "10x15")!;
    assert.equal(baja.dpi, 102);
    assert.match(baja.avisos[0]!, /Resolución baja/);
  });

  it("avisa cuando el laboratorio va a recortar, en cualquier orientación", () => {
    // 4:3 en papel 10x15 (3:2): más cuadrada.
    assert.match(calidadDeLaFoto(4000, 3000, "10x15")!.avisos.join(" "), /más cuadrada/);
    // 16:9 en papel 10x15: más alargada.
    assert.match(calidadDeLaFoto(1080 * 4, 1920 * 4, "10x15")!.avisos.join(" "), /más alargada/);
    // Apaisada en papel escrito vertical: no es recorte.
    assert.deepEqual(calidadDeLaFoto(6000, 4000, "10x15")!.avisos, []);
  });

  it("sin medida no hay calidad", () => {
    assert.equal(calidadDeLaFoto(4000, 6000, null), null);
  });

  it("escribe el peso", () => {
    assert.equal(textoDelPeso(null), "—");
    assert.equal(textoDelPeso(2.5 * 1024 * 1024), "2,5 MB");
    assert.equal(textoDelPeso(850 * 1024), "850 KB");
  });
});
