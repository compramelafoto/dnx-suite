/**
 * ZIP de varios pedidos ordenado para el laboratorio: primero por tamaño y acabado, y
 * adentro una carpeta por cliente. Así el laboratorio imprime juntas todas las 10x15 brillo
 * sin abrir pedido por pedido, y el fotógrafo igual sabe de quién es cada copia.
 *
 *   15x21 cm - MATE - Foto impresa/Pedido-Album-003888 - Juan Perez/2 Copias - 15x21 cm - IMG_1.jpg
 *   Foto grupal/Pedido-Album-003888 - Juan Perez/Diseno 12.pdf          (diseños: por producto)
 *   Control por cliente/Pedido-Album-003888 - Juan Perez/MANIFEST.txt   (+ resumen PDF y avisos)
 *   RESUMEN_PARA_LABORATORIO.txt                                         (copias por tamaño)
 *
 * Sólo cambia dónde va cada archivo; qué archivos entran lo siguen decidiendo los planes.
 */

import type { PrintExportPlan } from "./stream-print-export-zip";

export const CARPETA_CONTROL = "Control por cliente";
export const NOMBRE_RESUMEN = "RESUMEN_PARA_LABORATORIO.txt";

function carpetaDeTamano(i: { tamano: string; acabado: string; producto: string }): string {
  return `${i.tamano} - ${i.acabado} - ${i.producto}`;
}

const porNombre = (a: string, b: string) => a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });

export function organizarPorTamano(plans: PrintExportPlan[]): {
  plans: PrintExportPlan[];
  resumen: { name: string; content: string };
} {
  // grupo → cliente → { fotos, copias }
  const conteo = new Map<string, Map<string, { fotos: number; copias: number }>>();

  const reorganizados = plans.map((plan) => {
    const prefijo = `${plan.folder}/`;
    const files = plan.files.map((file) => {
      const relativa = file.zipPath.startsWith(prefijo) ? file.zipPath.slice(prefijo.length) : file.zipPath;
      const partes = relativa.split("/");
      let zipPath: string;
      if (file.impresion) {
        const grupo = carpetaDeTamano(file.impresion);
        zipPath = `${grupo}/${plan.folder}/${partes[partes.length - 1]}`;
        const clientes = conteo.get(grupo) ?? new Map();
        const fila = clientes.get(plan.folder) ?? { fotos: 0, copias: 0 };
        fila.fotos += 1;
        fila.copias += file.impresion.copias;
        clientes.set(plan.folder, fila);
        conteo.set(grupo, clientes);
      } else if (partes.length > 1) {
        // Diseños (PDF y caras): la primera carpeta es el producto.
        zipPath = `${partes[0]}/${plan.folder}/${partes.slice(1).join("/")}`;
      } else {
        zipPath = `Otros/${plan.folder}/${relativa}`;
      }
      return {
        ...file,
        zipPath,
        manifestLine: file.manifestLine.split(file.zipPath).join(zipPath),
      };
    });
    return { ...plan, folder: `${CARPETA_CONTROL}/${plan.folder}`, files };
  });

  const lineas = [
    `Resumen para el laboratorio - ${plans.length} pedido${plans.length === 1 ? "" : "s"}`,
    "",
    "Cada carpeta es un tamaño y acabado; adentro hay una carpeta por cliente.",
    "Si falta algún archivo, figura como (FALTA ARCHIVO) en el MANIFEST del cliente,",
    `dentro de "${CARPETA_CONTROL}".`,
    "",
  ];
  let totalFotos = 0;
  let totalCopias = 0;
  for (const grupo of [...conteo.keys()].sort(porNombre)) {
    const clientes = conteo.get(grupo)!;
    let fotos = 0;
    let copias = 0;
    for (const fila of clientes.values()) {
      fotos += fila.fotos;
      copias += fila.copias;
    }
    totalFotos += fotos;
    totalCopias += copias;
    lineas.push(`${grupo}: ${copias} copias (${fotos} fotos)`);
    for (const cliente of [...clientes.keys()].sort(porNombre)) {
      const fila = clientes.get(cliente)!;
      lineas.push(`   ${cliente}: ${fila.copias} copias (${fila.fotos} fotos)`);
    }
    lineas.push("");
  }
  lineas.push(`TOTAL: ${totalCopias} copias (${totalFotos} fotos)`);

  return { plans: reorganizados, resumen: { name: NOMBRE_RESUMEN, content: lineas.join("\n") } };
}
