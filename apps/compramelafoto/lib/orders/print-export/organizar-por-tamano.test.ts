import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { CARPETA_CONTROL, NOMBRE_RESUMEN, organizarPorTamano } from "./organizar-por-tamano";
import { streamPrintExportZip, type PrintExportFile, type PrintExportPlan } from "./stream-print-export-zip";
import { carpetaDeImpresion, nombreDeCopia } from "./rutas-cortas";

// Igual que lo arman los planes de álbum e impresión.
function copia(folder: string, tamano: string, acabado: string, copias: number, foto: string): PrintExportFile {
  const producto = "Foto impresa";
  const impresion = { producto, acabado, tamano, copias };
  const zipPath = `${folder}/${carpetaDeImpresion(impresion)}/${nombreDeCopia(copias, foto)}`;
  return {
    zipPath,
    r2Key: `fotos/${foto}`,
    manifestLine: `${producto} | ${acabado} | ${tamano} | ${copias} | ${zipPath}`,
    missingLine: `${producto} | ${acabado} | ${tamano} | ${copias} | (FALTA ARCHIVO)`,
    impresion,
  };
}

function pedido(folder: string, files: PrintExportFile[], notes: PrintExportPlan["notes"] = []): PrintExportPlan {
  const codigo = folder.split(" ")[0];
  return { folder, codigo, manifestHeader: [`Pedido ${folder}`], files, pdfBytes: new Uint8Array([37, 80, 68, 70]), notes };
}

const JUAN = "123 Juan Perez";
const ANA = "45 Ana Gomez";

const planes = () => [
  pedido(JUAN, [
    copia(JUAN, "10x15", "Brillo", 2, "IMG_1.jpg"),
    copia(JUAN, "15x21", "Mate", 1, "IMG_2.jpg"),
    {
      zipPath: `${JUAN}/Foto grupal/Diseno 12.pdf`,
      r2Key: "disenos/12.pdf",
      manifestLine: `Foto grupal | DISEÑO | 12 | 1 | ${JUAN}/Foto grupal/Diseno 12.pdf`,
      missingLine: "Foto grupal | DISEÑO | 12 | 1 | (FALTA EL PDF DEL DISEÑO)",
    },
  ]),
  pedido(ANA, [copia(ANA, "10x15", "Brillo", 3, "DSC_9.jpg")], [{ name: "AVISO.txt", content: "pendiente" }]),
];

describe("organizarPorTamano", () => {
  it("agrupa las copias por tamaño y acabado, con una carpeta por cliente adentro", () => {
    const { plans } = organizarPorTamano(planes());
    const rutas = plans.flatMap((p) => p.files.map((f) => f.zipPath));
    assert.deepEqual(rutas, [
      `10x15 Brillo/${JUAN}/2x IMG_1.jpg`,
      `15x21 Mate/${JUAN}/1x IMG_2.jpg`,
      `Foto grupal/${JUAN}/Diseno 12.pdf`,
      `10x15 Brillo/${ANA}/3x DSC_9.jpg`,
    ]);
  });

  it("deja el MANIFEST y el resumen de cada cliente en la carpeta de control, con las rutas nuevas", () => {
    const { plans } = organizarPorTamano(planes());
    assert.equal(plans[0]!.folder, `${CARPETA_CONTROL}/${JUAN}`);
    assert.equal(
      plans[0]!.files[0]!.manifestLine,
      `Foto impresa | Brillo | 10x15 | 2 | 10x15 Brillo/${JUAN}/2x IMG_1.jpg`
    );
  });

  it("suma copias por tamaño y por cliente para el laboratorio", () => {
    const { resumen } = organizarPorTamano(planes());
    assert.equal(resumen.name, NOMBRE_RESUMEN);
    assert.match(resumen.content, /10x15 Brillo: 5 copias \(2 fotos\)/);
    assert.match(resumen.content, new RegExp(`   ${ANA}: 3 copias \\(1 fotos\\)`));
    assert.match(resumen.content, /15x21 Mate: 1 copias \(1 fotos\)/);
    assert.match(resumen.content, /TOTAL: 6 copias \(3 fotos\)/);
  });

  it("sin separar clientes: todas las copias del tamaño juntas, con el número de pedido delante", () => {
    const { plans, resumen } = organizarPorTamano(planes(), { separarClientes: false });
    const rutas = plans.flatMap((p) => p.files.map((f) => f.zipPath));
    assert.deepEqual(rutas, [
      "10x15 Brillo/123 2x IMG_1.jpg",
      "15x21 Mate/123 1x IMG_2.jpg",
      "Foto grupal/123 Diseno 12.pdf",
      "10x15 Brillo/45 3x DSC_9.jpg",
    ]);
    // El control por cliente sigue estando, y el resumen sigue diciendo de quién es cada pedido.
    assert.equal(plans[1]!.folder, `${CARPETA_CONTROL}/${ANA}`);
    assert.match(resumen.content, new RegExp(`   ${ANA}: 3 copias`));
    assert.match(resumen.content, /cada archivo empieza con el número de pedido/);
  });

  it("el ZIP sale con esas carpetas y abre sano", async () => {
    const { plans, resumen } = organizarPorTamano(planes());
    const leer = async (key: string) => (key === "fotos/IMG_2.jpg" ? null : Buffer.from(`bytes de ${key}`));
    const res = streamPrintExportZip(plans, "prueba", [resumen], leer);
    const dir = mkdtempSync(path.join(tmpdir(), "zip-por-tamano-"));
    const zip = path.join(dir, "prueba.zip");
    writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
    execFileSync("unzip", ["-tq", zip]);
    const entradas = execFileSync("unzip", ["-Z1", zip], { encoding: "utf8" }).trim().split("\n").sort();
    assert.deepEqual(entradas, [
      `10x15 Brillo/${ANA}/3x DSC_9.jpg`,
      `10x15 Brillo/${JUAN}/2x IMG_1.jpg`,
      `${CARPETA_CONTROL}/${ANA}/AVISO.txt`,
      `${CARPETA_CONTROL}/${ANA}/MANIFEST.txt`,
      `${CARPETA_CONTROL}/${ANA}/RESUMEN_PEDIDO.pdf`,
      `${CARPETA_CONTROL}/${JUAN}/MANIFEST.txt`,
      `${CARPETA_CONTROL}/${JUAN}/RESUMEN_PEDIDO.pdf`,
      `Foto grupal/${JUAN}/Diseno 12.pdf`,
      NOMBRE_RESUMEN,
    ].sort());
    const manifest = execFileSync("unzip", ["-p", zip, `${CARPETA_CONTROL}/${JUAN}/MANIFEST.txt`], { encoding: "utf8" });
    assert.match(manifest, /15x21 \| 1 \| \(FALTA ARCHIVO\)/);
  });
});
